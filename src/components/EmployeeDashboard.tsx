'use client'

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Project, Task, Reminder, Flag, TaskPriority, EmployeePerformance, DailyEntry, DailyEntryAttachment } from '../types';
import Sidebar, { TabType } from './Sidebar';
import { CodeBadge, formatHoursMinutes } from './BadgeUtils';
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
  Sparkles,
  X
} from 'lucide-react';
import { formatHierarchyCode, groupItemsByProject, orderMainTasksFirst, sortByHierarchyCode, titleRepeatsCode } from '@/lib/taskHierarchy';

type CategoryType = 'URGENT' | 'LESS_URGENT' | 'LOW_URGENT' | 'All' | 'SELF_DEFINED' | 'DAILY_TASK';

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
    bgColor: '#64748B',
    hoverColor: '#475569',
    activeRing: 'ring-[#64748B]',
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
  attachments?: DailyEntryAttachment[];
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

const BOARD_HISTORY_DAYS = 5;
const MAX_DAILY_COMMENT_ATTACHMENT_BYTES = 2 * 1024 * 1024;
const DAILY_COMMENT_ATTACHMENT_TYPES = new Set(['image/png', 'image/jpeg', 'application/pdf', 'text/plain']);

const readDailyCommentAttachment = (file: File, index: number): Promise<DailyEntryAttachment> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error(`Unable to read "${file.name}".`));
        return;
      }
      const separator = reader.result.indexOf(',');
      if (separator < 0) {
        reject(new Error(`Unable to read "${file.name}".`));
        return;
      }
      resolve({
        id: `${Date.now()}-${file.lastModified}-${index}`,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        data: reader.result.slice(separator + 1)
      });
    };
    reader.onerror = () => reject(reader.error || new Error(`Unable to read "${file.name}".`));
    reader.readAsDataURL(file);
  });

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
  const [isSubmittedWorkOpen, setIsSubmittedWorkOpen] = useState(false);
  const [submittedWorkProjectFilter, setSubmittedWorkProjectFilter] = useState('ALL');
  const [submittedWorkTaskFilter, setSubmittedWorkTaskFilter] = useState('ALL');

  // Daily Entry Task Board State
  const [dailyBoard, setDailyBoard] = useState<BoardTask[]>([]);
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
  const [completedHistoryProjectFilter, setCompletedHistoryProjectFilter] = useState('ALL');
  const [completedHistoryEmployeeFilter, setCompletedHistoryEmployeeFilter] = useState('ALL');
  const [completedHistoryTimeFilter, setCompletedHistoryTimeFilter] = useState<'all' | 'date' | 'week' | 'month'>('all');

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

  // Performance data refresh ordering
  const perfRequestIdRef = useRef(0);

  const weeklyPerformanceRows = performance?.weeklyHistory || [];
  const latestPerformanceMark = [...weeklyPerformanceRows]
    .reverse()
    .find(week => week.rating !== null)?.rating ?? null;
  const formatPerformanceHours = (hours: number) => {
    const rounded = Math.round(hours * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  };
  const formatPerformanceMark = (mark: number) => {
    const rounded = Math.round(mark * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  };

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
        fetch('/api/performance'),
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
    attachments: [],
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

  // Tasks stay on the board after submit so the next Action Taken can be typed in the same box.
  const boardStorageKey = user?.id ? `daily_board_${user.id}` : '';
  const boardRestoredKey = useRef('');
  const restoredSubmittedRef = useRef(false);
  const normalizeBoardItem = (item: BoardTask): BoardTask => {
    if (!item || item.date === todayDateStr) return item;
    return {
      ...item,
      date: todayDateStr,
      actionTaken: '',
      hours: 0,
      hoursInput: '',
      flagged: false,
      flagComment: '',
      attachments: [],
      concernedPersonId: '',
      concernedPersonName: ''
    };
  };
  useEffect(() => {
    if (!boardStorageKey || boardRestoredKey.current === boardStorageKey) return;
    boardRestoredKey.current = boardStorageKey;
    restoredSubmittedRef.current = false;
    try {
      const persistent = JSON.parse(window.localStorage.getItem(boardStorageKey) || '[]');
      const legacyKey = `${boardStorageKey}_${todayDateStr}`;
      const legacy = JSON.parse(window.localStorage.getItem(legacyKey) || '[]');
      const saved = [...(Array.isArray(persistent) ? persistent : []), ...(Array.isArray(legacy) ? legacy : [])];
      if (saved.length > 0) {
        setDailyBoard(prev => {
          const existing = new Set(prev.map(item => item.boardId));
          const extra = saved
            .filter((item: BoardTask) => item?.boardId && !existing.has(item.boardId))
            .map(normalizeBoardItem);
          return extra.length ? [...prev, ...extra] : prev;
        });
      }
      window.localStorage.removeItem(legacyKey);
    } catch {
      window.localStorage.removeItem(boardStorageKey);
    }
  }, [boardStorageKey, todayDateStr]);
  useEffect(() => {
    if (!boardStorageKey || boardRestoredKey.current !== boardStorageKey) return;
    if (dailyBoard.length === 0) {
      window.localStorage.removeItem(boardStorageKey);
    } else {
      const persistedBoard = dailyBoard.map(item => {
        const persistedItem = { ...item };
        delete persistedItem.attachments;
        return persistedItem;
      });
      window.localStorage.setItem(boardStorageKey, JSON.stringify(persistedBoard));
    }
  }, [dailyBoard, boardStorageKey]);

  // Drop board items whose task no longer exists (e.g. the Director deleted the task or its project).
  useEffect(() => {
    if (loading || fetchError) return;
    const knownTaskIds = new Set([...openingTasks, ...tasks].map(task => String(task.id || task._id || '')));
    setDailyBoard(prev => {
      const next = prev.filter(item =>
        !/^[a-f\d]{24}$/i.test(String(item.taskId || '')) || knownTaskIds.has(String(item.taskId))
      );
      return next.length === prev.length ? prev : next;
    });
  }, [loading, fetchError, openingTasks, tasks, dailyBoard.length]);

  // After a submit, keep that task on the board so a white Action Taken stays in the same box.
  useEffect(() => {
    if (loading || fetchError || restoredSubmittedRef.current) return;
    if (!boardStorageKey || boardRestoredKey.current !== boardStorageKey) return;
    restoredSubmittedRef.current = true;
    const todaySubmitted = dailyHistory.filter(entry => String(entry.date).substring(0, 10) === todayDateStr);
    if (todaySubmitted.length === 0) return;
    setDailyBoard(prev => {
      const have = new Set(prev.map(item => String(item.taskId)));
      const extras: BoardTask[] = [];
      for (const entry of todaySubmitted) {
        const taskId = String(entry.taskId || '');
        if (!taskId || have.has(taskId) || extras.some(item => String(item.taskId) === taskId)) continue;
        const task = [...openingTasks, ...tasks].find(t => String(t.id || t._id || '') === taskId);
        extras.push(taskToBoardItem({
          taskId,
          projectId: entry.projectId,
          projectName: entry.projectName || task?.projectName || 'Project',
          taskTitle: entry.taskTitle,
          details: entry.details || task?.description || '',
          urgency: task ? getUrgencyFromPriority(task.priority) : 'SELF DEFINED',
          parentTaskId: task?.parentTaskId,
          parentTaskTitle: task?.parentTaskTitle,
          dueDate: task?.dueDate || task?.reminderDate,
          estimatedHours: task?.estimatedHours
        }));
      }
      return extras.length ? [...prev, ...extras] : prev;
    });
  }, [loading, fetchError, dailyHistory, todayDateStr, boardStorageKey, openingTasks, tasks]);

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
    const alreadyExists = dailyBoard.some(b => b.taskId === taskItem.taskId && b.taskTitle === taskItem.taskTitle);
    if (alreadyExists) {
      showToast('error', `Task "${taskItem.taskTitle}" is already in your Daily Entry Task Board.`);
      return;
    }

    setDailyBoard(prev => [...prev, taskToBoardItem(taskItem)]);
    showToast('success', `Added "${taskItem.taskTitle}" to Daily Entry Task Board.`);
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

  const handleBoardAttachmentSelect = async (boardId: string, files: FileList | null) => {
    const selectedFiles = Array.from(files || []);
    if (selectedFiles.length === 0) return;
    if (selectedFiles.some(file => !DAILY_COMMENT_ATTACHMENT_TYPES.has(file.type))) {
      showToast('error', 'Only PNG, JPG, PDF, and TXT attachments are supported.');
      return;
    }
    const existingAttachments = dailyBoard.find(item => item.boardId === boardId)?.attachments || [];
    const selectedSize = selectedFiles.reduce((total, file) => total + file.size, 0);
    if (existingAttachments.length + selectedFiles.length > 5) {
      showToast('error', 'Attach up to 5 files to each daily comment.');
      return;
    }
    if (existingAttachments.reduce((total, attachment) => total + attachment.fileSize, selectedSize) > MAX_DAILY_COMMENT_ATTACHMENT_BYTES) {
      showToast('error', 'Attachments must total 2 MB or less per daily comment.');
      return;
    }
    try {
      const attachments = await Promise.all(selectedFiles.map(readDailyCommentAttachment));
      updateBoardItem(boardId, { attachments: [...existingAttachments, ...attachments] });
    } catch (error) {
      console.error('Failed to read daily comment attachment:', error);
      showToast('error', error instanceof Error ? error.message : 'Failed to read attachment.');
    }
  };

  const removeBoardAttachment = (boardId: string, attachmentId: string) => {
    const item = dailyBoard.find(boardItem => boardItem.boardId === boardId);
    if (!item) return;
    updateBoardItem(boardId, {
      attachments: (item.attachments || []).filter(attachment => attachment.id !== attachmentId)
    });
  };

  // Submit Daily Entry Validation & Action (Page 3 Submit Validation)
  const knownTaskParentId = (taskId?: string) =>
    String([...openingTasks, ...tasks].find(t => String(t.id || t._id || '') === String(taskId || ''))?.parentTaskId || '');
  const subtaskParentIdsOnBoard = new Set(
    dailyBoard
      .map(item => String(item.parentTaskId || knownTaskParentId(item.taskId)))
      .filter(parentId => parentId && parentId !== 'undefined')
  );
  // A main task whose subtasks are on the board only works as a heading; work is logged on the subtasks.
  const isBoardHeadingTask = (taskId?: string) => subtaskParentIdsOnBoard.has(String(taskId || ''));

  const handleSubmitDailyBoard = async () => {
    setBoardGlobalError(null);
    const workRows = dailyBoard.filter(item => !isBoardHeadingTask(item.taskId));

    if (workRows.length === 0) {
      setBoardGlobalError('Your Daily Entry Task Board is empty. Add at least one task to submit today\'s entry.');
      return;
    }

    // Only rows the employee has started filling are submitted; untouched rows stay on the board for later.
    const hasHoursInput = (item: BoardTask) => {
      const source = item.hoursInput !== undefined ? item.hoursInput : item.hours;
      return source !== undefined && source !== null && String(source).trim() !== '' && source !== 0;
    };
    const boardItems = workRows.filter(item =>
      Boolean(item.actionTaken && item.actionTaken.trim()) || hasHoursInput(item) || item.flagged
    );

    if (boardItems.length === 0) {
      setFieldErrors({});
      setBoardGlobalError('Fill Action Taken and Hours for at least one task to submit.');
      showToast('error', 'Fill Action Taken and Hours for at least one task to submit.');
      return;
    }

    // Perform complete Page 3 validation
    const newErrors: Record<string, { actionTaken?: string; hours?: string; flagged?: string; flagComment?: string; status?: string }> = {};
    let hasValidationFailure = false;
    let missingFieldMsg = '';

    for (const item of boardItems) {
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
        body: JSON.stringify(boardItems.map(b => ({
          taskId: b.taskId,
          projectId: b.projectId,
          projectName: b.projectName,
          taskTitle: b.taskTitle,
          details: (b.details || '').trim() || b.taskTitle,
          actionTaken: b.actionTaken,
          date: b.date,
          hours: b.hours,
          flagged: b.flagged,
          flagComment: b.flagComment,
          concernedPersonId: b.concernedPersonId,
          concernedPersonName: b.concernedPersonName,
          workDone: b.workDone,
          status: b.status,
          attachments: b.attachments || []
        })))
      });

      const data = await res.json();
      if (!res.ok) {
        showToast('error', data.error || 'Unable to submit daily entry. Please try again.');
        setBoardGlobalError(data.error || 'Unable to submit daily entry. Please try again.');
        return;
      }

      const submittedBoardIds = new Set(boardItems.map(item => item.boardId));
      setDailyBoard(prev => prev.map(item => {
        if (!submittedBoardIds.has(item.boardId)) return item;
        return {
          ...item,
          actionTaken: '',
          hours: 0,
          hoursInput: '',
          flagged: false,
          flagComment: '',
          concernedPersonId: '',
          concernedPersonName: '',
          date: todayDateStr
        };
      }));
      setFieldErrors({});
      showToast('success', `Submitted ${boardItems.length} ${boardItems.length === 1 ? 'task' : 'tasks'}. You can add the next Action Taken in the same box.`);
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

  const availableAssignedTasks = openingTasks
    .filter(task => task.status !== 'Completed')
    .filter(task => urgencyFilter === 'ALL' || getUrgencyFromPriority(task.priority) === urgencyFilter);
  const taskCodeById = new Map([...openingTasks, ...tasks].map(t => [String(t.id || t._id || ''), t.taskCode || '']));
  const projectCodeById = new Map(projects.map(p => [String(p.id || p._id || ''), p.projectCode || '']));
  const taskCodeOf = (taskId?: string) => taskCodeById.get(String(taskId || '')) || '';
  const taskById = new Map([...openingTasks, ...tasks].map(t => [String(t.id || t._id || ''), t]));
  const boardParentOf = (taskId?: string, parentTaskId?: string) => {
    const id = String(taskId || '');
    const parentId = String(parentTaskId || taskById.get(id)?.parentTaskId || '');
    if (!parentId || parentId === id) return undefined;
    const parent = taskById.get(parentId);
    return {
      id: parentId,
      title: parent?.title || taskById.get(id)?.parentTaskTitle || 'Parent task',
      code: parent?.taskCode || ''
    };
  };
  const projectHeading = (group: { projectId: string; projectName: string }) => {
    const code = projectCodeById.get(String(group.projectId));
    if (!code) return group.projectName;
    const shown = formatHierarchyCode(code);
    const name = String(group.projectName || '').trim();
    if (!name || name.toLowerCase() === shown.toLowerCase() || name.toLowerCase() === String(code).toLowerCase()) {
      return shown;
    }
    return `${shown} — ${name}`;
  };
  const cleanTaskTitle = (title?: string) => String(title || '').replace(/^[\s\-–•]+/, '');
  const taskIdOf = (task: Task) => String(task.id || task._id || '');
  const completedHistoryEmployeeId = String(user?.id || user?._id || '');
  const completedHistoryProjectOptions = new Map<string, string>();
  projects.forEach(project => {
    const id = String(project.id || project._id || '');
    if (id) completedHistoryProjectOptions.set(id, project.projectName);
  });
  dailyHistory.forEach(entry => {
    const id = String(entry.projectId || '');
    if (id && !completedHistoryProjectOptions.has(id)) {
      completedHistoryProjectOptions.set(id, entry.projectName || 'Project');
    }
  });
  tasks.forEach(task => {
    const id = String(task.projectId || '');
    if (id && !completedHistoryProjectOptions.has(id)) {
      completedHistoryProjectOptions.set(id, task.projectName || 'Project');
    }
  });
  const completedHistoryDateKey = (value?: string) => {
    const rawDate = String(value || '');
    if (/^\d{4}-\d{2}-\d{2}/.test(rawDate)) return rawDate.slice(0, 10);
    const date = new Date(rawDate);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
  };
  const matchesCompletedHistoryTime = (value?: string) => {
    const dateKey = completedHistoryDateKey(value);
    if (!dateKey) return false;
    if (completedHistoryTimeFilter === 'all') return true;
    if (dateKey > todayDateStr) return false;
    if (completedHistoryTimeFilter === 'date') return dateKey === todayDateStr;
    if (completedHistoryTimeFilter === 'month') return dateKey.slice(0, 7) === todayDateStr.slice(0, 7);

    const weekStart = new Date(`${todayDateStr}T00:00:00Z`);
    const mondayOffset = (weekStart.getUTCDay() + 6) % 7;
    weekStart.setUTCDate(weekStart.getUTCDate() - mondayOffset);
    return dateKey >= weekStart.toISOString().slice(0, 10);
  };
  const filteredCompletedDailyHistory = dailyHistory.filter(entry =>
    (completedHistoryProjectFilter === 'ALL' || String(entry.projectId) === completedHistoryProjectFilter) &&
    (completedHistoryEmployeeFilter === 'ALL' || String(entry.employeeId) === completedHistoryEmployeeId) &&
    matchesCompletedHistoryTime(entry.date)
  );
  const filteredCompletedTasks = tasks.filter(task =>
    task.status === 'Completed' &&
    (completedHistoryProjectFilter === 'ALL' || String(task.projectId) === completedHistoryProjectFilter) &&
    (completedHistoryEmployeeFilter === 'ALL' ||
      (task.assignedEmployeeIds || []).some(id => String(id) === completedHistoryEmployeeId)) &&
    matchesCompletedHistoryTime(task.approvalDate || task.updatedAt)
  );

  type CategoryTaskRow = {
    key: string;
    projectName: string;
    title: string;
    code: string;
    description: string;
    subtasks: Task[];
    addables: Task[];
  };
  const openAssignedTasks = openingTasks.filter(t => t.status !== 'Completed' && taskIdOf(t));
  const categoryRowMap = new Map<string, CategoryTaskRow>();
  for (const t of openAssignedTasks) {
    if (mapPriorityToCategory(t.priority) !== activeCategory) continue;
    const id = taskIdOf(t);
    const parentId = String(t.parentTaskId || '');
    const mainId = parentId && parentId !== id ? parentId : id;
    if (categoryRowMap.has(mainId)) continue;
    const main = mainId === id ? t : taskById.get(mainId);
    const subtasks = sortByHierarchyCode(
      openAssignedTasks.filter(child => String(child.parentTaskId || '') === mainId && taskIdOf(child) !== mainId),
      child => child.taskCode
    );
    const assignedMain = openAssignedTasks.find(task => taskIdOf(task) === mainId);
    categoryRowMap.set(mainId, {
      key: mainId,
      projectName: main?.projectName || t.projectName || 'Project',
      title: cleanTaskTitle(main?.title || t.parentTaskTitle || t.title),
      code: main?.taskCode || '',
      description: main?.description || '',
      subtasks,
      addables: [assignedMain || (main || t)]
    });
  }
  const categoryTaskRows = sortByHierarchyCode(Array.from(categoryRowMap.values()), row => row.code);

  const submittedTodayIds = new Set(
    dailyHistory.filter(entry => entry.date === todayDateStr).map(entry => entry.taskId)
  );
  const isTaskOnBoardOrSubmitted = (task: Task) =>
    dailyBoard.some(item => item.taskId === taskIdOf(task)) || submittedTodayIds.has(taskIdOf(task));

  const handleAddTaskRowToDailyBoard = (row: CategoryTaskRow) => {
    const additions = row.addables
      .filter(task => !isTaskOnBoardOrSubmitted(task))
      .map(task => taskToBoardItem({
        taskId: taskIdOf(task),
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
    if (additions.length === 0) {
      showToast('error', 'Task is already added to Daily Entry Chart.');
      return;
    }
    setDailyBoard(prev => [...prev, ...additions]);
    showToast('success', `"${row.title}" added to Daily Entry Chart.`);
  };
  const groupedAssignedTasks = groupItemsByProject(
    availableAssignedTasks.map(t => ({
      ...t,
      projectId: t.projectId,
      projectName: t.projectName || 'Project'
    }))
  );
  const groupedEmployeeTasks = groupItemsByProject(
    sortByHierarchyCode(tasks, t => t.taskCode).map(t => ({
      ...t,
      projectId: t.projectId,
      projectName: t.projectName || 'Project'
    }))
  );

  const entryMatchesTask = (entry: DailyEntry, taskId: string, taskTitle: string, projectId: string) =>
    taskId && taskId !== 'OFFICE_WORK'
      ? entry.taskId === taskId
      : entry.taskTitle === taskTitle && String(entry.projectId) === String(projectId);

  const recentHistoryStart = new Date(`${todayDateStr}T00:00:00Z`);
  recentHistoryStart.setUTCDate(recentHistoryStart.getUTCDate() - (BOARD_HISTORY_DAYS - 1));
  const recentHistoryStartDate = recentHistoryStart.toISOString().slice(0, 10);
  const taskEntryHistory = (taskId: string, taskTitle: string, projectId: string) =>
    dailyHistory
      .filter(entry => {
        const entryDate = String(entry.date || '').slice(0, 10);
        return entryMatchesTask(entry, taskId, taskTitle, projectId) &&
          entryDate >= recentHistoryStartDate &&
          entryDate <= todayDateStr;
      })
      .sort((a, b) =>
        String(b.date || '').localeCompare(String(a.date || '')) ||
        String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
      );

  const submittedWorkProjectOptions = Array.from(
    dailyHistory.reduce((projectsById, entry) => {
      const id = String(entry.projectId || '');
      if (id && !projectsById.has(id)) {
        projectsById.set(id, entry.projectName || 'Project');
      }
      return projectsById;
    }, new Map<string, string>()),
    ([id, name]) => ({ id, name })
  ).sort((a, b) => a.name.localeCompare(b.name));
  const submittedWorkTaskOptions = Array.from(
    dailyHistory
      .filter(entry => submittedWorkProjectFilter === 'ALL' || String(entry.projectId) === submittedWorkProjectFilter)
      .reduce((tasksByKey, entry) => {
        const key = JSON.stringify([entry.projectId, entry.taskId, entry.taskTitle]);
        if (!tasksByKey.has(key)) {
          tasksByKey.set(key, {
            key,
            taskId: String(entry.taskId || ''),
            projectId: String(entry.projectId || ''),
            taskTitle: entry.taskTitle || 'Task'
          });
        }
        return tasksByKey;
      }, new Map<string, { key: string; taskId: string; projectId: string; taskTitle: string }>())
      .values()
  ).sort((a, b) => a.taskTitle.localeCompare(b.taskTitle));
  const filteredSubmittedWork = dailyHistory
    .filter(entry =>
      (submittedWorkProjectFilter === 'ALL' || String(entry.projectId) === submittedWorkProjectFilter) &&
      (submittedWorkTaskFilter === 'ALL' ||
        JSON.stringify([entry.projectId, entry.taskId, entry.taskTitle]) === submittedWorkTaskFilter)
    )
    .sort((a, b) =>
      String(b.date || '').localeCompare(String(a.date || '')) ||
      String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
    );

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
    sortByHierarchyCode(
      orderMainTasksFirst(boardBlocks, block => block.taskId, block => block.item?.parentTaskId),
      block => taskCodeOf(block.taskId)
    )
  );

  const boardBlockRows = (block: BoardBlock) => {
    const item = block.item;
    const errs = item ? fieldErrors[item.boardId] : undefined;
    const isFlagged = item?.flagged === true;
    const submittedEntries = block.history;
    if (!item && submittedEntries.length === 0) return [];
    const isTodayEntry = (dateStr: string) => String(dateStr || '').substring(0, 10) === todayDateStr;

    return [{
      key: `${block.key}-box`,
      cells: (
        <>
          <td className="p-0 border border-white align-top">
            {submittedEntries.length > 0 && (
              <p className="px-3 pt-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Recent submissions · last 5 days
              </p>
            )}
            {submittedEntries.map((entry, index) => {
              return (
                <div
                  key={entry.id || entry._id || `${block.key}-act-${index}`}
                  className="px-3 py-1.5 text-sm text-black break-words"
                >
                  <span className="mr-1 text-[10px] font-semibold text-slate-500">{formatBoardDate(entry.date)}:</span>
                  <span className="bg-[#00B050] px-1">{entry.actionTaken || '—'}</span>
                  <span className="ml-1 text-[10px] font-semibold text-slate-600">
                    ({formatHoursMinutes(Number(entry.hours) || 0)})
                  </span>
                  {!!entry.attachments?.length && (
                    <span className="mt-1 flex flex-wrap gap-2">
                      {entry.attachments.map(attachment => (
                        <a
                          key={attachment.id}
                          href={`/api/daily-entries/${entry.id || entry._id}/attachments/${attachment.id}`}
                          download={attachment.fileName}
                          className="text-xs font-semibold text-blue-700 underline"
                        >
                          {attachment.fileName}
                        </a>
                      ))}
                    </span>
                  )}
                </div>
              );
            })}
            {item && (
              <div className="px-3 py-2">
                <textarea
                  rows={2}
                  value={item.actionTaken}
                  onChange={(e) => updateBoardItem(item.boardId, { actionTaken: e.target.value })}
                  placeholder="Action taken"
                  className={`w-full resize-y px-2 py-1 text-sm text-black placeholder:text-black/60 border bg-white focus:outline-none focus:ring-2 ${
                    errs?.actionTaken
                      ? 'border-rose-500 focus:ring-rose-500'
                      : 'border-slate-300 focus:ring-[#4472C4]'
                  }`}
                />
                {errs?.actionTaken && (
                  <p className="text-[11px] font-bold text-rose-600 mt-0.5">{errs.actionTaken}</p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50">
                    <span>Attach files</span>
                    <input
                      type="file"
                      multiple
                      accept=".png,.jpg,.jpeg,.pdf,.txt"
                      className="sr-only"
                      onChange={event => {
                        void handleBoardAttachmentSelect(item.boardId, event.currentTarget.files);
                        event.currentTarget.value = '';
                      }}
                    />
                  </label>
                  <span className="text-[10px] text-slate-500">PNG, JPG, PDF, TXT · up to 2 MB · submit before leaving</span>
                </div>
                {!!item.attachments?.length && (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {item.attachments.map(attachment => (
                      <span key={attachment.id} className="inline-flex max-w-full items-center gap-1 rounded bg-blue-50 px-2 py-1 text-[11px] text-blue-800">
                        <span className="truncate">{attachment.fileName}</span>
                        <button
                          type="button"
                          aria-label={`Remove ${attachment.fileName}`}
                          onClick={() => removeBoardAttachment(item.boardId, attachment.id)}
                          className="font-bold text-blue-900 hover:text-rose-600"
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
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
              </div>
            )}
          </td>
          <td className="p-0 border border-white align-top">
            {submittedEntries.map((entry, index) => {
              const today = isTodayEntry(entry.date);
              return (
                <div
                  key={entry.id || entry._id || `${block.key}-date-${index}`}
                  className="px-3 py-1.5 text-sm text-black"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={`whitespace-nowrap ${today ? 'bg-[#00B050] px-1' : ''}`}>
                      {formatBoardDate(entry.date)}
                    </span>
                    {entry.flagged && (
                      <span className="px-2 py-0.5 bg-[#ED7D31] border border-[#4472C4] text-white text-[10px] font-semibold">
                        Flag
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {item && (
              <div className="px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="inline-block px-1.5 py-0.5 text-sm text-black whitespace-nowrap bg-white border border-slate-200">
                    {formatBoardDate(item.date)}
                  </span>
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
                </div>
              </div>
            )}
          </td>
          <td className="p-0 border border-white text-center align-top">
            {submittedEntries.map((entry, index) => {
              const today = isTodayEntry(entry.date);
              return (
                <div
                  key={entry.id || entry._id || `${block.key}-hrs-${index}`}
                  className="px-3 py-1.5 text-sm font-semibold"
                >
                  <span className={today ? 'bg-[#00B050] px-1 text-black' : 'text-[#0070C0]'}>
                    {formatHoursMinutes(entry.hours)}
                  </span>
                </div>
              );
            })}
            {item && (
              <div className="px-3 py-2">
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
                  className={`w-20 px-1.5 py-1 text-sm font-bold text-center text-black placeholder:text-[#0070C0] border bg-white focus:outline-none focus:ring-2 ${
                    errs?.hours
                      ? 'border-rose-500 focus:ring-rose-500'
                      : 'border-slate-300 focus:ring-[#4472C4]'
                  }`}
                />
                {errs?.hours && (
                  <p className="text-[11px] font-bold text-rose-600 mt-0.5">{errs.hours}</p>
                )}
              </div>
            )}
          </td>
        </>
      )
    }];
  };

  type BoardTaskGroup = {
    key: string;
    projectId: string;
    projectName: string;
    mainId: string;
    mainTitle: string;
    mainCode: string;
    blocks: BoardBlock[];
  };
  const boardTaskGroups: BoardTaskGroup[] = [];
  for (const group of boardBlockGroups) {
    const byMain = new Map<string, BoardTaskGroup>();
    for (const block of group.items) {
      const parent = boardParentOf(block.taskId, block.item?.parentTaskId);
      const hasTaskId = Boolean(block.taskId) && block.taskId !== 'OFFICE_WORK';
      const mainId = parent?.id || (hasTaskId ? String(block.taskId) : '');
      const key = `${group.projectId}:${mainId || block.key}`;
      let taskGroup = byMain.get(key);
      if (!taskGroup) {
        taskGroup = {
          key,
          projectId: group.projectId,
          projectName: group.projectName,
          mainId,
          mainTitle: parent ? parent.title : block.taskTitle,
          mainCode: parent ? parent.code : taskCodeOf(block.taskId),
          blocks: []
        };
        byMain.set(key, taskGroup);
        boardTaskGroups.push(taskGroup);
      }
      taskGroup.blocks.push(block);
    }
  }

  const boardTaskLabel = (code: string, title: string) => {
    const shownCode = formatHierarchyCode(code);
    if (!shownCode) return title;
    return titleRepeatsCode(title, code) ? shownCode : `${shownCode} ${title}`;
  };

  const renderBoardTaskGroup = (taskGroup: BoardTaskGroup) => {
    const mainBlock = taskGroup.blocks.find(block => String(block.taskId) === taskGroup.mainId && taskGroup.mainId);
    const subtaskLines = new Map<string, { id: string; title: string; code: string; block?: BoardBlock }>();
    if (taskGroup.mainId) {
      sortByHierarchyCode(
        Array.from(taskById.values()).filter(t => String(t.parentTaskId || '') === taskGroup.mainId),
        t => t.taskCode
      ).forEach(t => {
        const id = String(t.id || t._id || '');
        subtaskLines.set(id, { id, title: t.title, code: t.taskCode || '' });
      });
    }
    for (const block of taskGroup.blocks) {
      if (block === mainBlock || !taskGroup.mainId || String(block.taskId) === taskGroup.mainId) continue;
      const id = String(block.taskId);
      const existing = subtaskLines.get(id);
      subtaskLines.set(id, existing
        ? { ...existing, block }
        : { id, title: block.taskTitle, code: taskCodeOf(block.taskId), block });
    }

    const hasSubtaskBlocks = taskGroup.blocks.some(block => block !== mainBlock);
    // Only render one Action taken box per task group — use mainBlock if available, otherwise the first block
    const primaryBlock = mainBlock || taskGroup.blocks[0];
    const rows = primaryBlock ? boardBlockRows(primaryBlock) : [];
    if (rows.length === 0) return null;

    const projectCode = projectCodeById.get(String(taskGroup.projectId)) || '';
    const urgency = (mainBlock || taskGroup.blocks[0])?.urgency;
    const removeButton = (block?: BoardBlock) => block?.item ? (
      <button
        onClick={() => setRemoveTargetId(block.item!.boardId)}
        className="p-0.5 text-slate-500 hover:text-rose-600 hover:bg-white/60 rounded transition cursor-pointer flex-shrink-0"
        title="Remove task from daily board"
        aria-label={`Remove ${block.item.taskTitle} from daily board`}
      >
        <Trash2 size={13} />
      </button>
    ) : null;

    const taskCell = (
      <td rowSpan={rows.length} className="align-top px-3 py-2 bg-[#CFD5EA] border border-white">
        <p className="text-base font-bold text-black leading-snug break-words" title={taskGroup.projectName}>
          {formatHierarchyCode(projectCode) || taskGroup.projectName}
        </p>
        <div className="flex items-start justify-between gap-2">
          <p className="text-base font-bold text-black leading-snug break-words">
            {boardTaskLabel(taskGroup.mainCode, taskGroup.mainTitle)}
          </p>
          {!hasSubtaskBlocks && removeButton(mainBlock || (!taskGroup.mainId ? taskGroup.blocks[0] : undefined))}
        </div>
        {Array.from(subtaskLines.values()).map(sub => (
          <div key={sub.id} className="flex items-start justify-between gap-2">
            <p className="text-sm text-black leading-snug break-words">
              - {boardTaskLabel(sub.code, sub.title)}
            </p>
            {removeButton(sub.block)}
          </div>
        ))}
        {urgency && (
          <span className={`inline-block mt-1 px-1.5 py-px text-[9px] font-bold tracking-wide rounded whitespace-nowrap ${
            urgency === 'URGENT' ? 'bg-red-100 text-red-800' :
            urgency === 'LESS URGENT' ? 'bg-slate-100 text-slate-700 border border-slate-300' :
            urgency === 'LOW URGENT' ? 'bg-purple-100 text-purple-800' :
            urgency === 'DAILY TASK' ? 'bg-emerald-100 text-emerald-800' :
            'bg-indigo-100 text-indigo-800'
          }`}>
            {urgency}
          </span>
        )}
      </td>
    );

    return rows.map((row, index) => (
      <tr key={row.key} className={index % 2 === 0 ? 'bg-[#E9EBF5]' : 'bg-[#CFD5EA]'}>
        {index === 0 && taskCell}
        {row.cells}
      </tr>
    ));
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
              <div className="overflow-x-auto">
              <div className="grid grid-cols-5 min-w-[640px]">
                {CATEGORIES.map((cat) => {
                  const isActive = activeCategory === cat.id;

                  return (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      aria-pressed={isActive}
                      className={`h-11 px-4 border border-white text-[15px] font-bold text-black transition flex items-center justify-center gap-2 cursor-pointer ${
                        isActive ? 'bg-[#C55A11] text-white shadow-inner' : 'bg-[#ED7D31] hover:bg-[#D9682A]'
                      }`}
                    >
                      <span className="text-[10px]">❖</span>
                      <span className="truncate">{cat.label}</span>
                    </button>
                  );
                })}
              </div>
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
                      } ({categoryTaskRows.length})
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
                ) : categoryTaskRows.length === 0 ? (
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
                    <table className="w-full table-fixed text-left border-collapse min-w-[700px]">
                      <colgroup>
                        <col className="w-[23%]" />
                        <col className="w-[23%]" />
                        <col className="w-[27%]" />
                        <col className="w-[27%]" />
                      </colgroup>
                      <thead>
                        <tr className="bg-[#4472C4] text-white">
                          <th className="px-3 py-4 text-center text-base font-bold border border-white">Project</th>
                          <th className="px-3 py-4 text-center text-base font-bold border border-white">Task</th>
                          <th className="px-3 py-4 text-center text-base font-bold border border-white">Description</th>
                          <th className="px-3 py-4 text-center text-base font-bold border border-white">Action</th>
                        </tr>
                      </thead>
                      <tbody className="text-[15px] text-black">
                        {categoryTaskRows.map((row, index) => {
                          const isAdded = row.addables.every(isTaskOnBoardOrSubmitted);
                          const ownDescription = row.description.trim();
                          return (
                            <tr key={row.key} className={index % 2 === 0 ? 'bg-[#CFD5EA]' : 'bg-[#E9EBF5]'}>
                              <td className="px-3 py-2 align-top font-bold break-words border border-white">
                                {row.projectName}
                              </td>
                              <td className="px-3 py-2 align-top font-bold break-words border border-white">
                                {row.title}
                              </td>
                              <td className="px-3 py-2 align-top break-words border border-white">
                                {row.subtasks.length > 0 ? (
                                  <ul className="text-[13px] leading-snug">
                                    {row.subtasks.map(sub => (
                                      <li key={taskIdOf(sub)}>- {cleanTaskTitle(sub.title)}</li>
                                    ))}
                                  </ul>
                                ) : ownDescription && cleanTaskTitle(ownDescription) !== row.title ? (
                                  renderDescription(ownDescription)
                                ) : (
                                  <span className="text-[13px] text-slate-500">-</span>
                                )}
                              </td>
                              <td className="px-3 py-2 align-top border border-white">
                                {isAdded ? (
                                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                                    <Check size={15} />
                                    Added to Daily entry Chart
                                  </span>
                                ) : (
                                <button
                                    type="button"
                                    onClick={() => handleAddTaskRowToDailyBoard(row)}
                                    className="text-left font-medium text-[#FF0000] hover:underline cursor-pointer"
                                  >
                                    Add to Daily entry Chart
                                </button>
                              )}
                            </td>
                          </tr>
                          );
                        })}
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
                    type="button"
                    onClick={() => {
                      setSubmittedWorkProjectFilter('ALL');
                      setSubmittedWorkTaskFilter('ALL');
                      setIsSubmittedWorkOpen(true);
                    }}
                    className="px-3 py-2 bg-white hover:bg-slate-50 text-[#4472C4] border border-[#4472C4] text-xs font-semibold transition inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <History size={14} />
                    <span>Submitted Work</span>
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
                    Assigned project tasks appear here automatically.
                  </p>
                </div>
              ) : (
                <div className="w-full max-w-full overflow-x-auto">
                  <table className="w-full min-w-[860px] table-fixed text-left border-collapse">
                    <colgroup>
                      <col className="w-[27%]" />
                      <col className="w-[30%]" />
                      <col className="w-[16%]" />
                      <col className="w-[27%]" />
                    </colgroup>
                    <thead>
                      <tr className="bg-[#4472C4] text-white">
                        <th colSpan={3} className="px-3 py-2 text-center text-base font-bold border border-white">
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
                      {boardTaskGroups.map(taskGroup => (
                        <React.Fragment key={`board-task-${taskGroup.key}`}>
                          {renderBoardTaskGroup(taskGroup)}
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
                  <h4 className="text-sm font-bold text-[#172554]">{projectHeading(group)}</h4>
                  <ul className="space-y-1">
                    {group.items.map(t => (
                      <li key={t.id || t._id} className={`flex items-start gap-2 text-sm text-slate-800 ${t.parentTaskId ? 'pl-6' : ''}`}>
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#2563EB] flex-shrink-0" />
                        <span className="flex-1"><CodeBadge code={t.taskCode} />{t.title}</span>
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
                        <td className="py-3 px-4 font-bold text-slate-900"><CodeBadge code={taskCodeOf(entry.taskId)} />{entry.taskTitle}</td>
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
                <h3 className="text-lg font-black text-[#172554]">Completed Task History</h3>
                <p className="text-xs text-slate-500">View only — submitted daily entry history and finished tasks</p>
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

            <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
              <select
                aria-label="Filter completed history by project"
                value={completedHistoryProjectFilter}
                onChange={(event) => setCompletedHistoryProjectFilter(event.target.value)}
                className="min-w-[200px] flex-1 rounded-xl border border-blue-300 bg-blue-50 px-3.5 py-2 text-xs font-bold text-blue-900 shadow-sm transition hover:bg-blue-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="ALL">Project: All</option>
                {Array.from(completedHistoryProjectOptions, ([id, name]) => (
                  <option key={id} value={id}>Project: {name}</option>
                ))}
              </select>
              <select
                aria-label="Filter completed history by employee"
                value={completedHistoryEmployeeFilter}
                onChange={(event) => setCompletedHistoryEmployeeFilter(event.target.value)}
                className="min-w-[200px] flex-1 rounded-xl border border-indigo-300 bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-900 shadow-sm transition hover:bg-indigo-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                <option value="ALL">Employee: All</option>
                <option value="ME">Employee: {user?.name || 'Me'}</option>
              </select>
              <select
                aria-label="Filter completed history by time"
                value={completedHistoryTimeFilter}
                onChange={(event) => setCompletedHistoryTimeFilter(event.target.value as 'all' | 'date' | 'week' | 'month')}
                className="min-w-[200px] flex-1 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-900 shadow-sm transition hover:bg-emerald-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              >
                <option value="all">Time: All</option>
                <option value="date">Time: Today</option>
                <option value="week">Time: Week</option>
                <option value="month">Time: Month</option>
              </select>
            </div>

            {completedHistorySubTab === 'daily' && (
              filteredCompletedDailyHistory.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <CheckCircle2 size={36} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-bold text-slate-700">No daily entry history matches these filters.</p>
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
                      {filteredCompletedDailyHistory.map((entry, index) => (
                        <tr key={entry.id || entry._id || `comp-dh-${index}`} className="hover:bg-slate-50 transition">
                          <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">{entry.date}</td>
                          <td className="py-3 px-4 font-semibold text-slate-700">{entry.projectName}</td>
                          <td className="py-3 px-4 font-bold text-slate-900"><CodeBadge code={taskCodeOf(entry.taskId)} />{entry.taskTitle}</td>
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
              filteredCompletedTasks.length === 0 ? (
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
                      {filteredCompletedTasks.map(t => {
                          const taskIdStr = t.id || t._id;
                          const taskEntries = filteredCompletedDailyHistory.filter(e => e.taskId === taskIdStr);
                          const hoursWorked = taskEntries.reduce((acc, e) => acc + (Number(e.hours) || 0), 0);
                          const actionTaken = taskEntries.length > 0 ? (taskEntries[0].actionTaken || '—') : '—';
                          const compDate = t.approvalDate
                            ? new Date(t.approvalDate).toLocaleDateString('en-IN')
                            : (t.updatedAt ? new Date(t.updatedAt).toLocaleDateString('en-IN') : todayDateStr);

                          return (
                            <tr key={taskIdStr} className="hover:bg-slate-50 transition">
                              <td className="py-3.5 px-4 font-bold text-slate-900">{t.projectName}</td>
                              <td className="py-3.5 px-4 font-bold text-indigo-700"><CodeBadge code={t.taskCode} />{t.title}</td>
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
          <section className="space-y-5" aria-labelledby="employee-performance-title">
            <h2 id="employee-performance-title" className="text-xl font-bold text-[#172554] md:text-[22px]">
              Performance
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                { label: 'Tasks done', value: weeklyPerformanceRows.reduce((total, week) => total + week.tasksDone, 0) },
                { label: 'Hours logged', value: formatPerformanceHours(weeklyPerformanceRows.reduce((total, week) => total + week.hoursLogged, 0)) },
                { label: 'Latest marks', value: latestPerformanceMark === null ? '— / 10' : `${formatPerformanceMark(latestPerformanceMark * 2)} / 10` }
              ].map(card => (
                <div
                  key={card.label}
                  className="flex min-h-[90px] items-center justify-center rounded-lg border border-[#D9E2EF] bg-white px-5 py-6 text-center"
                >
                  <p className="text-lg font-semibold text-[#1E293B]">
                    {card.label}: <span className="font-bold">{card.value}</span>
                  </p>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto border border-[#D9E2EF] bg-white">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm text-[#172033]">
                <thead>
                  <tr className="bg-[#334155] text-white">
                    <th className="border border-[#94A3B8] px-2.5 py-2 font-bold">Week</th>
                    <th className="border border-[#94A3B8] px-2.5 py-2 font-bold">Tasks done</th>
                    <th className="border border-[#94A3B8] px-2.5 py-2 font-bold">Hours</th>
                    <th className="border border-[#94A3B8] px-2.5 py-2 font-bold">Marks</th>
                  </tr>
                </thead>
                <tbody>
                  {weeklyPerformanceRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-4 text-sm text-slate-500">
                        No weekly performance data available yet.
                      </td>
                    </tr>
                  ) : weeklyPerformanceRows.map((week, index) => (
                    <tr key={week.periodStart} className={index % 2 === 0 ? 'bg-[#F8FAFC]' : 'bg-white'}>
                      <td className="border border-[#E2E8F0] px-2.5 py-2.5">Week {index + 1}</td>
                      <td className="border border-[#E2E8F0] px-2.5 py-2.5">{week.tasksDone}</td>
                      <td className="border border-[#E2E8F0] px-2.5 py-2.5">{formatPerformanceHours(week.hoursLogged)}</td>
                      <td className="border border-[#E2E8F0] px-2.5 py-2.5">
                        {week.rating === null ? '—' : `${formatPerformanceMark(week.rating * 2)} / 10`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 text-sm text-[#1D4ED8]">
              Employee can see only their own performance.
            </div>
          </section>
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

        {isSubmittedWorkOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
            <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5">
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-bold text-[#0F172A]">
                    <History size={20} className="text-[#2563EB]" />
                    Submitted Work
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">Review submitted action taken by project and task.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSubmittedWorkOpen(false)}
                  className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                  aria-label="Close submitted work"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex flex-wrap gap-3 border-b border-slate-200 bg-slate-50 p-4">
                <label className="min-w-[220px] flex-1 text-xs font-bold text-slate-600">
                  Project
                  <select
                    value={submittedWorkProjectFilter}
                    onChange={(event) => {
                      setSubmittedWorkProjectFilter(event.target.value);
                      setSubmittedWorkTaskFilter('ALL');
                    }}
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
                  >
                    <option value="ALL">All projects</option>
                    {submittedWorkProjectOptions.map(project => (
                      <option key={project.id} value={project.id}>{project.name}</option>
                    ))}
                  </select>
                </label>
                <label className="min-w-[220px] flex-1 text-xs font-bold text-slate-600">
                  Task
                  <select
                    value={submittedWorkTaskFilter}
                    onChange={(event) => setSubmittedWorkTaskFilter(event.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
                  >
                    <option value="ALL">All tasks</option>
                    {submittedWorkTaskOptions.map(task => (
                      <option key={task.key} value={task.key}>
                        {taskCodeOf(task.taskId) ? `${formatHierarchyCode(taskCodeOf(task.taskId))} ` : ''}{task.taskTitle}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="self-end pb-2 text-xs font-semibold text-slate-500">
                  {filteredSubmittedWork.length} {filteredSubmittedWork.length === 1 ? 'submission' : 'submissions'}
                </p>
              </div>

              <div className="min-h-0 flex-1 overflow-auto">
                {filteredSubmittedWork.length === 0 ? (
                  <div className="p-12 text-center text-sm font-medium text-slate-500">
                    No submitted work matches these filters.
                  </div>
                ) : (
                  <table className="w-full min-w-[760px] border-collapse text-left text-xs">
                    <thead className="sticky top-0 bg-[#1E3A8A] text-[11px] font-bold uppercase tracking-wide text-white">
                      <tr>
                        <th className="px-4 py-3">Project</th>
                        <th className="px-4 py-3">Task</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Action Taken</th>
                        <th className="px-4 py-3 text-center">Hours</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredSubmittedWork.map((entry, index) => (
                        <tr key={entry.id || entry._id || `${entry.taskId}-${entry.date}-${index}`} className="align-top hover:bg-slate-50">
                          <td className="px-4 py-3 font-semibold text-slate-700">{entry.projectName || 'Project'}</td>
                          <td className="px-4 py-3 font-bold text-slate-900">{entry.taskTitle}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatBoardDate(entry.date)}</td>
                          <td className="whitespace-pre-wrap px-4 py-3 text-slate-800">{entry.actionTaken || '—'}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-center font-bold text-blue-700">
                            {formatHoursMinutes(Number(entry.hours) || 0)}
                          </td>
                          <td className="px-4 py-3 text-slate-700">{entry.status || 'Submitted'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
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
