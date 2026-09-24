'use client'

import React, { useState, useEffect } from 'react';
import { Project, ProjectStatus } from '../types';
import { X, Save, Plus, Trash2, AlertCircle } from 'lucide-react';
import { getTodayKolkata } from '@/lib/auth';

interface ProjectModalProps {
  project?: Project | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (projectData: any) => Promise<void>;
  onDelete?: (projectId: string) => void;
  users?: any[];
  onCommentAdded?: (projectId: string, comment: any) => void;
}

const PROJECT_STATUSES: ProjectStatus[] = ['Current', 'Upcoming', 'Sleeping (On Hold)', 'Completed'];

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
  const [status, setStatus] = useState<ProjectStatus>('Current');
  const [remarks, setRemarks] = useState<{ date: string; remark: string }[]>([]);
  const [newRemarkText, setNewRemarkText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (project) {
      setProjectName(project.projectName || (project as any).name || '');
      setProjectNumber(project.projectNumber || '');
      setLocation(project.location || '');
      setDescription(project.description || '');
      setContactDetails(project.contactDetails || '');
      setStatus(project.status || 'Current');
      setRemarks(project.projectRemarks || []);
    } else {
      setProjectName('');
      setProjectNumber('');
      setLocation('');
      setDescription('');
      setContactDetails('');
      setStatus('Current');
      setRemarks([]);
    }
    setNewRemarkText('');
    setError('');
  }, [project, isOpen]);

  if (!isOpen) return null;

  const handleAddRemark = () => {
    if (!newRemarkText.trim()) return;
    const todayStr = new Date().toISOString().substring(0, 10);
    setRemarks([...remarks, { date: todayStr, remark: newRemarkText.trim() }]);
    setNewRemarkText('');
  };

  const handleRemoveRemark = (index: number) => {
    setRemarks(remarks.filter((_, i) => i !== index));
  };

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

    setIsSubmitting(true);
    try {
      await onSave({
        id: project?.id || project?._id,
        projectName: projectName.trim(),
        projectNumber: projectNumber.trim(),
        location: location.trim(),
        description: description.trim(),
        contactDetails: contactDetails.trim(),
        status,
        projectRemarks: remarks
      });
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
            {project ? 'Edit Project Master' : 'Create New Master Project'}
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
                Project Status *
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

          {/* 5. Contact Details */}
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

          {/* 6. Date-wise Project Remarks Timeline */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              6. Project Remarks (Date-wise Timeline)
            </label>
            
            {remarks.length > 0 && (
              <div className="relative border-l-2 border-blue-500/40 ml-2 pl-4 space-y-3 mb-4">
                {remarks.map((r, idx) => (
                  <div key={idx} className="relative bg-slate-50/80 p-3 rounded-xl border border-slate-200 text-xs">
                    <span className="absolute -left-[21px] top-3.5 w-2.5 h-2.5 rounded-full bg-blue-600 ring-4 ring-white"></span>
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider">
                        {r.date}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveRemark(idx)}
                        className="text-slate-400 hover:text-rose-600 transition"
                        title="Delete remark"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <p className="text-slate-800 font-medium mt-1.5 leading-relaxed">{r.remark}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={newRemarkText}
                onChange={(e) => setNewRemarkText(e.target.value)}
                placeholder="Add new date-wise remark..."
                className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleAddRemark}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs rounded-lg flex items-center gap-1 shadow-xs"
              >
                <Plus size={14} />
                Add Remark
              </button>
            </div>
          </div>

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
              <span>{isSubmitting ? 'Saving...' : 'Save Master Project'}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default ProjectModal;
