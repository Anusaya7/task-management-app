'use client'

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Project,
  Task,
  Employee,
  Flag,
  Reminder,
  EmployeePerformance,
  DailyEntry,
  TaskPriority,
  ProjectStatus
} from '../types';
import Sidebar, { TabType } from './Sidebar';
import ProjectModal from './ProjectModal';
import TaskModal from './TaskModal';
import EmployeeModal from './EmployeeModal';
import NotificationCenter from './NotificationCenter';
import DirectorProfile from './DirectorProfile';
import {
  PriorityBadge,
  ProjectStatusBadge,
  EmployeeStatusBadge,
  EmployeeAvatar,
  SkeletonCard,
  SkeletonTable
} from './BadgeUtils';
import {
  FolderOpen,
  CheckSquare,
  Clock,
  AlertTriangle,
  Users,
  Flag as FlagIcon,
  Plus,
  CheckCircle2,
  Star,
  UserCheck,
  UserX,
  Edit,
  Trash2,
  RotateCcw,
  MessageSquare,
  ShieldCheck,
  Send,
  BarChart3,
  Calendar,
  Search,
  ListTodo,
  Layers,
  Sparkles,
  ArrowRight,
  FileText,
  CalendarCheck,
  AlertCircle,
  Filter
} from 'lucide-react';

const FLAG_TYPES = [
  'Needs Input',
  'Needs Attention',
  'Progress Concern',
  'Client Dependency',
  'Technical Issue',
  'Priority Change',
  'On Track'
];

const Dashboard: React.FC = () => {
  const { user, isDirector, isProjectHead } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [performanceData, setPerformanceData] = useState<EmployeePerformance[]>([]);
  const [dailyEntries, setDailyEntries] = useState<DailyEntry[]>([]);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals state
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  // Confirmation Modal for Deletions
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'project' | 'employee' | 'task'; id: string; name: string } | null>(null);

  // Private Rating Modal State (Director only)
  const [ratingModalTask, setRatingModalTask] = useState<Task | null>(null);
  const [ratingValue, setRatingValue] = useState<number>(5);
  const [ratingComment, setRatingComment] = useState<string>('');

  // Flag Task Modal State (Director & Project Head)
  const [managementFlagTask, setManagementFlagTask] = useState<Task | null>(null);
  const [managementFlagType, setManagementFlagType] = useState<string>('Progress Concern');
  const [managementFlagMessage, setManagementFlagMessage] = useState<string>('');

  // Flag Resolution State: flagId -> responseText
  const [flagResponses, setFlagResponses] = useState<Record<string, string>>({});

  // Overview & Management Filters
  const [projectStatusFilter, setProjectStatusFilter] = useState<string>('all');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState<string>('all');
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>('all');
  const [taskSearch, setTaskSearch] = useState<string>('');
  const [employeeSearch, setEmployeeSearch] = useState<string>('');

  // Daily Task Board Filters
  const [boardEmployeeFilter, setBoardEmployeeFilter] = useState<string>('all');
  const [boardProjectFilter, setBoardProjectFilter] = useState<string>('all');
  const [boardDateFilter, setBoardDateFilter] = useState<string>('');
  const [boardSearch, setBoardSearch] = useState<string>('');
  const [boardStatusFilter, setBoardStatusFilter] = useState<string>('all');

  // Daily Reports Filters
  const [reportDateFilter, setReportDateFilter] = useState<string>('');
  const [reportEmployeeFilter, setReportEmployeeFilter] = useState<string>('all');
  const [reportProjectFilter, setReportProjectFilter] = useState<string>('all');
  const [reportStatusFilter, setReportStatusFilter] = useState<string>('all');

  // Completed History Sub-Tab
  const [completedSubTab, setCompletedSubTab] = useState<'tasks' | 'projects' | 'daily'>('tasks');

  // Reminders Filter
  const [reminderStatusFilter, setReminderStatusFilter] = useState<'ALL' | 'TODAY' | 'UPCOMING' | 'OVERDUE' | 'NOT_REPLIED'>('ALL');

  // Flags Filter
  const [flagStatusFilter, setFlagStatusFilter] = useState<'OPEN' | 'RESOLVED' | 'ALL'>('OPEN');

  const fetchData = async (isInitial = false) => {
    try {
      if (isInitial) {
        setLoading(true);
      }
      const [projectsRes, tasksRes, empRes, flagsRes, perfRes, remindersRes, dailyRes] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/tasks'),
        fetch('/api/employees'),
        fetch('/api/flags'),
        fetch('/api/performance'),
        fetch('/api/reminders'),
        fetch('/api/daily-entries')
      ]);

      if (projectsRes.ok) setProjects(await projectsRes.json());
      if (tasksRes.ok) setTasks(await tasksRes.json());
      if (empRes.ok) setEmployees(await empRes.json());
      if (flagsRes.ok) setFlags(await flagsRes.json());
      if (perfRes.ok) setPerformanceData(await perfRes.json());
      if (remindersRes.ok) setReminders(await remindersRes.json());
      if (dailyRes.ok) setDailyEntries(await dailyRes.json());

    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      if (isInitial) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchData(true);
    // Auto-poll every 10 seconds for real-time updates
    const interval = setInterval(() => fetchData(false), 10000);
    return () => clearInterval(interval);
  }, []);

  const showToast = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  // Today's Date String YYYY-MM-DD (Asia/Kolkata)
  const getKolkataDateString = () => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  };

  const todayDateStr = getKolkataDateString();

  const todayFormatted = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(new Date());

  // 10 EXACT SUMMARY CARDS
  const stats = {
    totalProjects: projects.length,
    activeProjects: projects.filter(p => p.status === 'Current').length,
    upcomingProjects: projects.filter(p => p.status === 'Upcoming').length,
    sleepingProjects: projects.filter(p => p.status === 'Sleeping (On Hold)').length,
    completedProjects: projects.filter(p => p.status === 'Completed').length,
    totalEmployees: employees.length,
    currentTasks: tasks.filter(t => ['Pending', 'In Progress'].includes(t.status)).length,
    pendingApprovals: tasks.filter(t => t.status === 'Pending Approval' || t.workDone === 100).length,
    overdueTasks: tasks.filter(t => Boolean(t.dueDate && t.dueDate < todayDateStr && t.status !== 'Completed')).length,
    openFlags: flags.filter(f => f.status === 'Open').length
  };

  // ACTION REQUIRED CATEGORIES
  const openFlagsList = flags.filter(f => f.status === 'Open');
  const pendingApprovalTasks = tasks.filter(t => t.status === 'Pending Approval' || (t.workDone === 100 && t.status !== 'Completed'));
  const unrepliedRemindersList = reminders.filter(r => r.status === 'Not Replied' || (r.reminderDate && r.reminderDate < todayDateStr && r.status !== 'Replied'));
  const overdueTasksList = tasks.filter(t => Boolean(t.dueDate && t.dueDate < todayDateStr && t.status !== 'Completed'));
  const submittedDailyWorkToday = dailyEntries.filter(d => d.date === todayDateStr);
  const updatePendingTasksList = tasks.filter(t => ['Not Updated', 'Revision Required', 'Not Replied'].includes(t.status));

  // Completion Approval Action (Director Only)
  const handleApproveCompletion = async (taskId: string, approved: boolean, remarkText?: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/approve-completion`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approved,
          remarks: remarkText || (approved ? 'Completion Approved by Director' : 'Requires Revisions')
        })
      });

      if (!res.ok) {
        const data = await res.json();
        showToast('error', data.error || 'Failed to approve task completion');
        return;
      }

      showToast('success', approved ? 'Task completion approved! Marked as Completed.' : 'Task returned for revision. Employee notified.');
      fetchData();
    } catch (err) {
      showToast('error', 'Network error.');
    }
  };

  // Handle Management Creating a Flag on a Task
  const handleCreateManagementFlag = async () => {
    if (!managementFlagTask || !managementFlagMessage.trim()) return;
    const tId = managementFlagTask.id || managementFlagTask._id || '';

    try {
      const res = await fetch('/api/flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: tId,
          flagType: managementFlagType,
          flagMessage: managementFlagMessage.trim()
        })
      });

      if (!res.ok) {
        const data = await res.json();
        showToast('error', data.error || 'Failed to flag task');
        return;
      }

      showToast('success', 'Task flagged successfully. Employee notified.');
      setManagementFlagTask(null);
      setManagementFlagMessage('');
      fetchData();
    } catch (err) {
      showToast('error', 'Network error.');
    }
  };

  // Resolve Flag Action
  const handleResolveFlag = async (flagId: string) => {
    const responseText = flagResponses[flagId] || 'Resolved by management';
    try {
      const res = await fetch(`/api/flags/${flagId}/resolve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: responseText })
      });

      if (!res.ok) {
        const data = await res.json();
        showToast('error', data.error || 'Failed to resolve flag');
        return;
      }

      showToast('success', 'Flag resolved successfully.');
      fetchData();
    } catch (err) {
      showToast('error', 'Network error.');
    }
  };

  // Delete Handlers
  const handleDeleteProject = async (projectId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        showToast('error', data.error || 'Failed to delete project');
        return;
      }
      showToast('success', 'Project deleted successfully.');
      setDeleteConfirm(null);
      fetchData();
    } catch (err) {
      showToast('error', 'Network error.');
    }
  };

  const handleDeleteEmployee = async (employeeId: string) => {
    try {
      const res = await fetch(`/api/employees/${employeeId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        showToast('error', data.error || 'Failed to update employee status');
        return;
      }
      showToast('success', 'Employee status set to Inactive.');
      setDeleteConfirm(null);
      fetchData();
    } catch (err) {
      showToast('error', 'Network error.');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        showToast('error', data.error || 'Failed to delete task');
        return;
      }
      showToast('success', 'Task deleted successfully.');
      setDeleteConfirm(null);
      fetchData();
    } catch (err) {
      showToast('error', 'Network error.');
    }
  };

  // Save Director Private Rating
  const handleSavePrivateRating = async () => {
    if (!ratingModalTask) return;
    const tId = ratingModalTask.id || ratingModalTask._id || '';
    const empId = ratingModalTask.assignedEmployeeIds[0] || '';

    try {
      const res = await fetch('/api/private-ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: tId,
          employeeId: empId,
          rating: ratingValue,
          privateComment: ratingComment
        })
      });

      if (!res.ok) {
        const data = await res.json();
        showToast('error', data.error || 'Failed to save private rating');
        return;
      }

      showToast('success', 'Private star rating saved.');
      setRatingModalTask(null);
      fetchData();
    } catch (err) {
      showToast('error', 'Network error.');
    }
  };

  // Save Project Handler
  const handleSaveProject = async (projectData: any) => {
    try {
      const isEdit = !!projectData.id || !!projectData._id;
      const url = isEdit ? `/api/projects/${projectData.id || projectData._id}` : '/api/projects';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save project');
      }

      showToast('success', isEdit ? 'Project updated successfully.' : 'Project created successfully.');
      fetchData();
    } catch (err: any) {
      throw err;
    }
  };

  // Save Task Handler
  const handleSaveTask = async (taskData: any) => {
    try {
      const isEdit = !!selectedTask;
      const url = isEdit ? `/api/tasks/${selectedTask?.id || selectedTask?._id}` : '/api/tasks';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save task');
      }

      showToast('success', isEdit ? 'Task updated.' : 'Task created.');
      fetchData();
    } catch (err: any) {
      throw err;
    }
  };

  // Save Employee Handler
  const handleSaveEmployee = async (employeeData: any) => {
    try {
      const isEdit = !!employeeData.id || !!employeeData._id;
      const url = isEdit ? `/api/employees/${employeeData.id || employeeData._id}` : '/api/employees';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(employeeData)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save employee');
      }

      showToast('success', isEdit ? 'Employee updated.' : 'Employee added successfully.');
      fetchData();
    } catch (err: any) {
      throw err;
    }
  };

  const completedTasks = tasks.filter(t => t.status === 'Completed');
  const activeTasks = tasks.filter(t => ['Pending', 'In Progress'].includes(t.status));

  // My Tasks (Assigned to logged in Director)
  const myDirectorTasks = tasks.filter(t => {
    const uId = user?.id || (user as any)?._id || '';
    return t.assignedEmployeeIds?.includes(uId) || t.assignedById === uId;
  });

  // Filtered views
  const filteredProjects = projects.filter(p => {
    if (projectStatusFilter !== 'all' && p.status !== projectStatusFilter) return false;
    return true;
  });

  const filteredTasks = tasks.filter(t => {
    if (taskPriorityFilter !== 'all' && t.priority !== taskPriorityFilter) return false;
    if (taskStatusFilter !== 'all' && t.status !== taskStatusFilter) return false;
    if (taskSearch && !t.title.toLowerCase().includes(taskSearch.toLowerCase()) && !(t.projectName || '').toLowerCase().includes(taskSearch.toLowerCase())) return false;
    return true;
  });

  const filteredEmployees = employees.filter(e => {
    if (employeeSearch && !`${e.firstName} ${e.lastName}`.toLowerCase().includes(employeeSearch.toLowerCase()) && !e.email.toLowerCase().includes(employeeSearch.toLowerCase())) return false;
    return true;
  });

  // Filtered Daily Board
  const filteredDailyBoard = dailyEntries.filter(entry => {
    if (boardEmployeeFilter !== 'all' && entry.employeeId !== boardEmployeeFilter) return false;
    if (boardProjectFilter !== 'all' && entry.projectId !== boardProjectFilter) return false;
    if (boardDateFilter && entry.date !== boardDateFilter) return false;
    if (boardStatusFilter !== 'all' && entry.status !== boardStatusFilter) return false;
    if (boardSearch && !entry.taskTitle.toLowerCase().includes(boardSearch.toLowerCase()) && !(entry.actionTaken || '').toLowerCase().includes(boardSearch.toLowerCase())) return false;
    return true;
  });

  // Filtered Daily Reports
  const filteredDailyReports = dailyEntries.filter(entry => {
    if (reportDateFilter && entry.date !== reportDateFilter) return false;
    if (reportEmployeeFilter !== 'all' && entry.employeeId !== reportEmployeeFilter) return false;
    if (reportProjectFilter !== 'all' && entry.projectId !== reportProjectFilter) return false;
    if (reportStatusFilter !== 'all' && entry.status !== reportStatusFilter) return false;
    return true;
  });

  const reportTotalHours = filteredDailyReports.reduce((sum, e) => sum + (e.hours || 0), 0);

  // Filtered Reminders
  const filteredReminders = reminders.filter(rem => {
    if (reminderStatusFilter === 'TODAY') return rem.reminderDate === todayDateStr;
    if (reminderStatusFilter === 'UPCOMING') return rem.reminderDate && rem.reminderDate > todayDateStr;
    if (reminderStatusFilter === 'OVERDUE') return rem.reminderDate && rem.reminderDate < todayDateStr && rem.status !== 'Replied';
    if (reminderStatusFilter === 'NOT_REPLIED') return rem.status === 'Not Replied';
    return true;
  });

  // Director's Own Performance Calculation
  const directorPerformance = {
    tasksCreated: tasks.filter(t => t.assignedById === user?.id || t.assignedById === (user as any)?._id).length,
    tasksCompleted: tasks.filter(t => t.status === 'Completed' && (t.assignedById === user?.id || t.assignedById === (user as any)?._id)).length,
    projectsManaged: projects.length,
    flagsResolved: flags.filter(f => f.status === 'Resolved').length,
    approvalsProcessed: tasks.filter(t => t.approvedBy || t.status === 'Completed').length,
    dailyEntriesReviewed: dailyEntries.length
  };

  return (
    <div className="flex bg-[#F8FAFC] min-h-screen font-sans text-slate-800 antialiased">
      {/* Grouped Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        flagCount={openFlagsList.length}
        reminderCount={unrepliedRemindersList.length}
      />

      {/* Main Workspace */}
      <div className="flex-1 w-full pt-20 px-4 pb-12 md:pt-6 md:px-8 md:ml-64 transition-all">

        {/* Sticky Corporate Top Header */}
        <div className="bg-white rounded-[14px] border border-[#E2E8F0] p-4 md:px-6 md:py-4 mb-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <img
              src="/logo.png"
              alt="Korals Design Logo"
              className="h-10 w-auto object-contain bg-black px-2 py-1 rounded-xl border border-slate-200 shadow-xs hidden sm:block"
            />
            <EmployeeAvatar name={user?.name || 'Director'} size="lg" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-[#0F172A] tracking-tight">
                  {isDirector ? 'Director Project Monitoring Dashboard' : 'Project Head Dashboard'}
                </h1>
                <span className="px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded-md bg-[#2563EB] text-white">
                  {user?.role || 'DIRECTOR'}
                </span>
              </div>
              <p className="text-xs text-[#64748B] mt-0.5">
                Executive oversight &bull; <span className="font-medium text-[#334155]">{user?.email}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <NotificationCenter onSelectTask={() => setActiveTab('tasks')} />

            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-xs font-semibold text-[#475569]">
              <Calendar size={14} className="text-[#2563EB]" />
              <span>{todayFormatted}</span>
            </div>

            {isDirector && (
              <button
                onClick={() => { setSelectedProject(null); setIsProjectModalOpen(true); }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#0F172A] hover:bg-[#1E293B] text-white font-semibold rounded-lg text-xs shadow-xs transition cursor-pointer"
              >
                <Plus size={14} />
                <span>New Project</span>
              </button>
            )}

            <button
              onClick={() => { setSelectedTask(null); setIsTaskModalOpen(true); }}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold rounded-lg text-xs shadow-xs transition cursor-pointer"
            >
              <Plus size={14} />
              <span>Create Task</span>
            </button>
          </div>
        </div>

        {/* Global Toast Banner */}
        {message && (
          <div className={`mb-6 p-4 rounded-xl flex items-center justify-between text-xs font-semibold shadow-xs border ${
            message.type === 'success'
              ? 'bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]'
              : 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]'
          }`}>
            <span>{message.text}</span>
            <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-600 text-base">&times;</button>
          </div>
        )}

        {/* TAB 1: DASHBOARD OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">

            {/* ACTION REQUIRED SECTION */}
            {(openFlagsList.length > 0 || pendingApprovalTasks.length > 0 || unrepliedRemindersList.length > 0 || overdueTasksList.length > 0 || submittedDailyWorkToday.length > 0 || updatePendingTasksList.length > 0) && (
              <div className="bg-white rounded-[14px] border border-[#FECACA] shadow-sm p-6 space-y-4 bg-gradient-to-r from-red-50/30 to-amber-50/20">
                <div className="flex items-center justify-between pb-3 border-b border-rose-200">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={20} className="text-[#DC2626]" />
                    <h2 className="text-base font-extrabold text-[#0F172A] tracking-tight">ACTION REQUIRED — EXECUTIVE ATTENTION</h2>
                  </div>
                  <span className="px-2.5 py-0.5 bg-[#DC2626] text-white text-[10px] font-extrabold rounded uppercase tracking-wider">
                    {openFlagsList.length + pendingApprovalTasks.length + unrepliedRemindersList.length + overdueTasksList.length} ITEMS PENDING
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

                  {/* A. NEW TASK FLAGS */}
                  {openFlagsList.length > 0 && (
                    <div className="bg-white border border-[#FECACA] rounded-xl p-4 shadow-2xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 bg-rose-100 text-[#DC2626] text-[10px] font-extrabold rounded uppercase">
                          A. NEW TASK FLAG ({openFlagsList.length})
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold">{openFlagsList[0].flagDate}</span>
                      </div>
                      <h4 className="font-bold text-[#0F172A] text-xs truncate">{openFlagsList[0].taskTitle}</h4>
                      <p className="text-[11px] text-[#475569]">Staff: <span className="font-bold">{openFlagsList[0].employeeName}</span></p>
                      <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded border border-slate-200 line-clamp-2">
                        &quot;{openFlagsList[0].flagMessage}&quot;
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          placeholder="Reply & resolve..."
                          value={flagResponses[openFlagsList[0].id || openFlagsList[0]._id || ''] || ''}
                          onChange={(e) => setFlagResponses({ ...flagResponses, [openFlagsList[0].id || openFlagsList[0]._id || '']: e.target.value })}
                          className="flex-1 px-2.5 py-1 bg-white border border-slate-300 rounded text-[11px]"
                        />
                        <button
                          onClick={() => handleResolveFlag(openFlagsList[0].id || openFlagsList[0]._id || '')}
                          className="px-3 py-1 bg-[#DC2626] text-white text-[11px] font-bold rounded cursor-pointer"
                        >
                          Resolve
                        </button>
                      </div>
                    </div>
                  )}

                  {/* B. 100% TASK COMPLETION APPROVAL REQUIRED */}
                  {pendingApprovalTasks.length > 0 && (
                    <div className="bg-white border border-[#FDE68A] rounded-xl p-4 shadow-2xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 bg-amber-100 text-[#D97706] text-[10px] font-extrabold rounded uppercase">
                          B. APPROVAL REQUIRED ({pendingApprovalTasks.length})
                        </span>
                        <span className="text-[10px] text-amber-700 font-bold">100% Submitted</span>
                      </div>
                      <h4 className="font-bold text-[#0F172A] text-xs truncate">{pendingApprovalTasks[0].title}</h4>
                      <p className="text-[11px] text-[#475569]">Project: <span className="font-bold">{pendingApprovalTasks[0].projectName}</span></p>
                      <p className="text-[11px] text-[#475569]">Staff: {pendingApprovalTasks[0].assignedEmployeeNames?.join(', ')}</p>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => handleApproveCompletion(pendingApprovalTasks[0].id || pendingApprovalTasks[0]._id || '', true)}
                          className="flex-1 py-1 bg-[#16A34A] text-white text-[11px] font-bold rounded cursor-pointer text-center"
                        >
                          Approve (100%)
                        </button>
                        <button
                          onClick={() => handleApproveCompletion(pendingApprovalTasks[0].id || pendingApprovalTasks[0]._id || '', false)}
                          className="px-3 py-1 bg-slate-100 text-[#334155] text-[11px] font-bold rounded border border-slate-300 cursor-pointer"
                        >
                          Revision
                        </button>
                      </div>
                    </div>
                  )}

                  {/* C. REMINDER NOT REPLIED */}
                  {unrepliedRemindersList.length > 0 && (
                    <div className="bg-white border border-[#FED7AA] rounded-xl p-4 shadow-2xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 bg-orange-100 text-orange-800 text-[10px] font-extrabold rounded uppercase">
                          C. REMINDER NOT REPLIED ({unrepliedRemindersList.length})
                        </span>
                        <span className="text-[10px] text-orange-700 font-bold">{unrepliedRemindersList[0].reminderDate}</span>
                      </div>
                      <h4 className="font-bold text-[#0F172A] text-xs truncate">{unrepliedRemindersList[0].taskTitle || 'Task Reminder'}</h4>
                      <p className="text-[11px] text-[#475569]">Staff: <span className="font-bold">{unrepliedRemindersList[0].employeeName}</span></p>
                      <button
                        onClick={() => setActiveTab('reminders')}
                        className="w-full mt-1 py-1 bg-orange-600 hover:bg-orange-700 text-white text-[11px] font-bold rounded transition text-center cursor-pointer"
                      >
                        Follow Up Reminders
                      </button>
                    </div>
                  )}

                  {/* D. OVERDUE TASK */}
                  {overdueTasksList.length > 0 && (
                    <div className="bg-white border border-rose-300 rounded-xl p-4 shadow-2xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-extrabold rounded uppercase">
                          D. OVERDUE TASK ({overdueTasksList.length})
                        </span>
                        <span className="text-[10px] text-rose-700 font-bold">{overdueTasksList[0].dueDate || 'Due Passed'}</span>
                      </div>
                      <h4 className="font-bold text-[#0F172A] text-xs truncate">{overdueTasksList[0].title}</h4>
                      <p className="text-[11px] text-[#475569]">Project: <span className="font-bold">{overdueTasksList[0].projectName}</span></p>
                      <button
                        onClick={() => { setActiveTab('tasks'); setTaskStatusFilter('all'); }}
                        className="w-full mt-1 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold rounded transition text-center cursor-pointer"
                      >
                        Follow Up Task
                      </button>
                    </div>
                  )}

                  {/* E. DAILY WORK SUBMITTED TODAY */}
                  {submittedDailyWorkToday.length > 0 && (
                    <div className="bg-white border border-blue-200 rounded-xl p-4 shadow-2xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 bg-blue-100 text-[#2563EB] text-[10px] font-extrabold rounded uppercase">
                          E. DAILY WORK SUBMITTED TODAY ({submittedDailyWorkToday.length})
                        </span>
                        <span className="text-[10px] text-blue-700 font-bold">{todayDateStr}</span>
                      </div>
                      <h4 className="font-bold text-[#0F172A] text-xs truncate">{submittedDailyWorkToday[0].taskTitle}</h4>
                      <p className="text-[11px] text-[#475569]">Employee: <span className="font-bold">{submittedDailyWorkToday[0].employeeName}</span></p>
                      <p className="text-[11px] text-slate-600 line-clamp-1">Action: {submittedDailyWorkToday[0].actionTaken}</p>
                      <button
                        onClick={() => setActiveTab('today-work')}
                        className="w-full mt-1 py-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[11px] font-bold rounded transition text-center cursor-pointer"
                      >
                        Review Daily Task Board
                      </button>
                    </div>
                  )}

                  {/* F. TASK UPDATE PENDING */}
                  {updatePendingTasksList.length > 0 && (
                    <div className="bg-white border border-purple-200 rounded-xl p-4 shadow-2xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-[10px] font-extrabold rounded uppercase">
                          F. TASK UPDATE PENDING ({updatePendingTasksList.length})
                        </span>
                        <span className="text-[10px] text-purple-700 font-bold">Needs Update</span>
                      </div>
                      <h4 className="font-bold text-[#0F172A] text-xs truncate">{updatePendingTasksList[0].title}</h4>
                      <p className="text-[11px] text-[#475569]">Project: <span className="font-bold">{updatePendingTasksList[0].projectName}</span></p>
                      <button
                        onClick={() => setActiveTab('tasks')}
                        className="w-full mt-1 py-1 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-[11px] font-bold rounded transition text-center cursor-pointer"
                      >
                        Follow Up Update
                      </button>
                    </div>
                  )}

                </div>
              </div>
            )}

            {/* 10 STATS SUMMARY CARDS GRID */}
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {[...Array(10)].map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">

                {/* 1. Total Projects */}
                <button
                  onClick={() => { setActiveTab('projects'); setProjectStatusFilter('all'); }}
                  className="text-left bg-white p-5 rounded-[14px] border border-[#E2E8F0] shadow-xs hover:border-[#2563EB] hover:shadow-md transition cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-[#64748B] mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Total Projects</span>
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center group-hover:bg-[#2563EB] group-hover:text-white transition">
                      <FolderOpen size={16} />
                    </div>
                  </div>
                  <p className="text-2xl font-extrabold text-[#0F172A]">{stats.totalProjects}</p>
                  <p className="text-[11px] text-[#94A3B8] mt-0.5">Registered projects</p>
                </button>

                {/* 2. Active Projects */}
                <button
                  onClick={() => { setActiveTab('projects'); setProjectStatusFilter('Current'); }}
                  className="text-left bg-white p-5 rounded-[14px] border border-[#E2E8F0] shadow-xs hover:border-[#2563EB] hover:shadow-md transition cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-[#64748B] mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#2563EB]">Active Projects</span>
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center group-hover:bg-[#2563EB] group-hover:text-white transition">
                      <Layers size={16} />
                    </div>
                  </div>
                  <p className="text-2xl font-extrabold text-[#2563EB]">{stats.activeProjects}</p>
                  <p className="text-[11px] text-[#94A3B8] mt-0.5">Active execution</p>
                </button>

                {/* 3. Upcoming Projects */}
                <button
                  onClick={() => { setActiveTab('projects'); setProjectStatusFilter('Upcoming'); }}
                  className="text-left bg-white p-5 rounded-[14px] border border-[#E2E8F0] shadow-xs hover:border-[#7C3AED] hover:shadow-md transition cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-[#64748B] mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#7C3AED]">Upcoming</span>
                    <div className="w-8 h-8 rounded-lg bg-purple-50 text-[#7C3AED] flex items-center justify-center group-hover:bg-[#7C3AED] group-hover:text-white transition">
                      <Sparkles size={16} />
                    </div>
                  </div>
                  <p className="text-2xl font-extrabold text-[#7C3AED]">{stats.upcomingProjects}</p>
                  <p className="text-[11px] text-[#94A3B8] mt-0.5">Pipeline stage</p>
                </button>

                {/* 4. Sleeping (On Hold) */}
                <button
                  onClick={() => { setActiveTab('projects'); setProjectStatusFilter('Sleeping (On Hold)'); }}
                  className="text-left bg-white p-5 rounded-[14px] border border-[#E2E8F0] shadow-xs hover:border-[#D97706] hover:shadow-md transition cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-[#64748B] mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#D97706]">On Hold / Sleeping</span>
                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-[#D97706] flex items-center justify-center group-hover:bg-[#D97706] group-hover:text-white transition">
                      <Clock size={16} />
                    </div>
                  </div>
                  <p className="text-2xl font-extrabold text-[#D97706]">{stats.sleepingProjects}</p>
                  <p className="text-[11px] text-[#94A3B8] mt-0.5">Paused projects</p>
                </button>

                {/* 5. Completed Projects */}
                <button
                  onClick={() => { setActiveTab('projects'); setProjectStatusFilter('Completed'); }}
                  className="text-left bg-white p-5 rounded-[14px] border border-[#E2E8F0] shadow-xs hover:border-[#16A34A] hover:shadow-md transition cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-[#64748B] mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#16A34A]">Completed</span>
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#16A34A] flex items-center justify-center group-hover:bg-[#16A34A] group-hover:text-white transition">
                      <CheckCircle2 size={16} />
                    </div>
                  </div>
                  <p className="text-2xl font-extrabold text-[#16A34A]">{stats.completedProjects}</p>
                  <p className="text-[11px] text-[#94A3B8] mt-0.5">Finished projects</p>
                </button>

                {/* 6. Total Employees */}
                <button
                  onClick={() => setActiveTab('employees')}
                  className="text-left bg-white p-5 rounded-[14px] border border-[#E2E8F0] shadow-xs hover:border-[#2563EB] hover:shadow-md transition cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-[#64748B] mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#334155]">Total Employees</span>
                    <div className="w-8 h-8 rounded-lg bg-slate-100 text-[#334155] flex items-center justify-center group-hover:bg-[#0F172A] group-hover:text-white transition">
                      <Users size={16} />
                    </div>
                  </div>
                  <p className="text-2xl font-extrabold text-[#0F172A]">{stats.totalEmployees}</p>
                  <p className="text-[11px] text-[#94A3B8] mt-0.5">Staff roster</p>
                </button>

                {/* 7. Current Tasks */}
                <button
                  onClick={() => setActiveTab('tasks')}
                  className="text-left bg-white p-5 rounded-[14px] border border-[#E2E8F0] shadow-xs hover:border-[#2563EB] hover:shadow-md transition cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-[#64748B] mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#2563EB]">Current Tasks</span>
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center group-hover:bg-[#2563EB] group-hover:text-white transition">
                      <ListTodo size={16} />
                    </div>
                  </div>
                  <p className="text-2xl font-extrabold text-[#2563EB]">{stats.currentTasks}</p>
                  <p className="text-[11px] text-[#94A3B8] mt-0.5">Active tasks</p>
                </button>

                {/* 8. Pending Approvals */}
                <button
                  onClick={() => { setActiveTab('tasks'); setTaskStatusFilter('Pending Approval'); }}
                  className="text-left bg-white p-5 rounded-[14px] border border-[#E2E8F0] shadow-xs hover:border-[#D97706] hover:shadow-md transition cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-[#64748B] mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#D97706]">Pending Approvals</span>
                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-[#D97706] flex items-center justify-center group-hover:bg-[#D97706] group-hover:text-white transition">
                      <Clock size={16} />
                    </div>
                  </div>
                  <p className="text-2xl font-extrabold text-[#D97706]">{stats.pendingApprovals}</p>
                  <p className="text-[11px] text-[#94A3B8] mt-0.5">100% completion pending</p>
                </button>

                {/* 9. Overdue Tasks */}
                <button
                  onClick={() => setActiveTab('tasks')}
                  className="text-left bg-white p-5 rounded-[14px] border border-[#E2E8F0] shadow-xs hover:border-[#DC2626] hover:shadow-md transition cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-[#64748B] mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#DC2626]">Overdue Tasks</span>
                    <div className="w-8 h-8 rounded-lg bg-rose-50 text-[#DC2626] flex items-center justify-center group-hover:bg-[#DC2626] group-hover:text-white transition">
                      <AlertTriangle size={16} />
                    </div>
                  </div>
                  <p className="text-2xl font-extrabold text-[#DC2626]">{stats.overdueTasks}</p>
                  <p className="text-[11px] text-[#94A3B8] mt-0.5">Past due date</p>
                </button>

                {/* 10. Open Flags */}
                <button
                  onClick={() => setActiveTab('flags')}
                  className="text-left bg-white p-5 rounded-[14px] border border-[#E2E8F0] shadow-xs hover:border-[#DC2626] hover:shadow-md transition cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-[#64748B] mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#DC2626]">Open Flags</span>
                    <div className="w-8 h-8 rounded-lg bg-rose-50 text-[#DC2626] flex items-center justify-center group-hover:bg-[#DC2626] group-hover:text-white transition">
                      <FlagIcon size={16} className="fill-current" />
                    </div>
                  </div>
                  <p className="text-2xl font-extrabold text-[#DC2626]">{stats.openFlags}</p>
                  <p className="text-[11px] text-[#94A3B8] mt-0.5">Requires guidance</p>
                </button>

              </div>
            )}

            {/* ACTIVE TASK PIPELINE CARDS */}
            <div className="bg-white rounded-[14px] border border-[#E2E8F0] p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0]">
                <div>
                  <h3 className="text-base font-bold text-[#0F172A]">Active Task Pipeline Overview</h3>
                  <p className="text-xs text-[#64748B]">Real-time employee execution &amp; completion status</p>
                </div>
                <button
                  onClick={() => setActiveTab('tasks')}
                  className="text-xs font-bold text-[#2563EB] hover:text-[#1D4ED8] flex items-center gap-1 cursor-pointer"
                >
                  View All Tasks <ArrowRight size={14} />
                </button>
              </div>

              {activeTasks.length === 0 ? (
                <p className="text-xs text-[#94A3B8] text-center py-8">No active tasks in progress right now.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeTasks.slice(0, 6).map(t => (
                    <div key={t.id || t._id} className="border border-[#E2E8F0] rounded-xl p-4 bg-[#F8FAFC] hover:bg-white hover:border-[#2563EB] transition shadow-2xs space-y-3">
                      <div className="flex justify-between items-center">
                        <PriorityBadge priority={t.priority} />
                        <span className="text-[11px] font-bold text-[#475569] bg-slate-200 px-2 py-0.5 rounded-md uppercase">
                          {t.status}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-bold text-[#0F172A] text-sm leading-tight">{t.title}</h4>
                        <p className="text-xs text-[#64748B] mt-0.5">Project: <span className="font-semibold text-[#334155]">{t.projectName}</span></p>
                      </div>

                      {/* Progress Bar */}
                      <div>
                        <div className="flex justify-between items-center text-[11px] mb-1 font-semibold">
                          <span className="text-[#64748B]">Progress</span>
                          <span className="text-[#2563EB] font-bold">{t.workDone || 0}%</span>
                        </div>
                        <div className="w-full bg-[#E2E8F0] rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-[#2563EB] h-2 rounded-full transition-all duration-300"
                            style={{ width: `${t.workDone || 0}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1 text-xs text-[#475569]">
                        <EmployeeAvatar name={t.assignedEmployeeNames?.[0] || 'Staff'} size="sm" />
                        <span className="truncate font-medium">{t.assignedEmployeeNames?.join(', ') || 'Unassigned'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB 2: DAILY TASK BOARD */}
        {activeTab === 'today-work' && (
          <div className="bg-white rounded-[14px] border border-[#E2E8F0] p-6 shadow-xs space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-[#E2E8F0] gap-4">
              <div>
                <h3 className="text-lg font-bold text-[#0F172A]">Daily Task Board</h3>
                <p className="text-xs text-[#64748B]">Real-time daily work entries submitted by employees across projects</p>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="Search task or action..."
                  value={boardSearch}
                  onChange={(e) => setBoardSearch(e.target.value)}
                  className="px-3 py-1.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs w-40 focus:outline-none focus:border-[#2563EB]"
                />

                <select
                  value={boardEmployeeFilter}
                  onChange={(e) => setBoardEmployeeFilter(e.target.value)}
                  className="px-3 py-1.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs font-semibold text-[#334155]"
                >
                  <option value="all">All Employees</option>
                  {employees.map(e => (
                    <option key={e.id || e._id} value={e.id || e._id}>{e.firstName} {e.lastName}</option>
                  ))}
                </select>

                <select
                  value={boardProjectFilter}
                  onChange={(e) => setBoardProjectFilter(e.target.value)}
                  className="px-3 py-1.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs font-semibold text-[#334155]"
                >
                  <option value="all">All Projects</option>
                  {projects.map(p => (
                    <option key={p.id || p._id} value={p.id || p._id}>{p.projectName}</option>
                  ))}
                </select>

                <input
                  type="date"
                  value={boardDateFilter}
                  onChange={(e) => setBoardDateFilter(e.target.value)}
                  className="px-3 py-1.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs font-semibold text-[#334155]"
                />

                <select
                  value={boardStatusFilter}
                  onChange={(e) => setBoardStatusFilter(e.target.value)}
                  className="px-3 py-1.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs font-semibold text-[#334155]"
                >
                  <option value="all">All Statuses</option>
                  <option value="Completed">Completed</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Pending">Pending</option>
                </select>
              </div>
            </div>

            {filteredDailyBoard.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <CalendarCheck size={36} className="mx-auto text-slate-300" />
                <p className="text-sm font-bold text-[#0F172A]">No daily work entries found matching filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#F8FAFC] text-[#64748B] uppercase font-bold text-[11px] border-b border-[#E2E8F0]">
                      <th className="p-3.5">Project</th>
                      <th className="p-3.5">Task</th>
                      <th className="p-3.5">Description</th>
                      <th className="p-3.5">Action Taken</th>
                      <th className="p-3.5">Employee</th>
                      <th className="p-3.5 text-center">Date</th>
                      <th className="p-3.5 text-center">Hours</th>
                      <th className="p-3.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {filteredDailyBoard.map(entry => (
                      <tr key={entry.id || entry._id} className="hover:bg-[#F8FAFC] transition">
                        <td className="p-3.5 font-bold text-[#0F172A]">{entry.projectName}</td>
                        <td className="p-3.5 font-semibold text-[#0F172A]">{entry.taskTitle}</td>
                        <td className="p-3.5 text-[#64748B] max-w-xs">{entry.details || '-'}</td>
                        <td className="p-3.5 text-[#0F172A] max-w-xs">{entry.actionTaken}</td>
                        <td className="p-3.5 font-bold text-[#334155]">{entry.employeeName}</td>
                        <td className="p-3.5 text-center font-semibold text-[#64748B] whitespace-nowrap">{entry.date}</td>
                        <td className="p-3.5 text-center font-extrabold text-[#2563EB]">{entry.hours} hrs</td>
                        <td className="p-3.5 text-center">
                          <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                            {entry.status || 'Submitted'}
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

        {/* TAB 3: MY TASKS (Director Assigned Tasks) */}
        {activeTab === 'my-tasks' && (
          <div className="bg-white rounded-[14px] border border-[#E2E8F0] p-6 shadow-xs space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0]">
              <div>
                <h3 className="text-lg font-bold text-[#0F172A]">My Director Tasks</h3>
                <p className="text-xs text-[#64748B]">Tasks assigned specifically to you as Director</p>
              </div>
              <button
                onClick={() => { setSelectedTask(null); setIsTaskModalOpen(true); }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold rounded-lg text-xs transition cursor-pointer"
              >
                <Plus size={14} />
                Create Task
              </button>
            </div>

            {myDirectorTasks.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <CheckSquare size={36} className="mx-auto text-slate-300" />
                <p className="text-sm font-bold text-[#0F172A]">No tasks directly assigned to you.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myDirectorTasks.map(t => (
                  <div key={t.id || t._id} className="border border-[#E2E8F0] rounded-xl p-4 bg-white shadow-xs space-y-3">
                    <div className="flex justify-between items-center">
                      <PriorityBadge priority={t.priority} />
                      <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-700">
                        {t.status}
                      </span>
                    </div>

                    <h4 className="font-bold text-[#0F172A] text-sm">{t.title}</h4>
                    <p className="text-xs text-[#64748B]">Project: <span className="font-semibold text-[#334155]">{t.projectName}</span></p>
                    <p className="text-xs text-[#475569]">{t.description}</p>
                    
                    <div>
                      <div className="flex justify-between text-[11px] mb-1 font-semibold text-[#64748B]">
                        <span>Progress</span>
                        <span className="text-[#2563EB] font-bold">{t.workDone || 0}%</span>
                      </div>
                      <div className="w-full bg-[#E2E8F0] rounded-full h-2">
                        <div className="bg-[#2563EB] h-2 rounded-full" style={{ width: `${t.workDone || 0}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: DAILY REPORTS */}
        {activeTab === 'reports' && (
          <div className="bg-white rounded-[14px] border border-[#E2E8F0] p-6 shadow-xs space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-[#E2E8F0] gap-4">
              <div>
                <h3 className="text-lg font-bold text-[#0F172A]">Executive Daily Reports</h3>
                <p className="text-xs text-[#64748B]">Date-based daily report records and hour calculations</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={reportDateFilter}
                  onChange={(e) => setReportDateFilter(e.target.value)}
                  className="px-3 py-1.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs font-semibold text-[#334155]"
                />

                <select
                  value={reportEmployeeFilter}
                  onChange={(e) => setReportEmployeeFilter(e.target.value)}
                  className="px-3 py-1.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs font-semibold text-[#334155]"
                >
                  <option value="all">All Staff</option>
                  {employees.map(e => (
                    <option key={e.id || e._id} value={e.id || e._id}>{e.firstName} {e.lastName}</option>
                  ))}
                </select>

                <select
                  value={reportProjectFilter}
                  onChange={(e) => setReportProjectFilter(e.target.value)}
                  className="px-3 py-1.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs font-semibold text-[#334155]"
                >
                  <option value="all">All Projects</option>
                  {projects.map(p => (
                    <option key={p.id || p._id} value={p.id || p._id}>{p.projectName}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Total Hours Banner */}
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-center justify-between text-xs text-indigo-950 font-bold">
              <span>Total Entries Found: {filteredDailyReports.length}</span>
              <span>Calculated Total Hours: <span className="text-indigo-600 text-sm font-black">{reportTotalHours.toFixed(1)} Hours</span></span>
            </div>

            {filteredDailyReports.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <FileText size={36} className="mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-bold text-[#0F172A]">No report entries matching filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#F8FAFC] text-[#64748B] uppercase font-bold text-[11px] border-b border-[#E2E8F0]">
                      <th className="p-3.5">Employee</th>
                      <th className="p-3.5">Project</th>
                      <th className="p-3.5">Task</th>
                      <th className="p-3.5">Description</th>
                      <th className="p-3.5">Action Taken</th>
                      <th className="p-3.5 text-center">Hours</th>
                      <th className="p-3.5 text-center">Date</th>
                      <th className="p-3.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {filteredDailyReports.map(entry => (
                      <tr key={entry.id || entry._id} className="hover:bg-[#F8FAFC] transition">
                        <td className="p-3.5 font-bold text-[#0F172A]">{entry.employeeName}</td>
                        <td className="p-3.5 font-semibold text-[#334155]">{entry.projectName}</td>
                        <td className="p-3.5 font-bold text-[#0F172A]">{entry.taskTitle}</td>
                        <td className="p-3.5 text-[#64748B]">{entry.details || '-'}</td>
                        <td className="p-3.5 text-[#0F172A]">{entry.actionTaken}</td>
                        <td className="p-3.5 text-center font-extrabold text-[#2563EB]">{entry.hours} hrs</td>
                        <td className="p-3.5 text-center font-semibold text-[#64748B] whitespace-nowrap">{entry.date}</td>
                        <td className="p-3.5 text-center">
                          <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                            {entry.status || 'Submitted'}
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
          <div className="bg-white rounded-[14px] border border-[#E2E8F0] p-6 shadow-xs space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-[#E2E8F0] gap-4">
              <div>
                <h3 className="text-lg font-bold text-[#0F172A]">Completed History Archive</h3>
                <p className="text-xs text-[#64748B]">Complete historical records of finished projects, tasks, and daily entries</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCompletedSubTab('tasks')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border cursor-pointer ${
                    completedSubTab === 'tasks' ? 'bg-[#0F172A] text-white border-[#0F172A]' : 'bg-[#F8FAFC] text-[#475569] border-[#CBD5E1]'
                  }`}
                >
                  Tasks ({completedTasks.length})
                </button>
                <button
                  onClick={() => setCompletedSubTab('projects')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border cursor-pointer ${
                    completedSubTab === 'projects' ? 'bg-[#0F172A] text-white border-[#0F172A]' : 'bg-[#F8FAFC] text-[#475569] border-[#CBD5E1]'
                  }`}
                >
                  Projects ({projects.filter(p => p.status === 'Completed').length})
                </button>
              </div>
            </div>

            {completedSubTab === 'tasks' && (
              completedTasks.length === 0 ? (
                <p className="text-xs text-[#94A3B8] text-center py-12">No completed tasks recorded in archive.</p>
              ) : (
                <div className="space-y-3">
                  {completedTasks.map(t => (
                    <div key={t.id || t._id} className="border border-[#BBF7D0] rounded-xl p-4 bg-[#F0FDF4]/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <h4 className="font-bold text-[#0F172A] text-sm">{t.title}</h4>
                        <p className="text-xs text-[#64748B] mt-0.5">
                          Project: <span className="font-semibold text-[#334155]">{t.projectName}</span> &bull; Staff: <span className="font-semibold text-[#334155]">{t.assignedEmployeeNames?.join(', ')}</span>
                        </p>
                        {t.approvalRemarks && (
                          <p className="text-xs text-[#475569] mt-1 italic">&quot;{t.approvalRemarks}&quot;</p>
                        )}
                      </div>
                      <span className="px-3 py-1 text-xs font-bold rounded-full bg-[#16A34A] text-white self-start md:self-auto flex-shrink-0">
                        Completed 100%
                      </span>
                    </div>
                  ))}
                </div>
              )
            )}

            {completedSubTab === 'projects' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {projects.filter(p => p.status === 'Completed').map(p => (
                  <div key={p.id || p._id} className="border border-[#BBF7D0] bg-[#F0FDF4]/30 rounded-xl p-4 space-y-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 uppercase">
                      {p.projectNumber}
                    </span>
                    <h4 className="font-bold text-[#0F172A] text-sm">{p.projectName}</h4>
                    <p className="text-xs text-[#64748B]">{p.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 6: REMINDERS */}
        {activeTab === 'reminders' && (
          <div className="bg-white rounded-[14px] border border-[#E2E8F0] p-6 shadow-xs space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-[#E2E8F0] gap-4">
              <div>
                <h3 className="text-lg font-bold text-[#0F172A]">Task Reminders Tracker</h3>
                <p className="text-xs text-[#64748B]">Monitor automated reminders, response deadlines, and employee updates</p>
              </div>

              {/* Status Filter Badges */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'ALL', label: 'All' },
                  { id: 'TODAY', label: "Today's" },
                  { id: 'UPCOMING', label: 'Upcoming' },
                  { id: 'OVERDUE', label: 'Overdue' },
                  { id: 'NOT_REPLIED', label: 'Not Replied' }
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => setReminderStatusFilter(item.id as any)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition border cursor-pointer ${
                      reminderStatusFilter === item.id
                        ? 'bg-[#0F172A] text-white border-[#0F172A]'
                        : 'bg-[#F8FAFC] text-[#475569] border-[#CBD5E1] hover:bg-slate-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredReminders.length === 0 ? (
              <p className="text-xs text-[#94A3B8] text-center py-12">No reminders matching filter.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#F8FAFC] text-[#64748B] uppercase font-bold text-[11px] border-b border-[#E2E8F0]">
                      <th className="p-3.5">Task Title</th>
                      <th className="p-3.5">Employee</th>
                      <th className="p-3.5">Reminder Date</th>
                      <th className="p-3.5">Response Status</th>
                      <th className="p-3.5">Response / Comment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {filteredReminders.map(rem => {
                      const remId = rem.id || rem._id || '';
                      return (
                        <tr key={remId} className="hover:bg-[#F8FAFC] transition">
                          <td className="p-3.5 font-bold text-[#0F172A]">{rem.taskTitle || 'Task'}</td>
                          <td className="p-3.5 text-[#334155] font-semibold">{rem.employeeName}</td>
                          <td className="p-3.5 text-[#64748B] font-medium">{rem.reminderDate}</td>
                          <td className="p-3.5">
                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              rem.status === 'Replied' ? 'bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]' :
                              rem.status === 'Not Replied' ? 'bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]' :
                              'bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]'
                            }`}>
                              {rem.status}
                            </span>
                          </td>
                          <td className="p-3.5 text-[#475569] italic">
                            {rem.response ? `"${rem.response}"` : <span className="text-[#94A3B8]">No response recorded</span>}
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

        {/* TAB 7: FLAGS */}
        {activeTab === 'flags' && (
          <div className="bg-white rounded-[14px] border border-[#E2E8F0] p-6 shadow-xs space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-[#E2E8F0] gap-4">
              <div>
                <h3 className="text-lg font-bold text-[#0F172A]">Task Flags Management</h3>
                <p className="text-xs text-[#64748B]">Review open flags, respond with guidance, and resolve employee input requests</p>
              </div>

              <div className="flex items-center gap-2">
                {['OPEN', 'RESOLVED', 'ALL'].map(st => (
                  <button
                    key={st}
                    onClick={() => setFlagStatusFilter(st as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                      flagStatusFilter === st ? 'bg-[#0F172A] text-white border-[#0F172A]' : 'bg-[#F8FAFC] text-[#475569] border-[#CBD5E1]'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {flags.filter(f => flagStatusFilter === 'ALL' || f.status === (flagStatusFilter === 'OPEN' ? 'Open' : 'Resolved')).length === 0 ? (
              <p className="text-xs text-[#94A3B8] text-center py-12">No flags recorded matching status filter.</p>
            ) : (
              <div className="space-y-4">
                {flags
                  .filter(f => flagStatusFilter === 'ALL' || f.status === (flagStatusFilter === 'OPEN' ? 'Open' : 'Resolved'))
                  .map(flag => {
                    const flagId = flag.id || flag._id || '';
                    const isOpen = flag.status === 'Open';

                    return (
                      <div key={flagId} className="border border-[#E2E8F0] rounded-xl p-4 bg-[#F8FAFC] space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-[#0F172A] text-sm">{flag.taskTitle}</h4>
                            <p className="text-xs text-[#64748B]">
                              Raised by <span className="font-semibold text-[#334155]">{flag.employeeName}</span> on {flag.flagDate}
                            </p>
                          </div>
                          <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
                            isOpen ? 'bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]' : 'bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]'
                          }`}>
                            {flag.status}
                          </span>
                        </div>

                        <p className="text-xs text-[#334155] bg-white p-3 rounded-lg border border-[#E2E8F0]">
                          {flag.flagMessage}
                        </p>

                        {isOpen ? (
                          <div className="flex items-center gap-2 pt-1">
                            <input
                              type="text"
                              placeholder="Type resolution guidance..."
                              value={flagResponses[flagId] || ''}
                              onChange={(e) => setFlagResponses({ ...flagResponses, [flagId]: e.target.value })}
                              className="flex-1 px-3 py-1.5 bg-white border border-[#CBD5E1] rounded-lg text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                            />
                            <button
                              onClick={() => handleResolveFlag(flagId)}
                              className="px-4 py-1.5 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-xs rounded-lg transition shadow-xs cursor-pointer"
                            >
                              Resolve Flag
                            </button>
                          </div>
                        ) : (
                          <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg p-3 text-xs text-[#16A34A]">
                            <strong>Management Response:</strong> {flag.managementResponse || 'Resolved'}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* TAB 8: MY PERFORMANCE */}
        {activeTab === 'performance' && (
          <div className="bg-white rounded-[14px] border border-[#E2E8F0] p-6 shadow-xs space-y-6">
            <div className="border-b border-[#E2E8F0] pb-4">
              <h3 className="text-lg font-bold text-[#0F172A]">My Director Performance Metrics</h3>
              <p className="text-xs text-[#64748B]">Real-time activity stats &amp; management output calculated strictly from database records</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4">
                <span className="text-[10px] font-bold text-[#64748B] uppercase">Tasks Created</span>
                <p className="text-2xl font-black text-[#2563EB] mt-1">{directorPerformance.tasksCreated}</p>
              </div>
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4">
                <span className="text-[10px] font-bold text-[#64748B] uppercase">Tasks Completed</span>
                <p className="text-2xl font-black text-[#16A34A] mt-1">{directorPerformance.tasksCompleted}</p>
              </div>
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4">
                <span className="text-[10px] font-bold text-[#64748B] uppercase">Projects Managed</span>
                <p className="text-2xl font-black text-[#7C3AED] mt-1">{directorPerformance.projectsManaged}</p>
              </div>
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4">
                <span className="text-[10px] font-bold text-[#64748B] uppercase">Flags Resolved</span>
                <p className="text-2xl font-black text-[#16A34A] mt-1">{directorPerformance.flagsResolved}</p>
              </div>
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4">
                <span className="text-[10px] font-bold text-[#64748B] uppercase">Approvals Processed</span>
                <p className="text-2xl font-black text-[#D97706] mt-1">{directorPerformance.approvalsProcessed}</p>
              </div>
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4">
                <span className="text-[10px] font-bold text-[#64748B] uppercase">Daily Entries Reviewed</span>
                <p className="text-2xl font-black text-[#2563EB] mt-1">{directorPerformance.dailyEntriesReviewed}</p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 9: PROFILE */}
        {activeTab === 'profile' && (
          <DirectorProfile />
        )}

        {/* TAB 10: ALL TASKS OVERVIEW */}
        {activeTab === 'tasks' && (
          <div className="bg-white rounded-[14px] border border-[#E2E8F0] p-6 shadow-xs space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-[#E2E8F0] gap-4">
              <div>
                <h3 className="text-lg font-bold text-[#0F172A]">Task Management Directory</h3>
                <p className="text-xs text-[#64748B]">Priority filters, staff assignments, work progress, and Director private star ratings</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="Search task or project..."
                  value={taskSearch}
                  onChange={(e) => setTaskSearch(e.target.value)}
                  className="px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs w-48 focus:outline-none focus:border-[#2563EB]"
                />

                <select
                  value={taskPriorityFilter}
                  onChange={(e) => setTaskPriorityFilter(e.target.value)}
                  className="px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs font-semibold text-[#334155]"
                >
                  <option value="all">All Priorities</option>
                  <option value="Urgent">Urgent</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                  <option value="Self">Self</option>
                  <option value="Daily">Daily</option>
                </select>

                <select
                  value={taskStatusFilter}
                  onChange={(e) => setTaskStatusFilter(e.target.value)}
                  className="px-3.5 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs font-semibold text-[#334155]"
                >
                  <option value="all">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Pending Approval">Pending Approval</option>
                  <option value="Completed">Completed</option>
                </select>

                <button
                  onClick={() => { setSelectedTask(null); setIsTaskModalOpen(true); }}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold rounded-lg text-xs transition cursor-pointer"
                >
                  <Plus size={14} />
                  New Task
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F8FAFC] text-[#64748B] uppercase font-bold text-[11px] border-b border-[#E2E8F0]">
                    <th className="p-3.5">Task Title</th>
                    <th className="p-3.5">Project</th>
                    <th className="p-3.5">Priority</th>
                    <th className="p-3.5">Assigned Staff</th>
                    <th className="p-3.5">Work %</th>
                    <th className="p-3.5">Status</th>
                    {isDirector && <th className="p-3.5">Director Star</th>}
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {filteredTasks.map(t => {
                    const tId = t.id || t._id || '';
                    return (
                      <tr key={tId} className="hover:bg-[#F8FAFC] transition">
                        <td className="p-3.5 font-bold text-[#0F172A]">{t.title}</td>
                        <td className="p-3.5 text-[#475569] font-medium">{t.projectName}</td>
                        <td className="p-3.5">
                          <PriorityBadge priority={t.priority} />
                        </td>
                        <td className="p-3.5">
                          <div className="flex items-center gap-2">
                            <EmployeeAvatar name={t.assignedEmployeeNames?.[0] || 'Staff'} size="sm" />
                            <span className="font-semibold text-[#334155]">{t.assignedEmployeeNames?.join(', ') || '-'}</span>
                          </div>
                        </td>
                        <td className="p-3.5 font-extrabold text-[#2563EB]">{t.workDone || 0}%</td>
                        <td className="p-3.5">
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            t.status === 'Completed' ? 'bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]' :
                            t.status === 'Pending Approval' ? 'bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]' :
                            'bg-[#F8FAFC] text-[#64748B] border border-[#E2E8F0]'
                          }`}>
                            {t.status}
                          </span>
                        </td>
                        {isDirector && (
                          <td className="p-3.5">
                            {t.rating ? (
                              <span className="flex items-center text-[#D97706] font-extrabold">
                                {t.rating} <Star size={13} className="fill-[#D97706] ml-0.5" />
                              </span>
                            ) : (
                              <span className="text-[#94A3B8]">Unrated</span>
                            )}
                          </td>
                        )}
                        <td className="p-3.5 text-right space-x-1.5">
                          {isDirector && (
                            <button
                              onClick={() => {
                                setRatingModalTask(t);
                                setRatingValue(t.rating || 5);
                                setRatingComment(t.privateComment || '');
                              }}
                              className="px-2.5 py-1 bg-[#FFFBEB] hover:bg-[#FEF3C7] text-[#D97706] font-bold rounded-lg border border-[#FDE68A] transition cursor-pointer"
                            >
                              Rate (Private)
                            </button>
                          )}
                          <button
                            onClick={() => { setSelectedTask(t); setIsTaskModalOpen(true); }}
                            className="px-2.5 py-1 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#334155] font-semibold rounded-lg transition cursor-pointer"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Director Private Star Rating Modal */}
        {ratingModalTask && (
          <div className="fixed inset-0 bg-[#0F172A]/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-[14px] shadow-2xl max-w-md w-full p-6 space-y-4 border border-[#E2E8F0]">
              <h3 className="text-base font-bold text-[#0F172A]">Director Private Star Rating</h3>
              <p className="text-xs text-[#64748B]">This star rating and private comment is strictly visible ONLY to Director role accounts.</p>

              <div>
                <label className="block text-[11px] font-bold text-[#475569] uppercase tracking-wider mb-2">Rating (1 to 5 Stars)</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRatingValue(star)}
                      className={`p-2.5 rounded-lg border transition cursor-pointer ${
                        ratingValue >= star ? 'bg-[#FFFBEB] border-[#FDE68A] text-[#D97706]' : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#CBD5E1]'
                      }`}
                    >
                      <Star size={24} className={ratingValue >= star ? 'fill-[#D97706]' : ''} />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#475569] uppercase tracking-wider mb-1">Private Director Feedback</label>
                <textarea
                  rows={3}
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                  placeholder="Private performance evaluation remarks..."
                  className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
                <button
                  onClick={() => setRatingModalTask(null)}
                  className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-[#F1F5F9] rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePrivateRating}
                  className="px-4 py-2 bg-[#D97706] hover:bg-[#B45309] text-white font-bold text-xs rounded-lg shadow-xs transition cursor-pointer"
                >
                  Save Rating
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Project Modal */}
        <ProjectModal
          isOpen={isProjectModalOpen}
          project={selectedProject}
          users={[]}
          onClose={() => setIsProjectModalOpen(false)}
          onSave={handleSaveProject}
        />

        {/* Task Modal */}
        <TaskModal
          isOpen={isTaskModalOpen}
          task={selectedTask}
          projects={projects}
          employees={employees}
          onClose={() => setIsTaskModalOpen(false)}
          onSave={handleSaveTask}
        />

        {/* Employee Modal */}
        <EmployeeModal
          isOpen={isEmployeeModalOpen}
          employee={selectedEmployee}
          onClose={() => setIsEmployeeModalOpen(false)}
          onSave={handleSaveEmployee}
        />

      </div>
    </div>
  );
};

export default Dashboard;
