'use client'

import React, { useState, useEffect } from 'react';
import { Project, ProjectRemark, ProjectStatus } from '../types';
import { X, Save, AlertCircle } from 'lucide-react';
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
  const [projectNumber, setProjectNumber] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [contactDetails, setContactDetails] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('Ongoing');
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
      setProjectNumber(project.projectNumber || '');
      setLocation(project.location || '');
      setDescription(project.description || '');
      setContactDetails(project.contactDetails || '');
      setStatus(normalizeProjectStatus(project.status));
      setRemarks((project.projectRemarks || []).map((item) => ({
        _id: item._id,
        date: toDateInputValue(item.date),
        remark: item.remark,
        createdBy: item.createdBy
      })));
    } else {
      setProjectName('');
      setProjectNumber('');
      setLocation('');
      setDescription('');
      setContactDetails('');
      setStatus('Ongoing');
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
    if (!projectNumber.trim()) {
      setError('Project Number is required.');
      return;
    }
    if (!description.trim()) {
      setError('Project Description is required.');
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
        projectNumber: projectNumber.trim(),
        location: location.trim(),
        description: description.trim(),
        contactDetails: contactDetails.trim(),
        status,
        projectRemarks: allRemarks
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
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto border border-slate-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
          <h3 className="text-lg font-bold text-slate-800">
            {project ? 'Edit Project' : 'Create New Project'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
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

          {/* 1. Project Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              1. Project Name *
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. Commercial Complex - Tower A"
              required
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* 2. Project Number */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                2. Project Number *
              </label>
              <input
                type="text"
                value={projectNumber}
                onChange={(e) => setProjectNumber(e.target.value)}
                placeholder="e.g. 2026-001"
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Lifecycle Status Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Project Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
              >
                {PROJECT_STATUSES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. Location */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              3. Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Mumbai, Maharashtra"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* 4. Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              4. Project Description *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Enter comprehensive project scope..."
              required
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {project && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                5. Contact Details
              </label>
              <input
                type="text"
                value={contactDetails}
                onChange={(e) => setContactDetails(e.target.value)}
                placeholder="Client Contact / Phone / Email"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          {/* Action Buttons */}
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
              <span>{isSubmitting ? 'Saving...' : 'Save Project'}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default ProjectModal;
