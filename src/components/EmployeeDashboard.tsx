'use client'

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Project, Task, Reminder, Flag, TaskPriority, EmployeePerformance, DailyEntry } from '../types';
import Sidebar, { TabType } from './Sidebar';
import { formatHoursMinutes } from './BadgeUtils';
import { hoursToHHMM, parseTimeInput, MAX_DAILY_HOURS } from '@/lib/timeFormat';
import TaskModal from './TaskModal';
import NotificationCenter from './NotificationCenter';
import EmployeeProfile from './EmployeeProfile';
import {
  CheckCircle2,
  Clock,
  Flag as FlagIcon,
  Plus,
  Bell,
  AlertCircle,
  Send,
  Calendar,
  Check,
  ShieldCheck,
  BarChart3,
  FileText,
  User,
  ListTodo,
  Save,
  CheckSquare,
  History,
  CalendarCheck,
  AlertTriangle,
  RotateCcw,
  Trash2,
  Briefcase,
  Layers,
  Filter,
  Info,
  Edit3,
  Sparkles
} from 'lucide-react';
import { groupItemsByProject, orderMainTasksFirst } from '@/lib/taskHierarchy';

type CategoryType = 'URGENT' | 'LESS_URGENT' | 'LOW_URGENT' | 'SELF_DEFINED' | 'DAILY_TASK';

interface CategoryConfig {
  id: CategoryType;
  label: string;
  dbPriority: TaskPriority;
  bgColor: string;
  hoverColor: string;
  activeRing: string;
  textColor: string;
}

const CATEGORIES: CategoryConfig[] = [
  {
    id: 'URGENT',
    label: 'Urgent',
    dbPriority: 'Urgent',
    bgColor: '#DC2626',
    hoverColor: '#B91C1C',
    activeRing: 'ring-[#DC2626]',
    textColor: '#FFFFFF'
  },
  {
    id: 'LESS_URGENT',
    label: 'Less Urgent',
    dbPriority: 'Medium',
    bgColor: '#F59E0B',
    hoverColor: '#D97706',
    activeRing: 'ring-[#F59E0B]',
    textColor: '#FFFFFF'
  },
  {
    id: 'LOW_URGENT',
    label: 'Low Urgent',
    dbPriority: 'Low',
    bgColor: '#7C3AED',
    hoverColor: '#6D28D9',
    activeRing: 'ring-[#7C3AED]',
    textColor: '#FFFFFF'
  },
  {
    id: 'SELF_DEFINED',
    label: 'Self Defined',
    dbPriority: 'Self',
    bgColor: '#6366F1',
    hoverColor: '#4F46E5',
    activeRing: 'ring-[#6366F1]',
    textColor: '#FFFFFF'
  },
  {
    id: 'DAILY_TASK',
    label: 'Daily Task',
    dbPriority: 'Daily',
    bgColor: '#16A34A',
    hoverColor: '#15803D',
    activeRing: 'ring-[#16A34A]',
    textColor: '#FFFFFF'
  }
];

interface DisplayTaskItem {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  description: string;
  category: CategoryType;
  parentTaskId?: string;
}

interface BoardTask {
  boardId: string;
  taskId: string;
  projectId: string;
  projectName: string;
  taskTitle: string;
  details: string;
  actionTaken: string;
  date: string;
  hours: number;
  hoursInput?: string;
  flagged?: boolean | null;
  flagComment: string;
  concernedPersonId: string;
  concernedPersonName: string;
  workDone: number; // 10-100%
  status: '' | 'In Progress' | 'Completed';
  urgency: 'URGENT' | 'LESS URGENT' | 'LOW URGENT' | 'SELF DEFINED' | 'DAILY TASK';
  parentTaskId?: string;
  parentTaskTitle?: string;
  dueDate?: string;
  estimatedHours?: number;
}

interface BoardBlock {
  key: string;
  taskId: string;
  projectId: string;
  projectName: string;
  taskTitle: string;
  details: string;
  urgency?: BoardTask['urgency'];
  item?: BoardTask;
  history: DailyEntry[];
}

const BOARD_HISTORY_ROWS = 3;

const formatBoardDate = (dateStr: string) => {
  const d = new Date(`${String(dateStr).substring(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  const month = d.toLocaleDateString('en-GB', { month: 'short' });
  const weekday = d.toLocaleDateString('en-GB', { weekday: 'short' });
  return `${d.getDate()} ${month} - ${weekday}`;
};

const EmployeeDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [activeCategory, setActiveCategory] = useState<CategoryType>('DAILY_TASK');
  const [fetchError, setFetchError] = useState<boolean>(false);
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [openingTasks, setOpeningTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [performance, setPerformance] = useState<EmployeePerformance | null>(null);
  const [dailyHistory, setDailyHistory] = useState<DailyEntry[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Self Defined Task Modal State
  const [isSelfModalOpen, setIsSelfModalOpen] = useState<boolean>(false);
  const [selfProject, setSelfProject] = useState<string>('Office Work');
  const [selfTaskTitle, setSelfTaskTitle] = useState<string>('');
  const [selfTaskDescription, setSelfTaskDescription] = useState<string>('');
  const [selfModalError, setSelfModalError] = useState<string>('');
  const [isSavingSelfTask, setIsSavingSelfTask] = useState<boolean>(false);

  // Add Daily Work Modal State
  const [isDailyWorkModalOpen, setIsDailyWorkModalOpen] = useState<boolean>(false);
  const [dailyWorkProjectId, setDailyWorkProjectId] = useState<string>('');
  const [dailyWorkTask, setDailyWorkTask] = useState<string>('');
  const [dailyWorkDescription, setDailyWorkDescription] = useState<string>('');
  const [dailyWorkActionTaken, setDailyWorkActionTaken] = useState<string>('');
  const [dailyWorkHours, setDailyWorkHours] = useState<string>('01:00');
  const [dailyWorkError, setDailyWorkError] = useState<string>('');

  // Daily Entry Task Board State
  const [dailyBoard, setDailyBoard] = useState<BoardTask[]>([]);
  const dismissedBoardTaskIds = useRef<Set<string>>(new Set());
  const submittedTodayTaskIds = useRef<Set<string>>(new Set());
  
  // Validation Errors state per board item ID
  const [fieldErrors, setFieldErrors] = useState<Record<string, { actionTaken?: string; hours?: string; flagged?: string; flagComment?: string; status?: string }>>({});
  const [boardGlobalError, setBoardGlobalError] = useState<string | null>(null);

  // Task Removal Confirmation Modal State
  const [removeTargetId, setRemoveTargetId] = useState<string | null>(null);

  // Urgency Filter for Assigned Tasks
  const [urgencyFilter, setUrgencyFilter] = useState<string>('ALL');

  // Reports Filter State
  const [reportDateFilter, setReportDateFilter] = useState<string>('');
  const [reportProjectFilter, setReportProjectFilter] = useState<string>('ALL');
  const [reportFlaggedFilter, setReportFlaggedFilter] = useState<string>('ALL');

  // Completed History Sub-Tab
  const [completedHistorySubTab, setCompletedHistorySubTab] = useState<'daily' | 'tasks'>('daily');

  // Reminder & Flag Reply states
  const [reminderReplies, setReminderReplies] = useState<Record<string, string>>({});
  const [flagReplies, setFlagReplies] = useState<Record<string, string>>({});

  // Add Reminder Modal State
  const [isAddReminderModalOpen, setIsAddReminderModalOpen] = useState<boolean>(false);
  const [newReminderTitle, setNewReminderTitle] = useState<string>('');
  const [newReminderTaskId, setNewReminderTaskId] = useState<string>('');
  const [newReminderError, setNewReminderError] = useState<string>('');
  const [isSavingReminder, setIsSavingReminder] = useState<boolean>(false);

  // Today's date in Asia/Kolkata timezone YYYY-MM-DD
  const getKolkataDateString = () => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  };

  const todayDateStr = getKolkataDateString();

  // Performance Tab View State ('daily' | 'weekly' | 'monthly' | 'custom')
  const [perfTab, setPerfTab] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('daily');
  const [perfStartDate, setPerfStartDate] = useState<string>(todayDateStr);
  const [perfEndDate, setPerfEndDate] = useState<string>(todayDateStr);
  const perfStartDateRef = useRef(perfStartDate);
  const perfEndDateRef = useRef(perfEndDate);
  const perfRequestIdRef = useRef(0);

  useEffect(() => {
    perfStartDateRef.current = perfStartDate;
    perfEndDateRef.current = perfEndDate;
  }, [perfStartDate, perfEndDate]);

  const normalizeDateRange = (start: string, end: string) => (
    start <= end ? { start, end } : { start: end, end: start }
  );

  const getWeekBounds = (dateStr: string) => {
    const [yr, mo, dy] = dateStr.split('-').map(Number);
    const d = new Date(Date.UTC(yr, mo - 1, dy));
    const day = d.getUTCDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    return {
      start: monday.toISOString().substring(0, 10),
      end: sunday.toISOString().substring(0, 10)
    };
  };

  const getMonthBounds = (dateStr: string) => {
    const [yr, mo] = dateStr.split('-').map(Number);
    const last = new Date(Date.UTC(yr, mo, 0)).getUTCDate();
    return {
      start: `${yr}-${String(mo).padStart(2, '0')}-01`,
      end: `${yr}-${String(mo).padStart(2, '0')}-${String(last).padStart(2, '0')}`
    };
  };

  const handleApplyPerfDateRange = async (start: string, end: string) => {
    const range = normalizeDateRange(start, end);
    const requestId = ++perfRequestIdRef.current;
    try {
      const res = await fetch(`/api/performance?startDate=${encodeURIComponent(range.start)}&endDate=${encodeURIComponent(range.end)}`);
      if (requestId !== perfRequestIdRef.current) return;
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          setPerformance(data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch performance for date range:', err);
    }
  };

  const applyPerfView = (tab: 'daily' | 'weekly' | 'monthly' | 'custom', start: string, end: string) => {
    const range = normalizeDateRange(start, end);
    perfStartDateRef.current = range.start;
    perfEndDateRef.current = range.end;
    setPerfTab(tab);
    setPerfStartDate(range.start);
    setPerfEndDate(range.end);
    handleApplyPerfDateRange(range.start, range.end);
  };

  const formatPerformanceDate = (dateStr: string) => {
    try {
      return new Intl.DateTimeFormat('en-IN', {
        timeZone: 'UTC',
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }).format(new Date(`${dateStr}T00:00:00Z`));
    } catch {
      return dateStr;
    }
  };

  const formatPerformanceRange = (start: string, end: string) => {
    const fmt = (dateStr: string) => {
      try {
        return new Intl.DateTimeFormat('en-IN', {
          timeZone: 'UTC',
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }).format(new Date(`${dateStr}T00:00:00Z`));
      } catch {
        return dateStr;
      }
    };
    return `${fmt(start)} – ${fmt(end)}`;
  };

  const formatPerformanceMonth = (dateStr: string) => {
    try {
      return new Intl.DateTimeFormat('en-IN', {
        timeZone: 'UTC',
        month: 'long',
        year: 'numeric'
      }).format(new Date(`${dateStr}T00:00:00Z`));
    } catch {
      return dateStr;
    }
  };

  const renderDirectorMarking = (marking: number | null | undefined) => {
    const value = Number(marking);
    if (marking === null || marking === undefined || Number.isNaN(value) || value < 1 || value > 5) {
      return <span className="text-slate-400 font-semibold">Not Rated</span>;
    }
    return (
      <span className="font-black text-amber-950">
        {value} <span className="text-xs font-bold">/ 5</span>
      </span>
    );
  };

  const getRowTaskMarkings = (row: {
    tasks?: string[];
    taskMarkings?: Array<{ title: string; marking: number | null }>;
  }) => {
    if (row.taskMarkings && row.taskMarkings.length > 0) {
      return row.taskMarkings;
    }
    return (row.tasks || []).map(title => ({ title, marking: null as number | null }));
  };

  const selectedPerfMetrics = performance?.custom;
  const dayWiseRows = (selectedPerfMetrics?.dayWise || []).filter(row =>
    (row.tasks && row.tasks.length > 0) || (Number(row.workHours) || 0) > 0
  );
  const selectedPeriodLabel = perfTab === 'daily'
    ? formatPerformanceDate(perfStartDate)
    : perfTab === 'weekly'
      ? `Weekly Performance: ${formatPerformanceRange(perfStartDate, perfEndDate)}`
      : perfTab === 'monthly'
        ? formatPerformanceMonth(perfStartDate)
        : formatPerformanceRange(perfStartDate, perfEndDate);
  const selectedPeriodHeading = perfTab === 'daily'
    ? 'DAILY PERFORMANCE'
    : perfTab === 'weekly'
      ? 'WEEKLY PERFORMANCE'
      : perfTab === 'monthly'
        ? 'MONTHLY PERFORMANCE'
        : 'SELECTED PERIOD PERFORMANCE';

  const todayFormattedText = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(new Date());

  const fetchData = async (isInitial = false) => {
    const perfRequestId = ++perfRequestIdRef.current;
    try {
      if (isInitial) {
        setLoading(true);
      }
      const [tasksRes, openingTasksRes, projectsRes, remindersRes, flagsRes, perfRes, historyRes] = await Promise.all([
        fetch('/api/tasks'),
        fetch('/api/tasks?view=employee-opening'),
        fetch('/api/projects'),
        fetch('/api/reminders'),
        fetch('/api/flags'),
        fetch(`/api/performance?startDate=${encodeURIComponent(perfStartDateRef.current)}&endDate=${encodeURIComponent(perfEndDateRef.current)}`),
        fetch('/api/daily-entries')
      ]);

      if (tasksRes.ok) {
        const tasksData = await tasksRes.json();
        setTasks(tasksData);
      }

      if (!tasksRes.ok || !openingTasksRes.ok) {
        throw new Error(`Unable to load assigned tasks (HTTP ${tasksRes.status}/${openingTasksRes.status}).`);
      }

      setOpeningTasks(await openingTasksRes.json());
      setFetchError(false);

      if (projectsRes.ok) {
        const projData = await projectsRes.json();
        setProjects(projData);
      }

      if (remindersRes.ok) {
        const remData = await remindersRes.json();
        setReminders(remData);
      }

      if (flagsRes.ok) {
        const flagData = await flagsRes.json();
        setFlags(flagData);
      }

      if (perfRes.ok) {
        const perfData = await perfRes.json();
        if (perfRequestId === perfRequestIdRef.current && perfData && perfData.length > 0) {
          setPerformance(perfData[0]);
        }
      }

      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setDailyHistory(historyData);
      }
    } catch (err) {
      console.error('Error fetching employee dashboard data:', err);
      setFetchError(true);
    } finally {
      if (isInitial) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchData(true);
    const interval = setInterval(() => fetchData(false), 10000);
    return () => clearInterval(interval);
  }, []);

  const showToast = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  // Map Task Priority to Urgency Category
  const getUrgencyFromPriority = (priority: TaskPriority): BoardTask['urgency'] => {
    if (priority === 'Urgent') return 'URGENT';
    if (priority === 'Medium') return 'LESS URGENT';
    if (priority === 'Low') return 'LOW URGENT';
    if (priority === 'Daily') return 'DAILY TASK';
    return 'SELF DEFINED';
  };

  const taskToBoardItem = (taskItem: {
    taskId: string;
    projectId: string;
    projectName: string;
    taskTitle: string;
    details: string;
    urgency?: BoardTask['urgency'];
    parentTaskId?: string;
    parentTaskTitle?: string;
    dueDate?: string;
    estimatedHours?: number;
  }): BoardTask => ({
    boardId: taskItem.taskId && taskItem.taskId !== 'OFFICE_WORK' ? `assigned_${taskItem.taskId}` : `board_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    taskId: taskItem.taskId,
    projectId: taskItem.projectId,
    projectName: taskItem.projectName,
    taskTitle: taskItem.taskTitle,
    details: taskItem.details,
    actionTaken: '',
    date: todayDateStr,
    hours: 0,
    flagged: false,
    flagComment: '',
    concernedPersonId: '',
    concernedPersonName: '',
    workDone: 50,
    status: 'In Progress',
    urgency: taskItem.urgency || 'SELF DEFINED',
    parentTaskId: taskItem.parentTaskId,
    parentTaskTitle: taskItem.parentTaskTitle,
    dueDate: taskItem.dueDate ? String(taskItem.dueDate).substring(0, 10) : undefined,
    estimatedHours: taskItem.estimatedHours
  });

  useEffect(() => {
    const submittedIds = new Set(
      dailyHistory
        .filter(entry => entry.date === todayDateStr)
        .map(entry => entry.taskId)
    );

    setDailyBoard(prev => {
      const existingIds = new Set(prev.map(item => item.taskId));
      const additions: BoardTask[] = [];
      for (const task of openingTasks) {
        const taskId = task.id || task._id || '';
        if (!taskId || task.status === 'Completed') continue;
        if (submittedIds.has(taskId) || existingIds.has(taskId)) continue;
        if (dismissedBoardTaskIds.current.has(taskId)) continue;
        if (submittedTodayTaskIds.current.has(taskId)) continue;
        additions.push(taskToBoardItem({
          taskId,
          projectId: task.projectId,
          projectName: task.projectName || 'Project',
          taskTitle: task.title,
          details: task.description || '',
          urgency: getUrgencyFromPriority(task.priority),
          parentTaskId: task.parentTaskId,
          parentTaskTitle: task.parentTaskTitle,
          dueDate: task.dueDate || task.reminderDate,
          estimatedHours: task.estimatedHours
        }));
      }
      return additions.length === 0 ? prev : [...prev, ...additions];
    });
  }, [openingTasks, dailyHistory, todayDateStr]);

  // Keep board cards in sync when the Director renames a task or project.
  useEffect(() => {
    const latestById = new Map([...openingTasks, ...tasks].map(task => [String(task.id || task._id || ''), task]));
    setDailyBoard(prev => {
      let changed = false;
      const next = prev.map(item => {
        const latest = latestById.get(String(item.taskId));
        if (!latest) return item;
        const projectName = latest.projectName || item.projectName;
        if (
          item.taskTitle === latest.title &&
          item.projectId === latest.projectId &&
          item.projectName === projectName &&
          item.parentTaskTitle === latest.parentTaskTitle
        ) return item;
        changed = true;
        return {
          ...item,
          taskTitle: latest.title,
          projectId: latest.projectId,
          projectName,
          parentTaskTitle: latest.parentTaskTitle
        };
      });
      return changed ? next : prev;
    });
  }, [tasks, openingTasks]);

  // Add Task to Daily Board
  const handleAddToDailyBoard = (taskItem: {
    taskId: string;
    projectId: string;
    projectName: string;
    taskTitle: string;
    details: string;
    urgency?: BoardTask['urgency'];
    parentTaskId?: string;
    parentTaskTitle?: string;
    dueDate?: string;
    estimatedHours?: number;
  }) => {
    const alreadyExists = dailyBoard.some(b => b.taskId === taskItem.taskId && b.taskTitle === taskItem.taskTitle) ||
      dailyHistory.some(entry =>
        entry.date === todayDateStr &&
        entry.taskId === taskItem.taskId &&
        entry.taskTitle === taskItem.taskTitle
      );
    if (alreadyExists) {
      showToast('error', `Task "${taskItem.taskTitle}" is already in your Daily Entry Task Board.`);
      return;
    }

    dismissedBoardTaskIds.current.delete(taskItem.taskId);
    setDailyBoard(prev => [...prev, taskToBoardItem(taskItem)]);
    showToast('success', `Added "${taskItem.taskTitle}" to Daily Entry Task Board.`);
  };

  // Add Category Task to Daily Board
  const handleAddCategoryTaskToDailyBoard = (taskItem: DisplayTaskItem) => {
    const urgencyLabelMap: Record<CategoryType, BoardTask['urgency']> = {
      URGENT: 'URGENT',
      LESS_URGENT: 'LESS URGENT',
      LOW_URGENT: 'LOW URGENT',
      SELF_DEFINED: 'SELF DEFINED',
      DAILY_TASK: 'DAILY TASK'
    };

    const alreadyExists = dailyBoard.some(b => b.taskId === taskItem.id) ||
      dailyHistory.some(entry => entry.taskId === taskItem.id && entry.date === todayDateStr);
    if (alreadyExists) {
      showToast('error', `Task is already added to Daily Entry.`);
      return;
    }

    const sourceTask = openingTasks.find(task => (task.id || task._id) === taskItem.id);
    const newBoardItem: BoardTask = {
      boardId: `assigned_${taskItem.id}`,
      taskId: taskItem.id,
      projectId: taskItem.projectId,
      projectName: taskItem.projectName,
      taskTitle: taskItem.title,
      details: taskItem.description !== 'No description available' ? taskItem.description : '',
      actionTaken: '',
      date: todayDateStr,
      hours: 0,
      flagged: false,
      flagComment: '',
      concernedPersonId: '',
      concernedPersonName: '',
      workDone: 50,
      status: 'In Progress',
      urgency: urgencyLabelMap[taskItem.category],
      parentTaskId: sourceTask?.parentTaskId,
      parentTaskTitle: sourceTask?.parentTaskTitle,
      dueDate: sourceTask?.dueDate || sourceTask?.reminderDate,
      estimatedHours: sourceTask?.estimatedHours
    };

    dismissedBoardTaskIds.current.delete(taskItem.id);
    setDailyBoard(prev => [...prev, newBoardItem]);
    if (taskItem.category === 'DAILY_TASK') {
      showToast('success', "Daily task added to Daily Entry Chart successfully.");
    } else {
      showToast('success', "Task added to Daily Entry Chart successfully.");
    }
  };

  const renderDescription = (text: string) => {
    if (!text || text.trim() === '' || text === 'No description available') {
      return <span className="text-[#64748B] italic text-xs">No description available</span>;
    }

    const items = text.split(/,|\n/).map(s => s.trim()).filter(Boolean);
    if (items.length > 1) {
      return (
        <ul className="space-y-1 text-xs text-[#64748B]">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-1.5">
              <span className="text-[#2563EB] font-bold">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );
    }

    return <span className="text-xs text-[#64748B]">{text}</span>;
  };

  // Remove Task from Board
  const confirmRemoveBoardItem = () => {
    if (!removeTargetId) return;
    const removed = dailyBoard.find(item => item.boardId === removeTargetId);
    if (removed?.taskId && removed.taskId !== 'OFFICE_WORK') {
      dismissedBoardTaskIds.current.add(removed.taskId);
    }
    setDailyBoard(prev => prev.filter(item => item.boardId !== removeTargetId));
    setFieldErrors(prev => {
      const copy = { ...prev };
      delete copy[removeTargetId];
      return copy;
    });
    setRemoveTargetId(null);
    showToast('success', 'Task removed from Daily Entry Task Board.');
  };

  // Create Reminder Handler
  const handleSaveReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewReminderError('');

    const titleClean = newReminderTitle.trim();
    if (!titleClean) {
      setNewReminderError('Please enter reminder details/title');
      return;
    }

    setIsSavingReminder(true);
    try {
      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: titleClean,
          message: titleClean,
          taskId: newReminderTaskId || undefined,
          reminderDate: todayDateStr
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setNewReminderError(data.error || 'Failed to create reminder');
        return;
      }

      setIsAddReminderModalOpen(false);
      setNewReminderTitle('');
      setNewReminderTaskId('');
      showToast('success', 'Reminder created successfully.');
      await fetchData(false);
    } catch (err) {
      setNewReminderError('Network error while creating reminder');
    } finally {
      setIsSavingReminder(false);
    }
  };

  // Save Self Created Daily Work Entry
  const handleSaveDailyWork = (e: React.FormEvent) => {
    e.preventDefault();
    setDailyWorkError('');

    if (!dailyWorkProjectId) {
      setDailyWorkError('Please select a Project Name.');
      return;
    }
    if (!dailyWorkTask || !dailyWorkTask.trim()) {
      setDailyWorkError('Please enter a Task.');
      return;
    }
    if (!dailyWorkDescription || !dailyWorkDescription.trim()) {
      setDailyWorkError('Please enter a Description.');
      return;
    }
    if (!dailyWorkActionTaken || !dailyWorkActionTaken.trim()) {
      setDailyWorkError('Please enter Action Taken.');
      return;
    }

    const parsedHours = parseTimeInput(dailyWorkHours);
    if (!parsedHours.ok) {
      setDailyWorkError(parsedHours.error);
      return;
    }
    const hours = parsedHours.hours;

    const taskTitle = dailyWorkTask.trim();
    const alreadyExists = dailyBoard.some(item =>
      item.taskId === 'OFFICE_WORK' && item.taskTitle === taskTitle
    ) || dailyHistory.some(entry =>
      entry.date === todayDateStr &&
      entry.taskId === 'OFFICE_WORK' &&
      entry.taskTitle === taskTitle
    );
    if (alreadyExists) {
      setDailyWorkError("This task is already in today's Daily Entry.");
      return;
    }

    const selectedProj = projects.find(p => (p.id || p._id) === dailyWorkProjectId);
    const projName = selectedProj ? selectedProj.projectName : 'Project';
    const newBoardItem: BoardTask = {
      boardId: `board_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      taskId: 'OFFICE_WORK',
      projectId: dailyWorkProjectId,
      projectName: projName,
      taskTitle,
      details: dailyWorkDescription.trim(),
      actionTaken: dailyWorkActionTaken.trim(),
      date: todayDateStr,
      hours,
      flagged: false,
      flagComment: '',
      concernedPersonId: '',
      concernedPersonName: '',
      workDone: 0,
      status: 'In Progress',
      urgency: 'SELF DEFINED'
    };

    setDailyBoard(prev => [newBoardItem, ...prev]);
    showToast('success', 'Daily work added to your Daily Entry Task Board.');
    setDailyWorkProjectId('');
    setDailyWorkTask('');
    setDailyWorkDescription('');
    setDailyWorkActionTaken('');
    setDailyWorkHours('01:00');
    setIsDailyWorkModalOpen(false);
  };

  // Dynamic Hours Calculations
  const todayEntries = dailyHistory.filter(entry => entry.date === todayDateStr);
  const savedTodayHours = todayEntries.reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0);
  const allocatedHours = savedTodayHours + dailyBoard.reduce((sum, item) => sum + (Number(item.hours) || 0), 0);
  const freeHours = Math.max(0, MAX_DAILY_HOURS - allocatedHours);
  const overtimeHours = Math.max(0, allocatedHours - MAX_DAILY_HOURS);
  const progressPercent = Math.min(100, Math.round((allocatedHours / MAX_DAILY_HOURS) * 100));

  // Daily Board Form Field Changes
  const updateBoardItem = (boardId: string, updates: Partial<BoardTask>) => {
    setDailyBoard(prev => prev.map(item => {
      if (item.boardId === boardId) {
        return { ...item, ...updates };
      }
      return item;
    }));

    // Clear field error on edit
    setFieldErrors(prev => {
      if (!prev[boardId]) return prev;
      const copy = { ...prev };
      if (updates.actionTaken !== undefined) delete copy[boardId]?.actionTaken;
      if (updates.hours !== undefined) delete copy[boardId]?.hours;
      if (updates.flagged !== undefined) delete copy[boardId]?.flagged;
      if (updates.flagComment !== undefined) delete copy[boardId]?.flagComment;
      if (updates.status !== undefined) delete copy[boardId]?.status;
      return copy;
    });
    setBoardGlobalError(null);
  };

  // Submit Daily Entry Validation & Action (Page 3 Submit Validation)
  const handleSubmitDailyBoard = async () => {
    setBoardGlobalError(null);

    if (dailyBoard.length === 0) {
      setBoardGlobalError('Your Daily Entry Task Board is empty. Add at least one task to submit today\'s entry.');
      return;
    }

    // Perform complete Page 3 validation
    const newErrors: Record<string, { actionTaken?: string; hours?: string; flagged?: string; flagComment?: string; status?: string }> = {};
    let hasValidationFailure = false;
    let missingFieldMsg = '';

    for (const item of dailyBoard) {
      const itemErr: { actionTaken?: string; hours?: string; flagged?: string; flagComment?: string; status?: string } = {};

      if (!item.actionTaken || !item.actionTaken.trim()) {
        itemErr.actionTaken = 'Please enter Action Taken.';
        if (!missingFieldMsg) missingFieldMsg = 'Please enter Action Taken before submitting.';
        hasValidationFailure = true;
      }

      const hoursSource = item.hoursInput !== undefined ? item.hoursInput : item.hours;
      const parsedHours = parseTimeInput(hoursSource);
      if (!parsedHours.ok) {
        itemErr.hours = hoursSource === '' || hoursSource === undefined || hoursSource === 0
          ? 'Please enter Hours before submitting.'
          : parsedHours.error;
        if (!missingFieldMsg) missingFieldMsg = itemErr.hours;
        hasValidationFailure = true;
      } else {
        item.hours = parsedHours.hours;
      }

      if (item.flagged === undefined || item.flagged === null) {
        itemErr.flagged = 'Please select Flag before submitting.';
        if (!missingFieldMsg) missingFieldMsg = 'Please select Flag before submitting.';
        hasValidationFailure = true;
      }

      if (item.status !== 'In Progress' && item.status !== 'Completed') {
        itemErr.status = 'Please select task status before submitting.';
        if (!missingFieldMsg) missingFieldMsg = 'Please select task status before submitting.';
        hasValidationFailure = true;
      }

      if (Object.keys(itemErr).length > 0) {
        newErrors[item.boardId] = itemErr;
      }
    }

    if (hasValidationFailure) {
      setFieldErrors(newErrors);
      showToast('error', missingFieldMsg || 'Please complete all required fields (Action Taken, Hours, Flag) before submitting.');
      return;
    }

    // Submit API
    try {
      setSubmitting(true);
      const res = await fetch('/api/daily-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dailyBoard.map(b => ({
          taskId: b.taskId,
          projectId: b.projectId,
          projectName: b.projectName,
          taskTitle: b.taskTitle,
          details: b.details,
          actionTaken: b.actionTaken,
          date: b.date,
          hours: b.hours,
          flagged: b.flagged,
          flagComment: b.flagComment,
          concernedPersonId: b.concernedPersonId,
          concernedPersonName: b.concernedPersonName,
          workDone: b.workDone,
          status: b.status
        })))
      });

      const data = await res.json();
      if (!res.ok) {
        showToast('error', data.error || 'Unable to submit daily entry. Please try again.');
        setBoardGlobalError(data.error || 'Unable to submit daily entry. Please try again.');
        return;
      }

      showToast('success', 'Daily entry submitted successfully.');
      dailyBoard.forEach(item => {
        if (item.taskId) submittedTodayTaskIds.current.add(item.taskId);
      });
      setDailyBoard([]);
      setFieldErrors({});
      await fetchData(false);
    } catch (err) {
      showToast('error', 'Network error. Failed to submit daily entry.');
    } finally {
      setSubmitting(false);
    }
  };

  // Reply to Reminder
  const handleReplyReminder = async (reminderId: string) => {
    const replyText = reminderReplies[reminderId];
    if (!replyText || !replyText.trim()) {
      showToast('error', 'Please enter a reply for the reminder.');
      return;
    }

    try {
      const res = await fetch(`/api/reminders/${reminderId}/reply`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: replyText })
      });

      if (!res.ok) {
        const data = await res.json();
        showToast('error', data.error || 'Failed to reply to reminder');
        return;
      }

      showToast('success', 'Reminder reply submitted.');
      setReminderReplies(prev => ({ ...prev, [reminderId]: '' }));
      fetchData();
    } catch (err) {
      showToast('error', 'Network error.');
    }
  };

  const handleCloseReminder = async (reminderId: string) => {
    try {
      const res = await fetch(`/api/reminders/${reminderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'Closed',
          response: reminderReplies[reminderId] || undefined
        })
      });
      if (!res.ok) {
        const data = await res.json();
        showToast('error', data.error || 'Failed to close reminder');
        return;
      }
      showToast('success', 'Reminder marked as closed.');
      setReminderReplies(prev => ({ ...prev, [reminderId]: '' }));
      fetchData(false);
    } catch (err) {
      showToast('error', 'Network error.');
    }
  };

  // Reply to Flag
  const handleReplyFlag = async (flagId: string) => {
    const replyText = flagReplies[flagId];
    if (!replyText || !replyText.trim()) {
      showToast('error', 'Please enter a reply for the flag.');
      return;
    }

    try {
      const res = await fetch(`/api/flags/${flagId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: replyText })
      });

      if (!res.ok) {
        const data = await res.json();
        showToast('error', data.error || 'Failed to reply to flag');
        return;
      }

      showToast('success', 'Flag reply submitted to management.');
      setFlagReplies(prev => ({ ...prev, [flagId]: '' }));
      fetchData();
    } catch (err) {
      showToast('error', 'Network error.');
    }
  };

  // Save Self Task
  const handleSaveSelfTask = async (taskData: any) => {
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create self task');
      }

      showToast('success', 'Self-assigned task created successfully.');
      fetchData();
    } catch (err: any) {
      throw err;
    }
  };

  // Save Employee Self Defined Task (Modal)
  const handleSaveSelfDefinedTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setSelfModalError('');

    if (!selfTaskTitle.trim()) {
      setSelfModalError('Task name is required.');
      return;
    }

    if (!selfTaskDescription.trim()) {
      setSelfModalError('Description is required.');
      return;
    }

    let targetProjectId = '';
    const trimmedProj = (selfProject || '').trim();
    if (trimmedProj && projects.length > 0) {
      const match = projects.find(p => p.projectName.toLowerCase() === trimmedProj.toLowerCase());
      if (match) {
        targetProjectId = match.id || match._id || '';
      }
    }
    if (!targetProjectId && projects.length > 0) {
      targetProjectId = projects[0].id || projects[0]._id || '';
    }

    if (!targetProjectId) {
      setSelfModalError('No active project found to save task under.');
      return;
    }

    setIsSavingSelfTask(true);
    try {
      const userId = user?.id || (user as any)?._id || '';
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: selfTaskTitle.trim(),
          description: selfTaskDescription.trim(),
          projectId: targetProjectId,
          priority: 'Self',
          assignedEmployeeIds: [userId]
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save self-defined task.');
      }

      showToast('success', 'Self-defined task created successfully.');
      setIsSelfModalOpen(false);
      setSelfTaskTitle('');
      setSelfTaskDescription('');
      setSelfProject('Office Work');
      fetchData();
    } catch (err: any) {
      setSelfModalError(err.message || 'An error occurred while saving task.');
    } finally {
      setIsSavingSelfTask(false);
    }
  };

  const activeReminders = reminders.filter(r => r.status === 'Pending' || r.status === 'Not Replied');
  const activeFlags = flags.filter(f => f.status === 'Open');

  // Filtered Daily History for Reports
  const filteredDailyHistory = dailyHistory.filter(entry => {
    if (reportDateFilter && entry.date !== reportDateFilter) return false;
    if (reportProjectFilter !== 'ALL' && entry.projectId !== reportProjectFilter) return false;
    if (reportFlaggedFilter === 'FLAGGED' && !entry.flagged) return false;
    if (reportFlaggedFilter === 'UNFLAGGED' && entry.flagged) return false;
    return true;
  });

  const totalReportHours = filteredDailyHistory.reduce((sum, e) => sum + (e.hours || 0), 0);

  // Helper to map DB priority to CategoryType
  const mapPriorityToCategory = (p: TaskPriority | string): CategoryType => {
    const norm = (p || '').toLowerCase();
    if (norm.includes('urgent') && !norm.includes('less') && !norm.includes('low') && !norm.includes('upcoming')) return 'URGENT';
    if (norm.includes('medium') || norm.includes('less')) return 'LESS_URGENT';
    if (norm.includes('low')) return 'LOW_URGENT';
    if (norm.includes('self')) return 'SELF_DEFINED';
    return 'DAILY_TASK';
  };

  const currentCategoryConfig = CATEGORIES.find(c => c.id === activeCategory) || CATEGORIES[4];

  const matchingDbTasks: DisplayTaskItem[] = openingTasks
    .filter(t => t.status !== 'Completed')
    .filter(t => Boolean(t.id || t._id))
    .filter(t => mapPriorityToCategory(t.priority) === activeCategory)
    .map(t => ({
      id: t.id || t._id || '',
      projectId: t.projectId || 'GENERAL',
      projectName: t.projectName || 'Project',
      title: t.title,
      description: t.description || 'No description available',
      category: activeCategory,
      parentTaskId: t.parentTaskId
    }));

  const combinedCategoryTasks = matchingDbTasks;
  const availableAssignedTasks = openingTasks
    .filter(task => task.status !== 'Completed')
    .filter(task => urgencyFilter === 'ALL' || getUrgencyFromPriority(task.priority) === urgencyFilter);
  const groupedCategoryTasks = groupItemsByProject(
    orderMainTasksFirst(combinedCategoryTasks, t => t.id, t => t.parentTaskId)
  );
  const groupedAssignedTasks = groupItemsByProject(
    availableAssignedTasks.map(t => ({
      ...t,
      projectId: t.projectId,
      projectName: t.projectName || 'Project'
    }))
  );
  const groupedEmployeeTasks = groupItemsByProject(
    tasks.map(t => ({
      ...t,
      projectId: t.projectId,
      projectName: t.projectName || 'Project'
    }))
  );

  const entryMatchesTask = (entry: DailyEntry, taskId: string, taskTitle: string, projectId: string) =>
    taskId && taskId !== 'OFFICE_WORK'
      ? entry.taskId === taskId
      : entry.taskTitle === taskTitle && String(entry.projectId) === String(projectId);

  const taskEntryHistory = (taskId: string, taskTitle: string, projectId: string) =>
    dailyHistory
      .filter(entry => entryMatchesTask(entry, taskId, taskTitle, projectId))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .slice(-BOARD_HISTORY_ROWS);

  const submittedOnlyBlocks: BoardBlock[] = [];
  for (const entry of todayEntries) {
    const onBoard = dailyBoard.some(item => entryMatchesTask(entry, item.taskId, item.taskTitle, item.projectId));
    const alreadyListed = submittedOnlyBlocks.some(block => entryMatchesTask(entry, block.taskId, block.taskTitle, block.projectId));
    if (onBoard || alreadyListed) continue;
    submittedOnlyBlocks.push({
      key: `submitted_${entry.id || entry._id || entry.taskId}`,
      taskId: entry.taskId,
      projectId: entry.projectId,
      projectName: entry.projectName || 'Project',
      taskTitle: entry.taskTitle,
      details: entry.details || '',
      history: taskEntryHistory(entry.taskId, entry.taskTitle, entry.projectId)
    });
  }

  const boardBlocks: BoardBlock[] = [
    ...dailyBoard.map(item => ({
      key: item.boardId,
      taskId: item.taskId,
      projectId: item.projectId,
      projectName: item.projectName,
      taskTitle: item.taskTitle,
      details: item.details,
      urgency: item.urgency,
      item,
      history: taskEntryHistory(item.taskId, item.taskTitle, item.projectId)
    })),
    ...submittedOnlyBlocks
  ];
  const boardBlockGroups = groupItemsByProject(
    orderMainTasksFirst(boardBlocks, block => block.taskId, block => block.item?.parentTaskId)
  );

  const renderBoardBlock = (block: BoardBlock) => {
    const item = block.item;
    const errs = item ? fieldErrors[item.boardId] : undefined;
    const isFlagged = item?.flagged === true;
    const rowCount = block.history.length + (item ? 1 : 0);
    if (rowCount === 0) return null;

    const rowBg = (index: number) => (index % 2 === 0 ? 'bg-[#E9EBF5]' : 'bg-[#CFD5EA]');

    const taskCell = (
      <td rowSpan={rowCount} className="align-top pl-6 pr-3 py-2 bg-[#CFD5EA] border border-white">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-black leading-snug break-words">
              <span className="mr-1.5">-</span>{block.taskTitle}
            </p>
            {block.details && block.details.trim().toLowerCase() !== block.taskTitle.trim().toLowerCase() && (
              <p className="pl-3 text-[13px] text-slate-700 leading-snug whitespace-pre-line break-words">{block.details}</p>
            )}
            {block.urgency && (
              <span className={`inline-block mt-1 px-1.5 py-px text-[9px] font-bold tracking-wide rounded whitespace-nowrap ${
                block.urgency === 'URGENT' ? 'bg-red-100 text-red-800' :
                block.urgency === 'LESS URGENT' ? 'bg-amber-100 text-amber-800' :
                block.urgency === 'LOW URGENT' ? 'bg-purple-100 text-purple-800' :
                block.urgency === 'DAILY TASK' ? 'bg-emerald-100 text-emerald-800' :
                'bg-indigo-100 text-indigo-800'
              }`}>
                {block.urgency}
              </span>
            )}
          </div>
          {item && (
            <button
              onClick={() => setRemoveTargetId(item.boardId)}
              className="p-1 text-slate-500 hover:text-rose-600 hover:bg-white/60 rounded transition cursor-pointer flex-shrink-0"
              title="Remove task from daily board"
              aria-label={`Remove ${item.taskTitle} from daily board`}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </td>
    );

    const rows = block.history.map((entry, index) => (
      <tr key={`${block.key}-h-${entry.id || entry._id || index}`} className={rowBg(index)}>
        {index === 0 && taskCell}
        <td className="px-3 py-2 border border-white text-sm text-black align-top break-words">
          {entry.actionTaken || '—'}
        </td>
        <td className="px-3 py-2 border border-white text-sm text-black align-top whitespace-nowrap">
          {formatBoardDate(entry.date)}
        </td>
        <td className="px-2 py-2 border border-white text-center align-top">
          {entry.flagged && (
            <span className="inline-block px-2 py-0.5 bg-[#ED7D31] border border-[#4472C4] text-white text-[10px] font-semibold">
              Flag
            </span>
          )}
        </td>
        <td className="px-3 py-2 border border-white text-center text-sm font-semibold text-[#0070C0] align-top">
          {formatHoursMinutes(entry.hours)}
        </td>
      </tr>
    ));

    if (item) {
      rows.push(
        <tr key={`${block.key}-today`} className={rowBg(block.history.length)}>
          {block.history.length === 0 && taskCell}
          <td className="px-3 py-2 border border-white align-top">
            <textarea
              rows={2}
              value={item.actionTaken}
              onChange={(e) => updateBoardItem(item.boardId, { actionTaken: e.target.value })}
              placeholder="Action taken"
              className={`w-full resize-y px-2 py-1 text-sm text-black placeholder:text-black/60 border focus:outline-none focus:ring-2 ${
                errs?.actionTaken
                  ? 'bg-rose-100 border-rose-500 focus:ring-rose-500'
                  : 'bg-[#00B050] border-[#00B050] focus:ring-emerald-900'
              }`}
            />
            {errs?.actionTaken && (
              <p className="text-[11px] font-bold text-rose-600 mt-0.5">{errs.actionTaken}</p>
            )}
            {isFlagged && (
              <textarea
                rows={2}
                value={item.flagComment}
                onChange={(e) => updateBoardItem(item.boardId, { flagComment: e.target.value })}
                placeholder="Reason for flag / blocker..."
                className="mt-1 w-full px-2 py-1 text-xs border border-[#ED7D31] bg-orange-50 text-orange-950 focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            )}
            <label className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={item.status === 'Completed'}
                onChange={(e) => updateBoardItem(item.boardId, e.target.checked
                  ? { status: 'Completed', workDone: 100 }
                  : { status: 'In Progress', workDone: item.workDone === 100 ? 50 : item.workDone })}
                className="h-3.5 w-3.5 accent-[#00B050]"
              />
              Mark task completed
            </label>
          </td>
          <td className="px-3 py-2 border border-white align-top">
            <span className="inline-block px-1.5 py-0.5 bg-[#00B050] text-sm text-black whitespace-nowrap">
              {formatBoardDate(item.date)}
            </span>
          </td>
          <td className="px-2 py-2 border border-white text-center align-top">
            <button
              type="button"
              onClick={() => updateBoardItem(item.boardId, isFlagged
                ? { flagged: false, flagComment: '', concernedPersonId: '', concernedPersonName: '' }
                : { flagged: true })}
              className={`px-2 py-0.5 text-[10px] font-semibold text-white border transition cursor-pointer ${
                isFlagged
                  ? 'bg-[#C55A11] border-red-700 ring-2 ring-red-500'
                  : 'bg-[#ED7D31] border-[#4472C4] hover:bg-[#C55A11]'
              }`}
              title={isFlagged ? 'Remove flag' : 'Flag this task'}
              aria-pressed={isFlagged}
            >
              Flag
            </button>
          </td>
          <td className="px-3 py-2 border border-white text-center align-top">
            <input
              type="text"
              inputMode="numeric"
              placeholder="Hours"
              value={item.hoursInput !== undefined ? item.hoursInput : (item.hours ? hoursToHHMM(item.hours) : '')}
              onChange={(e) => {
                const val = e.target.value;
                const parsed = parseTimeInput(val);
                updateBoardItem(item.boardId, {
                  hours: parsed.ok ? parsed.hours : 0,
                  hoursInput: val
                });
              }}
              className={`w-20 px-1.5 py-1 text-sm font-bold text-center text-black placeholder:text-black/60 border focus:outline-none focus:ring-2 ${
                errs?.hours
                  ? 'bg-rose-100 border-rose-500 focus:ring-rose-500'
                  : 'bg-[#00B050] border-[#00B050] focus:ring-emerald-900'
              }`}
            />
            {errs?.hours && (
              <p className="text-[11px] font-bold text-rose-600 mt-0.5">{errs.hours}</p>
            )}
          </td>
        </tr>
      );
    }

    return rows;
  };

  return (
    <div className="flex bg-[#F8FAFC] min-h-screen font-sans text-slate-900">
      {/* Sidebar Navigation */}
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        reminderCount={activeReminders.length}
        flagCount={activeFlags.length}
      />

      {/* Main Content Viewport */}
      <div className="flex-1 min-w-0 w-full pt-20 px-4 pb-12 md:pt-8 md:px-6 lg:px-8 md:ml-64">
        <div className="mx-auto w-full max-w-[1600px] min-w-0">

        {/* UPDATE 2 — Header with Dynamic Logged-in Employee Name */}
        <header className="flex flex-col xl:flex-row xl:items-center justify-between mb-6 gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <img
              src="/logo.png"
              alt="Korals Design Logo"
              className="h-11 w-auto object-contain bg-black px-2 py-1 rounded-xl border border-slate-200 shadow-xs hidden sm:block flex-shrink-0"
            />
            <div className="w-11 h-11 rounded-xl bg-indigo-900 text-white flex items-center justify-center font-black text-lg shadow-md flex-shrink-0">
              {user?.name?.charAt(0) || 'E'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-[#172554] tracking-tight">
                  Employee Dashboard
                </h1>
                <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Online
                </span>
              </div>
              <p className="text-sm font-bold text-indigo-600 mt-0.5 truncate">
                Welcome, {user?.name || 'Employee'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap min-w-0">
            <NotificationCenter onSelectTask={() => setActiveTab('today-work')} />

            <div className="flex items-center gap-2 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 whitespace-nowrap">
              <Calendar size={15} className="text-indigo-600 flex-shrink-0" />
              <span>{todayFormattedText}</span>
            </div>

            <div className="flex items-center gap-2.5 px-3.5 py-2 bg-indigo-50 border border-indigo-200 rounded-xl min-w-0 max-w-full">
              <div className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                {user?.name?.charAt(0) || 'E'}
              </div>
              <div className="text-left min-w-0">
                <p className="text-xs font-bold text-indigo-950 leading-tight truncate">{user?.name || 'Employee'}</p>
                <p className="text-[10px] font-semibold text-indigo-600 truncate">{user?.email || 'Employee'}</p>
              </div>
            </div>

            <button
              onClick={logout}
              className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-rose-700 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-xl transition cursor-pointer"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Global Toast Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-xl flex items-center justify-between text-sm font-semibold shadow-sm border ${
            message.type === 'success' 
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300' 
              : 'bg-rose-50 text-rose-900 border-rose-300'
          }`}>
            <div className="flex items-center gap-2">
              {message.type === 'success' ? <CheckCircle2 size={18} className="text-emerald-600" /> : <AlertCircle size={18} className="text-rose-600" />}
              <span>{message.text}</span>
            </div>
            <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-600 font-bold">&times;</button>
          </div>
        )}

        {/* TAB 1: OVERVIEW — EMPLOYEE DASHBOARD OPENING PAGE */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            
            {/* UPDATE 2 — PAGE TITLE & DYNAMIC WELCOME BANNER */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E2E8F0] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight">
                  Employee Dashboard
                </h1>
                <h2 className="text-lg font-bold text-[#2563EB] mt-1">
                  Welcome back, <span className="text-[#0F172A]">{user?.name || 'Employee'}</span>
                </h2>
                <p className="text-xs font-medium text-[#64748B] mt-0.5">
                  Select a task category to view and add tasks to your Daily Entry Board
                </p>
              </div>

              <div className="flex items-center gap-3 bg-[#F8FAFC] border border-[#E2E8F0] px-4 py-3 rounded-xl flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-[#2563EB] text-white font-bold text-sm flex items-center justify-center flex-shrink-0 shadow-xs">
                  {user?.name?.charAt(0) || 'E'}
                </div>
                <div>
                  <p className="text-xs font-extrabold text-[#0F172A]">{user?.name || 'Loading employee...'}</p>
                  <p className="text-[11px] font-semibold text-[#64748B]">{user?.email || 'Employee Portal'}</p>
                </div>
              </div>
            </div>

            {/* Task categories */}
            <div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
                {CATEGORIES.map((cat) => {
                  const isActive = activeCategory === cat.id;

                  return (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      style={{
                        backgroundColor: cat.bgColor,
                        color: cat.textColor
                      }}
                      className={`h-[54px] px-5 rounded-xl font-semibold text-[15px] shadow-xs transition-all duration-200 flex items-center justify-center gap-2.5 relative overflow-hidden group cursor-pointer ${
                        isActive
                          ? 'ring-4 ring-offset-2 ring-slate-900/20 scale-[1.02] shadow-md border-2 border-white'
                          : 'hover:brightness-90 opacity-95 hover:opacity-100'
                      }`}
                    >
                      <span className="flex items-center justify-center">
                        {cat.id === 'URGENT' && <AlertTriangle size={18} className="text-white" />}
                        {cat.id === 'LESS_URGENT' && <Clock size={18} className="text-white" />}
                        {cat.id === 'LOW_URGENT' && <Sparkles size={18} className="text-white" />}
                        {cat.id === 'SELF_DEFINED' && <Edit3 size={18} className="text-white" />}
                        {cat.id === 'DAILY_TASK' && <CalendarCheck size={18} className="text-white" />}
                      </span>
                      <span className="truncate tracking-wide font-semibold">{cat.label}</span>
                      {isActive && (
                        <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* MAIN TASK CARD CONTAINER */}
            <div className="mt-8">
              <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-6 space-y-6">
                
                {/* CARD HEADER / CATEGORY TITLE */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E2E8F0]">
                  <div>
                    <h2 className="text-lg font-bold text-[#0F172A]">
                      Task List &bull; {
                        activeCategory === 'URGENT' ? 'Urgent Tasks' :
                        activeCategory === 'LESS_URGENT' ? 'Less Urgent Tasks' :
                        activeCategory === 'LOW_URGENT' ? 'Low Urgent Tasks' :
                        activeCategory === 'SELF_DEFINED' ? 'Self Defined Tasks' :
                        'Daily Tasks'
                      }
                    </h2>
                    <p className="text-xs font-semibold text-[#64748B] mt-0.5">
                      {
                        activeCategory === 'DAILY_TASK'
                          ? 'Daily tasks assigned to you by the Director.'
                          : `Showing: ${currentCategoryConfig.label} Tasks`
                      }
                    </p>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap self-start sm:self-auto">
                    {activeCategory === 'SELF_DEFINED' && (
                      <button
                        onClick={() => {
                          setSelfModalError('');
                          setIsSelfModalOpen(true);
                        }}
                        className="px-4 py-2 bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus size={15} />
                        <span>+ Add Self Defined Task</span>
                      </button>
                    )}

                    <span className="px-3.5 py-1 text-xs font-bold rounded-full bg-blue-50 text-[#2563EB] border border-blue-200">
                      {
                        activeCategory === 'URGENT' ? 'Urgent Tasks' :
                        activeCategory === 'LESS_URGENT' ? 'Less Urgent Tasks' :
                        activeCategory === 'LOW_URGENT' ? 'Low Urgent Tasks' :
                        activeCategory === 'SELF_DEFINED' ? 'Self Defined Tasks' :
                        'Daily Tasks'
                      } ({combinedCategoryTasks.length})
                    </span>
                  </div>
                </div>

                {/* EXACT 4-COLUMN PROJECT / TASK / DESCRIPTION / ACTION TABLE */}
                {loading ? (
                  /* LOADING SKELETON */
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="animate-pulse flex items-center gap-4 py-3">
                        <div className="h-5 bg-slate-200 rounded w-[20%]" />
                        <div className="h-5 bg-slate-200 rounded w-[28%]" />
                        <div className="h-5 bg-slate-200 rounded w-[32%]" />
                        <div className="h-9 bg-slate-200 rounded-lg w-[20%]" />
                      </div>
                    ))}
                  </div>
                ) : fetchError ? (
                  /* ERROR STATE */
                  <div className="p-8 text-center space-y-3">
                    <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
                    <h3 className="text-base font-bold text-[#0F172A]">Unable to load Daily Tasks</h3>
                    <p className="text-xs text-[#64748B]">Please try again.</p>
                    <button
                      onClick={() => fetchData(true)}
                      className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
                    >
                      Retry
                    </button>
                  </div>
                ) : combinedCategoryTasks.length === 0 ? (
                  /* EMPTY STATE */
                  <div className="py-12 text-center space-y-3">
                    <ListTodo className="w-12 h-12 text-slate-300 mx-auto" />
                    <p className="text-xs text-[#64748B]">
                      {
                        activeCategory === 'URGENT' ? 'No urgent tasks assigned.' :
                        activeCategory === 'LESS_URGENT' ? 'No less urgent tasks assigned.' :
                        activeCategory === 'LOW_URGENT' ? 'No low urgent tasks assigned.' :
                        activeCategory === 'SELF_DEFINED' ? 'No self-defined tasks added yet.' :
                        'No daily tasks assigned.'
                      }
                    </p>
                    {activeCategory === 'SELF_DEFINED' && (
                      <button
                        onClick={() => {
                          setSelfModalError('');
                          setIsSelfModalOpen(true);
                        }}
                        className="mt-2 px-4 py-2.5 bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-bold rounded-xl shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus size={16} />
                        <span>+ Add Self Defined Task</span>
                      </button>
                    )}
                  </div>
                ) : (
                  /* EXACT 4-COLUMN TABLE */
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[700px]">
                      <thead>
                        <tr className="bg-[#F8FAFC] text-[#0F172A] text-xs font-extrabold uppercase tracking-wider border-b border-[#E2E8F0]">
                          <th className="py-3.5 px-4 w-[40%]">Project / Task</th>
                          <th className="py-3.5 px-4 w-[38%]">Description</th>
                          <th className="py-3.5 px-4 w-[22%] text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0] text-sm text-[#0F172A]">
                        {groupedCategoryTasks.map(group => (
                          <React.Fragment key={`category-group-${group.projectId}`}>
                          <tr className="bg-[#F1F5F9]">
                            <td colSpan={3} className="py-2.5 px-4 font-bold text-[#0F172A]">
                              {group.projectName}
                            </td>
                          </tr>
                          {group.items.map(t => {
                          const isAdded = dailyBoard.some(b => b.taskId === t.id) ||
                            dailyHistory.some(entry => entry.taskId === t.id && entry.date === todayDateStr);

                          return (
                            <tr key={t.id} className="hover:bg-[#F8FAFC] transition-colors">
                              {/* TASK */}
                              <td className="py-3 pl-8 pr-4 font-semibold align-top text-[#0F172A] break-words">
                                <span className="text-slate-400 mr-1.5">-</span>{t.title}
                              </td>

                              {/* DESCRIPTION */}
                              <td className="py-3 px-4 align-top break-words">
                                {renderDescription(t.description)}
                              </td>

                              {/* ACTION */}
                              <td className="py-3 px-4 text-center align-top">
                                <button
                                  disabled={isAdded}
                                  onClick={() => handleAddCategoryTaskToDailyBoard(t)}
                                  className={`w-full py-2.5 px-3 rounded-[10px] text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                    isAdded
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-not-allowed'
                                      : 'bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-xs'
                                  }`}
                                >
                                  {isAdded ? (
                                    <>
                                      <Check size={14} />
                                      <span>✓ Added</span>
                                    </>
                                  ) : (
                                    <>
                                      <Plus size={14} />
                                      <span>Add to Daily Entry</span>
                                    </>
                                  )}
                                </button>
                              </td>
                            </tr>
                          );
                          })}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: DAILY ENTRY TASK BOARD (Page 2 & Page 3) */}
        {activeTab === 'today-work' && (
          <div className="space-y-6 min-w-0">
            
            {/* Daily Entry Task Board */}
            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-200 space-y-3 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-[#E00000]">Employee Dashboard</h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      setDailyWorkError('');
                      if (projects.length > 0) {
                        setDailyWorkProjectId(projects[0].id || projects[0]._id || '');
                      }
                      setIsDailyWorkModalOpen(true);
                    }}
                    className="px-3 py-2 bg-white hover:bg-slate-50 text-[#4472C4] border border-[#4472C4] text-xs font-semibold transition inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Add Daily Work</span>
                  </button>
                  <button
                    disabled={submitting}
                    onClick={handleSubmitDailyBoard}
                    className={`min-w-[150px] px-8 py-2.5 text-base text-white border transition cursor-pointer ${
                      submitting
                        ? 'bg-slate-400 border-slate-400 cursor-not-allowed'
                        : 'bg-[#ED7D31] border-[#C55A11] hover:bg-[#C55A11]'
                    }`}
                  >
                    {submitting ? 'Submitting...' : 'Submit'}
                  </button>
                </div>
              </div>

              {/* Global Error Banner */}
              {boardGlobalError && (
                <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl text-xs font-bold text-rose-800 flex items-center gap-2">
                  <AlertCircle size={18} className="text-rose-600 flex-shrink-0" />
                  <span>{boardGlobalError}</span>
                </div>
              )}

              {boardBlocks.length === 0 ? (
                /* Empty State */
                <div className="text-center py-16 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                  <ListTodo size={42} className="mx-auto text-slate-300 mb-3" />
                  <h3 className="text-base font-bold text-slate-800">No tasks added to today&apos;s Daily Entry.</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Assigned project tasks appear here automatically. Use Add Daily Work to add other work.
                  </p>
                </div>
              ) : (
                <div className="w-full max-w-full overflow-x-auto">
                  <table className="w-full min-w-[860px] table-fixed text-left border-collapse">
                    <colgroup>
                      <col className="w-[28%]" />
                      <col className="w-[30%]" />
                      <col className="w-[15%]" />
                      <col className="w-[7%]" />
                      <col className="w-[20%]" />
                    </colgroup>
                    <thead>
                      <tr className="bg-[#4472C4] text-white">
                        <th colSpan={4} className="px-3 py-2 text-center text-base font-bold border border-white">
                          Daily Entry Task Board
                        </th>
                        <th className="px-3 py-1.5 text-center font-bold border border-white">
                          <span className="block text-base">Free Hours</span>
                          <span className="inline-block mt-0.5 px-1.5 bg-[#D9D9D9] text-[#548235] text-sm font-bold">
                            (8 - Today&apos;s Hours) {formatHoursMinutes(freeHours)}
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {boardBlockGroups.map(group => (
                        <React.Fragment key={`board-project-${group.projectId}`}>
                          <tr className="bg-[#B4C6E7]">
                            <td colSpan={5} className="px-3 py-1.5 text-[15px] font-bold text-black border border-white">
                              {group.projectName}
                            </td>
                          </tr>
                          {group.items.map(block => (
                            <React.Fragment key={block.key}>
                              {renderBoardBlock(block)}
                            </React.Fragment>
                          ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB 3: MY TASKS OVERVIEW */}
        {activeTab === 'tasks' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-200 gap-4">
              <div>
                <h3 className="text-lg font-black text-[#172554]">My Tasks Overview</h3>
                <p className="text-xs text-slate-500">All tasks assigned to you across projects</p>
              </div>
            </div>

            <div className="space-y-6">
              {groupedEmployeeTasks.map(group => (
                <div key={group.projectId} className="space-y-2">
                  <h4 className="text-sm font-bold text-[#172554]">{group.projectName}</h4>
                  <ul className="space-y-1">
                    {group.items.map(t => (
                      <li key={t.id || t._id} className="flex items-start gap-2 text-sm text-slate-800">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#2563EB] flex-shrink-0" />
                        <span className="flex-1">{t.title}</span>
                        <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-slate-100 text-slate-700">{t.status}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: REPORTS VIEW */}
        {activeTab === 'reports' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-200 gap-4">
              <div>
                <h3 className="text-lg font-black text-[#172554]">Employee Daily Reports</h3>
                <p className="text-xs text-slate-500">Comprehensive historical log of submitted daily task entries</p>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-3 flex-wrap">
                <input
                  type="date"
                  value={reportDateFilter}
                  onChange={(e) => setReportDateFilter(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
                />

                <select
                  value={reportProjectFilter}
                  onChange={(e) => setReportProjectFilter(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
                >
                  <option value="ALL">All Projects</option>
                  {projects.map(p => (
                    <option key={p.id || p._id} value={p.id || p._id}>{p.projectName}</option>
                  ))}
                </select>

                <select
                  value={reportFlaggedFilter}
                  onChange={(e) => setReportFlaggedFilter(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
                >
                  <option value="ALL">All Flags</option>
                  <option value="FLAGGED">Flagged Only</option>
                  <option value="UNFLAGGED">Normal Only</option>
                </select>
              </div>
            </div>

            {/* Total Hours Summary */}
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-center justify-between text-xs text-indigo-950 font-bold">
              <span>Total Entries Found: {filteredDailyHistory.length}</span>
              <span>Total Hours Calculated: <span className="text-indigo-600 text-sm font-black">{formatHoursMinutes(totalReportHours)}</span></span>
            </div>

            {filteredDailyHistory.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <FileText size={36} className="mx-auto mb-2 text-slate-300" />
                <p className="text-sm font-bold">No daily report entries found matching filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-extrabold uppercase border-b border-slate-200">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Project</th>
                      <th className="py-3 px-4">Task</th>
                      <th className="py-3 px-4">Action Taken</th>
                      <th className="py-3 px-4">Hours</th>
                      <th className="py-3 px-4">Flag</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredDailyHistory.map(entry => (
                      <tr key={entry.id || entry._id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-bold text-slate-900">{entry.date}</td>
                        <td className="py-3 px-4 font-semibold text-slate-700">{entry.projectName}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{entry.taskTitle}</td>
                        <td className="py-3 px-4 text-slate-600">{entry.actionTaken}</td>
                        <td className="py-3 px-4 font-black text-indigo-600">{formatHoursMinutes(entry.hours)}</td>
                        <td className="py-3 px-4">
                          {entry.flagged ? (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-rose-100 text-rose-800">
                              {entry.flagComment || 'Flagged'}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800">
                            {entry.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: COMPLETED HISTORY */}
        {activeTab === 'completed' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-200 gap-4">
              <div>
                <h3 className="text-lg font-black text-[#172554]">Completed History Archive</h3>
                <p className="text-xs text-slate-500">Submitted daily entry history records and finished tasks</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCompletedHistorySubTab('daily')}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg border transition cursor-pointer ${
                    completedHistorySubTab === 'daily'
                      ? 'bg-[#0F172A] text-white border-[#0F172A] shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  Daily Entries ({dailyHistory.length})
                </button>
                <button
                  onClick={() => setCompletedHistorySubTab('tasks')}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg border transition cursor-pointer ${
                    completedHistorySubTab === 'tasks'
                      ? 'bg-[#0F172A] text-white border-[#0F172A] shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  Completed Tasks ({tasks.filter(t => t.status === 'Completed').length})
                </button>
              </div>
            </div>

            {completedHistorySubTab === 'daily' && (
              dailyHistory.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <CheckCircle2 size={36} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-bold text-slate-700">No daily entry history available.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-extrabold uppercase border-b border-slate-200">
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Project</th>
                        <th className="py-3 px-4">Task</th>
                        <th className="py-3 px-4">Description</th>
                        <th className="py-3 px-4">Action Taken</th>
                        <th className="py-3 px-4 text-center">Hours</th>
                        <th className="py-3 px-4 text-center">Flag</th>
                        <th className="py-3 px-4">Flag Comment</th>
                        <th className="py-3 px-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {dailyHistory.map((entry, index) => (
                        <tr key={entry.id || entry._id || `comp-dh-${index}`} className="hover:bg-slate-50 transition">
                          <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">{entry.date}</td>
                          <td className="py-3 px-4 font-semibold text-slate-700">{entry.projectName}</td>
                          <td className="py-3 px-4 font-bold text-slate-900">{entry.taskTitle}</td>
                          <td className="py-3 px-4 text-slate-600 max-w-xs">{entry.details || '—'}</td>
                          <td className="py-3 px-4 text-slate-600 max-w-xs">{entry.actionTaken}</td>
                          <td className="py-3 px-4 text-center font-black text-indigo-600 whitespace-nowrap">{formatHoursMinutes(entry.hours)}</td>
                          <td className="py-3 px-4 text-center">
                            {entry.flagged ? (
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-rose-100 text-rose-800 border border-rose-300">
                                Yes
                              </span>
                            ) : (
                              <span className="text-slate-400 font-medium">No</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-600 italic">
                            {entry.flagComment || '—'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                              {entry.status || 'Submitted'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {completedHistorySubTab === 'tasks' && (
              tasks.filter(t => t.status === 'Completed').length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <CheckCircle2 size={36} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-bold text-slate-700">No completed task history available.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-extrabold uppercase border-b border-slate-200">
                        <th className="py-3.5 px-4">Project Name</th>
                        <th className="py-3.5 px-4">Task Title</th>
                        <th className="py-3.5 px-4">Employee Name</th>
                        <th className="py-3.5 px-4">Completion Date</th>
                        <th className="py-3.5 px-4 text-center">Completion Status</th>
                        <th className="py-3.5 px-4 text-center">Work Done %</th>
                        <th className="py-3.5 px-4 text-center">Time Spent</th>
                        <th className="py-3.5 px-4">Action Taken</th>
                        <th className="py-3.5 px-4">Role Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-medium">
                      {tasks
                        .filter(t => t.status === 'Completed')
                        .map(t => {
                          const taskIdStr = t.id || t._id;
                          const taskEntries = dailyHistory.filter(e => e.taskId === taskIdStr);
                          const hoursWorked = taskEntries.reduce((acc, e) => acc + (Number(e.hours) || 0), 0);
                          const actionTaken = taskEntries.length > 0 ? taskEntries[0].actionTaken : (t.description || '-');
                          const compDate = t.approvalDate
                            ? new Date(t.approvalDate).toLocaleDateString('en-IN')
                            : (t.updatedAt ? new Date(t.updatedAt).toLocaleDateString('en-IN') : todayDateStr);

                          return (
                            <tr key={taskIdStr} className="hover:bg-slate-50 transition">
                              <td className="py-3.5 px-4 font-bold text-slate-900">{t.projectName}</td>
                              <td className="py-3.5 px-4 font-bold text-indigo-700">{t.title}</td>
                              <td className="py-3.5 px-4 text-slate-600">{user?.name}</td>
                              <td className="py-3.5 px-4 text-slate-600">{compDate}</td>
                              <td className="py-3.5 px-4 text-center">
                                <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800">
                                  Completed
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-center font-black text-emerald-600">
                                100%
                              </td>
                              <td className="py-3.5 px-4 text-center font-black text-indigo-600 whitespace-nowrap">
                                {hoursWorked > 0 ? formatHoursMinutes(hoursWorked) : '-'}
                              </td>
                              <td className="py-3.5 px-4 text-slate-700">{actionTaken}</td>
                              <td className="py-3.5 px-4 text-slate-600 space-y-1">
                                <div><span className="font-bold text-slate-700">Employee Remark:</span> {t.employeeRemark || actionTaken || 'None'}</div>
                                <div><span className="font-bold text-slate-700">Director Remark:</span> {t.directorRemark || t.approvalRemarks || 'None'}</div>
                                <div><span className="font-bold text-slate-700">Project Head Remark:</span> {t.projectHeadRemark || 'None'}</div>
                                <div><span className="font-bold text-slate-700">Status:</span> <span className="font-bold text-emerald-700">{t.status}</span></div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        )}

        {/* TAB 6: REMINDERS */}
        {activeTab === 'reminders' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-4 gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-black text-[#172554]">Daily Reminders</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-black ${
                    reminders.filter(r => r.reminderDate === todayDateStr).length >= 10
                      ? 'bg-rose-100 text-rose-800 border border-rose-300'
                      : 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                  }`}>
                    Reminders {reminders.filter(r => r.reminderDate === todayDateStr).length} / 10
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  Manage personal & task reminders (Up to 10 legitimate reminders per day)
                </p>
              </div>

              <button
                disabled={reminders.filter(r => r.reminderDate === todayDateStr).length >= 10}
                onClick={() => {
                  setNewReminderError('');
                  setIsAddReminderModalOpen(true);
                }}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer ${
                  reminders.filter(r => r.reminderDate === todayDateStr).length >= 10
                    ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                    : 'bg-[#2563EB] hover:bg-[#1D4ED8] text-white'
                }`}
              >
                <Plus size={16} />
                <span>Add Reminder</span>
              </button>
            </div>

            {reminders.filter(r => r.reminderDate === todayDateStr).length >= 10 && (
              <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-xs font-bold text-rose-800 flex items-center gap-2">
                <AlertCircle size={18} className="text-rose-600 flex-shrink-0" />
                <span>Daily reminder limit of 10 reached.</span>
              </div>
            )}

            {reminders.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <Bell size={36} className="mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-bold text-slate-700">No reminders set for today.</p>
                <p className="text-xs text-slate-500 mt-1">Click &quot;Add Reminder&quot; above to create a new reminder entry.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reminders.map(r => {
                  const remId = r.id || r._id || '';
                  const isClosed = r.status === 'Closed' || r.status === 'Completed';
                  return (
                    <div key={remId} className="p-4 border border-slate-200 bg-slate-50/70 rounded-xl text-xs space-y-2 hover:border-slate-300 transition">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-900 text-sm">{r.taskTitle}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-500 font-semibold">{r.reminderDate}</span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isClosed ? 'bg-emerald-100 text-emerald-800' :
                            r.status === 'Replied' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {isClosed ? 'Closed' : r.status}
                          </span>
                        </div>
                      </div>
                      {r.message && <p className="text-slate-600 font-medium">{r.message}</p>}
                      {r.response && <p className="text-slate-700 italic">Follow-up: {r.response}</p>}
                      {!isClosed && (
                        <div className="flex flex-col sm:flex-row gap-2 pt-1">
                          <input
                            type="text"
                            value={reminderReplies[remId] || ''}
                            onChange={(e) => setReminderReplies(prev => ({ ...prev, [remId]: e.target.value }))}
                            placeholder="Enter follow-up notes..."
                            className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                          />
                          <button
                            onClick={() => handleReplyReminder(remId)}
                            className="px-3 py-2 bg-indigo-50 text-indigo-800 font-bold rounded-lg border border-indigo-200"
                          >
                            Save Follow-up
                          </button>
                          <button
                            onClick={() => handleCloseReminder(remId)}
                            className="px-3 py-2 bg-emerald-50 text-emerald-800 font-bold rounded-lg border border-emerald-200"
                          >
                            Mark Closed
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 7: MY PERFORMANCE */}
        {activeTab === 'performance' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-4 border-b border-slate-200 gap-4">
              <div>
                <h3 className="text-lg font-black text-[#172554]">MY PERFORMANCE</h3>
                <p className="text-xs text-slate-500">View actual Daily Entry performance by day, week, month, or custom date range</p>
              </div>

              {/* Calendar Date Range Selector & View Toggles */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-1.5 rounded-xl text-xs">
                  <Calendar size={15} className="text-blue-600 flex-shrink-0 ml-1" />
                  <div className="flex items-center gap-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">From:</label>
                    <input
                      type="date"
                      value={perfStartDate}
                      onChange={(e) => applyPerfView('custom', e.target.value, perfEndDate)}
                      className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">To:</label>
                    <input
                      type="date"
                      value={perfEndDate}
                      onChange={(e) => applyPerfView('custom', perfStartDate, e.target.value)}
                      className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    onClick={() => {
                      const day = perfEndDate || todayDateStr;
                      applyPerfView('daily', day, day);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                      perfTab === 'daily'
                        ? 'bg-[#2563EB] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Daily
                  </button>
                  <button
                    onClick={() => {
                      const week = getWeekBounds(perfEndDate || todayDateStr);
                      applyPerfView('weekly', week.start, week.end);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                      perfTab === 'weekly'
                        ? 'bg-[#2563EB] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Weekly
                  </button>
                  <button
                    onClick={() => {
                      const month = getMonthBounds(perfEndDate || todayDateStr);
                      applyPerfView('monthly', month.start, month.end);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                      perfTab === 'monthly'
                        ? 'bg-[#2563EB] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => applyPerfView('custom', perfStartDate, perfEndDate)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                      perfTab === 'custom'
                        ? 'bg-[#2563EB] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Custom
                  </button>
                </div>
              </div>
            </div>

            {/* Selected Date Range Display Badge */}
            <div className="px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-900 inline-flex items-center gap-2">
              <Calendar size={14} className="text-indigo-600" />
              <span>Viewing Performance Period: <span className="font-extrabold text-indigo-950">{selectedPeriodLabel}</span></span>
            </div>

            {/* Performance Cards */}
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">{selectedPeriodHeading}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-2xl space-y-1">
                  <p className="text-xs font-bold text-blue-700 uppercase tracking-wider">Work Done</p>
                  <p className="text-2xl font-black text-blue-950">
                    {selectedPerfMetrics?.taskCount ?? selectedPerfMetrics?.workDone ?? 0}
                  </p>
                  <p className="text-[11px] text-blue-600 font-medium">
                    {(selectedPerfMetrics?.taskCount ?? 0)} Tasks
                  </p>
                </div>

                <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-1">
                  <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Time Spent (Work Hours)</p>
                  <p className="text-lg font-black text-emerald-950">
                    {formatHoursMinutes(selectedPerfMetrics?.workHours ?? 0)}
                  </p>
                  <p className="text-[11px] text-emerald-600 font-medium">Calculated from daily entries</p>
                </div>

                <div className="p-4 bg-purple-50/60 border border-purple-200 rounded-2xl space-y-1">
                  <p className="text-xs font-bold text-purple-700 uppercase tracking-wider">Free Time</p>
                  <p className="text-lg font-black text-purple-950">
                    {formatHoursMinutes(selectedPerfMetrics?.freeHours ?? 0)}
                  </p>
                  <p className="text-[11px] text-purple-600 font-medium">8 hours minus actual work hours on working days</p>
                </div>

                <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-2xl space-y-1">
                  <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">Marking</p>
                  <p className="text-2xl font-black text-amber-950">
                    {renderDirectorMarking(selectedPerfMetrics?.marking)}
                  </p>
                  <p className="text-[11px] text-amber-600 font-medium">Exact Director rating (Read-only)</p>
                </div>
              </div>
            </div>

            <section className="space-y-3 pt-2">
              <div>
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Day-Wise Performance</h4>
                <p className="text-xs text-slate-500 mt-1">Daily work, hours, free time, and Director marking for the selected period.</p>
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse min-w-[720px]">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 text-[11px] font-extrabold uppercase tracking-wider border-b border-slate-200">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Work Done / Tasks</th>
                      <th className="py-3 px-4 text-right">Work Hours</th>
                      <th className="py-3 px-4 text-right">Free Time</th>
                      <th className="py-3 px-4 text-right">Marking</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {dayWiseRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 px-4 text-center text-slate-400 font-semibold">
                          No performance data available for the selected period.
                        </td>
                      </tr>
                    ) : (
                      dayWiseRows.map(row => {
                        const taskRows = getRowTaskMarkings(row);
                        return (
                        <tr key={row.date} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap align-top">
                            {formatPerformanceDate(row.date)}
                          </td>
                          <td className="py-3 px-4 text-slate-700">
                            <ul className="space-y-0.5">
                              {taskRows.map((task, idx) => (
                                <li key={`${row.date}-${task.title}-${idx}`}>{task.title}</li>
                              ))}
                            </ul>
                          </td>
                          <td className="py-3 px-4 text-right font-black text-emerald-800 whitespace-nowrap align-top">
                            {formatHoursMinutes(row.workHours)}
                          </td>
                          <td className="py-3 px-4 text-right font-black text-purple-800 whitespace-nowrap align-top">
                            {formatHoursMinutes(row.freeHours)}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap align-top">
                            <ul className="space-y-0.5">
                              {taskRows.map((task, idx) => (
                                <li key={`${row.date}-marking-${task.title}-${idx}`}>
                                  {renderDirectorMarking(task.marking)}
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* TAB 8: FLAGS */}
        {activeTab === 'flags' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
            <div className="border-b border-slate-200 pb-4 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black text-[#172554]">All Flags List</h3>
                <p className="text-xs text-slate-500">All flagged tasks recorded across projects</p>
              </div>
              <span className="px-3 py-1 bg-rose-100 text-rose-800 text-xs font-bold rounded-full border border-rose-200">
                Total Flags: {flags.length}
              </span>
            </div>

            {flags.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <FlagIcon size={36} className="mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-bold text-slate-700">No flags recorded.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {flags.map(f => (
                  <div key={f.id || f._id} className="p-4 border border-slate-200 bg-slate-50/60 rounded-xl text-xs space-y-3 hover:border-rose-300 transition">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200 mr-2">
                          {f.projectName || 'Project'}
                        </span>
                        <span className="font-bold text-slate-900 text-sm">{f.taskTitle}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 font-semibold text-[11px]">{f.flagDate}</span>
                        <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full ${
                          f.status === 'Open' ? 'bg-rose-100 text-rose-800 border border-rose-300' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        }`}>
                          {f.status}
                        </span>
                      </div>
                    </div>

                    <div>
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Flag Reason / Details:</p>
                      <p className="text-slate-800 bg-white p-2.5 rounded-lg border border-slate-200 font-medium">{f.flagMessage}</p>
                    {(f.concernedPersonName || f.createdByName) && (
                      <p className="text-[11px] text-slate-600 mt-1">
                        From {f.createdByName || f.employeeName || 'Employee'} → {f.concernedPersonName || 'Unassigned'}
                      </p>
                    )}
                    </div>

                    {f.managementResponse && (
                      <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg text-emerald-900">
                        <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider mb-0.5">Management Response:</p>
                        <p className="font-medium">{f.managementResponse}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 7: PROFILE */}
        {activeTab === 'profile' && <EmployeeProfile />}
        </div>

        {/* Task Removal Confirmation Modal */}
        {removeTargetId && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 border border-slate-200">
              <div className="flex items-center gap-3 text-rose-600">
                <AlertTriangle size={24} />
                <h3 className="text-base font-bold text-slate-900">Remove Task?</h3>
              </div>
              <p className="text-xs text-slate-600">
                Are you sure you want to remove this task from today&apos;s Daily Entry Task Board?
              </p>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setRemoveTargetId(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmRemoveBoardItem}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition cursor-pointer"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Your Daily Work Modal Dialog */}
        {isDailyWorkModalOpen && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-5 border border-slate-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <h3 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
                  <CalendarCheck size={20} className="text-[#2563EB]" />
                  <span>Add Your Daily Work</span>
                </h3>
                <button
                  onClick={() => setIsDailyWorkModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold transition text-xl cursor-pointer"
                >
                  &times;
                </button>
              </div>

              {dailyWorkError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 flex items-center gap-2">
                  <AlertCircle size={16} />
                  <span>{dailyWorkError}</span>
                </div>
              )}

              <form onSubmit={handleSaveDailyWork} className="space-y-4">
                {/* Project Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Project Name *
                  </label>
                  {projects.length === 0 ? (
                    <p className="text-xs text-amber-700 font-semibold bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                      No projects assigned to you.
                    </p>
                  ) : (
                    <select
                      required
                      value={dailyWorkProjectId}
                      onChange={(e) => setDailyWorkProjectId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:bg-white transition"
                    >
                      <option value="">Select Project</option>
                      {projects.map((p) => (
                        <option key={p.id || p._id} value={p.id || p._id}>
                          {p.projectName}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Task */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Task *
                  </label>
                  <input
                    type="text"
                    required
                    value={dailyWorkTask}
                    onChange={(e) => setDailyWorkTask(e.target.value)}
                    placeholder="Enter task title (e.g. Drawing Cleaning & Updating)"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:bg-white transition"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Description *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={dailyWorkDescription}
                    onChange={(e) => setDailyWorkDescription(e.target.value)}
                    placeholder="Describe the work completed (e.g. Updated project drawing per latest client comments)"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:bg-white transition"
                  />
                </div>

                {/* Action Taken */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Action Taken *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={dailyWorkActionTaken}
                    onChange={(e) => setDailyWorkActionTaken(e.target.value)}
                    placeholder="Describe action taken (e.g. Reviewed drawing, corrected dimensions, saved file)"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Hours (HH:MM) *
                  </label>
                  <input
                    type="text"
                    required
                    value={dailyWorkHours}
                    onChange={(e) => setDailyWorkHours(e.target.value)}
                    placeholder="01:30"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:bg-white transition"
                  />
                </div>

                {/* Buttons */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsDailyWorkModalOpen(false)}
                    className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 text-xs font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    Add to Board
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Self Defined Task Modal Dialog */}
        {isSelfModalOpen && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-5 border border-slate-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <h3 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
                  <Edit3 size={20} className="text-[#6366F1]" />
                  <span>Add Self Defined Task</span>
                </h3>
                <button
                  onClick={() => setIsSelfModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold transition text-xl cursor-pointer"
                >
                  &times;
                </button>
              </div>

              {selfModalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 flex items-center gap-2">
                  <AlertCircle size={16} />
                  <span>{selfModalError}</span>
                </div>
              )}

              <form onSubmit={handleSaveSelfDefinedTask} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Project (Optional)
                  </label>
                  <input
                    type="text"
                    value={selfProject}
                    onChange={(e) => setSelfProject(e.target.value)}
                    placeholder="Enter project name"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Task *
                  </label>
                  <input
                    type="text"
                    required
                    value={selfTaskTitle}
                    onChange={(e) => setSelfTaskTitle(e.target.value)}
                    placeholder="What are you working on?"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Description *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={selfTaskDescription}
                    onChange={(e) => setSelfTaskDescription(e.target.value)}
                    placeholder="Describe the work you are doing..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:bg-white transition"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsSelfModalOpen(false)}
                    className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingSelfTask}
                    className="px-5 py-2.5 text-xs font-bold text-white bg-[#6366F1] hover:bg-[#4F46E5] rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    {isSavingSelfTask ? 'Saving...' : 'Save Self Defined Task'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add Reminder Modal Dialog */}
        {isAddReminderModalOpen && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 border border-slate-200">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Bell size={18} className="text-[#2563EB]" />
                  <span>Add Daily Reminder</span>
                </h3>
                <button
                  onClick={() => setIsAddReminderModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold transition text-lg cursor-pointer"
                >
                  &times;
                </button>
              </div>

              {newReminderError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 flex items-center gap-2">
                  <AlertCircle size={16} />
                  <span>{newReminderError}</span>
                </div>
              )}

              <form onSubmit={handleSaveReminder} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Reminder Title / Details *
                  </label>
                  <input
                    type="text"
                    required
                    value={newReminderTitle}
                    onChange={(e) => setNewReminderTitle(e.target.value)}
                    placeholder="Enter reminder details (e.g. Follow up on CAD drawings)"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Related Task (Optional)
                  </label>
                  <select
                    value={newReminderTaskId}
                    onChange={(e) => setNewReminderTaskId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:bg-white transition"
                  >
                    <option value="">General Reminder (No Task)</option>
                    {tasks.map((t) => (
                      <option key={t.id || t._id} value={t.id || t._id}>
                        {t.title} ({t.projectName})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsAddReminderModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingReminder}
                    className="px-5 py-2 text-xs font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-xl shadow-xs transition cursor-pointer disabled:bg-slate-300"
                  >
                    {isSavingReminder ? 'Saving...' : 'Save Reminder'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Task Modal for Self Task Creation */}
        <TaskModal
          isOpen={isTaskModalOpen}
          projects={projects}
          employees={[]}
          onClose={() => setIsTaskModalOpen(false)}
          onSave={handleSaveSelfTask}
        />

      </div>
    </div>
  );
};

export default EmployeeDashboard;
