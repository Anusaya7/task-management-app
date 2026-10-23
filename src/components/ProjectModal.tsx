'use client'

import React, { useState, useEffect } from 'react';
import { Project, ProjectRemark, ProjectStatus } from '../types';
import { X, AlertCircle } from 'lucide-react';
import { normalizeProjectStatus } from '@/lib/projectStatus';

interface ProjectModalProps {
  project?: Project | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (projectData: any) => Promise<void>;
  onDelete?: (projectId: string) => void;
  users?: any[];
  onCommentAdded?: (projectId: string, comment: any) => void;
}

const PROJECT_STATUSES: ProjectStatus[] = ['Ongoing', 'Upcoming', 'Sleeping (On Hold)', 'Completed'];

const ProjectModal: React.FC<ProjectModalProps> = ({
  project,
  isOpen,
  onClose,
  onSave
}) => {
  const [projectName, setProjectName] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [newRemark, setNewRemark] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('Upcoming');
  const [remarks, setRemarks] = useState<ProjectRemark[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const todayKolkata = () => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());

  const toDateInputValue = (value?: string) => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    if (value) {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).format(parsed);
      }
    }
    return todayKolkata();
  };

  useEffect(() => {
    if (!isOpen) return;

    if (project) {
      setProjectName(project.projectName || (project as any).name || '');
      setLocation(project.location || '');
      setDescription(project.description || '');
      setStartDate(project.startDate ? toDateInputValue(project.startDate) : '');
      setNewRemark('');
      setStatus(normalizeProjectStatus(project.status));
      setRemarks((project.projectRemarks || []).map((item) => ({
        _id: item._id,
        date: toDateInputValue(item.date),
        remark: item.remark,
        createdBy: item.createdBy
      })));
    } else {
      setProjectName('');
      setLocation('');
      setDescription('');
      setStartDate(todayKolkata());
      setNewRemark('');
      setStatus('Upcoming');
      setRemarks([]);
    }
    setError('');
  }, [isOpen, project?.id || (project as any)?._id]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!projectName.trim()) {
      setError('Project Name is required.');
      return;
    }
    if (!description.trim()) {
      setError('Project Description is required.');
      return;
    }
    if (!location.trim()) {
      setError('Project Location is required.');
      return;
    }

    const allRemarks = remarks
      .map((item) => ({
        ...item,
        date: toDateInputValue(item.date),
        remark: (item.remark || '').trim()
      }))
      .filter((item) => item.remark);

    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        projectName: projectName.trim(),
        projectNumber: project?.projectNumber || undefined,
        location: location.trim(),
        description: description.trim(),
        startDate,
        status,
        projectRemarks: allRemarks,
        ...(project ? { newRemark: newRemark.trim() } : { initialRemark: description.trim() })
      };
      const existingId = project?.id || project?._id;
      if (existingId) payload.id = existingId;
      await onSave(payload);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save project');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="flex max-h-[90vh] min-h-[min(580px,calc(100dvh-2rem))] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-[#25527a] bg-[#25527a] px-5 py-3 sm:px-6">
          <h3 className="text-lg font-bold text-white">
            {project ? 'Edit Project' : 'New Project (pop-up window)'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-white/90 transition hover:bg-white/10 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-600">
                Project name *
                <input
                  type="text"
                  value={projectName}
                  onChange={event => setProjectName(event.target.value)}
                  placeholder="Project name"
                  required
                  className="mt-1 w-full rounded-lg border border-red-500 bg-white px-2 py-2 text-sm font-normal text-red-600 placeholder:text-red-400 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </label>

              <label className="block text-sm font-semibold text-slate-600">
                Location *
                <input
                  type="text"
                  value={location}
                  onChange={event => setLocation(event.target.value)}
                  placeholder="Project location"
                  required
                  className="mt-1 w-full rounded-lg border border-red-500 bg-white px-2 py-2 text-sm font-normal text-red-600 placeholder:text-red-400 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </label>

              <label className="block text-sm font-semibold text-slate-600">
                Status *
                <select
                  value={status}
                  onChange={event => setStatus(event.target.value as ProjectStatus)}
                  className="mt-1 w-full rounded-lg border border-red-500 bg-white px-2 py-2 text-sm font-normal text-red-600 focus:outline-none focus:ring-1 focus:ring-red-500"
                >
                  {PROJECT_STATUSES.map(value => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-semibold text-slate-600">
                Start date
                <input
                  type="date"
                  value={startDate}
                  onChange={event => setStartDate(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-red-500 bg-white px-2 py-2 text-sm font-normal text-red-600 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </label>

              <label className="block text-sm font-semibold text-slate-600 sm:col-span-1">
                Description / first comment *
                <input
                  type="text"
                  value={description}
                  onChange={event => setDescription(event.target.value)}
                  placeholder="Project description (this is also the first comment)"
                  required
                  className="mt-1 w-full rounded-lg border border-red-500 bg-white px-2 py-2 text-sm font-normal text-red-600 placeholder:text-red-400 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </label>

              {project && (
                <div className="space-y-3 sm:col-span-2">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-600">Date-wise Remarks</h4>
                    {remarks.length > 0 ? (
                      <ol className="mt-2 max-h-32 space-y-2 overflow-y-auto">
                        {remarks.map((remark, index) => (
                          <li key={remark._id || `${remark.date}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                            <p className="text-[11px] font-semibold text-slate-500">{remark.date}</p>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{remark.remark}</p>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="mt-2 text-xs text-slate-500">No dated remarks recorded.</p>
                    )}
                  </div>
                  <label className="block text-sm font-semibold text-slate-600">
                    Add Today&apos;s Remark
                    <textarea
                      value={newRemark}
                      onChange={event => setNewRemark(event.target.value)}
                      rows={2}
                      placeholder="Add a dated project update"
                      className="mt-1 w-full rounded-lg border border-red-500 bg-white px-2 py-2 text-sm font-normal text-red-600 placeholder:text-red-400 focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </label>
                </div>
              )}
            </div>

          </div>

          <div className="flex shrink-0 flex-col gap-2 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:px-7">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-[#16A34A] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#15803D] disabled:cursor-not-allowed disabled:opacity-60 sm:w-[334px]"
            >
              {isSubmitting ? 'Saving...' : 'Save Project'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-slate-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-600 sm:w-[158px]"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProjectModal;
