'use client'

import React, { useState, useEffect } from 'react';
import { Task, Project, Employee, TaskPriority } from '../types';
import { X, Save, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface TaskModalProps {
  task?: Task | null;
  projects: Project[];
  employees: Employee[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (taskData: any) => Promise<void>;
}

const PRIORITIES: TaskPriority[] = ['Urgent', 'Medium', 'Low', 'Self', 'Daily'];

const TaskModal: React.FC<TaskModalProps> = ({
  task,
  projects,
  employees,
  isOpen,
  onClose,
  onSave
}) => {
  const { user, isDirector, isProjectHead, isEmployee } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [reminderDate, setReminderDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setProjectId(task.projectId || '');
      setPriority(task.priority || 'Medium');
      setSelectedEmployeeIds(task.assignedEmployeeIds || []);
      setReminderDate(task.reminderDate ? task.reminderDate.substring(0, 10) : '');
    } else {
      setTitle('');
      setDescription('');
      setProjectId(projects.length > 0 ? (projects[0].id || projects[0]._id || '') : '');
      setPriority(isEmployee ? 'Self' : 'Medium');
      setSelectedEmployeeIds(isEmployee && user?.id ? [user.id] : []);
      setReminderDate('');
    }
    setError('');
  }, [task, isOpen, isEmployee, user, projects]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Task Title is required.');
      return;
    }
    if (!projectId) {
      setError('Please select a Project.');
      return;
    }
    if (selectedEmployeeIds.length === 0 && !isEmployee) {
      setError('Please assign at least one employee.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || title.trim(),
        projectId,
        priority: isEmployee ? 'Self' : priority,
        assignedEmployeeIds: isEmployee && user?.id ? [user.id] : selectedEmployeeIds,
        reminderDate: reminderDate || undefined
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save task');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleEmployeeSelect = (empId: string) => {
    if (selectedEmployeeIds.includes(empId)) {
      setSelectedEmployeeIds(selectedEmployeeIds.filter(id => id !== empId));
    } else {
      setSelectedEmployeeIds([...selectedEmployeeIds, empId]);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="text-lg font-bold text-slate-800">
            {task ? 'Edit Task' : (isEmployee ? 'Create Self Task' : 'Create New Task')}
          </h3>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {error && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Task Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Task Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Draw Ground Floor Plan"
              required
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
            />
          </div>

          {/* Project Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Project *
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
            >
              <option value="">-- Select Project --</option>
              {projects.map(p => (
                <option key={p.id || p._id} value={p.id || p._id}>
                  {p.projectName} ({p.projectNumber})
                </option>
              ))}
            </select>
          </div>

          {/* Priority Dropdown (Exact 5 Priorities) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Priority *
            </label>
            {isEmployee ? (
              <input
                type="text"
                value="Self"
                disabled
                className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-lg text-sm font-semibold text-indigo-700 cursor-not-allowed"
              />
            ) : (
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
              >
                {PRIORITIES.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            )}
          </div>

          {/* Assigned Employees (Multi-Select for Management) */}
          {!isEmployee && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Assign Employees *
              </label>
              <div className="max-h-36 overflow-y-auto bg-slate-50 border border-slate-300 rounded-lg p-2.5 space-y-1.5">
                {employees.map(emp => {
                  const empId = emp.id || emp._id || '';
                  const checked = selectedEmployeeIds.includes(empId);
                  return (
                    <label 
                      key={empId} 
                      className={`flex items-center gap-2.5 p-1.5 rounded cursor-pointer text-xs font-medium transition ${
                        checked ? 'bg-indigo-50 text-indigo-900 font-semibold' : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleEmployeeSelect(empId)}
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                      />
                      <span>{emp.firstName} {emp.lastName} ({emp.role})</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Task Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Enter detailed instructions or context..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
            />
          </div>

          {/* Reminder Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Reminder Date (Optional)
            </label>
            <input
              type="date"
              value={reminderDate}
              onChange={(e) => setReminderDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg shadow-sm transition disabled:opacity-60"
            >
              <Save size={16} />
              <span>{isSubmitting ? 'Saving...' : 'Save Task'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskModal;
