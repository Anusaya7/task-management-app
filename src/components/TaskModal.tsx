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
  onClose: () => void;
  onSave: (taskData: any) => Promise<void>;
  dataLoading?: boolean;
}

const DIRECTOR_PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 'Urgent', label: 'Urgent' },
  { value: 'Medium', label: 'Less Urgent' },
  { value: 'Low', label: 'Low Urgent' },
  { value: 'Daily', label: 'Daily Task' }
];

const TaskModal: React.FC<TaskModalProps> = ({
  task,
  projects,
  employees,
  existingTasks = [],
  isOpen,
  onClose,
  onSave,
  dataLoading = false
}) => {
  const { user, isEmployee } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('Urgent');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [isEmployeeMenuOpen, setIsEmployeeMenuOpen] = useState(false);
  const [reminderDate, setReminderDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; projectId?: string; employees?: string; projectTasks?: string }>({});
  const [selectedRemarkKeys, setSelectedRemarkKeys] = useState<string[]>([]);
  const [taskRequirements, setTaskRequirements] = useState<Record<string, string>>({});
  const [parentTaskId, setParentTaskId] = useState('');
  const employeeMenuRef = useRef<HTMLDivElement | null>(null);
  const submitLockRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;

    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setProjectId(task.projectId || '');
      setPriority(task.priority && task.priority !== 'Self' ? task.priority : 'Urgent');
      setSelectedEmployeeIds(Array.from(new Set(task.assignedEmployeeIds || [])));
      setReminderDate(task.reminderDate ? task.reminderDate.substring(0, 10) : '');
      setParentTaskId(task.parentTaskId || '');
    } else {
      setTitle('');
      setDescription('');
      setProjectId('');
      setPriority(isEmployee ? 'Self' : 'Urgent');
      setSelectedEmployeeIds(isEmployee && user?.id ? [user.id] : []);
      setReminderDate('');
      setParentTaskId('');
    }
    setError('');
    setFieldErrors({});
    setSelectedRemarkKeys([]);
    setTaskRequirements({});
    setEmployeeSearch('');
    setIsEmployeeMenuOpen(false);
    setIsSubmitting(false);
    submitLockRef.current = false;
  }, [isOpen, task?.id || (task as any)?._id, isEmployee, user?.id]);

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
    () => employees.filter(emp => emp.role === 'Employee' && emp.status !== 'Inactive'),
    [employees]
  );

  const projectKey = (project: Project) => String(project.id || project._id || '');

  const selectedProject = useMemo(
    () => projects.find(p => projectKey(p) === String(projectId)) || null,
    [projects, projectId]
  );

  const projectTaskOptions = useMemo(() => {
    if (!selectedProject) return [] as Array<{ key: string; title: string; date?: string }>;
    const remarks = selectedProject.projectRemarks || [];
    const options: Array<{ key: string; title: string; date?: string }> = [];
    const remarkTitles = new Set<string>();

    remarks.forEach((remark, index) => {
      const title = (remark.remark || '').trim();
      if (!title) return;
      const remarkId = remark._id ? String(remark._id) : '';
      const key = remarkId && remarkId !== '[object Object]'
        ? `remark-${remarkId}`
        : `remark-${index}-${remark.date || ''}-${title}`;
      options.push({ key, title, date: remark.date });
      remarkTitles.add(title.toLowerCase());
    });

    existingTasks
      .filter(item => String(item.projectId) === String(projectId) && item.priority !== 'Self')
      .forEach(item => {
        const title = (item.title || '').trim();
        if (!title) return;
        if (remarkTitles.has(title.toLowerCase())) return;
        options.push({
          key: `task-${item.id || item._id || title}`,
          title,
          date: item.createdAt ? String(item.createdAt).substring(0, 10) : undefined
        });
      });

    return options;
  }, [selectedProject, existingTasks, projectId]);

  const parentTaskOptions = useMemo(() => {
    if (!projectId) return [] as Task[];
    const currentId = task ? String(task.id || (task as any)._id || '') : '';
    return existingTasks.filter(item =>
      String(item.projectId) === String(projectId) &&
      item.priority !== 'Self' &&
      !item.parentTaskId &&
      String(item.id || item._id || '') !== currentId
    );
  }, [existingTasks, projectId, task]);

  const showProjectTaskList = !isEmployee && !task;
  const hideTitleField = showProjectTaskList;

  const getEmpId = (emp: Employee) => emp.id || emp._id || '';
  const getEmpName = (emp: Employee) => `${emp.firstName || ''} ${emp.lastName || ''}`.trim();

  const selectedEmployees = assignableEmployees.filter(emp => selectedEmployeeIds.includes(getEmpId(emp)));
  const searchTerm = employeeSearch.trim().toLowerCase();
  const filteredEmployees = assignableEmployees.filter(emp => {
    const firstName = (emp.firstName || '').toLowerCase();
    const lastName = (emp.lastName || '').toLowerCase();
    const fullName = `${firstName} ${lastName}`.trim();
    return !searchTerm || firstName.includes(searchTerm) || lastName.includes(searchTerm) || fullName.includes(searchTerm);
  });

  if (!isOpen) return null;

  const heading = task ? 'Edit Task' : (isEmployee ? 'Create Self Task' : 'Assign New Task');
  const subtitle = task
    ? 'Update task details and assigned employees.'
    : (isEmployee ? 'Create a self-defined task for your daily work.' : 'Create a task and assign it to one or more employees.');
  const primaryLabel = isSubmitting
    ? (task ? 'Saving...' : (isEmployee ? 'Creating Task...' : 'Creating Task...'))
    : (task ? 'Save Task' : (isEmployee ? 'Create Task' : 'Assign Task'));

  const toggleEmployeeSelect = (empId: string) => {
    if (!empId) return;
    setSelectedEmployeeIds(prev => {
      if (prev.includes(empId)) return prev.filter(id => id !== empId);
      return [...prev, empId];
    });
    setFieldErrors(prev => ({ ...prev, employees: undefined }));
    setEmployeeSearch('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitLockRef.current || isSubmitting) return;

    const trimmedTitle = hideTitleField ? '' : title.trim();
    const selectedItems = projectTaskOptions
      .filter(item => selectedRemarkKeys.includes(item.key))
      .map(item => ({ ...item, requirement: (taskRequirements[item.key] || '').trim() }));
    const nextErrors: { title?: string; projectId?: string; employees?: string; projectTasks?: string } = {};

    if (!projectId) nextErrors.projectId = 'Please select a Project.';
    if (!isEmployee && selectedEmployeeIds.length === 0) nextErrors.employees = 'Please select at least one employee.';
    if (task || isEmployee) {
      if (!trimmedTitle) nextErrors.title = 'Task Title is required.';
    } else if (selectedItems.length === 0 && !trimmedTitle) {
      if (hideTitleField) {
        nextErrors.projectTasks = 'Please select at least one project task.';
      } else {
        nextErrors.title = 'Task Title is required.';
      }
    }

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setError(nextErrors.projectId || nextErrors.projectTasks || nextErrors.title || nextErrors.employees || 'Please complete the required fields.');
      return;
    }

    setError('');
    submitLockRef.current = true;
    setIsSubmitting(true);
    try {
      await onSave({
        title: trimmedTitle,
        description: description.trim(),
        projectId,
        priority: isEmployee ? 'Self' : priority,
        assignedEmployeeIds: isEmployee && user?.id ? [user.id] : Array.from(new Set(selectedEmployeeIds)),
        reminderDate: reminderDate || undefined,
        dueDate: reminderDate || undefined,
        parentTaskId: !isEmployee && parentTaskId ? parentTaskId : undefined,
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
    `w-full px-3.5 py-2.5 bg-slate-50 border rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:bg-white transition ${
      hasError ? 'border-rose-400 focus:ring-rose-500' : 'border-slate-300 focus:ring-[#2563EB]'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-3 sm:p-4">
      <div className="my-auto flex w-full max-w-2xl max-h-[calc(100vh-1.5rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[min(90vh,calc(100vh-2rem))]">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
          <div>
            <h3 className="text-lg font-bold text-slate-800">{heading}</h3>
            <p className="mt-1 text-xs font-medium text-slate-500">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 sm:px-6">
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">
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
                    setParentTaskId('');
                    if (fieldErrors.projectId) setFieldErrors(prev => ({ ...prev, projectId: undefined, projectTasks: undefined }));
                  }}
                  className={inputClass(fieldErrors.projectId)}
                >
                  <option value="">{projects.length === 0 ? 'No projects available' : '-- Select Project --'}</option>
                  {projects.map(p => {
                    const id = projectKey(p);
                    return (
                      <option key={id} value={id}>
                        {p.projectName} ({p.projectNumber})
                      </option>
                    );
                  })}
                </select>
              )}
              {projects.length === 0 && !dataLoading && (
                <p className="mt-1 text-[11px] font-semibold text-amber-600">No projects available</p>
              )}
              {fieldErrors.projectId && <p className="mt-1 text-[11px] font-semibold text-rose-600">{fieldErrors.projectId}</p>}
            </div>

            {showProjectTaskList && projectId && (
              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
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
                {projectTaskOptions.length === 0 ? (
                  <p className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-slate-500">
                    No saved tasks for this project yet. Add tasks to this project from the Projects page first.
                  </p>
                ) : (
                  <div className={`max-h-96 space-y-1 overflow-y-auto rounded-lg border bg-white p-2 ${fieldErrors.projectTasks ? 'border-rose-400' : 'border-slate-300'}`}>
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
                            <span className="block font-semibold">{item.title}</span>
                            {item.date && (
                              <span className="block text-[11px] font-medium text-slate-500">{item.date}</span>
                            )}
                          </span>
                        </label>
                        {checked && (
                          <div className="px-2 pb-2 pl-8">
                            <label className="mb-1 block text-[11px] font-semibold text-slate-600">
                              Requirement for {item.title}
                            </label>
                            <textarea
                              value={taskRequirements[item.key] || ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                setTaskRequirements(prev => ({ ...prev, [item.key]: value }));
                              }}
                              rows={2}
                              placeholder={`What exactly needs to be done in ${item.title}?`}
                              className="w-full resize-y rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                            />
                          </div>
                        )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {fieldErrors.projectTasks && <p className="mt-1 text-[11px] font-semibold text-rose-600">{fieldErrors.projectTasks}</p>}
              </div>
            )}

            {!isEmployee && projectId && (
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Parent Task (optional)
                </label>
                <select
                  value={parentTaskId}
                  onChange={(e) => setParentTaskId(e.target.value)}
                  className={inputClass()}
                >
                  <option value="">-- None (top-level task) --</option>
                  {parentTaskOptions.map(item => {
                    const id = String(item.id || item._id || '');
                    return (
                      <option key={id} value={id}>
                        {item.title}
                      </option>
                    );
                  })}
                </select>
                <p className="mt-1 text-[11px] font-medium text-slate-500">
                  Optional: pick an existing main task to add the selected tasks under it.
                </p>
              </div>
            )}

            {!hideTitleField && (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                {showProjectTaskList ? 'Task Title' : 'Task Title *'}
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

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Priority *
              </label>
              {isEmployee ? (
                <input
                  type="text"
                  value="Self Defined"
                  disabled
                  className="w-full cursor-not-allowed rounded-lg border border-slate-300 bg-slate-100 px-3.5 py-2.5 text-sm font-semibold text-indigo-700"
                />
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {DIRECTOR_PRIORITIES.map(option => {
                    const selected = priority === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setPriority(option.value)}
                        className={`rounded-lg border px-2.5 py-2 text-xs font-bold transition ${
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
              )}
            </div>

            {!isEmployee && (
              <div ref={employeeMenuRef}>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Assign Employees *
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

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                {showProjectTaskList ? 'Common Description (optional)' : 'Task Description'}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder={showProjectTaskList ? 'Used for selected tasks that have no requirement written above' : 'Enter task details...'}
                className={`${inputClass()} min-h-[96px] resize-y`}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Due Date / Reminder Date (Optional)
              </label>
              <input
                type="date"
                value={reminderDate}
                onChange={(e) => setReminderDate(e.target.value)}
                className={inputClass()}
              />
            </div>
          </div>

          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:gap-3 sm:px-6">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-[#2563EB] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {primaryLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskModal;
