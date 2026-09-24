'use client'

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Project, Task, Reminder, Flag, TaskPriority, EmployeePerformance, DailyEntry } from '../types';
import Sidebar, { TabType } from './Sidebar';
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

const MAX_DAILY_HOURS = 8;

type CategoryType = 'URGENT' | 'LESS_URGENT' | 'UPCOMING' | 'SELF_DEFINED' | 'DAILY_TASK';

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
    label: 'URGENT',
    dbPriority: 'Urgent',
    bgColor: '#DC2626',
    hoverColor: '#B91C1C',
    activeRing: 'ring-[#DC2626]',
    textColor: '#FFFFFF'
  },
  {
    id: 'LESS_URGENT',
    label: 'LESS URGENT',
    dbPriority: 'Medium',
    bgColor: '#F59E0B',
    hoverColor: '#D97706',
    activeRing: 'ring-[#F59E0B]',
    textColor: '#FFFFFF'
  },
  {
    id: 'UPCOMING',
    label: 'UPCOMING',
    dbPriority: 'Low',
    bgColor: '#7C3AED',
    hoverColor: '#6D28D9',
    activeRing: 'ring-[#7C3AED]',
    textColor: '#FFFFFF'
  },
  {
    id: 'SELF_DEFINED',
    label: 'SELF DEFINED',
    dbPriority: 'Self',
    bgColor: '#6366F1',
    hoverColor: '#4F46E5',
    activeRing: 'ring-[#6366F1]',
    textColor: '#FFFFFF'
  },
  {
    id: 'DAILY_TASK',
    label: 'DAILY TASK',
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
}

const PRESET_TASKS_CATALOG: DisplayTaskItem[] = [
  {
    id: 'ZP_SCHOOL_PROJ',
    projectId: 'ZP_SCHOOL_PROJ',
    projectName: 'ZP-School',
    title: 'Working Drawings',
    description: 'Plans, Elevations, Sections',
    category: 'URGENT'
  },
  {
    id: 'OW_LESS_1',
    projectId: 'OFFICE_WORKS',
    projectName: 'Office Works',
    title: 'Drawing Cleaning & Updating',
    description: 'Purging layers, fixing block references & sheet sets',
    category: 'LESS_URGENT'
  },
  {
    id: 'ZP_LESS_2',
    projectId: 'ZP_SCHOOL_PROJ',
    projectName: 'ZP-School',
    title: 'Material Specifications',
    description: 'Preparing finish schedule & brand approvals',
    category: 'LESS_URGENT'
  },
  {
    id: 'OW_UPCOMING_1',
    projectId: 'OFFICE_WORKS',
    projectName: 'Office Works',
    title: 'Folder & File Cleaning',
    description: 'Organizing CAD files, archives, shared drives',
    category: 'UPCOMING'
  },
  {
    id: 'OW_UPCOMING_2',
    projectId: 'OFFICE_WORKS',
    projectName: 'Office Works',
    title: 'Profile & Portfolio Update',
    description: 'Updating project renders & case studies',
    category: 'UPCOMING'
  },
  {
    id: 'OW_SELF_1',
    projectId: 'OFFICE_WORKS',
    projectName: 'Office Works',
    title: 'Social Networking Posts',
    description: 'Creating design showcases & firm updates',
    category: 'SELF_DEFINED'
  },
  {
    id: 'OW_SELF_2',
    projectId: 'OFFICE_WORKS',
    projectName: 'Office Works',
    title: 'Internal Discussions',
    description: 'Brainstorming & peer design reviews',
    category: 'SELF_DEFINED'
  },

  // PPT Predefined Daily Tasks (Group 1: ZP-School / Assigned Project)
  {
    id: 'ZP_DAILY_1',
    projectId: 'ZP_SCHOOL_PROJ',
    projectName: 'ZP-School',
    title: 'Coordination, project review, & Follow-up Calls',
    description: 'Client calls, vendor coordination, team sync',
    category: 'DAILY_TASK'
  },
  {
    id: 'ZP_DAILY_2',
    projectId: 'ZP_SCHOOL_PROJ',
    projectName: 'ZP-School',
    title: 'Folder & File Cleaning',
    description: 'Organizing CAD files, archives, shared drives',
    category: 'DAILY_TASK'
  },
  {
    id: 'ZP_DAILY_3',
    projectId: 'ZP_SCHOOL_PROJ',
    projectName: 'ZP-School',
    title: 'Drawing Cleaning & Updating',
    description: 'Purging layers, fixing block references & sheet sets',
    category: 'DAILY_TASK'
  },
  {
    id: 'ZP_DAILY_7',
    projectId: 'ZP_SCHOOL_PROJ',
    projectName: 'ZP-School',
    title: 'Client Meetings',
    description: 'Attending client review & milestone meetings',
    category: 'DAILY_TASK'
  },
  {
    id: 'ZP_DAILY_8',
    projectId: 'ZP_SCHOOL_PROJ',
    projectName: 'ZP-School',
    title: 'Meeting Preparation',
    description: 'Drafting presentation decks, printouts, agendas',
    category: 'DAILY_TASK'
  },
  {
    id: 'ZP_DAILY_9',
    projectId: 'ZP_SCHOOL_PROJ',
    projectName: 'ZP-School',
    title: 'Site Visit Preparation',
    description: 'Checklists, measuring tools, safety compliance',
    category: 'DAILY_TASK'
  },

  // PPT Predefined Daily Tasks (Group 2: Office Works)
  {
    id: 'OW_DAILY_4',
    projectId: 'OFFICE_WORKS',
    projectName: 'Office Works',
    title: 'Profile & Portfolio Update',
    description: 'Updating project renders & case studies',
    category: 'DAILY_TASK'
  },
  {
    id: 'OW_DAILY_5',
    projectId: 'OFFICE_WORKS',
    projectName: 'Office Works',
    title: 'Social Networking Posts',
    description: 'Creating design showcases & firm updates',
    category: 'DAILY_TASK'
  },
  {
    id: 'OW_DAILY_6',
    projectId: 'OFFICE_WORKS',
    projectName: 'Office Works',
    title: 'Internal Discussions',
    description: 'Brainstorming & peer design reviews',
    category: 'DAILY_TASK'
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
  flagged: boolean;
  flagComment: string;
  workDone: number; // 10-100%
  status: 'Pending' | 'In Progress' | 'Completed' | 'Blocked';
  urgency: 'URGENT' | 'LESS URGENT' | 'UPCOMING' | 'SELF DEFINED / DAILY TASK';
}

const OFFICE_WORKS_PRESETS = [
  { id: 'OW_1', title: 'Coordination, project review, & Follow-up Calls', details: 'Client calls, vendor coordination, team sync' },
  { id: 'OW_2', title: 'Folder & File Cleaning', details: 'Organizing CAD files, archives, shared drives' },
  { id: 'OW_3', title: 'Drawing Cleaning & Updating', details: 'Purging layers, fixing block references & sheet sets' },
  { id: 'OW_4', title: 'Client Meetings', details: 'Attending client review & milestone meetings' },
  { id: 'OW_5', title: 'Meeting Preparation', details: 'Drafting presentation decks, printouts, agendas' },
  { id: 'OW_6', title: 'Site Visit Preparation', details: 'Checklists, measuring tools, safety compliance' },
  { id: 'OW_7', title: 'Profile & Portfolio Update', details: 'Updating project renders & case studies' },
  { id: 'OW_8', title: 'Social Networking Posts', details: 'Creating design showcases & firm updates' },
  { id: 'OW_9', title: 'Internal Discussions', details: 'Brainstorming & peer design reviews' }
];

const SAMPLE_PROJECT = {
  id: 'ZP_SCHOOL_PROJ',
  projectName: 'ZP-School',
  taskTitle: 'Working Drawings',
  details: 'Plans, Elevations, Sections',
  urgency: 'URGENT' as const
};

const EmployeeDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [activeCategory, setActiveCategory] = useState<CategoryType>('DAILY_TASK');
  const [fetchError, setFetchError] = useState<boolean>(false);
  
  const [tasks, setTasks] = useState<Task[]>([]);
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
  const [dailyWorkHours, setDailyWorkHours] = useState<number>(1);
  const [dailyWorkError, setDailyWorkError] = useState<string>('');
  const [isSavingDailyWork, setIsSavingDailyWork] = useState<boolean>(false);

  // Daily Entry Task Board State
  const [dailyBoard, setDailyBoard] = useState<BoardTask[]>([]);
  
  // Validation Errors state per board item ID
  const [fieldErrors, setFieldErrors] = useState<Record<string, { actionTaken?: string; hours?: string; flagComment?: string }>>({});
  const [boardGlobalError, setBoardGlobalError] = useState<string | null>(null);

  // Task Removal Confirmation Modal State
  const [removeTargetId, setRemoveTargetId] = useState<string | null>(null);

  // Urgency Filter for Assigned Tasks
  const [urgencyFilter, setUrgencyFilter] = useState<string>('ALL');

  // Reports Filter State
  const [reportDateFilter, setReportDateFilter] = useState<string>('');
  const [reportProjectFilter, setReportProjectFilter] = useState<string>('ALL');
  const [reportFlaggedFilter, setReportFlaggedFilter] = useState<string>('ALL');

  // Reminder & Flag Reply states
  const [reminderReplies, setReminderReplies] = useState<Record<string, string>>({});
  const [flagReplies, setFlagReplies] = useState<Record<string, string>>({});

  // Add Reminder Modal State
  const [isAddReminderModalOpen, setIsAddReminderModalOpen] = useState<boolean>(false);
  const [newReminderTitle, setNewReminderTitle] = useState<string>('');
  const [newReminderTaskId, setNewReminderTaskId] = useState<string>('');
  const [newReminderError, setNewReminderError] = useState<string>('');
  const [isSavingReminder, setIsSavingReminder] = useState<boolean>(false);

  // Performance Tab View State ('weekly' | 'monthly')
  const [perfTab, setPerfTab] = useState<'weekly' | 'monthly'>('weekly');

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

  const todayFormattedText = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(new Date());

  const fetchData = async (isInitial = false) => {
    try {
      if (isInitial) {
        setLoading(true);
      }
      const [tasksRes, projectsRes, remindersRes, flagsRes, perfRes, historyRes] = await Promise.all([
        fetch('/api/tasks'),
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
        if (perfData && perfData.length > 0) {
          setPerformance(perfData[0]);
        }
      }

      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setDailyHistory(historyData);
      }
    } catch (err) {
      console.error('Error fetching employee dashboard data:', err);
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
    if (priority === 'Low') return 'UPCOMING';
    return 'SELF DEFINED / DAILY TASK';
  };

  // Add Task to Daily Board
  const handleAddToDailyBoard = (taskItem: {
    taskId: string;
    projectId: string;
    projectName: string;
    taskTitle: string;
    details: string;
    urgency?: BoardTask['urgency'];
  }) => {
    // Prevent duplicates
    const alreadyExists = dailyBoard.some(b => b.taskId === taskItem.taskId && b.taskTitle === taskItem.taskTitle);
    if (alreadyExists) {
      showToast('error', `Task "${taskItem.taskTitle}" is already in your Daily Entry Task Board.`);
      return;
    }

    const newBoardItem: BoardTask = {
      boardId: `board_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
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
      workDone: 50,
      status: 'In Progress',
      urgency: taskItem.urgency || 'SELF DEFINED / DAILY TASK'
    };

    setDailyBoard(prev => [...prev, newBoardItem]);
    showToast('success', `Added "${taskItem.taskTitle}" to Daily Entry Task Board.`);
  };

  // Add Category Task to Daily Board
  const handleAddCategoryTaskToDailyBoard = (taskItem: DisplayTaskItem) => {
    const urgencyLabelMap: Record<CategoryType, BoardTask['urgency']> = {
      URGENT: 'URGENT',
      LESS_URGENT: 'LESS URGENT',
      UPCOMING: 'UPCOMING',
      SELF_DEFINED: 'SELF DEFINED / DAILY TASK',
      DAILY_TASK: 'SELF DEFINED / DAILY TASK'
    };

    const alreadyExists = dailyBoard.some(b => b.taskId === taskItem.id || b.taskTitle === taskItem.title);
    if (alreadyExists) {
      showToast('error', `Task is already added to Daily Entry.`);
      return;
    }

    const newBoardItem: BoardTask = {
      boardId: `board_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
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
      workDone: 50,
      status: 'In Progress',
      urgency: urgencyLabelMap[taskItem.category]
    };

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

  // Delete Self Created Daily Work Entry
  const handleDeleteDailyEntry = async (id: string) => {
    try {
      const res = await fetch(`/api/daily-entries/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        showToast('error', data.error || 'Failed to delete entry');
        return;
      }
      setDailyHistory(prev => prev.filter(e => (e.id || e._id) !== id));
      showToast('success', 'Daily work entry deleted successfully.');
      fetchData();
    } catch (err) {
      console.error('Delete daily entry error:', err);
      showToast('error', 'Unable to delete daily work entry.');
    }
  };

  // Save Self Created Daily Work Entry
  const handleSaveDailyWork = async (e: React.FormEvent) => {
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

    try {
      setIsSavingDailyWork(true);
      const selectedProj = projects.find(p => (p.id || p._id) === dailyWorkProjectId);
      const projName = selectedProj ? selectedProj.projectName : 'Project';

      const payload = {
        projectId: dailyWorkProjectId,
        projectName: projName,
        taskTitle: dailyWorkTask.trim(),
        details: dailyWorkDescription.trim(),
        actionTaken: dailyWorkActionTaken.trim(),
        hours: Number(dailyWorkHours) || 1,
        status: 'Completed'
      };

      const res = await fetch('/api/daily-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        setDailyWorkError(data.error || 'Failed to save daily work. Please try again.');
        return;
      }

      // Add entry to dailyBoard
      const newBoardItem: BoardTask = {
        boardId: `board_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        taskId: data.entries?.[0]?._id || `self_${Date.now()}`,
        projectId: dailyWorkProjectId,
        projectName: projName,
        taskTitle: dailyWorkTask.trim(),
        details: dailyWorkDescription.trim(),
        actionTaken: dailyWorkActionTaken.trim(),
        date: todayDateStr,
        hours: Number(dailyWorkHours) || 1,
        flagged: false,
        flagComment: '',
        workDone: 100,
        status: 'Completed',
        urgency: 'SELF DEFINED / DAILY TASK'
      };

      setDailyBoard(prev => [newBoardItem, ...prev]);
      showToast('success', 'Daily work added successfully.');

      // Reset form & close modal
      setDailyWorkProjectId('');
      setDailyWorkTask('');
      setDailyWorkDescription('');
      setDailyWorkActionTaken('');
      setDailyWorkHours(1);
      setIsDailyWorkModalOpen(false);

      // Refresh data
      fetchData();
    } catch (err) {
      console.error('Save daily work error:', err);
      setDailyWorkError('Unable to save daily work. Please try again.');
    } finally {
      setIsSavingDailyWork(false);
    }
  };

  // Dynamic Hours Calculations
  const allocatedHours = dailyBoard.reduce((sum, item) => sum + (Number(item.hours) || 0), 0);
  const freeHours = Math.max(0, MAX_DAILY_HOURS - allocatedHours);
  const isHoursExceeded = allocatedHours > MAX_DAILY_HOURS;
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
      if (updates.flagComment !== undefined) delete copy[boardId]?.flagComment;
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
    const newErrors: Record<string, { actionTaken?: string; hours?: string; flagComment?: string }> = {};
    let hasValidationFailure = false;

    for (const item of dailyBoard) {
      const itemErr: { actionTaken?: string; hours?: string; flagComment?: string } = {};

      if (!item.actionTaken || !item.actionTaken.trim()) {
        itemErr.actionTaken = 'Please enter Action Taken.';
        hasValidationFailure = true;
      }

      const hrs = Number(item.hours);
      if (isNaN(hrs) || hrs <= 0) {
        itemErr.hours = 'Please enter valid Hours (> 0).';
        hasValidationFailure = true;
      }

      if (item.flagged && (!item.flagComment || !item.flagComment.trim())) {
        itemErr.flagComment = 'Please add a comment for the flagged task.';
        hasValidationFailure = true;
      }

      if (Object.keys(itemErr).length > 0) {
        newErrors[item.boardId] = itemErr;
      }
    }

    if (isHoursExceeded) {
      setBoardGlobalError(`Total daily hours cannot exceed 8 hours. Currently entered: ${allocatedHours.toFixed(1)} hrs (Remaining capacity: 0.0 hrs).`);
      hasValidationFailure = true;
    }

    if (hasValidationFailure) {
      setFieldErrors(newErrors);
      showToast('error', 'Please complete all required task entries before submitting.');
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
      setDailyBoard([]);
      setFieldErrors({});
      fetchData();
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
    if (norm.includes('upcoming') || norm.includes('low') || norm.includes('pending')) return 'UPCOMING';
    if (norm.includes('self')) return 'SELF_DEFINED';
    return 'DAILY_TASK';
  };

  const currentCategoryConfig = CATEGORIES.find(c => c.id === activeCategory) || CATEGORIES[4];

  const matchingDbTasks: DisplayTaskItem[] = tasks
    .filter(t => t.status !== 'Completed')
    .filter(t => mapPriorityToCategory(t.priority) === activeCategory)
    .map(t => ({
      id: t.id || t._id || `db_task_${Math.random()}`,
      projectId: t.projectId || 'GENERAL',
      projectName: t.projectName || 'Project',
      title: t.title,
      description: t.description || 'No description available',
      category: activeCategory
    }));

  const matchingPresetTasks = PRESET_TASKS_CATALOG.filter(pt => pt.category === activeCategory);

  const combinedCategoryTasks: DisplayTaskItem[] = [...matchingDbTasks];
  for (const preset of matchingPresetTasks) {
    if (!combinedCategoryTasks.some(t => t.title.toLowerCase() === preset.title.toLowerCase())) {
      combinedCategoryTasks.push(preset);
    }
  }

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
      <div className="flex-1 w-full pt-20 px-4 pb-12 md:pt-8 md:p-8 md:ml-64">
        
        {/* UPDATE 2 — Header with Dynamic Logged-in Employee Name */}
        <header className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 pb-6 border-b border-slate-200 gap-4 bg-white p-6 rounded-2xl shadow-sm">
          <div className="flex items-center gap-4">
            <img
              src="/logo.png"
              alt="Korals Design Logo"
              className="h-11 w-auto object-contain bg-black px-2 py-1 rounded-xl border border-slate-200 shadow-xs hidden sm:block"
            />
            <div className="w-12 h-12 rounded-xl bg-indigo-900 text-white flex items-center justify-center font-black text-xl shadow-md">
              {user?.name?.charAt(0) || 'E'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-[#172554] tracking-tight">
                  Employee Dashboard
                </h1>
                <span className="px-3 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Online
                </span>
              </div>
              <p className="text-sm font-bold text-indigo-600 mt-0.5">
                Welcome, {user?.name || 'Employee'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <NotificationCenter onSelectTask={() => setActiveTab('today-work')} />

            <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl shadow-xs text-xs font-bold text-slate-700">
              <Calendar size={15} className="text-indigo-600" />
              <span>{todayFormattedText}</span>
            </div>

            <div className="flex items-center gap-2.5 px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-xl">
              <div className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                {user?.name?.charAt(0) || 'E'}
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-indigo-950 leading-tight">{user?.name || 'Employee'}</p>
                <p className="text-[10px] font-semibold text-indigo-600">{user?.email || 'Employee'}</p>
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

            {/* UPDATE 1 — 5 TASK CATEGORY BUTTONS (URGENT, LESS URGENT, UPCOMING, SELF DEFINED, DAILY TASK) */}
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
                        {cat.id === 'UPCOMING' && <Sparkles size={18} className="text-white" />}
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
                        activeCategory === 'UPCOMING' ? 'Upcoming Tasks' :
                        activeCategory === 'SELF_DEFINED' ? 'Self Defined Tasks' :
                        'Daily Tasks'
                      }
                    </h2>
                    <p className="text-xs font-semibold text-[#64748B] mt-0.5">
                      {
                        activeCategory === 'DAILY_TASK'
                          ? 'Manage predefined daily activities and add required tasks to your Daily Entry Chart.'
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

                    {activeCategory === 'DAILY_TASK' && (
                      <button
                        onClick={() => {
                          setDailyWorkError('');
                          if (projects.length > 0) {
                            setDailyWorkProjectId(projects[0].id || projects[0]._id || '');
                          }
                          setIsDailyWorkModalOpen(true);
                        }}
                        className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus size={15} />
                        <span>+ Add Daily Work</span>
                      </button>
                    )}

                    <span className="px-3.5 py-1 text-xs font-bold rounded-full bg-blue-50 text-[#2563EB] border border-blue-200">
                      {
                        activeCategory === 'URGENT' ? 'Urgent Tasks' :
                        activeCategory === 'LESS_URGENT' ? 'Less Urgent Tasks' :
                        activeCategory === 'UPCOMING' ? 'Upcoming Tasks' :
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
                    <h3 className="text-base font-bold text-[#0F172A]">
                      {activeCategory === 'DAILY_TASK' ? 'No Daily Tasks Available' : 'No tasks available'}
                    </h3>
                    <p className="text-xs text-[#64748B]">
                      {
                        activeCategory === 'URGENT' ? 'No urgent tasks have been assigned to you.' :
                        activeCategory === 'LESS_URGENT' ? 'No less urgent tasks have been assigned to you.' :
                        activeCategory === 'UPCOMING' ? 'No upcoming tasks scheduled.' :
                        activeCategory === 'SELF_DEFINED' ? 'No self-defined tasks yet.' :
                        'No daily tasks are currently available.'
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
                          <th className="py-3.5 px-4 w-[20%]">Project</th>
                          <th className="py-3.5 px-4 w-[28%]">Task</th>
                          <th className="py-3.5 px-4 w-[32%]">Description</th>
                          <th className="py-3.5 px-4 w-[20%] text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0] text-sm text-[#0F172A]">
                        {combinedCategoryTasks.map((t) => {
                          const isAdded = dailyBoard.some(
                            b => b.taskId === t.id || b.taskTitle === t.title
                          );

                          return (
                            <tr key={t.id} className="hover:bg-[#F8FAFC] transition-colors">
                              {/* PROJECT */}
                              <td className="py-4 px-4 font-bold align-top text-[#0F172A]">
                                {t.projectName}
                              </td>

                              {/* TASK */}
                              <td className="py-4 px-4 font-semibold align-top text-[#0F172A]">
                                {t.title}
                              </td>

                              {/* DESCRIPTION */}
                              <td className="py-4 px-4 align-top break-words">
                                {renderDescription(t.description)}
                              </td>

                              {/* ACTION */}
                              <td className="py-4 px-4 text-center align-top">
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
                                      <span>+ Add to Daily Entry Chart</span>
                                    </>
                                  )}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* YOUR SUBMITTED DAILY WORK ENTRIES SECTION */}
              {activeCategory === 'DAILY_TASK' && (
                <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E2E8F0]">
                    <div>
                      <h3 className="text-base font-bold text-[#0F172A]">Your Submitted Daily Work Entries</h3>
                      <p className="text-xs text-[#64748B]">Records of work entries created by you</p>
                    </div>
                    <button
                      onClick={() => {
                        setDailyWorkError('');
                        if (projects.length > 0) {
                          setDailyWorkProjectId(projects[0].id || projects[0]._id || '');
                        }
                        setIsDailyWorkModalOpen(true);
                      }}
                      className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                    >
                      <Plus size={15} />
                      <span>+ Add Daily Work</span>
                    </button>
                  </div>

                  {dailyHistory.length === 0 ? (
                    <div className="py-8 text-center space-y-2 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="text-xs font-bold text-[#0F172A]">No daily work entries yet.</p>
                      <p className="text-xs text-[#64748B]">Click &quot;+ Add Daily Work&quot; to add your completed work entry.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-[750px]">
                        <thead>
                          <tr className="bg-[#F8FAFC] text-[#0F172A] text-xs font-extrabold uppercase tracking-wider border-b border-[#E2E8F0]">
                            <th className="py-3.5 px-4 w-[18%]">Project</th>
                            <th className="py-3.5 px-4 w-[22%]">Task</th>
                            <th className="py-3.5 px-4 w-[25%]">Description</th>
                            <th className="py-3.5 px-4 w-[20%]">Action Taken</th>
                            <th className="py-3.5 px-4 w-[10%] text-center">Date</th>
                            <th className="py-3.5 px-4 w-[5%] text-center">Status</th>
                            <th className="py-3.5 px-4 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E2E8F0] text-xs text-[#0F172A]">
                          {dailyHistory.map(entry => {
                            const entryId = entry.id || entry._id || '';
                            return (
                              <tr key={entryId} className="hover:bg-[#F8FAFC] transition-colors">
                                <td className="py-3.5 px-4 font-bold align-top text-[#0F172A]">{entry.projectName}</td>
                                <td className="py-3.5 px-4 font-semibold align-top text-[#0F172A]">{entry.taskTitle}</td>
                                <td className="py-3.5 px-4 align-top text-[#64748B]">{entry.details || '-'}</td>
                                <td className="py-3.5 px-4 align-top text-[#0F172A]">{entry.actionTaken}</td>
                                <td className="py-3.5 px-4 align-top text-center font-bold whitespace-nowrap text-[#0F172A]">{entry.date}</td>
                                <td className="py-3.5 px-4 align-top text-center">
                                  <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    {entry.status || 'Submitted'}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 align-top text-center">
                                  <button
                                    onClick={() => handleDeleteDailyEntry(entryId)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                    title="Delete daily entry"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick Actions & Office Works Presets Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div>
                  <h3 className="text-base font-bold text-[#172554]">Office Works Quick Presets</h3>
                  <p className="text-xs text-slate-500">Standard office administration tasks &bull; Click to add to Daily Task Board</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {OFFICE_WORKS_PRESETS.map((ow) => {
                  const isAdded = dailyBoard.some(b => b.taskTitle === ow.title);
                  return (
                    <div 
                      key={ow.id}
                      className="p-3.5 border border-slate-200 rounded-xl bg-slate-50 hover:bg-indigo-50/50 hover:border-indigo-300 transition flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{ow.title}</p>
                        <p className="text-[11px] text-slate-500 truncate">{ow.details}</p>
                      </div>

                      <button
                        disabled={isAdded}
                        onClick={() => handleAddToDailyBoard({
                          taskId: ow.id,
                          projectId: 'OFFICE_WORKS',
                          projectName: 'Office Works',
                          taskTitle: ow.title,
                          details: ow.details,
                          urgency: 'SELF DEFINED / DAILY TASK'
                        })}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 flex-shrink-0 cursor-pointer ${
                          isAdded 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-not-allowed' 
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                        }`}
                      >
                        {isAdded ? (
                          <>
                            <Check size={13} />
                            <span>Added</span>
                          </>
                        ) : (
                          <>
                            <Plus size={13} />
                            <span>Add</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sample Project ZP-School Card */}
            <div className="bg-gradient-to-r from-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="px-3 py-1 bg-amber-400 text-slate-950 font-black text-[10px] tracking-wider uppercase rounded-full">
                  Sample Requirement Project
                </span>
                <h3 className="text-lg font-bold mt-2">Project: {SAMPLE_PROJECT.projectName}</h3>
                <p className="text-xs text-indigo-200 mt-0.5">Task: <span className="font-bold text-white">{SAMPLE_PROJECT.taskTitle}</span> &bull; {SAMPLE_PROJECT.details}</p>
              </div>

              <button
                disabled={dailyBoard.some(b => b.taskTitle === SAMPLE_PROJECT.taskTitle)}
                onClick={() => handleAddToDailyBoard({
                  taskId: SAMPLE_PROJECT.id,
                  projectId: SAMPLE_PROJECT.id,
                  projectName: SAMPLE_PROJECT.projectName,
                  taskTitle: SAMPLE_PROJECT.taskTitle,
                  details: SAMPLE_PROJECT.details,
                  urgency: SAMPLE_PROJECT.urgency
                })}
                className={`px-4 py-2.5 rounded-xl font-extrabold text-xs transition flex items-center gap-1.5 shadow-sm cursor-pointer ${
                  dailyBoard.some(b => b.taskTitle === SAMPLE_PROJECT.taskTitle)
                    ? 'bg-emerald-500 text-white cursor-not-allowed'
                    : 'bg-white text-indigo-950 hover:bg-indigo-50'
                }`}
              >
                {dailyBoard.some(b => b.taskTitle === SAMPLE_PROJECT.taskTitle) ? (
                  <>
                    <Check size={16} />
                    <span>Added to Daily Entry</span>
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    <span>Add to Daily Entry</span>
                  </>
                )}
              </button>
            </div>

          </div>
        )}

        {/* TAB 2: DAILY ENTRY TASK BOARD (Page 2 & Page 3) */}
        {activeTab === 'today-work' && (
          <div className="space-y-8">
            
            {/* Top Board Title & Free Hours Summary */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                <div>
                  <h2 className="text-xl font-black text-[#172554]">Daily Entry Task Board</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Complete required green entry fields and click Submit &bull; Auto Date: <span className="font-bold text-slate-800">{todayDateStr}</span>
                  </p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={() => {
                      setDailyWorkError('');
                      if (projects.length > 0) {
                        setDailyWorkProjectId(projects[0].id || projects[0]._id || '');
                      }
                      setIsDailyWorkModalOpen(true);
                    }}
                    className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus size={15} />
                    <span>+ Add Daily Work</span>
                  </button>
                  <div className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700">
                    Today&apos;s Hours: <span className={isHoursExceeded ? 'text-rose-600 font-black' : 'text-indigo-600 font-extrabold'}>{allocatedHours.toFixed(1)}</span> / 8.0 Hrs
                  </div>
                  <div className="px-4 py-2 bg-blue-50 border border-blue-200 rounded-xl text-xs font-bold text-blue-900 shadow-xs">
                    Free Hours (8 - today&apos;s Hours): <span className="font-black text-blue-700">{freeHours.toFixed(1)} Hrs</span>
                  </div>
                </div>
              </div>

              {/* Required Green Fields Banner */}
              <div className="bg-emerald-50/70 border border-emerald-300 rounded-xl p-4 flex items-center justify-between text-xs text-emerald-950">
                <div className="flex items-center gap-2 font-bold">
                  <CheckSquare size={18} className="text-emerald-600 flex-shrink-0" />
                  <span>Required Green Fields: Action Taken and Hours must be completed before submission. Date is automatic today.</span>
                </div>
                <span className="text-[11px] font-black bg-emerald-200 text-emerald-950 px-2.5 py-1 rounded-md">
                  * Required Green Entries
                </span>
              </div>

              {/* Global Error Banner */}
              {boardGlobalError && (
                <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl text-xs font-bold text-rose-800 flex items-center gap-2">
                  <AlertCircle size={18} className="text-rose-600 flex-shrink-0" />
                  <span>{boardGlobalError}</span>
                </div>
              )}

              {/* Section 8 Table Interface */}
              {dailyBoard.length === 0 ? (
                /* Empty State */
                <div className="text-center py-16 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                  <ListTodo size={42} className="mx-auto text-slate-300 mb-3" />
                  <h3 className="text-base font-bold text-slate-800">No daily entry tasks available</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Select an assigned task or Office Works preset below to add it to your Daily Entry Task Board.
                  </p>
                  <button
                    onClick={() => {
                      const el = document.getElementById('available-tasks-section');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="mt-4 px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs rounded-xl shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus size={15} />
                    <span>Browse & Add Tasks</span>
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[900px]">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 text-xs font-extrabold uppercase tracking-wider border-b border-slate-200">
                        <th className="py-3.5 px-4 w-[20%] rounded-tl-xl">Project</th>
                        <th className="py-3.5 px-4 w-[25%]">Task</th>
                        <th className="py-3.5 px-4 w-[30%] bg-emerald-100/70 text-emerald-950 border-x border-emerald-300">
                          Action Taken * (Green Entry)
                        </th>
                        <th className="py-3.5 px-4 w-[12%] bg-slate-100 text-slate-800 border-r border-slate-200 text-center">
                          Date * (Auto)
                        </th>
                        <th className="py-3.5 px-4 w-[8%] bg-emerald-100/70 text-emerald-950 border-r border-emerald-300 text-center">
                          Hours * (Green Entry)
                        </th>
                        <th className="py-3.5 px-4 w-[5%] text-center">Flag</th>
                        <th className="py-3.5 px-4 text-center rounded-tr-xl">Remove</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {dailyBoard.map((item) => {
                        const errs = fieldErrors[item.boardId];

                        return (
                          <tr key={item.boardId} className="hover:bg-slate-50/80 transition">
                            {/* Project */}
                            <td className="py-3.5 px-4 font-bold text-slate-900 align-top">
                              {item.projectName}
                            </td>

                            {/* Task */}
                            <td className="py-3.5 px-4 align-top">
                              <p className="font-bold text-slate-900">{item.taskTitle}</p>
                              {item.details && (
                                <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{item.details}</p>
                              )}
                              <span className={`inline-block mt-1 px-2 py-0.5 text-[10px] font-black rounded ${
                                item.urgency === 'URGENT' ? 'bg-red-100 text-red-800' :
                                item.urgency === 'LESS URGENT' ? 'bg-amber-100 text-amber-800' :
                                item.urgency === 'UPCOMING' ? 'bg-purple-100 text-purple-800' :
                                'bg-indigo-100 text-indigo-800'
                              }`}>
                                {item.urgency}
                              </span>
                            </td>

                            {/* Action Taken (Green Required Field) */}
                            <td className="py-3.5 px-4 bg-emerald-50/40 border-x border-emerald-200 align-top">
                              <textarea
                                rows={2}
                                value={item.actionTaken}
                                onChange={(e) => updateBoardItem(item.boardId, { actionTaken: e.target.value })}
                                placeholder="Enter completed work details..."
                                className={`w-full px-3 py-2 text-xs rounded-lg border transition focus:outline-none ${
                                  errs?.actionTaken 
                                    ? 'bg-rose-50 border-rose-400 focus:ring-2 focus:ring-rose-500' 
                                    : 'bg-emerald-50/80 border-emerald-300 text-emerald-950 focus:ring-2 focus:ring-emerald-500 font-medium'
                                }`}
                              />
                              {errs?.actionTaken && (
                                <p className="text-[11px] font-bold text-rose-600 mt-1">{errs.actionTaken}</p>
                              )}
                            </td>

                            {/* Date (System Generated Today's Date) */}
                            <td className="py-3.5 px-4 bg-slate-50/70 border-r border-slate-200 align-top font-bold text-slate-800 whitespace-nowrap text-center">
                              <div className="px-2.5 py-2 bg-slate-100 border border-slate-300 rounded-lg text-center text-[11px]">
                                {item.date}
                              </div>
                            </td>

                            {/* Hours (Green Required Field) */}
                            <td className="py-3.5 px-4 bg-emerald-50/40 border-r border-emerald-200 align-top w-28">
                              <input
                                type="number"
                                step="0.5"
                                min="0.1"
                                max="8"
                                value={item.hours || ''}
                                onChange={(e) => updateBoardItem(item.boardId, { hours: parseFloat(e.target.value) || 0 })}
                                placeholder="Hrs"
                                className={`w-full px-3 py-2 text-xs rounded-lg border font-bold text-center transition focus:outline-none ${
                                  errs?.hours || isHoursExceeded
                                    ? 'bg-rose-50 border-rose-400 text-rose-900 focus:ring-2 focus:ring-rose-500'
                                    : 'bg-emerald-50/80 border-emerald-300 text-emerald-950 focus:ring-2 focus:ring-emerald-500'
                                }`}
                              />
                              {errs?.hours && (
                                <p className="text-[11px] font-bold text-rose-600 mt-1">{errs.hours}</p>
                              )}
                            </td>

                            {/* Flag & Comment */}
                            <td className="py-3.5 px-4 align-top">
                              <div className="space-y-1.5">
                                <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-700">
                                  <input
                                    type="checkbox"
                                    checked={item.flagged}
                                    onChange={(e) => updateBoardItem(item.boardId, { flagged: e.target.checked })}
                                    className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                                  />
                                  <span>Flag</span>
                                </label>
                                {item.flagged && (
                                  <div>
                                    <input
                                      type="text"
                                      value={item.flagComment}
                                      onChange={(e) => updateBoardItem(item.boardId, { flagComment: e.target.value })}
                                      placeholder="Flag reason/comment..."
                                      className={`w-full px-2.5 py-1.5 text-[11px] rounded-lg border transition focus:outline-none ${
                                        errs?.flagComment ? 'bg-rose-50 border-rose-400' : 'bg-amber-50/60 border-amber-300 text-amber-950'
                                      }`}
                                    />
                                    {errs?.flagComment && (
                                      <p className="text-[10px] font-bold text-rose-600 mt-0.5">{errs.flagComment}</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Remove */}
                            <td className="py-3.5 px-4 text-center align-top">
                              <button
                                onClick={() => setRemoveTargetId(item.boardId)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                title="Remove task from daily board"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Submit Button Section */}
              {dailyBoard.length > 0 && (
                <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <p className="text-xs text-slate-500">
                    * Make sure all required green entries (Action Taken & Hours) are filled accurately before submitting.
                  </p>

                  <button
                    disabled={submitting || isHoursExceeded}
                    onClick={handleSubmitDailyBoard}
                    className={`px-8 py-3 rounded-xl font-extrabold text-sm shadow-md transition flex items-center gap-2 cursor-pointer ${
                      submitting || isHoursExceeded
                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                        : 'bg-[#2563EB] hover:bg-[#1D4ED8] text-white'
                    }`}
                  >
                    <Save size={18} />
                    <span>{submitting ? 'Submitting...' : 'SUBMIT DAILY ENTRY'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Available Assigned Project Tasks & Office Works Catalog */}
            <div id="available-tasks-section" className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                <div>
                  <h3 className="text-lg font-black text-[#172554]">Assigned Tasks & Office Works Catalog</h3>
                  <p className="text-xs text-slate-500">Select tasks to add them into your Daily Entry Task Board</p>
                </div>

                {/* Urgency Filter Category Buttons */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {['ALL', 'URGENT', 'LESS URGENT', 'UPCOMING', 'DAILY TASK'].map(urg => (
                    <button
                      key={urg}
                      onClick={() => setUrgencyFilter(urg)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border cursor-pointer ${
                        urgencyFilter === urg 
                          ? 'bg-slate-900 text-white border-slate-900' 
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {urg}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* 1. Sample ZP-School */}
                {(urgencyFilter === 'ALL' || urgencyFilter === 'URGENT') && (
                  <div className="border border-red-200 rounded-xl p-4 bg-red-50/20 shadow-xs space-y-3">
                    <div className="flex justify-between items-start">
                      <span className="px-2.5 py-0.5 text-[10px] font-black rounded bg-red-100 text-red-800">
                        URGENT
                      </span>
                      <span className="text-xs font-bold text-slate-500">{SAMPLE_PROJECT.projectName}</span>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{SAMPLE_PROJECT.taskTitle}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">{SAMPLE_PROJECT.details}</p>
                    </div>

                    <button
                      disabled={dailyBoard.some(b => b.taskTitle === SAMPLE_PROJECT.taskTitle)}
                      onClick={() => handleAddToDailyBoard({
                        taskId: SAMPLE_PROJECT.id,
                        projectId: SAMPLE_PROJECT.id,
                        projectName: SAMPLE_PROJECT.projectName,
                        taskTitle: SAMPLE_PROJECT.taskTitle,
                        details: SAMPLE_PROJECT.details,
                        urgency: 'URGENT'
                      })}
                      className={`w-full py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        dailyBoard.some(b => b.taskTitle === SAMPLE_PROJECT.taskTitle)
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-not-allowed'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                      }`}
                    >
                      {dailyBoard.some(b => b.taskTitle === SAMPLE_PROJECT.taskTitle) ? (
                        <>
                          <Check size={14} />
                          <span>Added to Board</span>
                        </>
                      ) : (
                        <>
                          <Plus size={14} />
                          <span>Add to Daily Entry</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* 2. Real Assigned Tasks */}
                {tasks
                  .filter(t => t.status !== 'Completed')
                  .filter(t => {
                    if (urgencyFilter === 'ALL') return true;
                    const urg = getUrgencyFromPriority(t.priority);
                    return urg.includes(urgencyFilter);
                  })
                  .map(t => {
                    const taskId = t.id || t._id || '';
                    const urgency = getUrgencyFromPriority(t.priority);
                    const isAdded = dailyBoard.some(b => b.taskId === taskId || b.taskTitle === t.title);

                    return (
                      <div key={taskId} className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs space-y-3 hover:border-indigo-200 transition">
                        <div className="flex justify-between items-start">
                          <span className={`px-2.5 py-0.5 text-[10px] font-black rounded ${
                            urgency === 'URGENT' ? 'bg-red-100 text-red-800' :
                            urgency === 'LESS URGENT' ? 'bg-amber-100 text-amber-800' :
                            urgency === 'UPCOMING' ? 'bg-purple-100 text-purple-800' :
                            'bg-indigo-100 text-indigo-800'
                          }`}>
                            {urgency}
                          </span>
                          <span className="text-xs font-bold text-slate-500">{t.projectName}</span>
                        </div>

                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">{t.title}</h4>
                          <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{t.description}</p>
                        </div>

                        <button
                          disabled={isAdded}
                          onClick={() => handleAddToDailyBoard({
                            taskId,
                            projectId: t.projectId,
                            projectName: t.projectName || 'Project',
                            taskTitle: t.title,
                            details: t.description,
                            urgency
                          })}
                          className={`w-full py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                            isAdded
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-not-allowed'
                              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                          }`}
                        >
                          {isAdded ? (
                            <>
                              <Check size={14} />
                              <span>Added to Board</span>
                            </>
                          ) : (
                            <>
                              <Plus size={14} />
                              <span>Add to Daily Entry</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
              </div>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tasks.map(t => (
                <div key={t.id || t._id} className="border border-slate-200 rounded-xl p-5 bg-white shadow-xs space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="text-[11px] px-2.5 py-0.5 rounded font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {t.priority}
                    </span>
                    <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-slate-100 text-slate-700">
                      {t.status}
                    </span>
                  </div>

                  <h4 className="font-bold text-slate-900 text-sm">{t.title}</h4>
                  <p className="text-xs text-slate-500">Project: <span className="font-bold text-slate-700">{t.projectName}</span></p>
                  <p className="text-xs text-slate-600">{t.description}</p>
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
              <span>Total Hours Calculated: <span className="text-indigo-600 text-sm font-black">{totalReportHours.toFixed(1)} Hours</span></span>
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
                        <td className="py-3 px-4 font-black text-indigo-600">{entry.hours} hrs</td>
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
            <div className="border-b border-slate-200 pb-4">
              <h3 className="text-lg font-black text-[#172554]">Completed Task History</h3>
              <p className="text-xs text-slate-500">Only Director-approved & fully completed task records</p>
            </div>

            {tasks.filter(t => t.status === 'Completed' && t.approvedBy).length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <CheckCircle2 size={36} className="mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-bold text-slate-700">No completed task history available.</p>
                <p className="text-xs text-slate-500 mt-1">Tasks appear here only after 100% submission and Director approval.</p>
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
                      <th className="py-3.5 px-4 text-center">Hours Worked</th>
                      <th className="py-3.5 px-4">Action Taken</th>
                      <th className="py-3.5 px-4">Relevant Remarks</th>
                      <th className="py-3.5 px-4 text-center">Approval Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-medium">
                    {tasks
                      .filter(t => t.status === 'Completed' && t.approvedBy)
                      .map(t => {
                        const taskIdStr = t.id || t._id;
                        const taskEntries = dailyHistory.filter(e => e.taskId === taskIdStr);
                        const hoursWorked = taskEntries.reduce((acc, e) => acc + (Number(e.hours) || 0), 0);
                        const actionTaken = taskEntries.length > 0 ? taskEntries[0].actionTaken : (t.description || '-');
                        const remarks = t.approvalRemarks || t.description || '-';
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
                            <td className="py-3.5 px-4 text-center font-black text-indigo-600">
                              {hoursWorked > 0 ? `${hoursWorked.toFixed(1)} hrs` : '-'}
                            </td>
                            <td className="py-3.5 px-4 text-slate-700">{actionTaken}</td>
                            <td className="py-3.5 px-4 text-slate-600">{remarks}</td>
                            <td className="py-3.5 px-4 text-center">
                              <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-blue-100 text-blue-800">
                                Director Approved
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
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
                {reminders.map(r => (
                  <div key={r.id || r._id} className="p-4 border border-slate-200 bg-slate-50/70 rounded-xl text-xs space-y-2 hover:border-slate-300 transition">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-900 text-sm">{r.taskTitle}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-500 font-semibold">{r.reminderDate}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          r.status === 'Replied' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {r.status}
                        </span>
                      </div>
                    </div>
                    {r.message && <p className="text-slate-600 font-medium">{r.message}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 7: MY PERFORMANCE */}
        {activeTab === 'performance' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
              <div>
                <h3 className="text-lg font-black text-[#172554]">MY PERFORMANCE</h3>
                <p className="text-xs text-slate-500">Database-calculated weekly and monthly performance analysis</p>
              </div>

              {/* Weekly / Monthly Toggle Buttons */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  onClick={() => setPerfTab('weekly')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                    perfTab === 'weekly'
                      ? 'bg-[#2563EB] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Weekly
                </button>
                <button
                  onClick={() => setPerfTab('monthly')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                    perfTab === 'monthly'
                      ? 'bg-[#2563EB] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Monthly
                </button>
              </div>
            </div>

            {/* Performance Cards */}
            {perfTab === 'weekly' ? (
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">WEEKLY PERFORMANCE</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-2xl space-y-1">
                    <p className="text-xs font-bold text-blue-700 uppercase tracking-wider">Work Done</p>
                    <p className="text-2xl font-black text-blue-950">
                      {performance?.weekly?.workDone ?? performance?.tasksCompleted ?? 0}
                    </p>
                    <p className="text-[11px] text-blue-600 font-medium">Completed task entries this week</p>
                  </div>

                  <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-1">
                    <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Work Hours</p>
                    <p className="text-2xl font-black text-emerald-950">
                      {performance?.weekly?.workHours ?? 0} <span className="text-sm font-bold">hrs</span>
                    </p>
                    <p className="text-[11px] text-emerald-600 font-medium">Calculated from daily entries</p>
                  </div>

                  <div className="p-4 bg-purple-50/60 border border-purple-200 rounded-2xl space-y-1">
                    <p className="text-xs font-bold text-purple-700 uppercase tracking-wider">Free Hours</p>
                    <p className="text-2xl font-black text-purple-950">
                      {performance?.weekly?.freeHours ?? 0} <span className="text-sm font-bold">hrs</span>
                    </p>
                    <p className="text-[11px] text-purple-600 font-medium">(40 hrs standard - Work Hours)</p>
                  </div>

                  <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-2xl space-y-1">
                    <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">Marking</p>
                    <p className="text-2xl font-black text-amber-950">
                      {performance?.weekly?.marking ?? performance?.directorRating ?? 4.5} <span className="text-sm font-bold">/ 5</span>
                    </p>
                    <p className="text-[11px] text-amber-600 font-medium">Director score (Read-only)</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">MONTHLY PERFORMANCE</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-2xl space-y-1">
                    <p className="text-xs font-bold text-blue-700 uppercase tracking-wider">Work Done</p>
                    <p className="text-2xl font-black text-blue-950">
                      {performance?.monthly?.workDone ?? performance?.tasksCompleted ?? 0}
                    </p>
                    <p className="text-[11px] text-blue-600 font-medium">Completed task entries this month</p>
                  </div>

                  <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-1">
                    <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Work Hours</p>
                    <p className="text-2xl font-black text-emerald-950">
                      {performance?.monthly?.workHours ?? 0} <span className="text-sm font-bold">hrs</span>
                    </p>
                    <p className="text-[11px] text-emerald-600 font-medium">Calculated from daily entries</p>
                  </div>

                  <div className="p-4 bg-purple-50/60 border border-purple-200 rounded-2xl space-y-1">
                    <p className="text-xs font-bold text-purple-700 uppercase tracking-wider">Free Hours</p>
                    <p className="text-2xl font-black text-purple-950">
                      {performance?.monthly?.freeHours ?? 0} <span className="text-sm font-bold">hrs</span>
                    </p>
                    <p className="text-[11px] text-purple-600 font-medium">(176 hrs standard - Work Hours)</p>
                  </div>

                  <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-2xl space-y-1">
                    <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">Marking</p>
                    <p className="text-2xl font-black text-amber-950">
                      {performance?.monthly?.marking ?? performance?.directorRating ?? 4.5} <span className="text-sm font-bold">/ 5</span>
                    </p>
                    <p className="text-[11px] text-amber-600 font-medium">Director score (Read-only)</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 7: FLAGS */}
        {activeTab === 'flags' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h3 className="text-lg font-black text-[#172554]">Flags</h3>
              <p className="text-xs text-slate-500">Task flags under management review</p>
            </div>

            <div className="space-y-4">
              {flags.map(f => (
                <div key={f.id || f._id} className="p-4 border border-rose-200 bg-rose-50/20 rounded-xl text-xs space-y-2">
                  <div className="flex justify-between items-center">
                    <p className="font-bold text-slate-900">{f.taskTitle}</p>
                    <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-100 text-rose-800">
                      {f.status}
                    </span>
                  </div>
                  <p className="text-slate-700">{f.flagMessage}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 7: PROFILE */}
        {activeTab === 'profile' && <EmployeeProfile />}

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
                    disabled={isSavingDailyWork}
                    className="px-5 py-2.5 text-xs font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:bg-slate-300 disabled:cursor-not-allowed"
                  >
                    {isSavingDailyWork ? 'Saving...' : 'Add Work'}
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
