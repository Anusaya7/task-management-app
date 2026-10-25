'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  ProjectStatus,
  PrivateRating
} from '../types';
import Sidebar, { TabType } from './Sidebar';
import ProjectModal from './ProjectModal';
import ProjectList from './ProjectList';
import TaskModal from './TaskModal';
import EmployeeModal from './EmployeeModal';
import EmployeeList from './EmployeeList';
import NotificationCenter from './NotificationCenter';
import DirectorProfile from './DirectorProfile';
import DirectorPerformanceReview from './DirectorPerformanceReview';
import DailyTaskBoardView from './DailyTaskBoardView';
import {
  PriorityBadge,
  EmployeeStatusBadge,
  EmployeeAvatar,
  SkeletonCard,
  SkeletonTable,
  formatHoursMinutes
} from './BadgeUtils';
import { isOngoingProjectStatus } from '@/lib/projectStatus';
import { groupItemsByProject, sortByHierarchyCode } from '@/lib/taskHierarchy';
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
  Paperclip,
  Save,
  X,
  CalendarCheck,
  AlertCircle,
  ShoppingCart,
  ChevronDown
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

const getWeekStartDate = (dateString: string) => {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return '';
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return date.toISOString().slice(0, 10);
};

const addDaysToDate = (dateString: string, days: number) => {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const getCurrentKolkataDate = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
}).format(new Date());

const getPerformancePeriodRange = (
  view: 'week' | 'month' | 'year',
  weekStart: string,
  month: string,
  year: string
) => {
  if (view === 'week') {
    return { start: weekStart, end: addDaysToDate(weekStart, 6) };
  }
  if (view === 'month') {
    const selectedMonthValue = /^\d{4}-\d{2}$/.test(month)
      ? month
      : getCurrentKolkataDate().slice(0, 7);
    const [selectedYear, selectedMonth] = selectedMonthValue.split('-').map(Number);
    return {
      start: `${selectedMonthValue}-01`,
      end: new Date(Date.UTC(selectedYear, selectedMonth, 0)).toISOString().slice(0, 10)
    };
  }
  const selectedYear = /^\d{4}$/.test(year) ? year : getCurrentKolkataDate().slice(0, 4);
  return { start: `${selectedYear}-01-01`, end: `${selectedYear}-12-31` };
};

const getShortName = (name?: string) => {
  const parts = (name || 'Director').trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0] || 'Director';
};

type CompletedTimeFilter = 'all' | 'date' | 'week' | 'month';

interface ManagementCompletedHistoryProps {
  completedTasks: Task[];
  projects: Project[];
  employees: Employee[];
  dailyEntries: DailyEntry[];
  projectFilter: string;
  employeeFilter: string;
  timeFilter: CompletedTimeFilter;
  timeDate: string;
  onProjectFilterChange: (value: string) => void;
  onEmployeeFilterChange: (value: string) => void;
  onTimeFilterChange: (value: CompletedTimeFilter) => void;
  onTimeDateChange: (value: string) => void;
  onShiftTaskBack: (task: Task) => void;
  canEditLog: boolean;
  onUpdateDailyEntry: (entryId: string, updates: { actionTaken: string; hours: number }) => Promise<void>;
  onDeleteDailyEntry: (entryId: string) => Promise<void>;
}

const ManagementCompletedHistory: React.FC<ManagementCompletedHistoryProps> = ({
  completedTasks,
  projects,
  employees,
  dailyEntries,
  projectFilter,
  employeeFilter,
  timeFilter,
  timeDate,
  onProjectFilterChange,
  onEmployeeFilterChange,
  onTimeFilterChange,
  onTimeDateChange,
  onShiftTaskBack,
  canEditLog,
  onUpdateDailyEntry,
  onDeleteDailyEntry
}) => {
  const [selectedHistoryTask, setSelectedHistoryTask] = useState<Task | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingActionTaken, setEditingActionTaken] = useState('');
  const [editingHours, setEditingHours] = useState('');

  const formatCompletedDate = (value?: string) => {
    if (!value) return '-';
    const dateValue = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value;
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      timeZone: 'Asia/Kolkata'
    }).format(date);
  };

  const projectNameFor = (task: Task) => {
    if (task.projectName) return task.projectName;
    return projects.find(project => String(project.id || project._id) === String(task.projectId))?.projectName || '-';
  };

  const hoursFor = (task: Task) => {
    const id = String(task.id || task._id || '');
    const hours = dailyEntries
      .filter(entry => String(entry.taskId) === id)
      .reduce((total, entry) => total + (Number(entry.hours) || 0), 0);
    return Number(hours.toFixed(2));
  };
  const completedChildrenOf = (task: Task) => completedTasks.filter(candidate =>
    String(candidate.parentTaskId || '') === String(task.id || task._id || '')
  );
  const hoursForCompletedGroup = (task: Task) => {
    const ids = new Set([task, ...completedChildrenOf(task)].map(item => String(item.id || item._id || '')));
    const hours = dailyEntries
      .filter(entry => ids.has(String(entry.taskId)))
      .reduce((total, entry) => total + (Number(entry.hours) || 0), 0);
    return Number(hours.toFixed(2));
  };
  const completedRootTasks = completedTasks.filter(task =>
    !task.parentTaskId || !completedTasks.some(candidate => String(candidate.id || candidate._id || '') === String(task.parentTaskId))
  );
  const selectedHistoryTaskIds = selectedHistoryTask
    ? new Set([selectedHistoryTask, ...completedChildrenOf(selectedHistoryTask)].map(task => String(task.id || task._id || '')))
    : new Set<string>();
  const taskEntries = selectedHistoryTask
    ? dailyEntries
        .filter(entry => selectedHistoryTaskIds.has(String(entry.taskId)))
        .sort((first, second) => first.date.localeCompare(second.date))
    : [];
  const taskComments = selectedHistoryTask?.comments || [];

  return (
    <section className="space-y-5" aria-labelledby="completed-history-title">
      <h2 id="completed-history-title" className="text-xl font-bold text-[#0F172A] md:text-[22px]">
        Completed Task History
      </h2>

      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          aria-label="Filter completed history by project"
          value={projectFilter}
          onChange={event => onProjectFilterChange(event.target.value)}
          className="min-h-[39px] min-w-0 flex-1 rounded-lg border border-[#CBD5E1] bg-white px-2.5 text-sm text-[#334155] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="all">Project: All</option>
          {projects.map(project => (
            <option key={String(project.id || project._id)} value={String(project.id || project._id)}>
              {project.projectName}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter completed history by employee"
          value={employeeFilter}
          onChange={event => onEmployeeFilterChange(event.target.value)}
          className="min-h-[39px] min-w-0 flex-1 rounded-lg border border-[#CBD5E1] bg-white px-2.5 text-sm text-[#334155] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="all">Employee: All</option>
          {employees.map(employee => (
            <option key={String(employee.id || employee._id)} value={String(employee.id || employee._id)}>
              {employee.firstName} {employee.lastName}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter completed history by time"
          value={timeFilter}
          onChange={event => onTimeFilterChange(event.target.value as CompletedTimeFilter)}
          className="min-h-[39px] min-w-0 flex-1 rounded-lg border border-[#CBD5E1] bg-white px-2.5 text-sm text-[#334155] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="all">Time: All</option>
          <option value="date">Time: Date</option>
          <option value="week">Time: Week</option>
          <option value="month">Time: Month</option>
        </select>
        {(timeFilter === 'date' || timeFilter === 'week') && (
          <input
            aria-label="Choose completed history date"
            type="date"
            value={timeDate}
            onChange={event => onTimeDateChange(event.target.value)}
            className="min-h-[39px] min-w-0 flex-1 rounded-lg border border-[#CBD5E1] bg-white px-2.5 text-sm text-[#334155] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        )}
      </div>

      <div className="overflow-x-auto border border-[#E2E8F0] bg-white">
        <table className="w-full min-w-[740px] table-fixed border-collapse text-left text-sm">
          <colgroup>
            <col className="w-[48%]" />
            <col className="w-[13%]" />
            <col className="w-[13%]" />
            <col className="w-[12%]" />
            <col className="w-[14%]" />
          </colgroup>
          <thead className="bg-[#334155] text-white">
            <tr>
              <th scope="col" className="border-r border-slate-500 px-2.5 py-2 text-sm font-bold">Project / Task / Subtasks and description</th>
              <th scope="col" className="border-r border-slate-500 px-2 py-2 text-xs font-bold">Allocated</th>
              <th scope="col" className="border-r border-slate-500 px-2 py-2 text-xs font-bold">Completed</th>
              <th scope="col" className="border-r border-slate-500 px-2 py-2 text-xs font-bold">Total hours</th>
              <th scope="col" className="px-2 py-2 text-xs font-bold">Log</th>
            </tr>
          </thead>
          <tbody>
            {completedTasks.length === 0 ? (
              <tr>
                <td colSpan={5} className="h-40 px-4 text-center text-sm text-slate-400">
                  No completed tasks recorded in archive.
                </td>
              </tr>
            ) : completedRootTasks.map((task, index) => (
              <tr
                key={task.id || task._id}
                className={`border-t border-[#E2E8F0] ${index % 2 === 0 ? 'bg-[#F8FAFC]' : 'bg-white'}`}
              >
                <td className="border-r border-[#E2E8F0] px-2.5 py-2.5 text-sm text-[#1E293B]">
                  <p className="font-semibold">{projectNameFor(task)} / {task.title}</p>
                  {completedChildrenOf(task).map(subtask => (
                    <p key={String(subtask.id || subtask._id)} className="pl-3 text-xs text-slate-600">
                      {projectNameFor(task)}/{task.title}/{subtask.title}
                    </p>
                  ))}
                  {task.parentTaskTitle && <p className="mt-0.5 text-xs text-slate-600">Subtask of {task.parentTaskTitle}</p>}
                  <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">{task.description || '-'}</p>
                </td>
                <td className="border-r border-[#E2E8F0] px-2 py-2.5 text-xs text-[#1E293B]">
                  {formatCompletedDate(task.startDate || task.createdAt)}
                </td>
                <td className="border-r border-[#E2E8F0] px-2 py-2.5 text-xs text-[#1E293B]">
                  {formatCompletedDate(task.approvalDate || task.updatedAt || task.dueDate)}
                </td>
                <td className="border-r border-[#E2E8F0] px-2 py-2.5 text-xs text-[#1E293B]">{hoursForCompletedGroup(task)}</td>
                <td className="px-2 py-2.5 text-xs text-[#1E293B]">
                  <button
                    type="button"
                    onClick={() => setSelectedHistoryTask(task)}
                    className="inline-flex items-center gap-1 px-1 py-1.5 font-semibold text-[#2563EB] hover:underline"
                  >
                    View <span aria-hidden="true">›</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedHistoryTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="completed-log-title">
          <div className={`max-h-[90vh] w-full ${canEditLog ? 'max-w-3xl' : 'max-w-5xl'} overflow-y-auto rounded-md border border-slate-300 bg-white shadow-2xl`}>
            <div className={`flex items-start justify-between gap-4 px-5 py-3 ${canEditLog ? 'border-b border-slate-200' : 'bg-[#25527A] text-white'}`}>
              <div>
                <h3 id="completed-log-title" className={`text-lg font-bold ${canEditLog ? 'text-slate-900' : 'text-white'}`}>{canEditLog ? selectedHistoryTask.title : 'Log history (pop-up window)'}</h3>
                <p className={`mt-1 text-sm ${canEditLog ? 'text-slate-600' : 'text-blue-100'}`}>{projectNameFor(selectedHistoryTask)} · Allocated {formatCompletedDate(selectedHistoryTask.startDate || selectedHistoryTask.createdAt)} · Completed {formatCompletedDate(selectedHistoryTask.approvalDate || selectedHistoryTask.updatedAt || selectedHistoryTask.dueDate)}</p>
                {canEditLog && <p className="mt-1 text-xs text-slate-600">Total hours: {hoursFor(selectedHistoryTask)}</p>}
              </div>
              <button type="button" onClick={() => setSelectedHistoryTask(null)} aria-label="Close task log" className={`rounded-md p-1 ${canEditLog ? 'text-slate-500 hover:bg-slate-100' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}><X size={20} /></button>
            </div>
            <div className="space-y-4 p-5">
              {!canEditLog && (
                <p className="font-semibold text-[#25527A]">
                  {projectNameFor(selectedHistoryTask)}/{selectedHistoryTask.title}
                  {completedChildrenOf(selectedHistoryTask).length > 0 && ` | ${completedChildrenOf(selectedHistoryTask).map(child => child.title).join(', ')}`}
                </p>
              )}
              <div>
                <h4 className={`mb-2 text-sm font-semibold text-slate-800 ${canEditLog ? '' : 'sr-only'}`}>Date-wise comments and hours</h4>
                {!canEditLog && taskEntries.length > 0 ? (
                  <div className="overflow-x-auto border border-[#E2E8F0]">
                    <table className="w-full min-w-[620px] border-collapse text-left text-sm">
                      <thead className="bg-[#334155] text-white"><tr>
                        <th className="border border-[#94A3B8] px-2.5 py-2">Date &amp; time</th>
                        <th className="border border-[#94A3B8] px-2.5 py-2">Comment</th>
                        <th className="border border-[#94A3B8] px-2.5 py-2">By</th>
                        <th className="border border-[#94A3B8] px-2.5 py-2">Hours</th>
                      </tr></thead>
                      <tbody>{taskEntries.map((entry, index) => (
                        <tr key={entry.id || entry._id} className={index % 2 === 0 ? 'bg-[#F8FAFC]' : 'bg-white'}>
                          <td className="border border-[#E2E8F0] px-2.5 py-2.5">
                            {formatCompletedDate(entry.date)}{entry.createdAt ? `, ${new Date(entry.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}` : ''}
                          </td>
                          <td className="border border-[#E2E8F0] px-2.5 py-2.5 whitespace-pre-wrap">{entry.actionTaken}</td>
                          <td className="border border-[#E2E8F0] px-2.5 py-2.5">{entry.employeeName || 'Employee'}</td>
                          <td className="border border-[#E2E8F0] px-2.5 py-2.5">{formatHoursMinutes(Number(entry.hours) || 0)}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                ) : taskEntries.length > 0 ? (
                  <ol className="space-y-2">
                    {taskEntries.map(entry => (
                      <li key={entry.id || entry._id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-600">
                          <span>{formatCompletedDate(entry.date)} · {entry.employeeName || 'Employee'}</span>
                          <span>{formatHoursMinutes(Number(entry.hours) || 0)}</span>
                        </div>
                        {editingEntryId === String(entry.id || entry._id) ? (
                          <div className="mt-2 space-y-2">
                            <textarea
                              value={editingActionTaken}
                              onChange={event => setEditingActionTaken(event.target.value)}
                              rows={3}
                              aria-label="Edit daily log comment"
                              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                            />
                            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                              Hours
                              <input
                                type="number"
                                min="0"
                                max="8"
                                step="0.01"
                                value={editingHours}
                                onChange={event => setEditingHours(event.target.value)}
                                className="w-24 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
                              />
                            </label>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const entryId = String(entry.id || entry._id || '');
                                  const hours = Number(editingHours);
                                  if (!entryId || !editingActionTaken.trim() || !Number.isFinite(hours) || hours < 0 || hours > 8) return;
                                  void onUpdateDailyEntry(entryId, { actionTaken: editingActionTaken.trim(), hours })
                                    .then(() => setEditingEntryId(null))
                                    .catch(() => {});
                                }}
                                className="rounded-md bg-[#2563EB] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1D4ED8]"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingEntryId(null)}
                                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{entry.actionTaken}</p>
                        )}
                        {canEditLog && editingEntryId !== String(entry.id || entry._id) && (
                          <div className="mt-2 flex gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingEntryId(String(entry.id || entry._id || ''));
                                setEditingActionTaken(entry.actionTaken || '');
                                setEditingHours(String(entry.hours ?? ''));
                              }}
                              className="text-xs font-semibold text-blue-700 hover:underline"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const entryId = String(entry.id || entry._id || '');
                                if (entryId && window.confirm('Delete this date-wise log entry?')) {
                                  void onDeleteDailyEntry(entryId);
                                }
                              }}
                              className="text-xs font-semibold text-red-700 hover:underline"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ol>
                ) : taskComments.length > 0 ? (
                  <ol className="space-y-2">
                    {taskComments.map(comment => (
                      <li key={comment.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-semibold text-slate-600">{formatCompletedDate(comment.timestamp)} · {comment.userName}</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{comment.content}</p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">No comments or hours were recorded for this task.</p>
                )}
              </div>
              {!canEditLog && (
                <p className="text-base font-bold text-slate-800">Total hours: {hoursFor(selectedHistoryTask)}</p>
              )}
              <div className={`flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row ${canEditLog ? 'sm:justify-end' : 'sm:justify-start'}`}>
                <button type="button" onClick={() => setSelectedHistoryTask(null)} className={`rounded-md px-5 py-2.5 text-sm font-bold text-white ${canEditLog ? 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50' : 'bg-[#64748B] hover:bg-[#475569]'} min-w-36`}>Close</button>
                <button
                  type="button"
                  onClick={() => {
                    const task = selectedHistoryTask;
                    setSelectedHistoryTask(null);
                    onShiftTaskBack(task);
                  }}
                  className={`rounded-md px-5 py-2.5 text-sm font-bold text-white ${canEditLog ? 'bg-[#2563EB] hover:bg-[#1D4ED8]' : 'bg-[#475569] hover:bg-[#334155]'}`}
                >
                  Shift back to Dash Board
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

const Dashboard: React.FC = () => {
  const { user, isDirector, isProjectHead } = useAuth();
  const isManagementDashboard = isDirector || isProjectHead;
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const isManagementPersonalView = isManagementDashboard && activeTab === 'overview';
  const isDirectorTaskAllotmentView = isDirector && activeTab === 'tasks';

  const [projects, setProjects] = useState<Project[]>([]);
  const projectsRequestIdRef = useRef(0);
  const performanceMarksRequestIdRef = useRef(0);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [performanceData, setPerformanceData] = useState<EmployeePerformance[]>([]);
  const [performanceMarks, setPerformanceMarks] = useState<Array<{
    employeeId: string;
    projectId: string;
    periodStart: string;
    periodEnd: string;
    rating?: number;
    ratingScale?: number;
    comment?: string;
    selfRating?: number;
    selfComment?: string;
    coordinatorRating?: number;
    coordinatorComment?: string;
  }>>([]);
  const [loadedPerformanceMarksKey, setLoadedPerformanceMarksKey] = useState('');
  const [dailyEntries, setDailyEntries] = useState<DailyEntry[]>([]);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals state
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [personalTaskMode, setPersonalTaskMode] = useState(false);

  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  // Confirmation Modal for Deletions
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'project' | 'employee' | 'task'; id: string; name: string } | null>(null);

  // Private Rating Modal State (Director only)
  const [ratingModalTask, setRatingModalTask] = useState<Task | null>(null);
  const [ratingModalEmployeeId, setRatingModalEmployeeId] = useState<string>('');
  const [ratingValue, setRatingValue] = useState<number>(5);
  const [ratingComment, setRatingComment] = useState<string>('');
  const [privateRatings, setPrivateRatings] = useState<PrivateRating[]>([]);
  const [savingPrivateRating, setSavingPrivateRating] = useState(false);
  const [weeklyRatingDrafts, setWeeklyRatingDrafts] = useState<Record<string, { rating: string; comment: string }>>({});
  const [savingPerformanceMark, setSavingPerformanceMark] = useState(false);

  // Flag Task Modal State (Director & Project Head)
  const [managementFlagTask, setManagementFlagTask] = useState<Task | null>(null);
  const [managementFlagTaskIds, setManagementFlagTaskIds] = useState<string[]>([]);
  const [managementFlagType, setManagementFlagType] = useState<string>('Progress Concern');
  const [managementFlagMessage, setManagementFlagMessage] = useState<string>('');
  const [creatingManagementFlag, setCreatingManagementFlag] = useState(false);

  // Flag Resolution State: flagId -> responseText
  const [flagResponses, setFlagResponses] = useState<Record<string, string>>({});

  // Overview & Management Filters
  const [projectStatusFilter, setProjectStatusFilter] = useState<string>('all');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState<string>('all');
  const [isPriorityMenuOpen, setIsPriorityMenuOpen] = useState(false);
  const priorityMenuRef = useRef<HTMLDivElement | null>(null);
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>('all');
  const [taskProjectFilter, setTaskProjectFilter] = useState<string>('all');
  const [taskEmployeeFilter, setTaskEmployeeFilter] = useState<string>('all');
  const [taskTimeFilter, setTaskTimeFilter] = useState<'all' | 'date' | 'week' | 'month'>('all');
  const [taskTimeDate, setTaskTimeDate] = useState<string>('');
  const [taskSearch, setTaskSearch] = useState<string>('');
  const [completedProjectFilter, setCompletedProjectFilter] = useState<string>('all');
  const [completedEmployeeFilter, setCompletedEmployeeFilter] = useState<string>('all');
  const [completedTimeFilter, setCompletedTimeFilter] = useState<'all' | 'date' | 'week' | 'month'>('all');
  const [completedTimeDate, setCompletedTimeDate] = useState<string>(() => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date()));
  const [perfView, setPerfView] = useState<'week' | 'month' | 'year'>('week');
  const [perfProjectFilter, setPerfProjectFilter] = useState<string>('all');
  const [perfEmployeeFilter, setPerfEmployeeFilter] = useState<string>('all');
  const [performanceWeekStart, setPerformanceWeekStart] = useState(() => {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
    return getWeekStartDate(today);
  });
  const [performanceMonthSelection, setPerformanceMonthSelection] = useState(() => getCurrentKolkataDate().slice(0, 7));
  const [performanceYearSelection, setPerformanceYearSelection] = useState(() => getCurrentKolkataDate().slice(0, 4));
  const [expandedPerformanceEmployeeId, setExpandedPerformanceEmployeeId] = useState<string | null>(null);
  const { start: performancePeriodStart, end: performancePeriodEnd } = getPerformancePeriodRange(
    perfView,
    performanceWeekStart,
    performanceMonthSelection,
    performanceYearSelection
  );

  // Daily Task Board Filters
  const [boardEmployeeFilter, setBoardEmployeeFilter] = useState<string>('all');
  const [boardProjectFilter, setBoardProjectFilter] = useState<string>('all');
  const [boardDateFilter, setBoardDateFilter] = useState<string>('');
  const [boardSearch, setBoardSearch] = useState<string>('');
  const [boardStatusFilter, setBoardStatusFilter] = useState<string>('all');
  const [reviewingDailyEntryId, setReviewingDailyEntryId] = useState<string | null>(null);
  const [editingDailyCommentId, setEditingDailyCommentId] = useState<string | null>(null);
  const [dailyCommentDraft, setDailyCommentDraft] = useState('');
  const [savingDailyCommentId, setSavingDailyCommentId] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [dailyCartIds, setDailyCartIds] = useState<string[]>([]);
  const [boardEdits, setBoardEdits] = useState<Record<string, {
    comment: string;
    hours: string;
    flagged: boolean;
  }>>({});
  const [cartSubmittingId, setCartSubmittingId] = useState<string | null>(null);

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
  const [flagStatusFilter, setFlagStatusFilter] = useState<'OPEN' | 'RESOLVED' | 'ALL'>('ALL');

  // Performance Date Range Filter
  const [dashPerfStartDate, setDashPerfStartDate] = useState<string>('2026-09-01');
  const [dashPerfEndDate, setDashPerfEndDate] = useState<string>('2026-10-01');

  const applyProjectsFromApi = (data: unknown, requestId: number) => {
    if (requestId !== projectsRequestIdRef.current) return;
    if (Array.isArray(data)) {
      setProjects(data);
    }
  };

  const reloadProjects = async () => {
    const requestId = ++projectsRequestIdRef.current;
    try {
      const res = await fetch('/api/projects', { cache: 'no-store' });
      if (!res.ok) return;
      applyProjectsFromApi(await res.json(), requestId);
    } catch (err) {
      console.error('Failed to reload projects:', err);
    }
  };

  const openCreateTask = (personalTask = false) => {
    setSelectedTask(null);
    setPersonalTaskMode(personalTask);
    setIsTaskModalOpen(true);
    void reloadProjects();
  };

  const fetchData = useCallback(async (isInitial = false) => {
    const projectsRequestId = ++projectsRequestIdRef.current;
    const performanceMarksRequestId = ++performanceMarksRequestIdRef.current;
    try {
      if (isInitial) {
        setLoading(true);
      }
      const performanceParams = new URLSearchParams({
        startDate: performancePeriodStart,
        endDate: performancePeriodEnd,
        periodStart: performanceWeekStart
      });
      if (perfProjectFilter !== 'all') performanceParams.set('projectId', perfProjectFilter);
      const markParams = new URLSearchParams({
        periodStart: performanceWeekStart
      });
      if (perfProjectFilter !== 'all') markParams.set('projectId', perfProjectFilter);
      const [projectsRes, tasksRes, empRes, flagsRes, perfRes, remindersRes, dailyRes, marksRes, privateRatingsRes] = await Promise.all([
        fetch('/api/projects', { cache: 'no-store' }),
        fetch('/api/tasks'),
        fetch('/api/employees', { cache: 'no-store' }),
        fetch('/api/flags'),
        fetch(`/api/performance?${performanceParams.toString()}`),
        fetch('/api/reminders'),
        fetch('/api/daily-entries'),
        fetch(`/api/performance/marks?${markParams.toString()}`),
        isDirector ? fetch('/api/private-ratings') : Promise.resolve(null)
      ]);

      if (projectsRes.ok) applyProjectsFromApi(await projectsRes.json(), projectsRequestId);
      if (tasksRes.ok) setTasks(await tasksRes.json());
      if (empRes.ok) setEmployees(await empRes.json());
      if (flagsRes.ok) setFlags(await flagsRes.json());
      if (perfRes.ok) setPerformanceData(await perfRes.json());
      if (remindersRes.ok) setReminders(await remindersRes.json());
      if (dailyRes.ok) setDailyEntries(await dailyRes.json());
      if (marksRes.ok && performanceMarksRequestId === performanceMarksRequestIdRef.current) {
        setPerformanceMarks(await marksRes.json());
        setLoadedPerformanceMarksKey(`${perfProjectFilter}:${performanceWeekStart}`);
      }
      if (privateRatingsRes?.ok) setPrivateRatings(await privateRatingsRes.json());

    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      if (isInitial) {
        setLoading(false);
      }
    }
  }, [isDirector, perfProjectFilter, performancePeriodEnd, performancePeriodStart, performanceWeekStart]);

  useEffect(() => {
    fetchData(true);
    // Auto-poll every 10 seconds for real-time updates
    const interval = setInterval(() => fetchData(false), 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    if (!user?.id) return;
    try {
      const raw = localStorage.getItem(`dailyTaskCart:${user.id}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setDailyCartIds(parsed.map(String));
      }
    } catch {
      /* ignore */
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    localStorage.setItem(`dailyTaskCart:${user.id}`, JSON.stringify(dailyCartIds));
  }, [dailyCartIds, user?.id]);

  useEffect(() => {
    if (!isPriorityMenuOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (priorityMenuRef.current && !priorityMenuRef.current.contains(event.target as Node)) {
        setIsPriorityMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsPriorityMenuOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isPriorityMenuOpen]);

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
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(new Date());

  // 10 EXACT SUMMARY CARDS
  const stats = {
    totalProjects: projects.length,
    activeProjects: projects.filter(p => isOngoingProjectStatus(p.status)).length,
    upcomingProjects: projects.filter(p => p.status === 'Upcoming').length,
    sleepingProjects: projects.filter(p => p.status === 'Sleeping (On Hold)').length,
    completedProjects: projects.filter(p => p.status === 'Completed').length,
    totalEmployees: new Set(
      employees
        .filter(e => String(e.status || 'Active') !== 'Inactive')
        .map(e => String(e.id || e._id || e.email || ''))
        .filter(Boolean)
    ).size,
    currentTasks: tasks.filter(t => ['Pending', 'In Progress'].includes(t.status)).length,
    pendingApprovals: tasks.filter(t => t.status === 'Pending Approval' || t.workDone === 100).length,
    overdueTasks: tasks.filter(t => Boolean(t.dueDate && t.dueDate < todayDateStr && t.status !== 'Completed')).length,
    openFlags: flags.filter(f => f.status === 'Open').length
  };

  // ACTION REQUIRED CATEGORIES
  const openFlagsList = flags.filter(f => f.status === 'Open');
  const pendingApprovalTasks = tasks.filter(t =>
    t.status === 'Pending Approval' ||
    (t.workDone === 100 && t.status !== 'Completed') ||
    (t.assigneeProgress || []).some(item => item.status === 'Pending Approval' || item.workDone >= 100) && t.status !== 'Completed'
  );
  const unrepliedRemindersList = reminders.filter(r => !['Replied', 'Closed', 'Completed'].includes(r.status));
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
    if (!managementFlagTask) return;
    if (!(isDirector || isProjectHead)) {
      showToast('error', 'Only management can flag a task.');
      return;
    }
    const taskIds = Array.from(new Set(
      (managementFlagTaskIds.length > 0 ? managementFlagTaskIds : [taskKey(managementFlagTask)]).filter(Boolean)
    ));
    const messageText = managementFlagMessage.trim();
    if (taskIds.length === 0 || !messageText) {
      showToast('error', taskIds.length === 0 ? 'Select at least one task to flag.' : 'Enter a message before flagging this task.');
      return;
    }

    setCreatingManagementFlag(true);
    try {
      const results = await Promise.all(taskIds.map(async taskId => {
        try {
          const response = await fetch('/api/flags', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              taskId,
              flagType: managementFlagType,
              flagMessage: messageText
            })
          });
          const data = await response.json();
          return response.ok
            ? { taskId, success: true as const }
            : { taskId, success: false as const, error: data.error || 'Failed to flag task.' };
        } catch {
          return { taskId, success: false as const, error: 'Network error while flagging task.' };
        }
      }));
      const succeededIds = results.filter(result => result.success).map(result => result.taskId);
      const failures = results.filter(result => !result.success);
      if (succeededIds.length > 0) await fetchData();

      if (failures.length > 0) {
        const failedIds = failures.map(result => result.taskId);
        const remainingTasks = failedIds
          .map(id => tasks.find(task => taskKey(task) === id))
          .filter((task): task is Task => Boolean(task));
        setManagementFlagTaskIds(failedIds);
        setManagementFlagTask(remainingTasks[0] || null);
        showToast('error', `${succeededIds.length} task${succeededIds.length === 1 ? '' : 's'} flagged; ${failures.length} failed. ${failures[0].error}`);
        return;
      }

      showToast('success', `${succeededIds.length} task${succeededIds.length === 1 ? '' : 's'} flagged successfully. Employees notified.`);
      setManagementFlagTask(null);
      setManagementFlagTaskIds([]);
      setManagementFlagMessage('');
    } catch (err) {
      console.error('Management flag submission failed:', err);
      showToast('error', 'Failed to flag selected task(s).');
    } finally {
      setCreatingManagementFlag(false);
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

  const handleCloseReminder = async (reminderId: string) => {
    try {
      const res = await fetch(`/api/reminders/${reminderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Closed' })
      });
      if (!res.ok) {
        const data = await res.json();
        showToast('error', data.error || 'Failed to close reminder');
        return;
      }
      showToast('success', 'Reminder marked as closed.');
      fetchData(false);
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
      setProjects(prev => prev.filter(p => String(p.id || p._id) !== String(projectId)));
      setTasks(prev => prev.filter(t => String(t.projectId) !== String(projectId)));
      setDailyEntries(prev => prev.filter(entry => String(entry.projectId) !== String(projectId)));
      setFlags(prev => prev.filter(flag => String(flag.projectId || '') !== String(projectId)));
      await fetchData();
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
      setDailyCartIds(prev => prev.filter(id => id !== taskId));
      setSelectedTaskIds(prev => prev.filter(id => id !== taskId));
      fetchData();
    } catch (err) {
      showToast('error', 'Network error.');
    }
  };

  const taskKey = (t: Task) => String(t.id || t._id || '');

  const addTasksToDailyBoard = (ids: string[]) => {
    const unique = Array.from(new Set(ids.filter(Boolean)));
    if (unique.length === 0) {
      showToast('error', 'Select at least one task to add to the Daily Task Board.');
      return;
    }
    const newIds = unique.filter(id => !dailyCartIds.includes(id));
    if (newIds.length === 0) {
      showToast('error', 'The selected task is already on the Daily Task Board.');
      return;
    }
    setDailyCartIds(prev => Array.from(new Set([...prev, ...newIds])));
    setBoardEdits(prev => {
      const next = { ...prev };
      newIds.forEach(id => {
        const t = tasks.find(item => taskKey(item) === id);
        if (!t || next[id]) return;
        next[id] = {
          comment: '',
          hours: '',
          flagged: false
        };
      });
      return next;
    });
    setSelectedTaskIds([]);
    showToast('success', `${newIds.length} task${newIds.length === 1 ? '' : 's'} added to Daily Task Board.`);
  };

  const completeSelectedTasks = async () => {
    if (!(isDirector || isProjectHead)) return;
    const selectedTasks = selectedTaskIds
      .map(id => tasks.find(task => taskKey(task) === id))
      .filter((task): task is Task => task !== undefined && task.status !== 'Completed');
    if (selectedTasks.length === 0) {
      showToast('error', 'Select at least one active task to move to Completed Task History.');
      return;
    }

    const results = await Promise.all(selectedTasks.map(async task => {
      const id = taskKey(task);
      try {
        const response = await fetch(`/api/tasks/${id}/approve-completion`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            approved: true,
            remarks: 'Marked completed from Dashboard'
          })
        });
        if (response.ok) return { id, success: true };
        const data = await response.json();
        return { id, success: false, error: data.error || `Could not complete "${task.title}".` };
      } catch {
        return { id, success: false, error: `Network error while completing "${task.title}".` };
      }
    }));

    const completedIds = results.filter(result => result.success).map(result => result.id);
    const failures = results.filter(result => !result.success);
    setSelectedTaskIds(failures.map(result => result.id));
    if (completedIds.length > 0) {
      showToast(
        failures.length > 0 ? 'error' : 'success',
        failures.length > 0
          ? `${completedIds.length} task${completedIds.length === 1 ? '' : 's'} completed; ${failures.length} could not be completed. ${failures[0].error}`
          : `${completedIds.length} task${completedIds.length === 1 ? '' : 's'} moved to Completed Task History.`
      );
      await fetchData();
    } else {
      showToast('error', failures[0]?.error || 'No selected tasks could be completed.');
    }
  };

  const removeSelectedTasks = async () => {
    if (!isDirector) return;
    const selectedTasks = selectedTaskIds
      .map(id => tasks.find(task => taskKey(task) === id))
      .filter((task): task is Task => task !== undefined);
    if (selectedTasks.length === 0) {
      showToast('error', 'Select at least one task to remove.');
      return;
    }
    if (!window.confirm(`Permanently remove ${selectedTasks.length} selected task${selectedTasks.length === 1 ? '' : 's'}?`)) {
      return;
    }

    const results = await Promise.all(selectedTasks.map(async task => {
      const id = taskKey(task);
      try {
        const response = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
        if (response.ok) return { id, success: true };
        const data = await response.json();
        return { id, success: false, error: data.error || `Could not remove "${task.title}".` };
      } catch {
        return { id, success: false, error: `Network error while removing "${task.title}".` };
      }
    }));

    const removedIds = results.filter(result => result.success).map(result => result.id);
    const failures = results.filter(result => !result.success);
    setSelectedTaskIds(failures.map(result => result.id));
    setDailyCartIds(previous => previous.filter(id => !removedIds.includes(id)));
    if (removedIds.length > 0) {
      showToast(
        failures.length > 0 ? 'error' : 'success',
        failures.length > 0
          ? `${removedIds.length} task${removedIds.length === 1 ? '' : 's'} removed; ${failures.length} could not be removed. ${failures[0].error}`
          : `${removedIds.length} task${removedIds.length === 1 ? '' : 's'} removed.`
      );
      await fetchData();
    } else {
      showToast('error', failures[0]?.error || 'No selected tasks could be removed.');
    }
  };

  const handleRestoreCompletedTask = async (task: Task) => {
    const id = taskKey(task);
    if (!id) return;
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...task, status: 'In Progress' })
      });
      if (!res.ok) {
        const data = await res.json();
        showToast('error', data.error || 'Failed to shift task to Dashboard');
        return;
      }
      showToast('success', 'Task shifted back to Dashboard.');
      setActiveTab('overview');
      fetchData();
    } catch {
      showToast('error', 'Network error.');
    }
  };

  const handleUpdateCompletedLog = async (
    entryId: string,
    updates: { actionTaken: string; hours: number }
  ) => {
    try {
      const response = await fetch(`/api/daily-entries/${entryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update the daily log.');
      }
      showToast('success', 'Daily log updated.');
      await fetchData(false);
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Failed to update the daily log.');
      throw error;
    }
  };

  const handleDeleteCompletedLog = async (entryId: string) => {
    try {
      const response = await fetch(`/api/daily-entries/${entryId}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete the daily log.');
      }
      showToast('success', 'Daily log deleted.');
      await fetchData(false);
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Failed to delete the daily log.');
    }
  };

  const handleCompleteTask = async (task: Task) => {
    const id = taskKey(task);
    if (!id || !(isDirector || isProjectHead)) return;
    try {
      const response = await fetch(`/api/tasks/${id}/approve-completion`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: true, remarks: 'Marked completed from Task Allotment' })
      });
      if (!response.ok) {
        const data = await response.json();
        showToast('error', data.error || 'Failed to complete task.');
        return;
      }
      setIsTaskModalOpen(false);
      setSelectedTask(null);
      showToast('success', 'Task moved to Completed Task History.');
      await fetchData();
    } catch {
      showToast('error', 'Network error.');
    }
  };

  const handleLogDailyBoardEntry = async (task: Task) => {
    const id = taskKey(task);
    const edit = boardEdits[id] || {
      comment: '',
      hours: '',
      flagged: false
    };

    const hours = Number(edit.hours);
    if (!edit.comment.trim()) {
      showToast('error', 'Add today’s comment before submitting the daily entry.');
      return;
    }
    if (!Number.isFinite(hours) || hours <= 0) {
      showToast('error', 'Enter valid working hours greater than zero.');
      return;
    }
    if (todayLoggedHours + hours > 8) {
      showToast('error', `Daily work cannot exceed 8 hours. You have ${(8 - todayLoggedHours).toFixed(2)} hour(s) remaining.`);
      return;
    }

    setCartSubmittingId(id);
    try {
      const response = await fetch('/api/daily-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: id,
          projectId: task.projectId,
          projectName: task.projectName || '',
          taskTitle: task.title,
          details: task.description || task.title,
          actionTaken: edit.comment.trim(),
          hours,
          flagged: edit.flagged,
          status: 'In Progress'
        })
      });
      const data = await response.json();
      if (!response.ok) {
        showToast('error', data.error || 'Failed to submit daily entry.');
        return;
      }
      setBoardEdits(previous => ({
        ...previous,
        [id]: { ...edit, comment: '', hours: '', flagged: false }
      }));
      showToast('success', 'Daily entry submitted successfully.');
      await fetchData();
    } catch {
      showToast('error', 'Network error while submitting daily entry.');
    } finally {
      setCartSubmittingId(null);
    }
  };

  const handleSubmitDirectorDailyBoard = async () => {
    if (cartTasks.length === 0) {
      showToast('error', 'Add tasks to the Daily Task Board before submitting.');
      return;
    }

    const entries = cartTasks.map(task => {
      const id = taskKey(task);
      const edit = boardEdits[id] || { comment: '', hours: '', flagged: false };
      return { task, id, edit, hours: Number(edit.hours) };
    });
    const missingEntry = entries.find(entry =>
      !entry.edit.comment.trim() || !Number.isFinite(entry.hours) || entry.hours <= 0
    );
    if (missingEntry) {
      showToast('error', `Add today's comment and valid hours for ${missingEntry.task.title}.`);
      return;
    }

    const totalHours = entries.reduce((total, entry) => total + entry.hours, 0);
    if (todayLoggedHours + totalHours > 8) {
      showToast('error', `Daily work cannot exceed 8 hours. You have ${todayFreeHours.toFixed(2)} hour(s) remaining.`);
      return;
    }

    setCartSubmittingId('all');
    try {
      const response = await fetch('/api/daily-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entries.map(({ task, edit, hours }) => ({
          taskId: taskKey(task),
          projectId: task.projectId,
          projectName: task.projectName || '',
          taskTitle: task.title,
          details: task.description || task.title,
          actionTaken: edit.comment.trim(),
          hours,
          flagged: edit.flagged,
          status: 'In Progress'
        })))
      });
      const data = await response.json();
      if (!response.ok) {
        showToast('error', data.error || 'Failed to submit daily entries.');
        return;
      }

      setBoardEdits(previous => {
        const updated = { ...previous };
        entries.forEach(({ id }) => {
          updated[id] = { comment: '', hours: '', flagged: false };
        });
        return updated;
      });
      setDailyCartIds(previous => previous.filter(id => !entries.some(entry => entry.id === id)));
      showToast('success', 'Daily entries submitted successfully.');
      await fetchData();
    } catch {
      showToast('error', 'Network error while submitting daily entries.');
    } finally {
      setCartSubmittingId(null);
    }
  };

  const handleReviewDailyEntry = async (entry: DailyEntry) => {
    const id = String(entry.id || entry._id || '');
    if (!id) {
      showToast('error', 'Unable to review this daily entry.');
      return;
    }

    setReviewingDailyEntryId(id);
    try {
      const res = await fetch(`/api/daily-entries/${id}`, { method: 'PATCH' });
      const data = await res.json();
      if (!res.ok) {
        showToast('error', data.error || 'Failed to review daily entry.');
        return;
      }
      setDailyEntries(previous => previous.map(current =>
        String(current.id || current._id || '') === id ? data : current
      ));
      showToast('success', 'Daily entry reviewed.');
    } catch {
      showToast('error', 'Network error while reviewing daily entry.');
    } finally {
      setReviewingDailyEntryId(null);
    }
  };

  const startEditingDailyComment = (entry: DailyEntry) => {
    const id = String(entry.id || entry._id || '');
    if (!id) {
      showToast('error', 'Unable to edit this daily comment.');
      return;
    }
    setEditingDailyCommentId(id);
    setDailyCommentDraft(entry.actionTaken || '');
  };

  const cancelEditingDailyComment = () => {
    setEditingDailyCommentId(null);
    setDailyCommentDraft('');
  };

  const saveDailyComment = async (entry: DailyEntry) => {
    const id = String(entry.id || entry._id || '');
    if (!id || !dailyCommentDraft.trim()) {
      showToast('error', 'Daily comment cannot be empty.');
      return;
    }
    setSavingDailyCommentId(id);
    try {
      const res = await fetch(`/api/daily-entries/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionTaken: dailyCommentDraft })
      });
      const data = await res.json();
      if (!res.ok) {
        showToast('error', data.error || 'Failed to update daily comment.');
        return;
      }
      setDailyEntries(previous => previous.map(current =>
        String(current.id || current._id || '') === id ? data : current
      ));
      cancelEditingDailyComment();
      showToast('success', 'Daily comment updated.');
    } catch {
      showToast('error', 'Network error while updating daily comment.');
    } finally {
      setSavingDailyCommentId(null);
    }
  };

  const openPrivateRating = (task: Task, employeeId: string) => {
    const taskId = String(task.id || task._id || '');
    const existingRating = privateRatings.find(rating =>
      String(rating.taskId) === taskId && String(rating.employeeId) === employeeId
    );
    const isTaskEmployeeRating = task.assignedEmployeeIds?.[0] === employeeId;
    setRatingModalTask(task);
    setRatingModalEmployeeId(employeeId);
    setRatingValue(existingRating?.rating ?? (isTaskEmployeeRating ? task.rating : undefined) ?? 5);
    setRatingComment(existingRating?.privateComment ?? (isTaskEmployeeRating ? task.privateComment : '') ?? '');
  };

  // Save Director Private Rating
  const handleSavePrivateRating = async () => {
    if (!ratingModalTask || !ratingModalEmployeeId) {
      showToast('error', 'Select an employee before saving this rating.');
      return;
    }
    const tId = ratingModalTask.id || ratingModalTask._id || '';
    if (!tId) {
      showToast('error', 'Unable to identify the task for this rating.');
      return;
    }

    setSavingPrivateRating(true);
    try {
      const res = await fetch('/api/private-ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: tId,
          employeeId: ratingModalEmployeeId,
          rating: ratingValue,
          privateComment: ratingComment
        })
      });

      if (!res.ok) {
        const data = await res.json();
        showToast('error', data.error || 'Failed to save private rating');
        return;
      }

      const savedRating: PrivateRating = await res.json();
      setPrivateRatings(previous => [
        ...previous.filter(rating =>
          !(String(rating.taskId) === tId && String(rating.employeeId) === ratingModalEmployeeId)
        ),
        savedRating
      ]);
      showToast('success', 'Star rating saved and shared with the employee. Your comment remains private.');
      setRatingModalTask(null);
      fetchData();
    } catch (err) {
      console.error('Error saving private star rating:', err);
      showToast('error', 'Network error while saving the star rating.');
    } finally {
      setSavingPrivateRating(false);
    }
  };

  const handleSubmitWeeklyMarks = async () => {
    if (
      perfView !== 'week' ||
      loadedPerformanceMarksKey !== `${perfProjectFilter}:${performanceWeekStart}`
    ) {
      showToast('error', 'Wait for the selected week’s performance data to finish loading.');
      return;
    }

    const pendingRatings = performanceRows
      .map(employee => {
        const employeeId = String(employee.employeeId);
        const draft = weeklyRatingDrafts[employeeId];
        const mark = getWeeklyMark(employeeId);
        const alreadySubmitted = isDirector
          ? typeof mark?.rating === 'number'
          : typeof mark?.coordinatorRating === 'number';
        return draft && draft.rating && !alreadySubmitted
          ? { employeeId, rating: Number(draft.rating), comment: draft.comment.trim() }
          : null;
      })
      .filter((rating): rating is NonNullable<typeof rating> => rating !== null);

    if (pendingRatings.length === 0) {
      showToast('error', 'Choose a weekly rating for at least one employee.');
      return;
    }

    setSavingPerformanceMark(true);
    try {
      const results = await Promise.all(pendingRatings.map(async rating => {
        try {
          const res = await fetch('/api/performance/marks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              employeeId: rating.employeeId,
              projectId: 'all',
              periodStart: performanceWeekStart,
              rating: rating.rating,
              comment: rating.comment
            })
          });
          const data = await res.json();
          return res.ok
            ? { employeeId: rating.employeeId, mark: data }
            : { employeeId: rating.employeeId, error: data.error || 'Failed to save weekly rating.' };
        } catch {
          return { employeeId: rating.employeeId, error: 'Network error while saving this weekly rating.' };
        }
      }));
      const savedRatings = results.filter((result): result is { employeeId: string; mark: typeof performanceMarks[number] } => 'mark' in result);
      const failedRatings = results.filter(result => 'error' in result);

      if (savedRatings.length > 0) {
        setPerformanceMarks(previous => [
          ...previous.filter(mark => !savedRatings.some(result =>
            mark.employeeId === result.mark.employeeId &&
            mark.projectId === result.mark.projectId &&
            mark.periodStart === result.mark.periodStart
          )),
          ...savedRatings.map(result => result.mark)
        ]);
        setWeeklyRatingDrafts(previous => {
          const next = { ...previous };
          savedRatings.forEach(result => { delete next[result.employeeId]; });
          return next;
        });
      }
      if (failedRatings.length > 0) {
        showToast('error', `Saved ${savedRatings.length} rating(s); ${failedRatings.length} could not be saved. ${failedRatings[0].error}`);
      } else {
        showToast('success', `Saved weekly ratings for ${savedRatings.length} employee(s).`);
      }
      void fetchData(false);
    } finally {
      setSavingPerformanceMark(false);
    }
  };

  // Save Project Handler
  const handleSaveProject = async (projectData: any) => {
    try {
      const candidateId = String(projectData?.id || projectData?._id || '');
      const isEdit = /^[a-f\d]{24}$/i.test(candidateId);
      const url = isEdit ? `/api/projects/${candidateId}` : '/api/projects';
      const method = isEdit ? 'PUT' : 'POST';
      const payload = { ...projectData };
      if (!isEdit) {
        delete payload.id;
        delete payload._id;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save project');
      }

      const saved = await res.json();
      showToast('success', isEdit ? 'Project updated successfully.' : 'Project created successfully.');
      if (!isEdit) {
        setProjectStatusFilter('all');
        setSelectedProject(null);
      }
      if (saved && (saved.id || saved._id)) {
        const savedId = String(saved.id || saved._id);
        setProjects(prev => {
          const list = Array.isArray(prev) ? prev : [];
          const idx = list.findIndex(p => String(p.id || p._id) === savedId);
          if (idx >= 0) {
            const next = [...list];
            next[idx] = { ...list[idx], ...saved };
            return next;
          }
          return [saved, ...list];
        });
      }
      await reloadProjects();
      if (isEdit) await fetchData();
    } catch (err: any) {
      throw err;
    }
  };

  // Save Task Handler
  const handleSaveTask = async (taskData: any) => {
    try {
      const isEdit = !!selectedTask;
      const selectedProjectTasks = Array.isArray(taskData.selectedProjectTasks) ? taskData.selectedProjectTasks : [];

      if (!isEdit && selectedProjectTasks.length > 0) {
        const extraTitle = typeof taskData.title === 'string' ? taskData.title.trim() : '';
        let payloads = [...selectedProjectTasks];
        if (extraTitle && !payloads.some((item: any) => String(item.title || '').trim().toLowerCase() === extraTitle.toLowerCase())) {
          payloads.push({ title: extraTitle, assignedEmployeeIds: taskData.assignedEmployeeIds });
        }

        for (const item of payloads) {
          const res = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: item.title,
              description: String(item.requirement || '').trim() || taskData.description || item.title,
              projectId: taskData.projectId,
              priority: item.priority || taskData.priority,
              assignedEmployeeIds: item.assignedEmployeeIds || taskData.assignedEmployeeIds,
              reminderDate: taskData.reminderDate,
              startDate: taskData.startDate,
              dueDate: taskData.dueDate || taskData.reminderDate
            })
          });
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Failed to save task');
          }
          const savedTask = await res.json();
          const savedTaskId = String(savedTask.id || savedTask._id || '');
          const subtasks = Array.isArray(item.subtasks) ? item.subtasks : [];
          for (const sub of subtasks) {
            const subRes = await fetch('/api/tasks', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: sub.title,
                description: String(sub.requirement || '').trim() || sub.title,
                projectId: taskData.projectId,
                priority: item.priority || taskData.priority,
                assignedEmployeeIds: item.assignedEmployeeIds || taskData.assignedEmployeeIds,
                reminderDate: taskData.reminderDate,
                startDate: taskData.startDate,
                dueDate: taskData.dueDate || taskData.reminderDate,
                parentTaskId: savedTaskId
              })
            });
            if (!subRes.ok) {
              const data = await subRes.json();
              throw new Error(data.error || `Failed to save subtask ${sub.title}`);
            }
          }
        }
        showToast('success', payloads.length > 1 ? 'Selected tasks assigned successfully.' : 'Task assigned successfully.');
        fetchData();
        return;
      }

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

      showToast('success', isEdit
        ? 'Task updated.'
        : taskData.personalTask
          ? 'Task added to your Dashboard.'
          : 'Task assigned successfully.');
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

      await fetchData();
      showToast('success', isEdit ? 'Employee updated.' : 'Employee added successfully.');
    } catch (err: any) {
      throw err;
    }
  };

  const matchesTimeFilter = (
    dateStr: string | undefined,
    mode: 'all' | 'date' | 'week' | 'month',
    anchor: string
  ) => {
    if (mode === 'all') return true;
    if (!dateStr || !anchor) return false;
    const d = String(dateStr).substring(0, 10);
    const a = String(anchor).substring(0, 10);
    if (mode === 'date') return d === a;
    if (mode === 'week') {
      const base = new Date(`${a}T00:00:00`);
      const start = new Date(base);
      start.setDate(base.getDate() - base.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      const cur = new Date(`${d}T00:00:00`);
      return cur >= start && cur <= end;
    }
    if (mode === 'month') return d.substring(0, 7) === a.substring(0, 7);
    return true;
  };

  const completedTasks = tasks.filter(t => {
    if (t.status !== 'Completed') return false;
    if (completedProjectFilter !== 'all' && String(t.projectId) !== completedProjectFilter) return false;
    if (completedEmployeeFilter !== 'all' && !(t.assignedEmployeeIds || []).includes(completedEmployeeFilter)) return false;
    if (!matchesTimeFilter(t.approvalDate || t.updatedAt || t.dueDate, completedTimeFilter, completedTimeDate)) return false;
    return true;
  });
  const performanceRows = performanceData.filter(employee => {
    if (perfEmployeeFilter !== 'all' && String(employee.employeeId) !== perfEmployeeFilter) return false;
    if (perfProjectFilter === 'all') return true;
    return tasks.some(task =>
      (task.assignedEmployeeIds || []).includes(String(employee.employeeId)) &&
      String(task.projectId) === perfProjectFilter
    ) || dailyEntries.some(entry =>
      String(entry.employeeId) === String(employee.employeeId) &&
      String(entry.projectId) === perfProjectFilter
    ) || (
      loadedPerformanceMarksKey === `${perfProjectFilter}:${performanceWeekStart}` &&
      performanceMarks.some(mark =>
        mark.employeeId === String(employee.employeeId) &&
        mark.projectId === perfProjectFilter
      )
    );
  });
  const performanceSubmissions = dailyEntries
    .filter(entry =>
      entry.date >= performancePeriodStart &&
      entry.date <= performancePeriodEnd &&
      (perfProjectFilter === 'all' || String(entry.projectId) === perfProjectFilter)
    )
    .sort((first, second) => second.date.localeCompare(first.date));
  const getWeeklyMark = (employeeId: string) => {
    if (
      perfView !== 'week' ||
      loadedPerformanceMarksKey !== `${perfProjectFilter}:${performanceWeekStart}`
    ) return undefined;
    return performanceMarks.find(mark =>
      mark.employeeId === employeeId &&
      mark.projectId === perfProjectFilter &&
      mark.periodStart === performanceWeekStart
    );
  };
  const activeTasks = tasks.filter(t => ['Pending', 'In Progress'].includes(t.status));

  // Personal dashboard tasks are active/incomplete work assigned to the logged-in management user.
  const myPersonalTasks = tasks.filter(t => {
    const uId = user?.id || (user as any)?._id || '';
    if (!uId) return false;
    const assignedToMe = Array.isArray(t.assignedEmployeeIds) && t.assignedEmployeeIds.includes(uId);
    if (!assignedToMe) return false;
    const status = String(t.status || '').trim();
    return !['Completed', 'Closed', 'Cancelled'].includes(status);
  });

  // Filtered views
  const filteredProjects = projects.filter(p => {
    if (projectStatusFilter !== 'all') {
      if (projectStatusFilter === 'Ongoing') {
        if (!isOngoingProjectStatus(p.status)) return false
      } else if (p.status !== projectStatusFilter) {
        return false
      }
    }
    return true;
  });

  const filteredTasks = tasks.filter(t => {
    if (isProjectHead && activeTab === 'tasks' && t.status === 'Completed') return false;
    if (isManagementDashboard && activeTab === 'overview' && !myPersonalTasks.some(myTask => taskKey(myTask) === taskKey(t))) {
      return false;
    }
    if (taskPriorityFilter !== 'all' && t.priority !== taskPriorityFilter) return false;
    if (taskStatusFilter === 'current') {
      if (!['Pending', 'In Progress'].includes(t.status)) return false;
    } else if (taskStatusFilter !== 'all' && t.status !== taskStatusFilter) return false;
    if (taskProjectFilter !== 'all' && String(t.projectId) !== taskProjectFilter) return false;
    if (taskEmployeeFilter === 'coordinator') {
      const coordinatorIds = employees
        .filter(e => e.role === 'Project Head')
        .map(e => String(e.id || e._id));
      if (!(t.assignedEmployeeIds || []).some(id => coordinatorIds.includes(String(id)))) return false;
    } else if (taskEmployeeFilter !== 'all' && !(t.assignedEmployeeIds || []).includes(taskEmployeeFilter)) {
      return false;
    }
    if (!matchesTimeFilter(t.reminderDate || t.dueDate || t.createdAt, taskTimeFilter, taskTimeDate)) return false;
    if (taskSearch && !t.title.toLowerCase().includes(taskSearch.toLowerCase()) && !(t.projectName || '').toLowerCase().includes(taskSearch.toLowerCase())) return false;
    return true;
  });

  const cartTasks = dailyCartIds
    .map(id => tasks.find(t => taskKey(t) === id))
    .filter((t): t is Task => Boolean(t));
  const selectableDirectoryTasks = filteredTasks.filter(
    t => t.status !== 'Completed' && !dailyCartIds.includes(taskKey(t))
  );
  const allVisibleSelected = selectableDirectoryTasks.length > 0 &&
    selectableDirectoryTasks.every(t => selectedTaskIds.includes(taskKey(t)));

  // Filtered Daily Board
  const filteredDailyBoard = dailyEntries.filter(entry => {
    if (boardEmployeeFilter !== 'all' && entry.employeeId !== boardEmployeeFilter) return false;
    if (boardProjectFilter !== 'all' && entry.projectId !== boardProjectFilter) return false;
    if (boardDateFilter && entry.date !== boardDateFilter) return false;
    if (boardStatusFilter !== 'all' && entry.status !== boardStatusFilter) return false;
    if (boardSearch && !entry.taskTitle.toLowerCase().includes(boardSearch.toLowerCase()) && !(entry.actionTaken || '').toLowerCase().includes(boardSearch.toLowerCase())) return false;
    return true;
  });

  const boardTotalHours = filteredDailyBoard.reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0);
  const signedInUserId = String(user?.id || (user as any)?._id || '');
  const todayLoggedHours = Number(dailyEntries
    .filter(entry => entry.employeeId === signedInUserId && entry.date === getCurrentKolkataDate())
    .reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0)
    .toFixed(2));
  const todayFreeHours = Math.max(0, Number((8 - todayLoggedHours).toFixed(2)));
  const boardFiltersActive = Boolean(
    boardSearch || boardDateFilter || boardEmployeeFilter !== 'all' || boardProjectFilter !== 'all' || boardStatusFilter !== 'all'
  );
  const formatBoardDay = (dateStr: string) => {
    const d = new Date(`${String(dateStr || '').substring(0, 10)}T00:00:00`);
    if (Number.isNaN(d.getTime())) return dateStr || '-';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const formatBoardWeekday = (dateStr: string) => {
    const d = new Date(`${String(dateStr || '').substring(0, 10)}T00:00:00`);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { weekday: 'long' });
  };

  const taskCodeById = new Map(tasks.map(t => [String(t.id || t._id || ''), t.taskCode || '']));
  const taskById = new Map(tasks.map(t => [String(t.id || t._id || ''), t]));
  const boardParentOf = (taskId?: string) => {
    const id = String(taskId || '');
    const parentId = String(taskById.get(id)?.parentTaskId || '');
    return parentId && parentId !== id ? taskById.get(parentId) : undefined;
  };
  const boardMainIdOf = (taskId?: string) => {
    const parent = boardParentOf(taskId);
    return parent ? String(parent.id || parent._id || '') : String(taskId || '');
  };
  const projectHeading = (group: { projectId: string; projectName: string }) => {
    return String(group.projectName || '').trim() || 'Project';
  };

  const groupedDailyBoard = groupItemsByProject(
    sortByHierarchyCode(filteredDailyBoard, entry => taskCodeById.get(String(entry.taskId))).map(entry => ({
      ...entry,
      projectId: entry.projectId,
      projectName: entry.projectName || 'Project',
      hours: entry.hours
    }))
  );
  const groupedDirectorTasks = groupItemsByProject(
    sortByHierarchyCode(myPersonalTasks, t => t.taskCode).map(t => ({
      ...t,
      projectId: t.projectId,
      projectName: t.projectName || 'Project'
    }))
  );
  const directorDashboardTasks = myPersonalTasks.filter(task =>
    taskPriorityFilter === 'all' || task.priority === taskPriorityFilter
  );
  const groupedDirectorDashboardTasks = groupItemsByProject(
    sortByHierarchyCode(directorDashboardTasks, task => task.taskCode).map(task => ({
      ...task,
      projectId: task.projectId,
      projectName: task.projectName || 'Project'
    }))
  );
  const getDirectorDashboardSubtasks = (parentId: string, candidates: Task[]) => {
    const descendants: Task[] = [];
    const visited = new Set([parentId]);
    const collectChildren = (currentParentId: string) => {
      candidates.forEach(candidate => {
        const candidateId = taskKey(candidate);
        if (String(candidate.parentTaskId || '') !== currentParentId || visited.has(candidateId)) return;
        visited.add(candidateId);
        descendants.push(candidate);
        collectChildren(candidateId);
      });
    };
    collectChildren(parentId);
    return descendants;
  };
  const directorDashboardTaskIds = directorDashboardTasks
    .filter(task => task.status !== 'Completed' && !dailyCartIds.includes(taskKey(task)))
    .map(taskKey);
  const selectedDirectorDashboardTaskIds = selectedTaskIds.filter(id =>
    directorDashboardTasks.some(task => taskKey(task) === id)
  );
  const allDirectorDashboardTasksSelected = directorDashboardTaskIds.length > 0 &&
    directorDashboardTaskIds.every(id => selectedTaskIds.includes(id));
  const groupedFilteredTasks = groupItemsByProject(
    sortByHierarchyCode(filteredTasks, t => t.taskCode).map(t => ({
      ...t,
      projectId: t.projectId,
      projectName: t.projectName || 'Project'
    }))
  );

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
    <div className={isDirector ? 'min-h-screen bg-[#E7E5E9] py-[10px]' : ''}>
    <div className={`relative mx-auto flex min-h-[calc(100vh-20px)] font-sans text-slate-800 antialiased ${isDirector ? 'max-w-[1308px] border border-[#C7CAD0] bg-[#F1F5F9]' : `min-h-screen ${isManagementDashboard ? 'bg-[#F1F5F9]' : 'bg-[#F8FAFC]'}`}`}>
      {/* Grouped Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        flagCount={openFlagsList.length}
        reminderCount={unrepliedRemindersList.length}
        cartCount={dailyCartIds.length}
        taskCount={isDirector ? myPersonalTasks.length : isProjectHead ? activeTasks.length : 0}
      />

      {/* Main Workspace */}
      <div className={`flex min-w-0 w-full flex-1 flex-col pt-20 px-4 pb-12 ${isDirector ? 'md:pt-5' : 'md:pt-6'} ${isProjectHead ? 'md:ml-[266px]' : 'md:ml-64'} transition-all ${isManagementDashboard ? 'md:px-6' : 'md:px-8'}`}>

        {/* Sticky Corporate Top Header */}
        <div className={`flex flex-col justify-between gap-4 rounded-[14px] border border-[#E2E8F0] bg-white p-4 shadow-xs md:flex-row md:items-center md:px-6 ${isManagementDashboard ? 'mb-5 md:min-h-[84px]' : 'mb-6 md:py-4'}`}>
          <div className={`flex items-center ${isManagementDashboard ? 'justify-between gap-3' : 'gap-3.5'}`}>
            {isManagementDashboard ? (
              <>
                <div>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                    <h1 className="text-xl font-bold tracking-tight text-[#0F172A] md:text-2xl">
                      {isDirector ? 'Director Dashboard' : 'Project Head Dashboard'}
                    </h1>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#D1FAE5] px-4 py-1.5 text-[10px] font-bold text-[#047857]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                      Online
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-[#2563EB]">
                    Welcome, {user?.name || (isDirector ? 'Director' : 'Project Head')}
                  </p>
                </div>
              </>
            ) : (
              <>
                <img
                  src="/logo.png"
                  alt="Korals Design Logo"
                  className="hidden h-10 w-auto rounded-xl border border-slate-200 bg-black px-2 py-1 shadow-xs sm:block"
                />
                <EmployeeAvatar name={user?.name || 'Project Head'} size="lg" />
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold tracking-tight text-[#0F172A]">
                      Project Head Dashboard
                    </h1>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#D1FAE5] px-4 py-1.5 text-[10px] font-bold text-[#047857]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                      Online
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-[#2563EB]">
                    Welcome, {user?.name || 'Project Head'}
                  </p>
                </div>
              </>
            )}
          </div>

          <div className={`flex flex-wrap items-center gap-3 ${isManagementDashboard ? 'md:justify-end' : ''}`}>
            <NotificationCenter onSelectTask={() => setActiveTab('overview')} />

            <div className="flex items-center gap-2 rounded-lg border border-[#CBD5E1] bg-white px-3.5 py-1.5 text-xs font-medium text-[#334155]">
              {!isManagementDashboard && <Calendar size={14} className="text-[#2563EB]" />}
              <span>{todayFormatted}</span>
            </div>

            {isManagementDashboard ? (
              <div className="rounded-lg border border-[#BFDBFE] bg-[#EEF2FF] px-4 py-1.5 text-center text-xs font-semibold text-[#1E293B]">
                {getShortName(user?.name)}
              </div>
            ) : (
              <button
                onClick={() => { setSelectedProject(null); setIsProjectModalOpen(true); }}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-[#1D4ED8]"
              >
                <Plus size={14} />
                <span>Create Project</span>
              </button>
            )}

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

        {activeTab === 'overview' && isManagementDashboard && (
          <section className="space-y-4" aria-labelledby="personal-dashboard-tasks-title">
            <h2 id="personal-dashboard-tasks-title" className="text-xl font-bold text-[#0F172A]">
              Tasks and flags
            </h2>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {[
                { value: 'Urgent', label: 'Urgent', color: 'bg-[#DC2626] hover:bg-[#B91C1C]' },
                { value: 'Medium', label: 'Less Urgent', color: 'bg-[#F59E0B] hover:bg-[#D97706]' },
                { value: 'all', label: 'All', color: 'bg-[#3B82F6] hover:bg-[#2563EB]' },
                { value: 'Self', label: 'Self Defined', color: 'bg-[#6366F1] hover:bg-[#4F46E5]' },
                { value: 'Daily', label: 'Daily Task', color: 'bg-[#16A34A] hover:bg-[#15803D]' }
              ].map(option => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={taskPriorityFilter === option.value}
                  onClick={() => {
                    setTaskPriorityFilter(option.value);
                    setSelectedTaskIds([]);
                  }}
                  className={`flex min-h-[42px] items-center justify-center rounded-lg px-3 py-2 text-sm font-bold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#2563EB] ${option.color}`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto border border-[#E2E8F0]">
              <table className="w-full min-w-[680px] table-fixed border-collapse text-left text-xs">
                <colgroup>
                  <col className="w-[4.5%]" />
                  <col className="w-[46%]" />
                  <col className="w-[14%]" />
                  <col className="w-[35.5%]" />
                </colgroup>
                <thead>
                  <tr className="h-10 border-b border-[#CBD5E1] bg-[#334155] text-[13px] font-bold text-white">
                    <th className="p-2.5">
                      <input
                        type="checkbox"
                        checked={allDirectorDashboardTasksSelected}
                        onChange={event => setSelectedTaskIds(
                          event.target.checked ? directorDashboardTaskIds : []
                        )}
                        className="cursor-pointer accent-[#2563EB]"
                        aria-label="Select all visible tasks"
                      />
                    </th>
                    <th className="p-2.5">Task / Subtask</th>
                    <th className="p-2.5">Project</th>
                    <th className="p-2.5">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {groupedDirectorDashboardTasks.flatMap(group => {
                    const groupIds = new Set(group.items.map(taskKey));
                    const rootTasks = group.items.filter(task =>
                      !task.parentTaskId || !groupIds.has(String(task.parentTaskId))
                    );

                    return rootTasks.map(task => {
                      const id = taskKey(task);
                      const childTasks = getDirectorDashboardSubtasks(id, group.items);
                      const relatedTasks = [task, ...childTasks];
                      const selectableIds = relatedTasks
                        .filter(item => item.status !== 'Completed' && !dailyCartIds.includes(taskKey(item)))
                        .map(taskKey);
                      const isSelected = selectableIds.length > 0 &&
                        selectableIds.every(taskId => selectedTaskIds.includes(taskId));

                      return (
                        <tr key={id} className="bg-white even:bg-[#F8FAFC] hover:bg-[#F1F5F9]">
                          <td className="p-2.5 align-middle">
                            {selectableIds.length > 0 && (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={event => setSelectedTaskIds(previous => {
                                  const next = new Set(previous);
                                  selectableIds.forEach(taskId => {
                                    if (event.target.checked) next.add(taskId);
                                    else next.delete(taskId);
                                  });
                                  return Array.from(next);
                                })}
                                className="cursor-pointer accent-[#2563EB]"
                                aria-label={`Select ${task.title} and subtasks`}
                              />
                            )}
                          </td>
                          <td className="p-2.5 align-middle">
                            <button
                              type="button"
                              onClick={() => { setSelectedTask(task); setPersonalTaskMode(false); setIsTaskModalOpen(true); }}
                              className="block text-left text-sm font-bold leading-tight text-[#1E293B] hover:text-[#2563EB]"
                            >
                              {task.title}
                            </button>
                            {childTasks.map(child => (
                              <button
                                key={taskKey(child)}
                                type="button"
                                onClick={() => { setSelectedTask(child); setPersonalTaskMode(false); setIsTaskModalOpen(true); }}
                                className="block max-w-full truncate text-left text-[11px] leading-[14px] text-[#334155] hover:text-[#2563EB]"
                              >
                                {child.title}
                              </button>
                            ))}
                          </td>
                          <td className="p-2.5 align-middle text-sm text-[#1E293B]">
                            {group.projectName}
                          </td>
                          <td className="p-2.5 align-middle text-sm text-[#1E293B]">
                            {task.description || '-'}
                          </td>
                        </tr>
                      );
                    });
                  })}
                  {groupedDirectorDashboardTasks.every(group => group.items.length === 0) && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-sm text-[#64748B]">
                        No tasks match this category.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-0 flex flex-wrap gap-3 pt-12">
              <button
                type="button"
                onClick={() => addTasksToDailyBoard(selectedDirectorDashboardTaskIds)}
                disabled={selectedDirectorDashboardTaskIds.length === 0}
                className="min-h-10 w-full rounded-lg bg-[#2563EB] px-6 py-2 text-sm font-bold text-white transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-50 sm:w-64"
              >
                Add to Daily Task Board
              </button>
              <button
                type="button"
                onClick={() => openCreateTask(true)}
                className="min-h-10 w-full rounded-lg bg-[#6366F1] px-6 py-2 text-sm font-bold text-white transition hover:bg-[#4F46E5] sm:w-[198px]"
              >
                New Task +
              </button>
            </div>

          </section>
        )}

        {/* TAB 1: DASHBOARD OVERVIEW */}
        {activeTab === 'overview' && !isManagementDashboard && (
          <div className="order-2 space-y-6">

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

            {/* Project Head dashboard summary cards */}
            {!isManagementDashboard && (loading ? (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
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

                {/* 2. Ongoing Projects */}
                <button
                  onClick={() => { setActiveTab('projects'); setProjectStatusFilter('Ongoing'); }}
                  className="text-left bg-white p-5 rounded-[14px] border border-[#E2E8F0] shadow-xs hover:border-[#2563EB] hover:shadow-md transition cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-[#64748B] mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#2563EB]">Ongoing</span>
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center group-hover:bg-[#2563EB] group-hover:text-white transition">
                      <Layers size={16} />
                    </div>
                  </div>
                  <p className="text-2xl font-extrabold text-[#2563EB]">{stats.activeProjects}</p>
                  <p className="text-[11px] text-[#94A3B8] mt-0.5">Ongoing projects</p>
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
            ))}

            {/* ACTIVE TASK PIPELINE CARDS */}
            {!isManagementDashboard && (
            <div className="bg-white rounded-[14px] border border-[#E2E8F0] p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0]">
                <div>
                  <h3 className="text-base font-bold text-[#0F172A]">Active Task Pipeline Overview</h3>
                  <p className="text-xs text-[#64748B]">Real-time employee execution &amp; completion status</p>
                </div>
                <a
                  href="#dashboard-task-directory"
                  className="text-xs font-bold text-[#2563EB] hover:text-[#1D4ED8] flex items-center gap-1 cursor-pointer"
                >
                  View All Tasks <ArrowRight size={14} />
                </a>
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
            )}

          </div>
        )}

        {/* TAB 2: DAILY TASK BOARD */}
        {activeTab === 'today-work' && (
          <DailyTaskBoardView
            user={user}
            role={isDirector ? 'Director' : 'Project Head'}
            tasks={tasks}
            dailyEntries={dailyEntries}
            initialCartIds={dailyCartIds}
            onCartChange={setDailyCartIds}
            onRefresh={fetchData}
            showToast={showToast}
          />
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
                onClick={() => openCreateTask(isDirector)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold rounded-lg text-xs transition cursor-pointer"
              >
                <Plus size={14} />
                Create Task
              </button>
            </div>

            {myPersonalTasks.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <CheckSquare size={36} className="mx-auto text-slate-300" />
                <p className="text-sm font-bold text-[#0F172A]">No tasks directly assigned to you.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {groupedDirectorTasks.map(group => (
                  <div key={group.projectId} className="space-y-2">
                    <h4 className="text-sm font-bold text-[#0F172A]">{projectHeading(group)}</h4>
                    <ul className="space-y-1">
                      {group.items.map(t => (
                        <li key={t.id || t._id} className={`flex items-start gap-2 text-sm text-[#334155] ${t.parentTaskId ? 'pl-6' : ''}`}>
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#2563EB] flex-shrink-0" />
                          <span className="flex-1">{t.title}</span>
                          <span className="text-[10px] font-bold rounded-full bg-slate-100 text-slate-700 px-2 py-0.5">{t.status}</span>
                        </li>
                      ))}
                    </ul>
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
              <span>Calculated Total Hours: <span className="text-indigo-600 text-sm font-black">{formatHoursMinutes(reportTotalHours)}</span></span>
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
                      <th className="p-3.5 text-center">Flag</th>
                      <th className="p-3.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {filteredDailyReports.map(entry => (
                      <tr key={entry.id || entry._id} className="hover:bg-[#F8FAFC] transition">
                        <td className="p-3.5 font-bold text-[#0F172A]">{entry.employeeName}</td>
                        <td className="p-3.5 font-semibold text-[#334155]">
                          {projectHeading({ projectId: String(entry.projectId || ''), projectName: entry.projectName || 'Project' })}
                        </td>
                        <td className="p-3.5 font-bold text-[#0F172A]">
                          {entry.taskTitle}
                        </td>
                        <td className="p-3.5 text-[#64748B]">{entry.details || '-'}</td>
                        <td className="p-3.5 text-[#0F172A]">{entry.actionTaken}</td>
                        <td className="p-3.5 text-center font-extrabold text-[#2563EB]">{formatHoursMinutes(entry.hours)}</td>
                        <td className="p-3.5 text-center font-semibold text-[#64748B] whitespace-nowrap">{entry.date}</td>
                        <td className="p-3.5 text-center">
                          {entry.flagged ? (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-900 border border-amber-300" title={entry.flagComment || 'Flagged'}>
                              Yes{entry.flagComment ? ` (${entry.flagComment})` : ''}
                            </span>
                          ) : (
                            <span className="text-slate-400">No</span>
                          )}
                        </td>
                        <td className="p-3.5 text-center">
                          <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${
                            entry.status === 'Completed'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : entry.status === 'In Progress'
                                ? 'bg-blue-100 text-blue-800 border-blue-300'
                                : 'bg-slate-100 text-slate-700 border-slate-300'
                          }`}>
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
          isManagementDashboard ? (
            <ManagementCompletedHistory
              completedTasks={completedTasks}
              projects={projects}
              employees={employees}
              dailyEntries={dailyEntries}
              projectFilter={completedProjectFilter}
              employeeFilter={completedEmployeeFilter}
              timeFilter={completedTimeFilter}
              timeDate={completedTimeDate}
              onProjectFilterChange={setCompletedProjectFilter}
              onEmployeeFilterChange={setCompletedEmployeeFilter}
              onTimeFilterChange={setCompletedTimeFilter}
              onTimeDateChange={setCompletedTimeDate}
              onShiftTaskBack={handleRestoreCompletedTask}
              canEditLog={isDirector}
              onUpdateDailyEntry={handleUpdateCompletedLog}
              onDeleteDailyEntry={handleDeleteCompletedLog}
            />
          ) : (
          <div className="bg-white rounded-[14px] border border-[#E2E8F0] p-6 shadow-xs space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-[#E2E8F0] gap-4">
              <div>
                <h3 className="text-lg font-bold text-[#0F172A]">Completed Task History</h3>
                <p className="text-xs text-[#64748B]">Completed tasks and projects — filters: Project, Employee, Time</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={completedProjectFilter}
                  onChange={(e) => setCompletedProjectFilter(e.target.value)}
                  className="px-3 py-1.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs font-semibold text-[#334155]"
                >
                  <option value="all">Project: All</option>
                  {projects.map(p => (
                    <option key={String(p.id || p._id)} value={String(p.id || p._id)}>
                      {p.projectName}
                    </option>
                  ))}
                </select>
                <select
                  value={completedEmployeeFilter}
                  onChange={(e) => setCompletedEmployeeFilter(e.target.value)}
                  className="px-3 py-1.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs font-semibold text-[#334155]"
                >
                  <option value="all">Employee: All</option>
                  {employees.map(e => (
                    <option key={String(e.id || e._id)} value={String(e.id || e._id)}>
                      {e.firstName} {e.lastName}
                    </option>
                  ))}
                </select>
                <select
                  value={completedTimeFilter}
                  onChange={(e) => setCompletedTimeFilter(e.target.value as 'all' | 'date' | 'week' | 'month')}
                  className="px-3 py-1.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs font-semibold text-[#334155]"
                >
                  <option value="all">Time: All</option>
                  <option value="date">Date wise</option>
                  <option value="week">Week wise</option>
                  <option value="month">Month wise</option>
                </select>
                {completedTimeFilter !== 'all' && (
                  <input
                    type="date"
                    value={completedTimeDate}
                    onChange={(e) => setCompletedTimeDate(e.target.value)}
                    className="px-3 py-1.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs font-semibold text-[#334155]"
                  />
                )}
                <button
                  onClick={() => setActiveTab('overview')}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg border border-[#2563EB] bg-blue-50 text-[#2563EB] cursor-pointer hover:bg-blue-100"
                >
                  Shift to Dashboard
                </button>
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
                    <div key={t.id || t._id} className="border border-[#BBF7D0] rounded-xl p-4 bg-[#F0FDF4]/50 flex flex-col space-y-2">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#BBF7D0]/60 pb-2">
                        <div>
                          <h4 className="font-bold text-[#0F172A] text-sm">{t.title}</h4>
                          <p className="text-xs text-[#64748B] mt-0.5">
                            Project: <span className="font-semibold text-[#334155]">{t.projectName}</span> &bull; Staff: <span className="font-semibold text-[#334155]">{t.assignedEmployeeNames?.join(', ')}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2 self-start md:self-auto flex-shrink-0">
                          <span className="px-3 py-1 text-xs font-bold rounded-full bg-[#16A34A] text-white">
                          Completed 100%
                        </span>
                          {(isDirector || isProjectHead) && (
                            <button
                              type="button"
                              onClick={() => void handleRestoreCompletedTask(t)}
                              className="px-3 py-1 text-xs font-bold rounded-lg border border-[#2563EB] bg-blue-50 text-[#2563EB] hover:bg-blue-100 cursor-pointer"
                            >
                              Shift to Dashboard
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs pt-1">
                        <div className="bg-white/80 p-2 rounded border border-[#E2E8F0]">
                          <span className="font-bold text-slate-700 block text-[10px] uppercase">Employee Remark:</span>
                          <span className="text-slate-800">{t.employeeRemark || t.description || 'None'}</span>
                        </div>
                        <div className="bg-white/80 p-2 rounded border border-[#E2E8F0]">
                          <span className="font-bold text-slate-700 block text-[10px] uppercase">Director Remark:</span>
                          <span className="text-slate-800">{t.directorRemark || t.approvalRemarks || 'None'}</span>
                        </div>
                        <div className="bg-white/80 p-2 rounded border border-[#E2E8F0]">
                          <span className="font-bold text-slate-700 block text-[10px] uppercase">Project Head Remark:</span>
                          <span className="text-slate-800">{t.projectHeadRemark || 'None'}</span>
                        </div>
                        <div className="bg-white/80 p-2 rounded border border-[#E2E8F0]">
                          <span className="font-bold text-slate-700 block text-[10px] uppercase">Status:</span>
                          <span className="font-bold text-emerald-700">{t.status}</span>
                        </div>
                      </div>
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
          )
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
                      <th className="p-3.5 text-right">Action</th>
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
                          <td className="p-3.5 text-right">
                            {['Closed', 'Completed'].includes(rem.status) ? (
                              <span className="text-[11px] font-bold text-emerald-700">Closed</span>
                            ) : (
                              <button
                                onClick={() => handleCloseReminder(remId)}
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-lg border border-emerald-200 transition cursor-pointer"
                              >
                                Mark Closed
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
                            <div className="flex items-center gap-2 mb-1">
                              <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded bg-blue-100 text-blue-800 border border-blue-200">
                                {flag.projectName || 'Project'}
                              </span>
                              <h4 className="font-bold text-[#0F172A] text-sm">{flag.taskTitle}</h4>
                            </div>
                            <p className="text-xs text-[#64748B]">
                              Raised by <span className="font-semibold text-[#334155]">{flag.createdByName || flag.employeeName}</span>
                              {flag.concernedPersonName ? <> → <span className="font-semibold text-[#334155]">{flag.concernedPersonName}</span></> : null}
                              {' '}on {flag.flagDate}
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

        {/* TAB: PERFORMANCE */}
        {activeTab === 'performance' && isDirector && (
          <div className="rounded-[14px] border border-[#E2E8F0] bg-white p-5 shadow-xs md:p-6">
            <DirectorPerformanceReview
              employees={employees}
              performanceData={performanceData}
              tasks={tasks}
            />
          </div>
        )}
        {activeTab === 'performance' && !isDirector && (
          <div className={`space-y-5 ${isProjectHead ? '' : 'rounded-[14px] border border-[#E2E8F0] bg-white p-5 shadow-xs md:p-6'}`}>
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <h3 className="text-xl font-bold text-[#0F172A]">Performance</h3>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm font-medium text-[#334155]">
                  <span>{isProjectHead ? 'Time:' : 'View:'}</span>
                  <select
                    value={perfView}
                    onChange={event => setPerfView(event.target.value as 'week' | 'month' | 'year')}
                    className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#2563EB]"
                  >
                    <option value="week">Week</option>
                    <option value="month">Month</option>
                    <option value="year">Year</option>
                  </select>
                </label>
                {perfView === 'week' ? (
                  <label className="flex items-center gap-2 text-sm font-medium text-[#334155]">
                    <span>Week starting:</span>
                    <input
                      type="date"
                      value={performanceWeekStart}
                      onChange={event => {
                        if (!event.target.value) return;
                        const weekStart = getWeekStartDate(event.target.value);
                        if (!weekStart) return;
                        setPerformanceWeekStart(weekStart);
                        setWeeklyRatingDrafts({});
                      }}
                      aria-label="Select a week, starting Monday"
                      className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#2563EB]"
                    />
                  </label>
                ) : perfView === 'month' ? (
                  <label className="flex items-center gap-2 text-sm font-medium text-[#334155]">
                    <span>Month:</span>
                    <input
                      type="month"
                      value={performanceMonthSelection}
                      onChange={event => setPerformanceMonthSelection(event.target.value)}
                      aria-label="Select performance month"
                      className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#2563EB]"
                    />
                  </label>
                ) : (
                  <label className="flex items-center gap-2 text-sm font-medium text-[#334155]">
                    <span>Year:</span>
                    <input
                      type="number"
                      min="2000"
                      max="2100"
                      value={performanceYearSelection}
                      onChange={event => setPerformanceYearSelection(event.target.value)}
                      aria-label="Select performance year"
                      className="w-24 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#2563EB]"
                    />
                  </label>
                )}
                {isProjectHead && (
                  <label className="flex items-center gap-2 text-sm font-medium text-[#334155]">
                    <span>Employee:</span>
                    <select
                      value={perfEmployeeFilter}
                      onChange={event => setPerfEmployeeFilter(event.target.value)}
                      aria-label="Filter performance by employee"
                      className="rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#2563EB]"
                    >
                      <option value="all">All</option>
                      {employees.filter(employee => employee.status === 'Active' || !employee.status).map(employee => (
                        <option key={String(employee.id || employee._id)} value={String(employee.id || employee._id)}>
                          {employee.firstName} {employee.lastName}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-[#E2E8F0]">
              <table className={`w-full ${isProjectHead ? 'min-w-[760px]' : 'min-w-[900px]'} table-fixed border-collapse text-left`}>
                <colgroup>
                  {isProjectHead ? (
                    <>
                      <col className="w-[22%]" />
                      <col className="w-[36%]" />
                      <col className="w-[14%]" />
                      <col className="w-[12%]" />
                      <col className="w-[16%]" />
                    </>
                  ) : (
                    <>
                      <col className="w-[15%]" />
                      <col className="w-[13%]" />
                      <col className="w-[10%]" />
                      <col className="w-[10%]" />
                      <col className="w-[17%]" />
                      <col className="w-[12%]" />
                      <col className="w-[12%]" />
                      {isDirector && <col className="w-[11%]" />}
                    </>
                  )}
                </colgroup>
                <thead>
                  <tr className="bg-[#1E293B] text-xs font-semibold text-white">
                    <th className="whitespace-nowrap border-r border-slate-500 px-3 py-3">Employee</th>
                    <th className="whitespace-nowrap border-r border-slate-500 px-3 py-3">Tasks done</th>
                    <th className="whitespace-nowrap border-r border-slate-500 px-3 py-3">Work hours</th>
                    <th className="whitespace-nowrap border-r border-slate-500 px-3 py-3">Free hours</th>
                    {!isProjectHead && <th className="whitespace-nowrap border-r border-slate-500 px-3 py-3">Employee submissions &amp; comments</th>}
                    {!isProjectHead && <th className="whitespace-nowrap border-r border-slate-500 px-2 py-3">Self marks (/10)</th>}
                    {isDirector && (
                      <th className="whitespace-nowrap border-r border-slate-500 px-2 py-3">Co-ordinator marks (/10)</th>
                    )}
                    <th className="whitespace-nowrap px-2 py-3">{isDirector ? 'Director marks (/10)' : 'Co-ordinator marks (/10)'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] text-sm">
                  {performanceRows.length === 0 ? (
                    <tr>
                      <td colSpan={isProjectHead ? 5 : isDirector ? 8 : 7} className="px-4 py-10 text-center text-sm text-[#64748B]">
                        No performance data available for this period.
                      </td>
                    </tr>
                  ) : performanceRows.map(employee => {
                    const metrics = employee.custom;
                    const weeklyMark = getWeeklyMark(String(employee.employeeId));
                    const employeeSubmissions = performanceSubmissions.filter(
                      entry => String(entry.employeeId) === String(employee.employeeId)
                    );
                    const employeeId = String(employee.employeeId);
                    const taskCount = metrics?.taskCount ?? metrics?.workDone ?? 0;
                    const workHours = metrics?.workHours ?? 0;
                    const freeHours = metrics?.freeHours ?? 0;
                    const submittedTaskNames = Array.from(new Set(
                      employeeSubmissions.map(entry => entry.taskTitle?.trim()).filter((title): title is string => Boolean(title))
                    ));
                    const currentMark = isDirector ? weeklyMark?.rating : weeklyMark?.coordinatorRating;
                    const currentComment = isDirector ? weeklyMark?.comment : weeklyMark?.coordinatorComment;
                    return (
                      <React.Fragment key={employeeId}>
                      <tr className="text-[#334155] hover:bg-[#F8FAFC]">
                        <td className="border-r border-[#E2E8F0] px-3 py-4 font-semibold text-[#0F172A]">{employee.employeeName || 'Employee'}</td>
                        <td className="border-r border-[#E2E8F0] px-3 py-4">
                          <details className="text-sm">
                            <summary className={`cursor-pointer font-semibold ${isProjectHead ? 'text-red-600' : 'text-[#1D4ED8]'}`}>{taskCount} ▾</summary>
                            {submittedTaskNames.length > 0 ? (
                              <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-[#475569]">
                                {submittedTaskNames.map(title => <li key={title}>{title}</li>)}
                              </ul>
                            ) : (
                              <p className="mt-2 text-xs text-[#64748B]">No task names logged for this period.</p>
                            )}
                          </details>
                        </td>
                        <td className="border-r border-[#E2E8F0] px-3 py-4">{formatHoursMinutes(workHours)}</td>
                        <td className="border-r border-[#E2E8F0] px-3 py-4">{formatHoursMinutes(freeHours)}</td>
                        {!isProjectHead && <td className="border-r border-[#E2E8F0] px-3 py-4">
                          <button
                            type="button"
                            onClick={() => setExpandedPerformanceEmployeeId(
                              expandedPerformanceEmployeeId === employeeId ? null : employeeId
                            )}
                            aria-expanded={expandedPerformanceEmployeeId === employeeId}
                            className="rounded-full bg-[#EFF6FF] px-3 py-1.5 text-xs font-semibold text-[#1D4ED8] hover:bg-[#DBEAFE]"
                          >
                            {expandedPerformanceEmployeeId === employeeId ? 'Hide' : 'View'} {employeeSubmissions.length} {employeeSubmissions.length === 1 ? 'submission' : 'submissions'}
                          </button>
                        </td>}
                        {!isProjectHead && <td className="border-r border-[#E2E8F0] px-2 py-3 text-xs">
                          {weeklyMark?.selfRating ? (
                            <div>
                              <span className="font-bold text-[#0F172A]">{weeklyMark.selfRating}/10</span>
                              {weeklyMark.selfComment && <p className="mt-1 text-[11px] text-[#64748B]">{weeklyMark.selfComment}</p>}
                            </div>
                          ) : '—'}
                        </td>}
                        {isDirector && (
                          <td className="border-r border-[#E2E8F0] px-2 py-3 text-xs">
                            {weeklyMark?.coordinatorRating ? (
                              <div>
                                <span className="font-bold text-[#0F172A]">{weeklyMark.coordinatorRating}/10</span>
                                {weeklyMark.coordinatorComment && <p className="mt-1 text-[11px] text-[#64748B]">{weeklyMark.coordinatorComment}</p>}
                              </div>
                            ) : '—'}
                          </td>
                        )}
                        <td className="px-2 py-3 text-xs">
                          {perfView !== 'week' ? (
                            <span className="text-[#64748B]">Switch to Week view to rate</span>
                          ) : typeof currentMark === 'number' ? (
                            <div>
                              <span className={`font-bold ${isProjectHead ? 'text-red-600' : 'text-[#0F172A]'}`}>{currentMark}/10</span>
                              {currentComment && <p className="mt-1 text-[11px] text-[#64748B]">{currentComment}</p>}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <label className="block text-[10px] font-semibold text-[#64748B]">
                                {isDirector ? 'Director rating (1–10)' : 'Co-ordinator rating (1–10)'}
                                <select
                                  value={weeklyRatingDrafts[employeeId]?.rating || ''}
                                  onChange={event => setWeeklyRatingDrafts(previous => ({
                                    ...previous,
                                    [employeeId]: {
                                      rating: event.target.value,
                                      comment: previous[employeeId]?.comment || ''
                                    }
                                  }))}
                                  disabled={loadedPerformanceMarksKey !== `${perfProjectFilter}:${performanceWeekStart}` || savingPerformanceMark}
                                  className={`mt-1 block w-full rounded-lg border bg-white px-2 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:bg-[#F1F5F9] ${isProjectHead ? 'border-red-400 text-red-600 focus:border-red-500' : 'border-[#CBD5E1] text-[#0F172A] focus:border-[#2563EB]'}`}
                                >
                                  <option value="">Select rating</option>
                                  {Array.from({ length: 10 }, (_, index) => index + 1).map(rating => (
                                    <option key={rating} value={rating}>{rating} / 10</option>
                                  ))}
                                </select>
                              </label>
                              <input
                                type="text"
                                value={weeklyRatingDrafts[employeeId]?.comment || ''}
                                onChange={event => setWeeklyRatingDrafts(previous => ({
                                  ...previous,
                                  [employeeId]: {
                                    rating: previous[employeeId]?.rating || '',
                                    comment: event.target.value
                                  }
                                }))}
                                disabled={loadedPerformanceMarksKey !== `${perfProjectFilter}:${performanceWeekStart}` || savingPerformanceMark}
                                placeholder="Comment (optional)"
                                aria-label={`Optional weekly comment for ${employee.employeeName || 'employee'}`}
                                className={`block w-full rounded-lg border bg-white px-2 py-1.5 text-xs outline-none disabled:cursor-not-allowed disabled:bg-[#F1F5F9] ${isProjectHead ? 'border-red-400 text-red-600 focus:border-red-500' : 'border-[#CBD5E1] text-[#0F172A] focus:border-[#2563EB]'}`}
                              />
                            </div>
                          )}
                        </td>
                      </tr>
                      {expandedPerformanceEmployeeId === employeeId && (
                        <tr className="bg-[#F8FAFC]">
                          <td colSpan={isProjectHead ? 5 : isDirector ? 8 : 7} className="border-t border-[#E2E8F0] px-4 py-4">
                            {employeeSubmissions.length === 0 ? (
                              <p className="text-sm text-[#64748B]">No employee submissions for this period and project.</p>
                            ) : (
                              <div className="max-h-80 space-y-3 overflow-y-auto">
                                {employeeSubmissions.map((entry, index) => (
                                  <article
                                    key={String(entry.id || entry._id || `${entry.date}-${entry.taskId}-${index}`)}
                                    className="rounded-lg border border-[#E2E8F0] bg-white p-3"
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <h4 className="font-semibold text-[#0F172A]">{entry.taskTitle || 'Submitted work'}</h4>
                                      <span className="text-xs text-[#64748B]">
                                        {entry.date} · {formatHoursMinutes(entry.hours)} hrs · {entry.status}
                                      </span>
                                    </div>
                                    <p className="mt-2 text-xs text-[#64748B]">
                                      {entry.projectName || projects.find(project =>
                                        String(project.id || project._id) === String(entry.projectId)
                                      )?.projectName || 'Project'}
                                    </p>
                                    {entry.details && (
                                      <p className="mt-2 whitespace-pre-wrap text-sm text-[#334155]">
                                        <span className="font-semibold">Description: </span>{entry.details}
                                      </p>
                                    )}
                                    {entry.actionTaken && (
                                      <p className="mt-2 whitespace-pre-wrap text-sm text-[#334155]">
                                        <span className="font-semibold">Employee comment / action: </span>{entry.actionTaken}
                                      </p>
                                    )}
                                    {entry.flagComment && (
                                      <p className="mt-2 whitespace-pre-wrap rounded-md bg-amber-50 p-2 text-sm text-amber-800">
                                        <span className="font-semibold">Flag comment: </span>{entry.flagComment}
                                      </p>
                                    )}
                                  </article>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {(isDirector || isProjectHead) && perfView === 'week' && (
              <button
                type="button"
                onClick={() => void handleSubmitWeeklyMarks()}
                disabled={
                  performanceRows.length === 0 ||
                  loadedPerformanceMarksKey !== `${perfProjectFilter}:${performanceWeekStart}` ||
                  savingPerformanceMark ||
                  !performanceRows.some(employee =>
                    Boolean(weeklyRatingDrafts[String(employee.employeeId)]?.rating) &&
                    (isDirector
                      ? typeof getWeeklyMark(String(employee.employeeId))?.rating !== 'number'
                      : typeof getWeeklyMark(String(employee.employeeId))?.coordinatorRating !== 'number')
                  )
                }
                className="rounded-lg bg-[#2563EB] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingPerformanceMark ? 'Submitting...' : 'Submit Saturday Marks'}
              </button>
            )}

            {isDirector && (
              <p className="text-xs text-[#64748B]">
                Employees and Project Co-ordinators submit self-marks first. Review their marks and submit the Director mark for the selected week.
              </p>
            )}
          </div>
        )}

        {/* TAB 9: PROFILE */}
        {activeTab === 'profile' && (
          <DirectorProfile />
        )}

        {isDirectorTaskAllotmentView && (
          <section id="dashboard-task-directory" className="space-y-4" aria-labelledby="task-allotment-title">
            <h2 id="task-allotment-title" className="text-xl font-bold text-[#0F172A]">
              Ongoing tasks of all employees and Project Head
            </h2>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <div className="relative">
                <select
                  aria-label="Filter tasks by time period"
                  value={taskTimeFilter}
                  onChange={event => {
                    const mode = event.target.value as 'all' | 'date' | 'week' | 'month';
                    setTaskTimeFilter(mode);
                    if (mode !== 'all' && !taskTimeDate) setTaskTimeDate(todayDateStr);
                  }}
                  className="min-h-[38px] w-full appearance-none rounded-md border border-[#CBD5E1] bg-white px-2.5 py-2 pr-8 text-xs font-medium text-[#334155]"
                >
                  <option value="all">Time: All</option>
                  <option value="date">Time: Date wise</option>
                  <option value="week">Time: Week wise</option>
                  <option value="month">Time: Month wise</option>
                </select>
                <ChevronDown aria-hidden="true" size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#475569]" />
              </div>
              <div className="relative">
                <select
                  aria-label="Filter tasks by priority"
                  value={taskPriorityFilter}
                  onChange={event => setTaskPriorityFilter(event.target.value)}
                  className="min-h-[38px] w-full appearance-none rounded-md border border-[#CBD5E1] bg-white px-2.5 py-2 pr-8 text-xs font-medium text-[#334155]"
                >
                  <option value="all">Priority: All</option>
                  <option value="Urgent">Priority: Urgent</option>
                  <option value="Medium">Priority: Less Urgent</option>
                  <option value="Daily">Priority: Daily Task</option>
                  <option value="Self">Priority: Self-define</option>
                  <option value="Low">Priority: Low Urgent</option>
                </select>
                <ChevronDown aria-hidden="true" size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#475569]" />
              </div>
              <div className="relative">
                <select
                  aria-label="Filter tasks by employee"
                  value={taskEmployeeFilter}
                  onChange={event => setTaskEmployeeFilter(event.target.value)}
                  className="min-h-[38px] w-full appearance-none rounded-md border border-[#CBD5E1] bg-white px-2.5 py-2 pr-8 text-xs font-medium text-[#334155]"
                >
                  <option value="all">Employee: All</option>
                  <option value="coordinator">Employee: Project Co-ordinator</option>
                  {employees.filter(employee => employee.status === 'Active' || !employee.status).map(employee => (
                    <option key={String(employee.id || employee._id)} value={String(employee.id || employee._id)}>
                      Employee: {employee.firstName} {employee.lastName}
                    </option>
                  ))}
                </select>
                <ChevronDown aria-hidden="true" size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#475569]" />
              </div>
              <div className="relative">
                <select
                  aria-label="Filter tasks by project"
                  value={taskProjectFilter}
                  onChange={event => setTaskProjectFilter(event.target.value)}
                  className="min-h-[38px] w-full appearance-none rounded-md border border-[#CBD5E1] bg-white px-2.5 py-2 pr-8 text-xs font-medium text-[#334155]"
                >
                  <option value="all">Project: All</option>
                  {projects.map(project => (
                    <option key={String(project.id || project._id)} value={String(project.id || project._id)}>
                      Project: {project.projectName}
                    </option>
                  ))}
                </select>
                <ChevronDown aria-hidden="true" size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#475569]" />
              </div>
            </div>
            {taskTimeFilter !== 'all' && (
              <input
                type="date"
                aria-label={`Choose ${taskTimeFilter}`}
                value={taskTimeDate}
                onChange={event => setTaskTimeDate(event.target.value)}
                className="min-h-[36px] rounded-md border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-xs text-[#334155]"
              />
            )}

            <div className="overflow-x-auto border border-[#E2E8F0] bg-white">
              <table className="w-full min-w-[760px] table-fixed border-collapse text-left text-xs">
                <colgroup>
                  <col className="w-[4%]" />
                  <col className="w-[4.5%]" />
                  <col className="w-[38%]" />
                  <col className="w-[53.5%]" />
                </colgroup>
                <thead>
                  <tr className="h-10 border-b border-[#CBD5E1] bg-[#334155] text-[13px] font-bold text-white">
                    <th className="border-r border-white/20 px-2" aria-label="Select task" />
                    <th className="border-r border-white/20 px-2 text-center" aria-label="Flag status">
                      <FlagIcon size={13} className="mx-auto" />
                    </th>
                    <th className="border-r border-white/20 px-2.5">Task name and details</th>
                    <th className="px-2.5">Latest 5 comments</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedFilteredTasks.flatMap(group => {
                    const groupIds = new Set(group.items.map(taskKey));
                    const roots = group.items.filter(task =>
                      !task.parentTaskId || !groupIds.has(String(task.parentTaskId))
                    );
                    return roots.map(rootTask => {
                      const rootId = taskKey(rootTask);
                      const subtasks = group.items.filter(task => String(task.parentTaskId || '') === rootId);
                      const relatedTasks = [rootTask, ...subtasks];
                      const isSelected = selectedTaskIds.includes(rootId);
                      const isFlagged = relatedTasks.some(task =>
                        task.flagStatus === 'Open' || flags.some(flag =>
                          String(flag.taskId) === taskKey(task) && flag.status === 'Open'
                        )
                      );
                      const latestComments = relatedTasks
                        .flatMap(task => (task.comments || []).map(comment => ({
                          ...comment,
                          sourceTaskTitle: task.title
                        })))
                        .sort((first, second) =>
                          new Date(first.timestamp || 0).getTime() - new Date(second.timestamp || 0).getTime()
                        )
                        .slice(-5)
                        .reverse();

                      return (
                        <tr key={rootId} className="border-b border-[#E2E8F0] even:bg-[#F7F9FC]">
                          <td className="border-r border-[#E2E8F0] px-2 text-center align-middle">
                            {relatedTasks.some(task => task.status !== 'Completed') && (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={event => setSelectedTaskIds(previous =>
                                  event.target.checked
                                    ? Array.from(new Set([...previous, rootId]))
                                    : previous.filter(id => id !== rootId)
                                )}
                                className="cursor-pointer accent-[#2563EB]"
                                aria-label={`Select ${rootTask.title}`}
                              />
                            )}
                          </td>
                          <td className="border-r border-[#E2E8F0] px-2 text-center align-top">
                            <button
                              type="button"
                              onClick={() => {
                                const flaggedTask = relatedTasks.find(task =>
                                  flags.some(flag => String(flag.taskId) === taskKey(task) && flag.status === 'Open')
                                ) || rootTask;
                                setManagementFlagTask(flaggedTask);
                                setManagementFlagTaskIds([taskKey(flaggedTask)]);
                                setManagementFlagType('Progress Concern');
                                setManagementFlagMessage(flags.find(flag =>
                                  String(flag.taskId) === taskKey(flaggedTask) && flag.status === 'Open'
                                )?.flagMessage || flaggedTask.flagMessage || '');
                              }}
                              title={isFlagged ? 'Open intervention flag' : 'Raise an intervention flag'}
                              aria-label={`${isFlagged ? 'View or update' : 'Raise'} flag for ${rootTask.title}`}
                              className={`mt-1 rounded px-1.5 py-1 ${isFlagged ? 'text-red-600' : 'text-slate-400 hover:text-red-600'}`}
                            >
                              <FlagIcon size={14} fill={isFlagged ? 'currentColor' : 'none'} />
                            </button>
                          </td>
                          <td className="border-r border-[#E2E8F0] px-2.5 py-2 align-top text-[#172554]">
                            <p className="font-bold leading-tight">
                              {rootTask.projectName || group.projectName}/{rootTask.title}
                            </p>
                            {subtasks.map(subtask => (
                              <p key={taskKey(subtask)} className="mt-0.5 break-words text-[11px] leading-tight text-[#334155]">
                                {rootTask.projectName || group.projectName}/{rootTask.title}/{subtask.title}
                              </p>
                            ))}
                            <p className="mt-0.5 whitespace-pre-wrap text-[11px] italic leading-tight text-[#64748B]">
                              {rootTask.description || '-'}
                            </p>
                          </td>
                          <td className="px-2.5 py-2 align-top text-[#0F172A]">
                            {latestComments.length > 0 ? (
                              <ol className="space-y-0.5">
                                {latestComments.map((comment, index) => (
                                  <li key={`${comment.id || index}-${comment.timestamp}`} className="break-words leading-tight">
                                    {comment.content}
                                    {comment.timestamp ? ` (${new Date(comment.timestamp).toLocaleString('en-GB', {
                                      day: '2-digit',
                                      month: 'short',
                                      hour: 'numeric',
                                      minute: '2-digit',
                                      hour12: true
                                    })})` : ''}
                                    {comment.userName ? ` (${comment.userName})` : ''}
                                  </li>
                                ))}
                              </ol>
                            ) : (
                              <span className="text-[11px] italic text-[#94A3B8]">No comments yet.</span>
                            )}
                          </td>
                        </tr>
                      );
                    });
                  })}
                  {groupedFilteredTasks.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-sm text-[#64748B]">
                        {loading ? 'Loading tasks…' : 'No tasks match these filters.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={selectedTaskIds.length !== 1}
                onClick={() => {
                  const selectedTask = tasks.find(task => taskKey(task) === selectedTaskIds[0]);
                  if (!selectedTask) return;
                  setSelectedTask(selectedTask);
                  setIsTaskModalOpen(true);
                }}
                className="min-h-[38px] min-w-[217px] rounded-lg bg-[#2563EB] px-5 py-2 text-sm font-bold text-white hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Edit Task &gt;
              </button>
              <button
                type="button"
                onClick={() => openCreateTask()}
                className="min-h-[38px] min-w-[198px] rounded-lg bg-[#6366F1] px-5 py-2 text-sm font-bold text-white hover:bg-[#4F46E5]"
              >
                New Task +
              </button>
              <button
                type="button"
                onClick={() => void removeSelectedTasks()}
                disabled={selectedTaskIds.length === 0}
                className="min-h-[38px] min-w-[198px] rounded-lg bg-[#DC2626] px-5 py-2 text-sm font-bold text-white hover:bg-[#B91C1C] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Delete Selected Tasks
              </button>
            </div>

          </section>
        )}

        {/* DASHBOARD TASK DIRECTORY (also on overview) */}
        {(activeTab === 'overview' || activeTab === 'tasks') && !isDirectorTaskAllotmentView && !(isManagementDashboard && activeTab === 'overview') && (
          <div
            id="dashboard-task-directory"
            className={`order-1 space-y-4 ${isManagementDashboard ? '' : 'rounded-[14px] border border-[#E2E8F0] bg-white p-4 shadow-xs md:p-6'}`}
          >
            {isManagementDashboard && (
              <h2 className="text-xl font-bold text-[#0F172A]">
                {isDirector ? 'Ongoing tasks of all employees and Project Head' : 'Ongoing tasks of employees under me'}
              </h2>
            )}
            {!isManagementDashboard && (
              <div className="border-b border-[#E2E8F0] pb-3">
                <h3 className="text-lg font-bold text-[#0F172A]">Dash Board — tasks and flags</h3>
                <p className="mt-1 text-xs text-[#64748B]">
                  Filter tasks by category, project, employee and date range.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div ref={priorityMenuRef} className={`relative ${isProjectHead ? 'lg:order-2' : ''}`}>
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={isPriorityMenuOpen}
                  onClick={() => setIsPriorityMenuOpen(open => !open)}
                  className={`flex min-h-10 w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-extrabold text-slate-950 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#2563EB] ${
                    isProjectHead
                      ? 'border border-[#CBD5E1] bg-white text-[#334155] hover:bg-slate-50'
                      : isManagementDashboard
                      ? 'bg-[#DC2626] hover:bg-[#B91C1C]'
                      : taskPriorityFilter !== 'all'
                        ? 'border border-[#2563EB] bg-blue-50 text-[#1D4ED8]'
                        : 'border border-[#CBD5E1] bg-white text-[#334155] hover:bg-slate-50'
                  }`}
                >
                  Priority: {taskPriorityFilter !== 'all' ? `${
                    taskPriorityFilter === 'Medium' ? 'Less Urgent' :
                    taskPriorityFilter === 'Self' ? 'Self-define' :
                    taskPriorityFilter === 'Daily' ? 'Daily Task' :
                    taskPriorityFilter === 'Low' ? 'Low Urgent' : taskPriorityFilter
                  }` : 'All'}
                  <ChevronDown size={14} aria-hidden="true" />
                </button>
                {isPriorityMenuOpen && (
                  <div
                    role="menu"
                    aria-label="Filter tasks by priority"
                    className="absolute left-0 top-full z-40 mt-1 w-full min-w-48 overflow-hidden rounded-lg border border-[#E2E8F0] bg-white py-1 shadow-lg"
                  >
                    {[
                      { value: 'all', label: 'All' },
                      { value: 'Urgent', label: 'Urgent' },
                      { value: 'Medium', label: 'Less Urgent' },
                      { value: 'Daily', label: 'Daily Task' },
                      { value: 'Self', label: 'Self-define' },
                      { value: 'Low', label: 'Low Urgent' }
                    ].map(option => (
                      <button
                        key={option.value}
                        type="button"
                        role="menuitemradio"
                        aria-checked={taskPriorityFilter === option.value}
                        onClick={() => {
                          setTaskPriorityFilter(option.value);
                          setIsPriorityMenuOpen(false);
                        }}
                        className={`block w-full px-3 py-2 text-left text-xs transition ${
                          taskPriorityFilter === option.value
                            ? 'bg-blue-50 font-bold text-[#1D4ED8]'
                            : 'text-[#334155] hover:bg-slate-50'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                    {isDirector && (
                      <>
                        <div className="my-1 border-t border-[#E2E8F0]" />
                        <button
                          type="button"
                          role="menuitem"
                          disabled={selectedTaskIds.length === 0}
                          onClick={() => {
                            const selectedTasks = selectedTaskIds
                              .map(id => tasks.find(task => taskKey(task) === id))
                              .filter((task): task is Task => Boolean(task));
                            if (selectedTasks.length === 0) {
                              showToast('error', 'Select one or more tasks to flag.');
                              setIsPriorityMenuOpen(false);
                              return;
                            }
                            setManagementFlagTask(selectedTasks[0]);
                            setManagementFlagTaskIds(selectedTasks.map(taskKey));
                            setManagementFlagType('Progress Concern');
                            setManagementFlagMessage('');
                            setIsPriorityMenuOpen(false);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-bold text-orange-800 transition hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <FlagIcon size={14} />
                          Flag selected tasks ({selectedTaskIds.length})
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className={`relative ${isProjectHead ? 'lg:order-4' : ''}`}>
                <select
                  aria-label="Filter tasks by project"
                  value={taskProjectFilter}
                  onChange={(e) => setTaskProjectFilter(e.target.value)}
                  className={`min-h-10 w-full appearance-none rounded-lg px-3 py-2 pr-9 text-xs font-extrabold text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#2563EB] ${
                    isProjectHead
                      ? 'border border-[#CBD5E1] bg-white text-[#334155]'
                      : isManagementDashboard ? 'bg-[#F59E0B] hover:bg-[#D97706]' : 'border border-[#CBD5E1] bg-white text-[#334155]'
                  }`}
                >
                  <option value="all">Project: All</option>
                  {projects.map(p => (
                    <option key={String(p.id || p._id)} value={String(p.id || p._id)}>
                      {p.projectName}
                    </option>
                  ))}
                </select>
                <ChevronDown aria-hidden="true" size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-950" />
              </div>

              <div className={`relative ${isProjectHead ? 'lg:order-3' : ''}`}>
                <select
                  aria-label="Filter tasks by employee"
                  value={taskEmployeeFilter}
                  onChange={(e) => setTaskEmployeeFilter(e.target.value)}
                  className={`min-h-10 w-full appearance-none rounded-lg px-3 py-2 pr-9 text-xs font-extrabold text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#2563EB] ${
                    isProjectHead
                      ? 'border border-[#CBD5E1] bg-white text-[#334155]'
                      : isManagementDashboard ? 'bg-[#3B82F6] hover:bg-[#2563EB]' : 'border border-[#CBD5E1] bg-white text-[#334155]'
                  }`}
                >
                  <option value="all">Employee: All</option>
                  <option value="coordinator">Project Co-ordinator</option>
                  {employees.filter(e => e.status === 'Active' || !e.status).map(e => (
                    <option key={String(e.id || e._id)} value={String(e.id || e._id)}>
                      {e.role === 'Project Head'
                        ? `${e.firstName} ${e.lastName} (Project Co-ordinator)`
                        : `${e.firstName} ${e.lastName}`}
                    </option>
                  ))}
                </select>
                <ChevronDown aria-hidden="true" size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-950" />
              </div>

              <div className={`grid gap-2 ${taskTimeFilter === 'all' ? 'grid-cols-1' : 'grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]'} ${isProjectHead ? 'lg:order-1' : ''}`}>
                <div className="relative min-w-0">
                  <select
                    aria-label="Filter tasks by time period"
                    value={taskTimeFilter}
                    onChange={(e) => {
                      const mode = e.target.value as 'all' | 'date' | 'week' | 'month';
                      setTaskTimeFilter(mode);
                      if (mode !== 'all' && !taskTimeDate) setTaskTimeDate(todayDateStr);
                    }}
                    className={`min-h-10 min-w-0 w-full appearance-none rounded-lg px-3 py-2 pr-9 text-xs font-extrabold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#2563EB] ${
                      isProjectHead
                        ? 'border border-[#CBD5E1] bg-white font-semibold text-[#334155]'
                        : isManagementDashboard ? 'bg-[#6366F1] text-slate-950' : 'border border-[#CBD5E1] bg-white font-semibold text-[#334155]'
                    }`}
                  >
                    <option value="all">Time: All</option>
                    <option value="date">Date wise</option>
                    <option value="week">Week wise</option>
                    <option value="month">Month wise</option>
                  </select>
                  <ChevronDown aria-hidden="true" size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-950" />
                </div>
                {taskTimeFilter !== 'all' && (
                  <input
                    type="date"
                    aria-label={`Choose ${taskTimeFilter}`}
                    value={taskTimeDate}
                    onChange={(e) => setTaskTimeDate(e.target.value)}
                    className="min-h-10 min-w-0 rounded-lg border border-[#CBD5E1] bg-white px-2 py-2 text-xs font-semibold text-[#334155]"
                  />
                )}
              </div>
            </div>

            {!isManagementDashboard && (
            <div className="flex flex-col gap-2 border-b border-[#E2E8F0] pb-4 sm:flex-row sm:flex-wrap sm:items-center">
              <input
                type="text"
                placeholder="Search task or project..."
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                className="min-h-10 w-full rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-xs focus:outline-none focus:border-[#2563EB] sm:w-56"
              />
              <select
                aria-label="Filter tasks by status"
                value={taskStatusFilter}
                onChange={(e) => setTaskStatusFilter(e.target.value)}
                className="min-h-10 rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-xs font-semibold text-[#334155]"
              >
                <option value="all">All Statuses</option>
                <option value="current">Current (Pending + In Progress)</option>
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Pending Approval">Pending Approval</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
            )}

            <div className={`overflow-x-auto ${isManagementDashboard ? (isProjectHead ? 'pt-4' : 'pt-8') : ''}`}>
              <table className={`w-full border-collapse text-left text-xs ${isManagementDashboard ? (isProjectHead ? 'min-w-[760px] table-fixed' : 'min-w-[1120px] table-fixed') : ''}`}>
                {isManagementDashboard && (
                  <colgroup>
                    {isProjectHead && !isManagementPersonalView ? (
                      <>
                        <col className="w-[4%]" />
                        <col className="w-[4.5%]" />
                        <col className="w-[38%]" />
                        <col className="w-[53.5%]" />
                      </>
                    ) : !isManagementPersonalView ? (
                      <>
                        <col className="w-[4%]" />
                        <col className="w-[8%]" />
                        <col className="w-[27%]" />
                        <col className="w-[22%]" />
                        <col className="w-[39%]" />
                      </>
                    ) : isDirector ? (
                      <>
                        <col className="w-[5%]" />
                        <col className="w-[35%]" />
                        <col className={isManagementPersonalView ? 'w-[20%]' : 'w-[25%]'} />
                        <col className={isManagementPersonalView ? 'w-[25%]' : 'w-[20%]'} />
                        <col className="w-[15%]" />
                      </>
                    ) : (
                      <>
                        <col className="w-[4%]" />
                        <col className="w-[27%]" />
                        <col className="w-[17%]" />
                        <col className="w-[14%]" />
                        <col className="w-[11%]" />
                        <col className="w-[10%]" />
                        <col className="w-[9%]" />
                        <col className="w-[8%]" />
                      </>
                    )}
                  </colgroup>
                )}
                <thead>
                  <tr className={`border-b font-bold text-[11px] ${isManagementDashboard ? 'border-[#CBD5E1] bg-[#334155] text-white' : 'border-[#E2E8F0] bg-[#F8FAFC] uppercase text-[#64748B]'}`}>
                    <th className="p-3.5 w-10">
                      {!isProjectHead && <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTaskIds(selectableDirectoryTasks.map(taskKey));
                          } else {
                            setSelectedTaskIds([]);
                          }
                        }}
                        className="accent-[#2563EB] cursor-pointer"
                        aria-label="Select all visible tasks"
                      />}
                    </th>
                    {isProjectHead && !isManagementPersonalView ? (
                      <>
                        <th className="p-3.5">Flag</th>
                        <th className="p-3.5">Task name and details</th>
                        <th className="p-3.5">Latest 5 comments</th>
                      </>
                    ) : isManagementDashboard && !isManagementPersonalView ? (
                      <>
                        <th className="p-3.5">Flag</th>
                        <th className="p-3.5">Project / Task / Subtasks</th>
                        <th className="p-3.5">Description</th>
                        <th className="p-3.5">Latest 5 comments</th>
                      </>
                    ) : (
                      <>
                        <th className="p-3.5">{isManagementDashboard ? 'Task / Subtask' : 'Task Title'}</th>
                        <th className="p-3.5">Project</th>
                        <th className="p-3.5">{isManagementPersonalView ? 'Description' : 'Assigned Staff'}</th>
                      </>
                    )}
                    {!isManagementDashboard && (
                      <>
                        <th className="p-3.5">Priority</th>
                        <th className="p-3.5">Flag</th>
                        <th className="p-3.5">Due</th>
                        <th className="p-3.5">Individual Status</th>
                        <th className="p-3.5">Work %</th>
                        <th className="p-3.5">Status</th>
                        <th className="p-3.5">Reminder</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </>
                    )}
                    {isManagementDashboard && isManagementPersonalView && (
                      isManagementPersonalView ? (
                        <th className="p-3.5">Priority / Status</th>
                      ) : null
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {groupedFilteredTasks.map(group => {
                    const visibleGroupTasks = isProjectHead
                      ? group.items.filter(task =>
                          !task.parentTaskId || !group.items.some(candidate => taskKey(candidate) === String(task.parentTaskId))
                        )
                      : group.items;
                    return (
                    <React.Fragment key={group.projectId}>
                      {visibleGroupTasks.map((t, index) => {
                    const tId = t.id || t._id || '';
                    const projectHeadSubtasks = isProjectHead
                      ? group.items.filter(task => String(task.parentTaskId || '') === String(tId))
                      : [];
                    const projectHeadRelatedTasks = [t, ...projectHeadSubtasks];
                    const projectHeadComments = projectHeadRelatedTasks
                      .flatMap(task => task.comments || [])
                      .sort((first, second) => new Date(first.timestamp || 0).getTime() - new Date(second.timestamp || 0).getTime())
                      .slice(-5);
                    return (
                      <tr key={tId} className={`group transition hover:bg-[#F1F5F9] ${isManagementDashboard ? 'bg-white even:bg-[#F8FAFC]' : ''}`}>
                        <td className="p-3.5">
                          {t.status !== 'Completed' && (
                            <input
                              type="checkbox"
                              checked={selectedTaskIds.includes(tId) || dailyCartIds.includes(tId)}
                              disabled={dailyCartIds.includes(tId)}
                              onChange={(e) => {
                                setSelectedTaskIds(prev =>
                                  e.target.checked ? Array.from(new Set([...prev, tId])) : prev.filter(id => id !== tId)
                                );
                              }}
                              className="accent-[#2563EB] cursor-pointer"
                              aria-label={`Select ${t.title}`}
                            />
                          )}
                        </td>
                        {isManagementDashboard && !isManagementPersonalView && (
                          <td className="p-3.5 align-top">
                            {(() => {
                              const openFlag = flags.find(flag =>
                                String(flag.taskId) === String(tId) && flag.status === 'Open'
                              );
                              const isFlagged = projectHeadRelatedTasks.some(task => task.flagStatus === 'Open' || flags.some(flag =>
                                String(flag.taskId) === taskKey(task) && flag.status === 'Open'
                              ));
                              return (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setManagementFlagTask(t);
                                    setManagementFlagTaskIds([taskKey(t)]);
                                    setManagementFlagType('Progress Concern');
                                    setManagementFlagMessage(openFlag?.flagMessage || t.flagMessage || '');
                                  }}
                                  title={openFlag?.flagMessage || t.flagMessage || (isFlagged ? 'Open intervention flag' : 'Raise an intervention flag')}
                                  className={`${isProjectHead ? 'px-1 py-1 text-red-600' : `inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold ${isFlagged ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600 hover:bg-orange-50 hover:text-orange-700'}`}`}
                                >
                                  <FlagIcon size={isProjectHead ? 14 : 13} fill={isFlagged ? 'currentColor' : 'none'} />
                                  {!isProjectHead && (isFlagged ? 'Flagged' : 'Flag')}
                                </button>
                              );
                            })()}
                          </td>
                        )}
                        <td className={`p-3.5 font-bold text-[#0F172A] ${t.parentTaskId ? 'pl-8' : ''}`}>
                          {isManagementDashboard ? (
                            <div>
                              <button
                                type="button"
                                onClick={() => { setSelectedTask(t); setPersonalTaskMode(false); setIsTaskModalOpen(true); }}
                                className="text-left hover:text-[#2563EB] focus-visible:outline-none focus-visible:underline"
                                aria-label={`Edit ${t.title}`}
                              >
                                {isProjectHead && `${t.projectName || projectHeading(group)}/`}
                                {t.parentTaskId && <span className="mr-1 text-slate-400">↳</span>}
                                {t.title}
                              </button>
                              {isProjectHead && projectHeadSubtasks.map(subtask => (
                                <p key={taskKey(subtask)} className="mt-0.5 break-words text-[11px] font-normal leading-tight text-[#475569]">
                                  {t.projectName || projectHeading(group)}/{t.title}/{subtask.title}
                                </p>
                              ))}
                              {isProjectHead && (
                                <>
                                  <p className="mt-0.5 whitespace-pre-wrap text-[11px] font-normal italic leading-tight text-[#64748B]">{t.description || '-'}</p>
                                  <p className="mt-1 text-[11px] font-bold text-[#2563EB]">
                                    {t.priority === 'Medium' ? 'Less Urgent' : t.priority || 'Daily Task'} | {t.assignedEmployeeNames?.join(', ') || 'Unassigned'} | {t.projectName || projectHeading(group)}
                                  </p>
                                </>
                              )}
                              {!isManagementPersonalView && !isProjectHead && (
                                <p className="mt-1 text-[11px] font-medium text-[#64748B]">{t.projectName || projectHeading(group)}</p>
                              )}
                            </div>
                          ) : (
                            <>
                              {t.parentTaskId && <span className="mr-1 text-slate-400">↳</span>}
                              {t.title}
                            </>
                          )}
                        </td>
                        {index === 0 && !isManagementDashboard && (
                          <td rowSpan={group.items.length} className="p-3.5 font-bold text-[#0F172A] align-top">
                            {projectHeading(group)}
                          </td>
                        )}
                        {(!isProjectHead || isManagementPersonalView) && <td className="p-3.5">
                          {isManagementDashboard ? (
                            <p className="whitespace-pre-wrap font-normal text-[#475569]">{t.description || '-'}</p>
                          ) : (
                          <div className="flex max-w-[180px] items-center gap-2">
                            {!isManagementDashboard && <EmployeeAvatar name={t.assignedEmployeeNames?.[0] || 'Staff'} size="sm" />}
                            <span
                              className="font-semibold text-[#334155] truncate"
                              title={t.assignedEmployeeNames?.join(', ') || '-'}
                            >
                              {t.assignedEmployeeNames?.[0] || '-'}
                              {(t.assignedEmployeeNames?.length || 0) > 1 ? ` +${(t.assignedEmployeeNames?.length || 1) - 1}` : ''}
                            </span>
                          </div>
                          )}
                        </td>}
                        {isManagementDashboard && !isManagementPersonalView ? (
                          <td className="p-3.5">
                            {(isProjectHead ? projectHeadComments : (t.comments || [])).length > 0 ? (
                              <ol className="max-h-40 space-y-1.5 overflow-y-auto">
                                {(isProjectHead ? projectHeadComments : (t.comments || []).slice(-5).reverse()).map((comment, commentIndex) => (
                                  <li key={`${comment.id || commentIndex}-${comment.timestamp}`} className={`break-words text-[11px] leading-relaxed ${isProjectHead && commentIndex === projectHeadComments.length - 1 ? 'font-semibold text-[#C55A11]' : 'text-[#475569]'}`}>
                                    {isProjectHead ? (
                                      <>
                                        {comment.content}
                                        {comment.timestamp ? ` (${new Date(comment.timestamp).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })})` : ''}
                                        {comment.userName ? ` (${comment.userName})` : ''}
                                      </>
                                    ) : (
                                      <>
                                        <span className="font-semibold text-[#334155]">
                                          {comment.userName || comment.role}
                                          {comment.timestamp ? ` · ${new Date(comment.timestamp).toLocaleString()}` : ''}:
                                        </span>{' '}
                                        {comment.content}
                                      </>
                                    )}
                                  </li>
                                ))}
                              </ol>
                            ) : (
                              <span className="text-[11px] text-[#94A3B8]">No comments yet.</span>
                            )}
                          </td>
                        ) : isManagementDashboard && isManagementPersonalView ? (
                          <td className="p-3.5">
                            <div className="flex flex-col items-start gap-2">
                              <PriorityBadge priority={t.priority} />
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                t.status === 'Completed'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : t.status === 'Pending Approval'
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-slate-100 text-slate-700'
                              }`}>
                                {t.status}
                              </span>
                            </div>
                          </td>
                        ) : (
                          <td className="p-3.5">
                            <PriorityBadge priority={t.priority} />
                          </td>
                        )}
                        {!isManagementDashboard && (
                          <>
                            <td className="p-3.5">
                              {t.flagStatus === 'Open' || flags.some(flag =>
                                String(flag.taskId) === String(tId) && flag.status === 'Open'
                              ) ? (
                                <span
                                  title={t.flagMessage || 'This task has an open flag'}
                                  className="inline-flex rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700"
                                >
                                  Yes
                                </span>
                              ) : (
                                <span className="text-[#94A3B8]">-</span>
                              )}
                            </td>
                            <td className="p-3.5 whitespace-nowrap text-[#64748B] font-medium">
                              {t.dueDate || '-'}
                            </td>
                          </>
                        )}
                        {!isManagementDashboard && (
                        <>
                        <td className="p-3.5 whitespace-nowrap">
                          {(() => {
                            const progressItems = t.assigneeProgress && t.assigneeProgress.length > 0
                              ? t.assigneeProgress
                              : (t.assignedEmployeeIds || []).map((employeeId, index) => ({
                                  employeeId,
                                  employeeName: t.assignedEmployeeNames?.[index] || 'Employee',
                                  status: t.status,
                                  workDone: t.workDone || 0
                                }));
                            const selected = progressItems.find(item => item.status === 'In Progress')
                              || progressItems.find(item => item.status === 'Pending Approval')
                              || [...progressItems].sort((a, b) => (b.workDone || 0) - (a.workDone || 0)).find(item => (item.workDone || 0) > 0)
                              || progressItems[0];

                            if (!selected) {
                              return <span className="text-[#94A3B8]">-</span>;
                            }

                            return (
                              <span className="text-[11px] font-semibold text-[#334155]">
                                {selected.employeeName || 'Employee'} — {selected.status}
                              </span>
                            );
                          })()}
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
                        <td className="p-3.5 text-[#64748B] font-medium whitespace-nowrap">{t.reminderDate || '-'}</td>
                        </>
                        )}
                        {!isManagementDashboard && (
                        <td className="p-3.5 text-right space-x-1.5">
                          {t.status !== 'Completed' && (
                            <button
                              type="button"
                              disabled={dailyCartIds.includes(tId)}
                              onClick={() => addTasksToDailyBoard([tId])}
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-[#2563EB] font-semibold rounded-lg border border-blue-200 transition cursor-pointer disabled:opacity-50"
                            >
                              {dailyCartIds.includes(tId) ? 'In Daily Board' : 'Add to Daily Board'}
                            </button>
                          )}
                          <button
                            onClick={() => { setSelectedTask(t); setIsTaskModalOpen(true); }}
                            className="px-2.5 py-1 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#334155] font-semibold rounded-lg transition cursor-pointer"
                          >
                            Edit
                          </button>
                          {t.status !== 'Completed' && (isDirector || isProjectHead) && (
                            <button
                              onClick={async () => {
                                const id = String(t.id || t._id || '');
                                if (!id) return;
                                try {
                                  const res = await fetch(`/api/tasks/${id}/approve-completion`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      approved: true,
                                      remarks: 'Marked completed from Dashboard'
                                    })
                                  });
                                  if (!res.ok) {
                                    const data = await res.json();
                                    showToast('error', data.error || 'Failed to move to Completed History');
                                    return;
                                  }
                                  showToast('success', 'Task moved to Completed Task History.');
                                  fetchData();
                                } catch {
                                  showToast('error', 'Network error.');
                                }
                              }}
                              className="px-2.5 py-1 bg-[#F0FDF4] hover:bg-[#DCFCE7] text-[#16A34A] font-semibold rounded-lg border border-[#BBF7D0] transition cursor-pointer"
                            >
                              To History
                            </button>
                          )}
                        </td>
                        )}
                      </tr>
                    );
                  })}
                    </React.Fragment>
                    );
                  })}
                  {groupedFilteredTasks.length === 0 && (
                    <tr>
                      <td
                        colSpan={isManagementDashboard ? (isManagementPersonalView ? 5 : 5) : 12}
                        className="px-4 py-10 text-center text-sm text-[#64748B]"
                      >
                        {loading ? 'Loading tasks…' : 'No tasks match these filters.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className={`grid gap-3 ${isManagementDashboard ? 'mt-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 border-t border-[#E2E8F0] pt-4 sm:grid-cols-2 xl:grid-cols-4'}`}>
              {!isManagementDashboard && (
                <button
                  type="button"
                  onClick={() => addTasksToDailyBoard(selectedTaskIds)}
                  disabled={selectedTaskIds.length === 0}
                  className="inline-flex min-h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[#2563EB] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ShoppingCart size={15} />
                  Add to Daily Task Board ({selectedTaskIds.length})
                </button>
              )}
              {isManagementDashboard && (
                <button
                  type="button"
                  disabled={selectedTaskIds.length !== 1}
                  onClick={() => {
                    const task = tasks.find(item => taskKey(item) === selectedTaskIds[0]);
                    if (!task) return;
                    setSelectedTask(task);
                    setIsTaskModalOpen(true);
                  }}
                  className="inline-flex min-h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[#2563EB] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Edit Task &gt;
                </button>
              )}
              {(isDirector || isProjectHead) && (
                <button
                  type="button"
                  onClick={() => openCreateTask(isDirector && activeTab === 'overview')}
                  className="inline-flex min-h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[#16A34A] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#15803D]"
                >
                  <Plus size={15} />
                  {isManagementDashboard ? 'New Task +' : 'Add New Task'}
                </button>
              )}
              {isDirector && (
                <button
                  type="button"
                  onClick={() => void removeSelectedTasks()}
                  disabled={selectedTaskIds.length === 0}
                  className="inline-flex min-h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[#DC2626] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#B91C1C] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Delete Task
                </button>
              )}
              {(isDirector || isProjectHead) && (
                <button
                  type="button"
                  onClick={() => void completeSelectedTasks()}
                  disabled={selectedTaskIds.length === 0}
                  className="inline-flex min-h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[#475569] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#334155] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {!isManagementDashboard && <CheckCircle2 size={15} />}
                  Completed Task
                </button>
              )}
              {!isManagementDashboard && (
                <span className="text-xs text-[#64748B] sm:col-span-2 xl:col-span-4">
                  {selectedTaskIds.length} selected
                </span>
              )}
            </div>
          </div>
        )}

        {/* TAB 11: PROJECTS */}
        {activeTab === 'projects' && (
          <div className="space-y-4">
            <ProjectList
              projects={isDirector ? projects : filteredProjects}
              users={employees}
              onProjectSave={handleSaveProject}
              onProjectDelete={handleDeleteProject}
              onProjectComplete={async (project) => {
                await handleSaveProject({ ...project, status: 'Completed' });
              }}
              statusFilter={isDirector ? projectStatusFilter : undefined}
              onStatusFilterChange={isDirector ? setProjectStatusFilter : undefined}
            />
          </div>
        )}

        {/* TAB 12: EMPLOYEES */}
        {activeTab === 'employees' && (
          <div>
          <EmployeeList
            employees={employees}
            projects={projects}
            tasks={tasks}
            onEmployeeSave={handleSaveEmployee}
            onEmployeeDelete={handleDeleteEmployee}
          />
          </div>
        )}

        {selectedTaskIds.length > 0 && !isDirector && (
          <div className="fixed bottom-5 left-1/2 z-30 -translate-x-1/2 md:left-[calc(50%+8rem)]">
            <div className="flex items-center gap-3 rounded-2xl border border-[#2563EB] bg-[#0F172A] px-4 py-3 text-white shadow-xl">
              <ShoppingCart size={16} className="text-blue-300" />
              <span className="text-xs font-bold">{selectedTaskIds.length} task{selectedTaskIds.length === 1 ? '' : 's'} selected</span>
              <button
                type="button"
                onClick={() => addTasksToDailyBoard(selectedTaskIds)}
                className="px-3 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-xs font-extrabold cursor-pointer"
              >
                Add to Daily Task Board
              </button>
              <button
                type="button"
                onClick={() => setSelectedTaskIds([])}
                className="text-[11px] font-semibold text-slate-300 hover:text-white cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {managementFlagTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/70 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md space-y-4 rounded-[14px] border border-[#E2E8F0] bg-white p-6 shadow-2xl">
              <div>
                <h3 className="text-base font-bold text-[#0F172A]">Flag Task</h3>
                <p className="mt-1 text-xs text-[#64748B]">
                  {managementFlagTaskIds.length > 1
                    ? `${managementFlagTaskIds.length} tasks selected`
                    : managementFlagTask.title}
                </p>
              </div>

              <div>
                <label htmlFor="management-flag-type" className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#475569]">
                  Flag Type
                </label>
                <select
                  id="management-flag-type"
                  value={managementFlagType}
                  onChange={event => setManagementFlagType(event.target.value)}
                  className="w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#2563EB]"
                >
                  {FLAG_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>

              <div>
                <label htmlFor="management-flag-message" className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#475569]">
                  Message
                </label>
                <textarea
                  id="management-flag-message"
                  rows={3}
                  value={managementFlagMessage}
                  onChange={event => setManagementFlagMessage(event.target.value)}
                  placeholder="Describe the issue or attention needed..."
                  className="w-full rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#2563EB]"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-[#E2E8F0] pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setManagementFlagTask(null);
                    setManagementFlagTaskIds([]);
                  }}
                  disabled={creatingManagementFlag}
                  className="rounded-lg px-4 py-2 text-xs font-semibold text-[#64748B] transition hover:bg-[#F1F5F9] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleCreateManagementFlag()}
                  disabled={creatingManagementFlag || !managementFlagMessage.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#DC2626] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#B91C1C] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FlagIcon size={13} />
                  {creatingManagementFlag ? 'Saving...' : 'Save Flag'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Director Private Star Rating Modal */}
        {ratingModalTask && (
          <div className="fixed inset-0 bg-[#0F172A]/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-[14px] shadow-2xl max-w-md w-full p-6 space-y-4 border border-[#E2E8F0]">
              <h3 className="text-base font-bold text-[#0F172A]">Director Private Star Rating</h3>
              <p className="text-xs text-[#64748B]">
                {(() => {
                  const employee = employees.find(item => String(item.id || item._id) === ratingModalEmployeeId);
                  const employeeName = employee ? `${employee.firstName} ${employee.lastName}`.trim() : 'employee';
                  return `Rating for ${employeeName}. The employee will see the star rating in Performance; your written feedback stays private to Directors.`;
                })()}
              </p>

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
                  type="button"
                  onClick={() => setRatingModalTask(null)}
                  disabled={savingPrivateRating}
                  className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-[#F1F5F9] rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSavePrivateRating}
                  disabled={savingPrivateRating || !ratingModalEmployeeId}
                  className="px-4 py-2 bg-[#D97706] hover:bg-[#B45309] text-white font-bold text-xs rounded-lg shadow-xs transition cursor-pointer disabled:cursor-wait disabled:opacity-60"
                >
                  {savingPrivateRating ? 'Saving...' : 'Save Rating'}
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
          onClose={() => { setIsProjectModalOpen(false); setSelectedProject(null); }}
          onSave={handleSaveProject}
        />

        {/* Task Modal */}
        <TaskModal
          isOpen={isTaskModalOpen}
          task={selectedTask}
          personalTask={personalTaskMode}
          projectHeadWorkflow={isProjectHead && activeTab === 'tasks'}
          directorTaskAllotmentEdit={isDirectorTaskAllotmentView}
          projects={projects}
          employees={employees}
          existingTasks={tasks}
          onClose={() => setIsTaskModalOpen(false)}
          onSave={handleSaveTask}
          onDelete={isDirector ? task => {
            const id = taskKey(task);
            if (id && window.confirm(`Permanently delete "${task.title}"?`)) {
              setIsTaskModalOpen(false);
              void handleDeleteTask(id);
            }
          } : undefined}
          onComplete={handleCompleteTask}
          dataLoading={loading}
        />

        {/* Employee Modal */}
        <EmployeeModal
          isOpen={isEmployeeModalOpen}
          employee={selectedEmployee}
          onClose={() => setIsEmployeeModalOpen(false)}
          onSave={handleSaveEmployee}
          projects={projects}
          employees={employees}
        />

      </div>
    </div>
    </div>
  );
};

export default Dashboard;
