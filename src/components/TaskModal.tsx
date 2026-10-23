'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Task, Project, Employee, TaskPriority } from '../types';
import { AlertCircle, Check, ChevronDown, Search, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface TaskModalProps {
  task?: Task | null;
  projects: Project[];
  employees: Employee[];
  existingTasks?: Task[];
  isOpen: boolean;
  personalTask?: boolean;
  projectHeadWorkflow?: boolean;
  onClose: () => void;
  onSave: (taskData: any) => Promise<void>;
  onDelete?: (task: Task) => void;
  onComplete?: (task: Task) => void | Promise<void>;
  dataLoading?: boolean;
}

const DIRECTOR_PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 'Urgent', label: 'Urgent' },
  { value: 'Medium', label: 'Less Urgent' },
  { value: 'Daily', label: 'Daily Task' },
  { value: 'Self', label: 'Self-define' },
  { value: 'Low', label: 'Low Urgent' }
];

const TaskModal: React.FC<TaskModalProps> = ({
  task,
  projects,
  employees,
  existingTasks = [],
  isOpen,
  personalTask = false,
  projectHeadWorkflow = false,
  onClose,
  onSave,
  onDelete,
  onComplete,
  dataLoading = false
}) => {
  const { user, isEmployee } = useAuth();
  const isProjectHead = user?.role === 'Project Head';
  const projectHeadFormLayout = projectHeadWorkflow && isProjectHead;
  const projectHeadEditLayout = projectHeadFormLayout && Boolean(task);
  const projectHeadCreateLayout = projectHeadFormLayout && !task;
  const isManagementUser = user?.role === 'Director' || user?.role === 'Project Head';
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [forwardComment, setForwardComment] = useState('');
  const [projectId, setProjectId] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('Urgent');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [subtasks, setSubtasks] = useState('');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [selectedCoordinatorId, setSelectedCoordinatorId] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [isEmployeeMenuOpen, setIsEmployeeMenuOpen] = useState(false);
  const [reminderDate, setReminderDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    title?: string;
    projectId?: string;
    employees?: string;
    coordinator?: string;
    projectTasks?: string;
    startDate?: string;
    dueDate?: string;
    description?: string;
  }>({});
  const [selectedRemarkKeys, setSelectedRemarkKeys] = useState<string[]>([]);
  const [taskRequirements, setTaskRequirements] = useState<Record<string, string>>({});
  const [taskSubtasks, setTaskSubtasks] = useState<Record<string, Array<{ title: string; requirement: string }>>>({});
  const [taskPriorities, setTaskPriorities] = useState<Record<string, TaskPriority>>({});
  const [taskEmployeeIds, setTaskEmployeeIds] = useState<Record<string, string[]>>({});
  const [customTasks, setCustomTasks] = useState<Array<{ key: string; title: string }>>([]);
  const customTaskCounter = useRef(0);
  const [parentTaskId, setParentTaskId] = useState('');
  const employeeMenuRef = useRef<HTMLDivElement | null>(null);
  const submitLockRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;

    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setForwardComment('');
      setProjectId(task.projectId || '');
      setPriority(task.priority || 'Urgent');
      setStartDate(task.startDate || '');
      setDueDate(task.dueDate || '');
      setSubtasks('');
      setSelectedEmployeeIds(Array.from(new Set(task.assignedEmployeeIds || [])));
      setSelectedCoordinatorId(task.projectHeadId || '');
      setReminderDate(toDateTimeLocal(task.reminderDate));
      setParentTaskId(task.parentTaskId || '');
    } else {
      setTitle('');
      setDescription('');
      setForwardComment('');
      setProjectId('');
      setPriority('Urgent');
      setStartDate('');
      setDueDate('');
      setSubtasks('');
      setSelectedEmployeeIds((isEmployee || personalTask) && user?.id ? [user.id] : []);
      setSelectedCoordinatorId('');
      setReminderDate('');
      setParentTaskId('');
    }
    setError('');
    setFieldErrors({});
    setSelectedRemarkKeys([]);
    setTaskRequirements({});
    setTaskSubtasks({});
    setTaskPriorities({});
    setTaskEmployeeIds({});
    setCustomTasks([]);
    setEmployeeSearch('');
    setIsEmployeeMenuOpen(false);
    setIsSubmitting(false);
    submitLockRef.current = false;
  }, [isOpen, task?.id || (task as any)?._id, isEmployee, personalTask, user?.id]);

  useEffect(() => {
    if (!isEmployeeMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (employeeMenuRef.current && !employeeMenuRef.current.contains(event.target as Node)) {
        setIsEmployeeMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsEmployeeMenuOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isEmployeeMenuOpen]);

  const assignableEmployees = useMemo(
    () => employees.filter(emp =>
      (emp.status === 'Active' || !emp.status) &&
      emp.role !== 'Director' &&
      (user?.role !== 'Project Head' || emp.role === 'Employee')
    ),
    [employees, user?.role]
  );
  const assignableCoordinators = useMemo(
    () => employees.filter(emp =>
      emp.role === 'Project Head' &&
      (emp.status === 'Active' || !emp.status) &&
      (!projectId || (emp.assignedProjects || []).includes(projectId))
    ),
    [employees, projectId]
  );

  const projectKey = (project: Project) => String(project.id || project._id || '');

  const selectedProject = useMemo(
    () => projects.find(p => projectKey(p) === String(projectId)) || null,
    [projects, projectId]
  );

  const projectTaskOptions = useMemo(() => {
    type Option = { key: string; title: string; date?: string; priority?: TaskPriority };
    if (!selectedProject) return [] as Option[];
    const remarks = selectedProject.projectRemarks || [];
    const options: Option[] = [];
    const remarkTitles = new Set<string>();
    const mainTasks = existingTasks.filter(item =>
      String(item.projectId) === String(projectId) && item.priority !== 'Self' && !item.parentTaskId
    );
    const taskForTitle = (title: string) =>
      mainTasks.find(item => (item.title || '').trim().toLowerCase() === title.toLowerCase());

    remarks.forEach((remark, index) => {
      const title = (remark.remark || '').trim();
      if (!title) return;
      const remarkId = remark._id ? String(remark._id) : '';
      const key = remarkId && remarkId !== '[object Object]'
        ? `remark-${remarkId}`
        : `remark-${index}-${remark.date || ''}-${title}`;
      const matched = taskForTitle(title);
      options.push({ key, title, date: remark.date, priority: matched?.priority });
      remarkTitles.add(title.toLowerCase());
    });

    mainTasks.forEach(item => {
      const title = (item.title || '').trim();
      if (!title) return;
      if (remarkTitles.has(title.toLowerCase())) return;
      options.push({
        key: `task-${item.id || item._id || title}`,
        title,
        date: item.createdAt ? String(item.createdAt).substring(0, 10) : undefined,
        priority: item.priority
      });
    });

    return options;
  }, [selectedProject, existingTasks, projectId]);

  const toDateTimeLocal = (value?: string) => {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T09:00`;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  };

  const isPersonalTask = isManagementUser && (
    (personalTask && !task) ||
    Boolean(
      task &&
      user.id &&
      task.assignedById === user.id &&
      task.assignedEmployeeIds?.length === 1 &&
      task.assignedEmployeeIds.includes(user.id)
    )
  );
  const personalTaskLayout = isPersonalTask || isEmployee;
  const showProjectTaskList = false;
  const isDirectorPriority = (value?: TaskPriority) =>
    DIRECTOR_PRIORITIES.some(option => option.value === value);
  const priorityForTask = (key: string): TaskPriority => {
    if (taskPriorities[key]) return taskPriorities[key];
    const existing = projectTaskOptions.find(option => option.key === key)?.priority;
    return existing && isDirectorPriority(existing) ? existing : 'Urgent';
  };
  const hideTitleField = showProjectTaskList || projectHeadEditLayout;

  const getEmpId = (emp: Employee) => emp.id || emp._id || '';
  const getEmpName = (emp: Employee) => {
    const name = `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
    return emp.role === 'Project Head' ? `${name} (Project Co-ordinator)` : name;
  };

  const selectedEmployees = assignableEmployees.filter(emp => selectedEmployeeIds.includes(getEmpId(emp)));
  const searchTerm = employeeSearch.trim().toLowerCase();
  const filteredEmployees = assignableEmployees.filter(emp => {
    const firstName = (emp.firstName || '').toLowerCase();
    const lastName = (emp.lastName || '').toLowerCase();
    const fullName = `${firstName} ${lastName}`.trim();
    return !searchTerm || firstName.includes(searchTerm) || lastName.includes(searchTerm) || fullName.includes(searchTerm);
  });

  if (!isOpen) return null;

  const heading = task
    ? projectHeadEditLayout ? 'Edit Task (pop-up window)' : 'Edit Task'
    : projectHeadCreateLayout
      ? 'New Task - allot to Employee (pop-up window)'
      : personalTaskLayout
      ? 'New Task (pop-up window)'
      : isEmployee
        ? 'New Task'
        : 'New Task - allot to Project Head / Employee';
  const subtitle = task
    ? 'Update task details and assigned employees.'
    : isPersonalTask
      ? 'Add a task to your personal dashboard.'
    : (isEmployee ? 'Create a self-defined task for your daily work.' : 'Create a task and assign it to one or more employees.');
  const primaryLabel = isSubmitting
    ? (task ? 'Saving...' : (isEmployee ? 'Creating Task...' : 'Creating Task...'))
    : (task && isManagementUser ? 'Submit & Forward' : task ? 'Save Task' : (isPersonalTask || isEmployee) ? 'Add to My Dashboard' : 'Allot Task');

  const toggleEmployeeSelect = (empId: string) => {
    if (!empId) return;
    setSelectedEmployeeIds(prev => {
      if (prev.includes(empId)) return prev.filter(id => id !== empId);
      return [...prev, empId];
    });
    setFieldErrors(prev => ({ ...prev, employees: undefined }));
    setEmployeeSearch('');
  };

  const toggleTaskEmployee = (taskKey: string, employeeId: string) => {
    setTaskEmployeeIds(prev => {
      const current = prev[taskKey] || [];
      return {
        ...prev,
        [taskKey]: current.includes(employeeId)
          ? current.filter(id => id !== employeeId)
          : [...current, employeeId]
      };
    });
    setFieldErrors(prev => ({ ...prev, projectTasks: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitLockRef.current || isSubmitting) return;

    const trimmedTitle = projectHeadEditLayout ? task?.title?.trim() || '' : hideTitleField ? '' : title.trim();
    const selectedItems = [
      ...projectTaskOptions.filter(item => selectedRemarkKeys.includes(item.key)),
      ...customTasks
        .map(item => ({ key: item.key, title: item.title.trim() }))
        .filter(item => item.title)
    ]
      .map(item => ({
        ...item,
        priority: priorityForTask(item.key),
        requirement: (taskRequirements[item.key] || '').trim(),
        assignedEmployeeIds: Array.from(new Set(taskEmployeeIds[item.key] || [])),
        subtasks: parentTaskId
          ? []
          : (taskSubtasks[item.key] || [])
              .map(sub => ({ title: sub.title.trim(), requirement: sub.requirement.trim() }))
              .filter(sub => sub.title)
      }));
    const nextErrors: {
      title?: string;
      projectId?: string;
      employees?: string;
      coordinator?: string;
      projectTasks?: string;
      startDate?: string;
      dueDate?: string;
      description?: string;
    } = {};
    const extraTitleIsSeparate = Boolean(trimmedTitle) &&
      !selectedItems.some(item => item.title.trim().toLowerCase() === trimmedTitle.toLowerCase());

    if (!projectId) nextErrors.projectId = 'Please select a Project.';
    if (!task) {
      if (!startDate) nextErrors.startDate = 'Start date is required.';
      if (!dueDate) nextErrors.dueDate = 'Due date is required.';
      if (startDate && dueDate && dueDate < startDate) {
        nextErrors.dueDate = 'Due date must be on or after the start date.';
      }
    }
    if (!task && !description.trim()) {
      nextErrors.description = 'Description / first comment is required.';
    }
    if (!isEmployee && !isPersonalTask && !showProjectTaskList && selectedEmployeeIds.length === 0) {
      nextErrors.employees = 'Please select at least one employee.';
    }
    if (user?.role === 'Director' && !isPersonalTask && !selectedCoordinatorId) {
      nextErrors.coordinator = 'Please select a Project Co-ordinator.';
    }
    if (!isEmployee && showProjectTaskList) {
      if (selectedItems.some(item => item.assignedEmployeeIds.length === 0)) {
        nextErrors.projectTasks = 'Assign at least one employee to every selected task.';
      } else if (extraTitleIsSeparate && selectedEmployeeIds.length === 0) {
        nextErrors.employees = 'Please select at least one employee for the additional task.';
      }
    }
    if (task || isEmployee) {
      if (!trimmedTitle) nextErrors.title = 'Task Title is required.';
    } else if (selectedItems.length === 0 && !trimmedTitle) {
      if (hideTitleField) {
        nextErrors.projectTasks = 'Please select a task or add a new task.';
      } else {
        nextErrors.title = 'Task Title is required.';
      }
    }

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setError(nextErrors.projectId || nextErrors.projectTasks || nextErrors.title || nextErrors.employees || nextErrors.coordinator || 'Please complete the required fields.');
      return;
    }

    setError('');
    submitLockRef.current = true;
    setIsSubmitting(true);
    try {
      await onSave({
        title: trimmedTitle,
        description: description.trim(),
        nextComment: forwardComment.trim() || undefined,
        projectId,
        priority,
        projectHeadId: user?.role === 'Director' && !isPersonalTask ? selectedCoordinatorId : undefined,
        assignedEmployeeIds: (isEmployee || isPersonalTask) && user?.id ? [user.id] : Array.from(new Set(selectedEmployeeIds)),
        personalTask: isPersonalTask,
        startDate: startDate || undefined,
        dueDate: dueDate || reminderDate.substring(0, 10) || undefined,
        subtasks: !task
          ? subtasks.split(/\r?\n/).map(value => value.trim()).filter(Boolean)
          : undefined,
        reminderDate: reminderDate || undefined,
        parentTaskId: task && !isEmployee && parentTaskId ? parentTaskId : undefined,
        selectedProjectTasks: !isEmployee && !task && selectedItems.length > 0 ? selectedItems : undefined
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Unable to create task. Please try again.');
      submitLockRef.current = false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = (hasError?: string) =>
    `w-full px-3.5 py-2.5 ${personalTaskLayout || projectHeadFormLayout ? 'bg-white' : 'bg-slate-50'} border rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:bg-white transition ${
      hasError
        ? 'border-rose-400 focus:ring-rose-500'
        : personalTaskLayout || projectHeadFormLayout
          ? 'border-rose-500 text-rose-600 placeholder:text-rose-400 focus:ring-rose-500'
          : 'border-slate-300 focus:ring-[#2563EB]'
    }`;

  const renderTaskExtras = (key: string, title: string) => (
    <div className="px-2 pb-2 pl-8">
      <label className="mb-1 block text-[11px] font-semibold text-slate-600">
        Priority for {title} *
      </label>
      <div className="mb-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {DIRECTOR_PRIORITIES.map(option => {
          const selected = priorityForTask(key) === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setTaskPriorities(prev => ({ ...prev, [key]: option.value }))}
              aria-pressed={selected}
              className={`rounded-md border px-2 py-1.5 text-[11px] font-bold transition ${
                selected
                  ? 'border-[#2563EB] bg-[#2563EB] text-white shadow-sm'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <label className="mb-1 block text-[11px] font-semibold text-slate-600">
        Requirement for {title}
      </label>
      <textarea
        value={taskRequirements[key] || ''}
        onChange={(e) => {
          const value = e.target.value;
          setTaskRequirements(prev => ({ ...prev, [key]: value }));
        }}
        rows={2}
        placeholder={`What exactly needs to be done in ${title}?`}
        className="w-full resize-y rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
      />
      {!parentTaskId && showProjectTaskList && (
        <div className="mt-2">
          <p className="mb-1 block text-[11px] font-semibold text-slate-600">Assign employees *</p>
          <div className="grid grid-cols-1 gap-1 rounded-lg border border-slate-200 bg-white p-2 sm:grid-cols-2">
            {assignableEmployees.map(employee => {
              const employeeId = getEmpId(employee);
              const checked = (taskEmployeeIds[key] || []).includes(employeeId);
              return (
                <label key={employeeId} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs text-slate-700 hover:bg-blue-50">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleTaskEmployee(key, employeeId)}
                    className="h-4 w-4 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]"
                  />
                  <span>{getEmpName(employee)}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
      {!parentTaskId && (
        <div className="mt-2 space-y-2 border-l-2 border-indigo-200 pl-3">
          {(taskSubtasks[key] || []).map((sub, subIndex) => (
            <div key={subIndex} className="rounded-lg border border-indigo-100 bg-white p-2">
              <div className="flex items-center gap-2">
                <span className="flex-shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-extrabold text-indigo-600">
                  ST-{subIndex + 1}
                </span>
                <input
                  type="text"
                  value={sub.title}
                  onChange={(e) => {
                    const value = e.target.value;
                    setTaskSubtasks(prev => ({
                      ...prev,
                      [key]: (prev[key] || []).map((s, i) => i === subIndex ? { ...s, title: value } : s)
                    }));
                  }}
                  placeholder={`Subtask name under ${title}`}
                  className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <button
                  type="button"
                  onClick={() => setTaskSubtasks(prev => ({
                    ...prev,
                    [key]: (prev[key] || []).filter((_, i) => i !== subIndex)
                  }))}
                  className="flex-shrink-0 rounded-md p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                  aria-label="Remove subtask"
                >
                  <X size={14} />
                </button>
              </div>
              <input
                type="text"
                value={sub.requirement}
                onChange={(e) => {
                  const value = e.target.value;
                  setTaskSubtasks(prev => ({
                    ...prev,
                    [key]: (prev[key] || []).map((s, i) => i === subIndex ? { ...s, requirement: value } : s)
                  }));
                }}
                placeholder="Requirement for this subtask (optional)"
                className="mt-1.5 w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => setTaskSubtasks(prev => ({
              ...prev,
              [key]: [...(prev[key] || []), { title: '', requirement: '' }]
            }))}
            className="inline-flex items-center gap-1 rounded-md border border-dashed border-indigo-300 px-2.5 py-1 text-[11px] font-bold text-indigo-700 transition hover:bg-indigo-50"
          >
            + Add Subtask
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-3 sm:p-4">
      <div className="my-auto flex w-full max-w-5xl max-h-[calc(100dvh-1rem)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl sm:max-h-[min(90dvh,calc(100dvh-2rem))]">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#25527a] bg-[#25527a] px-5 py-4 sm:px-6">
          <div>
            <h3 className="text-lg font-bold text-white">{heading}</h3>
            {!personalTaskLayout && <p className="mt-1 text-xs font-medium text-blue-100">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/80 transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-7 sm:py-6">
          {error && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
                <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

            {projectHeadEditLayout && task && (
              <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.6fr)]">
                <section className="min-h-48 rounded-md border border-[#D9E2EF] bg-[#F8FAFC] p-4 text-sm text-[#334155]" aria-label="Task details">
                  <p className="font-bold text-[#1E293B]">{task.projectName || selectedProject?.projectName || 'Project'}/{task.title}</p>
                  {existingTasks.filter(item => String(item.parentTaskId || '') === String(task.id || (task as any)._id || '')).map(subtask => (
                    <p key={subtask.id || (subtask as any)._id} className="mt-0.5 text-xs">{task.projectName || selectedProject?.projectName || 'Project'}/{task.title}/{subtask.title}</p>
                  ))}
                  <p className="mt-1 whitespace-pre-wrap text-xs italic text-slate-500">{task.description || '-'}</p>
                </section>
                <section className="min-h-48 rounded-md border border-[#D9E2EF] bg-white p-4" aria-label="Latest task comments">
                  <h4 className="text-sm font-bold text-slate-500">Latest 5 comments</h4>
                  {task.comments?.length ? (
                    <ol className="mt-1 space-y-0.5">
                      {task.comments.slice(-5).map((comment, index) => (
                        <li key={comment.id} className={`text-sm ${index === Math.min(task.comments!.length, 5) - 1 ? 'font-semibold text-[#C55A11]' : 'text-[#334155]'}`}>
                          {comment.content} ({new Date(comment.timestamp).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })})({comment.userName || comment.role})
                        </li>
                      ))}
                    </ol>
                  ) : <p className="mt-1 text-sm text-slate-500">No comments have been added.</p>}
                </section>
              </div>
            )}

            {task && isManagementUser && !projectHeadEditLayout && (
              <section className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3" aria-label="Task comment history">
                <div>
                  <h4 className="text-sm font-bold text-slate-700">Latest 5 comments</h4>
                  {task.comments?.length ? (
                    <ol className="mt-2 max-h-40 space-y-2 overflow-y-auto">
                      {task.comments.slice(-5).map(comment => (
                        <li key={comment.id} className="rounded-md bg-white p-2 text-xs text-slate-700">
                          <p className="font-semibold">{comment.userName} · {new Date(comment.timestamp).toLocaleString()}</p>
                          <p className="mt-1 whitespace-pre-wrap">{comment.content}</p>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">No comments have been added.</p>
                  )}
                </div>
                <label className="block text-xs font-semibold text-slate-700">
                  Your comment (optional) - forwarded to employee
                  <textarea
                    value={forwardComment}
                    onChange={event => setForwardComment(event.target.value)}
                    rows={3}
                    placeholder="Add comment and forward..."
                    className="mt-1.5 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </label>
              </section>
            )}

            <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
            {!projectHeadEditLayout && <div style={{ order: projectHeadCreateLayout || personalTaskLayout ? 1 : undefined }}>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Project *
              </label>
              {dataLoading && projects.length === 0 ? (
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500">Loading projects...</p>
              ) : (
                <select
                  value={projectId}
                  onChange={(e) => {
                    setProjectId(e.target.value);
                    setSelectedRemarkKeys([]);
                    setTaskRequirements({});
                    setTaskSubtasks({});
                    setTaskPriorities({});
                    setTaskEmployeeIds({});
                    setCustomTasks([]);
                    setParentTaskId('');
                    setSelectedCoordinatorId('');
                    if (fieldErrors.projectId) setFieldErrors(prev => ({ ...prev, projectId: undefined, projectTasks: undefined }));
                  }}
                  className={inputClass(fieldErrors.projectId)}
                >
                  <option value="">{projects.length === 0 ? 'No projects available' : '-- Select Project --'}</option>
                  {projects.map(p => {
                    const id = projectKey(p);
                    return (
                      <option key={id} value={id}>
                        {p.projectName}
                      </option>
                    );
                  })}
                </select>
              )}
              {projects.length === 0 && !dataLoading && (
                <p className="mt-1 text-[11px] font-semibold text-amber-600">No projects available</p>
              )}
              {fieldErrors.projectId && <p className="mt-1 text-[11px] font-semibold text-rose-600">{fieldErrors.projectId}</p>}
            </div>}

            {showProjectTaskList && projectId && (
          <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    Tasks for {selectedProject?.projectName || 'Selected Project'}
                    {projectTaskOptions.length > 0 && (
                      <span className="ml-1 normal-case tracking-normal text-slate-500">
                        ({projectTaskOptions.length})
                      </span>
                    )}
                  </label>
                  {projectTaskOptions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const allKeys = projectTaskOptions.map(item => item.key);
                        const allSelected = allKeys.every(key => selectedRemarkKeys.includes(key));
                        setSelectedRemarkKeys(allSelected ? [] : allKeys);
                        setFieldErrors(prev => ({ ...prev, projectTasks: undefined, title: undefined }));
                      }}
                      className="text-[11px] font-semibold text-[#2563EB] hover:underline"
                    >
                      {projectTaskOptions.every(item => selectedRemarkKeys.includes(item.key)) ? 'Clear all' : 'Select all'}
                    </button>
                  )}
                </div>
                  <div className={`max-h-[28rem] space-y-1 overflow-y-auto rounded-lg border bg-white p-2 ${fieldErrors.projectTasks ? 'border-rose-400' : 'border-slate-300'}`}>
                    {projectTaskOptions.length === 0 && customTasks.length === 0 && (
                      <p className="px-2 py-1.5 text-xs font-medium text-slate-500">
                        No tasks in this project yet. Click &ldquo;+ Add New Task&rdquo; below to create one.
                      </p>
                    )}
                    {projectTaskOptions.map(item => {
                      const checked = selectedRemarkKeys.includes(item.key);
                      return (
                        <div
                          key={item.key}
                          className={`rounded-md transition ${checked ? 'bg-blue-50 text-blue-900' : 'text-slate-700 hover:bg-slate-50'}`}
                        >
                        <label className="flex cursor-pointer items-start gap-2.5 px-2 py-1.5 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setSelectedRemarkKeys(prev =>
                                prev.includes(item.key) ? prev.filter(key => key !== item.key) : [...prev, item.key]
                              );
                              if (fieldErrors.projectTasks || fieldErrors.title) {
                                setFieldErrors(prev => ({ ...prev, projectTasks: undefined, title: undefined }));
                              }
                            }}
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-1.5 font-semibold">
                              {item.title}
                            </span>
                            {item.date && (
                              <span className="block text-[11px] font-medium text-slate-500">{item.date}</span>
                            )}
                          </span>
            </label>
                        {checked && renderTaskExtras(item.key, item.title)}
                        </div>
                      );
                    })}
                    {customTasks.map(custom => (
                      <div key={custom.key} className="rounded-md bg-emerald-50/70 ring-1 ring-emerald-200">
                        <div className="flex items-center gap-2 px-2 py-1.5">
                          <span className="flex-shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-700">NEW TASK</span>
            <input
              type="text"
                            value={custom.title}
                            onChange={(e) => {
                              const value = e.target.value;
                              setCustomTasks(prev => prev.map(t => t.key === custom.key ? { ...t, title: value } : t));
                              if (fieldErrors.projectTasks) setFieldErrors(prev => ({ ...prev, projectTasks: undefined }));
                            }}
                            placeholder="Task name (e.g. Working Drawings)"
                            className="min-w-0 flex-1 rounded-md border border-emerald-200 bg-white px-2 py-1.5 text-sm font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setCustomTasks(prev => prev.filter(t => t.key !== custom.key));
                              setTaskRequirements(prev => {
                                const { [custom.key]: _removed, ...rest } = prev;
                                return rest;
                              });
                              setTaskSubtasks(prev => {
                                const { [custom.key]: _removed, ...rest } = prev;
                                return rest;
                              });
                              setTaskPriorities(prev => {
                                const { [custom.key]: _removed, ...rest } = prev;
                                return rest;
                              });
                            }}
                            className="flex-shrink-0 rounded-md p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                            aria-label="Remove new task"
                          >
                            <X size={14} />
                          </button>
                        </div>
                        {renderTaskExtras(custom.key, custom.title.trim() || 'this task')}
                      </div>
                    ))}
                  </div>
                <button
                  type="button"
                  onClick={() => {
                    customTaskCounter.current += 1;
                    setCustomTasks(prev => [...prev, { key: `new-${customTaskCounter.current}`, title: '' }]);
                    if (fieldErrors.projectTasks) setFieldErrors(prev => ({ ...prev, projectTasks: undefined }));
                  }}
                  className="mt-2 inline-flex items-center gap-1 rounded-lg border border-dashed border-emerald-400 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
                >
                  + Add New Task
                </button>
                {fieldErrors.projectTasks && <p className="mt-1 text-[11px] font-semibold text-rose-600">{fieldErrors.projectTasks}</p>}
          </div>
            )}

            {!hideTitleField && (
          <div style={{ order: projectHeadCreateLayout || personalTaskLayout ? 2 : undefined }}>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                {showProjectTaskList ? 'Task Title' : personalTaskLayout ? 'Task name *' : 'Task Title *'}
            </label>
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (fieldErrors.title) setFieldErrors(prev => ({ ...prev, title: undefined }));
                }}
                placeholder={showProjectTaskList ? 'Optional extra task, or skip if you selected tasks above' : 'Enter task title'}
                className={inputClass(fieldErrors.title)}
              />
              {fieldErrors.title && <p className="mt-1 text-[11px] font-semibold text-rose-600">{fieldErrors.title}</p>}
            </div>
            )}

            {user?.role === 'Director' && !isPersonalTask && !showProjectTaskList && (
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Project Co-ordinator *
              </label>
              <select
                value={selectedCoordinatorId}
                onChange={event => {
                  setSelectedCoordinatorId(event.target.value);
                  if (fieldErrors.coordinator) {
                    setFieldErrors(previous => ({ ...previous, coordinator: undefined }));
                  }
                }}
                className={inputClass(fieldErrors.coordinator)}
              >
                <option value="">
                  {assignableCoordinators.length ? '-- Select Project Co-ordinator --' : 'No Project Co-ordinators available'}
                </option>
                {assignableCoordinators.map(coordinator => {
                  const id = getEmpId(coordinator);
                  return (
                    <option key={id} value={id}>
                      {getEmpName(coordinator)}
                    </option>
                  );
                })}
              </select>
              {fieldErrors.coordinator && <p className="mt-1 text-[11px] font-semibold text-rose-600">{fieldErrors.coordinator}</p>}
            </div>
            )}

            {!showProjectTaskList && (
              <div style={{ order: projectHeadCreateLayout || personalTaskLayout ? 4 : undefined }}>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Priority *
              </label>
              <select
                value={priority}
                onChange={event => setPriority(event.target.value as TaskPriority)}
                className={inputClass()}
              >
                {DIRECTOR_PRIORITIES.filter(option =>
                  option.value !== 'Self' || isEmployee || isPersonalTask || task?.priority === 'Self'
                ).map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            )}

            {!isEmployee && !isPersonalTask && (!showProjectTaskList || Boolean(title.trim())) && (
              <div ref={employeeMenuRef} className={projectHeadFormLayout ? 'sm:col-span-1' : 'sm:col-span-2'} style={{ order: projectHeadCreateLayout ? 7 : undefined }}>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  {projectHeadEditLayout ? 'Employee in charge' : showProjectTaskList ? 'Assign Employees to Additional Task *' : 'Assigned to *'}
                    </label>
                {selectedEmployees.length > 0 && (
                  <div className="mb-2">
                    <p className="mb-1.5 text-[11px] font-semibold text-slate-500">Selected Employees:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedEmployees.map(emp => {
                        const empId = getEmpId(emp);
                        return (
                          <span key={empId} className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-800">
                            {getEmpName(emp)}
                            <button
                              type="button"
                              onClick={() => toggleEmployeeSelect(empId)}
                              className="text-blue-500 hover:text-rose-600"
                              aria-label={`Remove ${getEmpName(emp)}`}
                            >
                              <X size={12} />
                            </button>
                          </span>
                  );
                })}
              </div>
            </div>
          )}

                {dataLoading && assignableEmployees.length === 0 ? (
                  <p className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500">Loading employees...</p>
                ) : (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsEmployeeMenuOpen(open => !open)}
                      className={`${inputClass(fieldErrors.employees)} flex items-center justify-between text-left`}
                    >
                      <span className={`flex items-center gap-2 ${employeeSearch || isEmployeeMenuOpen ? 'text-slate-900' : 'text-slate-400'}`}>
                        <Search size={15} className="text-slate-400" />
                        Search employee name...
                      </span>
                      <ChevronDown size={16} className={`text-slate-400 transition ${isEmployeeMenuOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isEmployeeMenuOpen && (
                      <div className="absolute bottom-full left-0 right-0 z-30 mb-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                        <div className="border-b border-slate-100 p-2">
                          <input
                            autoFocus
                            type="text"
                            value={employeeSearch}
                            onChange={(e) => setEmployeeSearch(e.target.value)}
                            placeholder="Type employee name..."
                            className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                          />
                        </div>
                        <div className="max-h-44 overflow-y-auto p-1.5">
                          {filteredEmployees.length === 0 ? (
                            <p className="px-2 py-3 text-center text-xs font-medium text-slate-500">No employees found</p>
                          ) : filteredEmployees.map(emp => {
                            const empId = getEmpId(emp);
                            const checked = selectedEmployeeIds.includes(empId);
                            return (
                              <button
                                type="button"
                                key={empId}
                                onClick={() => toggleEmployeeSelect(empId)}
                                className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm transition ${
                                  checked ? 'bg-blue-50 font-semibold text-blue-900' : 'text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                <span>{getEmpName(emp)}</span>
                                {checked && <Check size={14} className="text-[#2563EB]" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {fieldErrors.employees && <p className="mt-1 text-[11px] font-semibold text-rose-600">{fieldErrors.employees}</p>}
              </div>
            )}

            {projectHeadCreateLayout && <div className="hidden sm:block" style={{ order: 8 }} aria-hidden="true" />}

            {!showProjectTaskList && !projectHeadEditLayout && (
          <div style={{ order: projectHeadCreateLayout ? 10 : personalTaskLayout ? 8 : undefined }}>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
              {!task ? 'Description / first comment *' : 'Task Description'}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
                  rows={personalTaskLayout ? 1 : 4}
                  placeholder="Enter task details..."
                  className={`${inputClass()} ${personalTaskLayout ? '' : 'min-h-[96px] resize-y'}`}
            />
                  {fieldErrors.description && <p className="mt-1 text-[11px] font-semibold text-rose-600">{fieldErrors.description}</p>}
          </div>
            )}

            {!task && (
                  <div style={{ order: projectHeadCreateLayout || personalTaskLayout ? 3 : undefined }}>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">
                      Subtasks
                    </label>
                    <textarea
                      value={subtasks}
                      onChange={(e) => setSubtasks(e.target.value)}
                      rows={personalTaskLayout ? 1 : 3}
                      placeholder="Enter one subtask per line"
                      className={`${inputClass()} resize-y`}
                    />
                  </div>
            )}

          {!projectHeadEditLayout && <div style={{ order: projectHeadCreateLayout || personalTaskLayout ? 5 : undefined }}>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    Start date *
            </label>
            <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required={!task}
                  className={inputClass(fieldErrors.startDate)}
            />
            {fieldErrors.startDate && <p className="mt-1 text-[11px] font-semibold text-rose-600">{fieldErrors.startDate}</p>}
          </div>}

          {!projectHeadEditLayout && <div style={{ order: projectHeadCreateLayout || personalTaskLayout ? 6 : undefined }}>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    Due date *
            </label>
            <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required={!task}
                  min={startDate || undefined}
                  className={inputClass(fieldErrors.dueDate)}
            />
            {fieldErrors.dueDate && <p className="mt-1 text-[11px] font-semibold text-rose-600">{fieldErrors.dueDate}</p>}
          </div>}

          {!projectHeadEditLayout && <div style={{ order: projectHeadCreateLayout ? 9 : personalTaskLayout ? 7 : undefined }}>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    {isEmployee || isPersonalTask ? 'Reminder to myself' : 'Reminder to assignee'}
            </label>
            <input
                  type="datetime-local"
                  value={reminderDate}
                  onChange={(e) => setReminderDate(e.target.value)}
                    className={inputClass()}
            />
            </div>}
          </div>
          {projectHeadEditLayout && (
            <label className="mt-4 block text-sm font-semibold text-slate-700">
              Your comment (optional) - forwarded to employee
              <textarea
                value={forwardComment}
                onChange={event => setForwardComment(event.target.value)}
                rows={3}
                placeholder="Add comment and forward..."
                className="mt-1.5 w-full resize-y rounded-md border border-rose-500 bg-white px-3 py-2 text-sm text-rose-600 placeholder:text-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </label>
          )}
          </div>

          <div className="flex shrink-0 flex-col gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-start sm:gap-3 sm:px-7">
            {task && isManagementUser && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(task)}
                disabled={isSubmitting}
                className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60 sm:mr-auto"
              >
                Delete Task
              </button>
            )}
            {task && isManagementUser && onComplete && task.status !== 'Completed' && (
              <button
                type="button"
                onClick={() => void onComplete(task)}
                disabled={isSubmitting}
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
              >
                Completed Task
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-[334px]"
            >
              {primaryLabel}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-slate-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-600 sm:w-[158px]"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskModal;
