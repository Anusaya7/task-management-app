'use client'

import React, { useState } from 'react';
import { Edit, Eye, Trash2, Plus, Download } from 'lucide-react';
import { Project, User, Employee, ProjectRemark, ProjectStatus } from '../types';
import ProjectModal from './ProjectModal';
import { useAuth } from '../contexts/AuthContext';
import { CodeBadge, ProjectStatusBadge } from './BadgeUtils';
import { normalizeProjectStatus } from '@/lib/projectStatus';

interface ProjectListProps {
  projects: Project[];
  users: (User | Employee)[];
  onProjectSave: (project: Project) => void | Promise<void>;
  onProjectDelete: (projectId: string) => void;
  onProjectComplete?: (project: Project) => void;
  onCommentAdded?: (projectId: string, comment: any) => void;
  statusFilter?: string;
  onStatusFilterChange?: (status: string) => void;
}

const PROJECT_STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Projects' },
  { value: 'Ongoing', label: 'Ongoing' },
  { value: 'Upcoming', label: 'Upcoming' },
  { value: 'Sleeping (On Hold)', label: 'On Hold / Sleeping' },
  { value: 'Completed', label: 'Completed' }
];

const PROJECT_BOARD_STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: 'Ongoing', label: 'Ongoing' },
  { value: 'Upcoming', label: 'Upcoming' },
  { value: 'Sleeping (On Hold)', label: 'On Hold' },
  { value: 'Completed', label: 'Completed' }
];

const ProjectList: React.FC<ProjectListProps> = ({
  projects,
  users,
  onProjectSave,
  onProjectDelete,
  onProjectComplete,
  onCommentAdded,
  statusFilter,
  onStatusFilterChange
}) => {
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'view' | 'edit'>('create');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [savingStatusProjectId, setSavingStatusProjectId] = useState<string | null>(null);
  const [statusSaveError, setStatusSaveError] = useState('');

  const handleCreateProject = () => {
    setSelectedProject(null);
    setModalMode('create');
    setIsModalOpen(true);
  };

  const handleViewProject = (project: Project) => {
    setSelectedProject(project);
    setModalMode('view');
    setIsModalOpen(true);
  };

  const handleEditProject = (project: Project) => {
    setSelectedProject(project);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleDeleteProject = (projectId: string) => {
    onProjectDelete(projectId);
  };

  const handleProjectSave = async (project: Project) => {
    try {
      await onProjectSave(project);
      setIsModalOpen(false);
    } catch (error: any) {
      console.error('Error saving project:', error);
      // Keep modal open if there's an error
    }
  };

  const handleBoardStatusChange = async (project: Project, status: ProjectStatus) => {
    const id = String(project.id || project._id || '');
    if (!id || normalizeProjectStatus(project.status) === status || savingStatusProjectId) return;

    setSavingStatusProjectId(id);
    setStatusSaveError('');
    try {
      await onProjectSave({ ...project, status });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update project status.';
      console.error('Error updating project status:', error);
      setStatusSaveError(`${project.projectName || project.projectNumber}: ${message}`);
    } finally {
      setSavingStatusProjectId(null);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedProject(null);
  };

  const canCreateProject = user?.role === 'Director';
  const canEditProject = user?.role === 'Director';
  const canDeleteProject = user?.role === 'Director';
  const isDirector = user?.role === 'Director';

  const selectedBoardProject = projects.find(
    project => String(project.id || project._id) === selectedProjectId
  );
  const visibleBoardProjects = projects.filter(project => {
    if (!statusFilter || statusFilter === 'all') return true;
    if (statusFilter === 'Ongoing') return normalizeProjectStatus(project.status) === 'Ongoing';
    return normalizeProjectStatus(project.status) === statusFilter;
  });

  const formatLatestRemark = (project: Project) => {
    const latestRemark = (project.projectRemarks || []).reduce<ProjectRemark | undefined>((latest, remark) => {
      return !latest || remark.date >= latest.date ? remark : latest;
    }, undefined);

    if (!latestRemark) return '-';
    const date = /^\d{4}-\d{2}-\d{2}$/.test(latestRemark.date)
      ? new Date(`${latestRemark.date}T00:00:00.000Z`)
      : new Date(latestRemark.date);
    const formattedDate = Number.isNaN(date.getTime())
      ? latestRemark.date
      : new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(date);
    return `${formattedDate}: ${latestRemark.remark}`;
  };

  if (isDirector) {
    return (
      <>
        <section className="space-y-4" aria-labelledby="director-project-board-title">
          <div>
            <h2 id="director-project-board-title" className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight">
              Project Board
            </h2>
          </div>

          <div className="overflow-x-auto border border-[#CBD5E1] bg-white shadow-xs">
            <table className="w-full min-w-[720px] table-fixed border-collapse text-left text-xs text-[#172033]">
              <colgroup>
                <col className="w-[6%]" />
                <col className="w-[24%]" />
                <col className="w-[20%]" />
                <col className="w-[18%]" />
                <col className="w-[32%]" />
              </colgroup>
              <thead>
                <tr className="bg-[#2D3A4B] text-white">
                  <th scope="col" className="border-r border-[#3D4C5E] px-3 py-2.5 text-center">
                    <input
                      type="checkbox"
                      aria-label="Select project"
                      checked={visibleBoardProjects.length > 0 && selectedProjectId === String(visibleBoardProjects[0].id || visibleBoardProjects[0]._id)}
                      onChange={e => {
                        if (e.target.checked && visibleBoardProjects.length > 0) {
                          setSelectedProjectId(String(visibleBoardProjects[0].id || visibleBoardProjects[0]._id));
                        } else {
                          setSelectedProjectId('');
                        }
                      }}
                      className="h-3.5 w-3.5 rounded border border-slate-400 accent-[#2563EB] cursor-pointer"
                    />
                  </th>
                  <th scope="col" className="border-r border-[#3D4C5E] px-3 py-2.5 font-bold">
                    Project
                  </th>
                  <th scope="col" className="border-r border-[#3D4C5E] px-3 py-2.5 font-bold">
                    Location
                  </th>
                  <th scope="col" className="border-r border-[#3D4C5E] px-3 py-2.5 font-bold">
                    <div className="relative inline-flex items-center gap-1">
                      <select
                        aria-label="Filter by project status"
                        value={statusFilter || 'all'}
                        onChange={e => onStatusFilterChange?.(e.target.value)}
                        className="cursor-pointer appearance-none bg-transparent pr-4 font-bold text-white outline-none focus:ring-0"
                      >
                        <option value="all" className="bg-[#2D3A4B] text-white">Status (All)</option>
                        <option value="Ongoing" className="bg-[#2D3A4B] text-white">Status: Ongoing</option>
                        <option value="Upcoming" className="bg-[#2D3A4B] text-white">Status: Upcoming</option>
                        <option value="Sleeping (On Hold)" className="bg-[#2D3A4B] text-white">Status: On Hold</option>
                        <option value="Completed" className="bg-[#2D3A4B] text-white">Status: Completed</option>
                      </select>
                      <span className="pointer-events-none absolute right-0 text-[10px]">▼</span>
                    </div>
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-bold">
                    Latest remark
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleBoardProjects.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="h-32 px-4 text-center text-sm text-slate-400">
                      {projects.length === 0 ? 'No projects found.' : 'No projects match this status.'}
                    </td>
                  </tr>
                ) : (
                  visibleBoardProjects.map((project, index) => {
                    const id = String(project.id || project._id || '');
                    const isChecked = selectedProjectId === id;
                    const normalizedStatus = normalizeProjectStatus(project.status);

                    return (
                      <tr
                        key={id || project.projectNumber}
                        onClick={() => setSelectedProjectId(isChecked ? '' : id)}
                        className={`cursor-pointer border-t border-[#E2E8F0] transition-colors ${
                          isChecked ? 'bg-blue-50/70' : index % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'
                        } hover:bg-slate-50`}
                      >
                        <td className="border-r border-[#E2E8F0] px-3 py-2.5 text-center" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => setSelectedProjectId(isChecked ? '' : id)}
                            className="h-3.5 w-3.5 rounded border border-slate-400 accent-[#2563EB] cursor-pointer"
                          />
                        </td>
                        <td className="border-r border-[#E2E8F0] px-3 py-2.5 font-medium text-[#1E293B]">
                          {project.projectName || project.projectNumber}
                        </td>
                        <td className="border-r border-[#E2E8F0] px-3 py-2.5 text-[#1E293B]">
                          {project.location || '-'}
                        </td>
                        <td className="border-r border-[#E2E8F0] px-3 py-2.5 text-[#1E293B]">
                          {normalizedStatus}
                        </td>
                        <td className="px-3 py-2.5 text-[#1E293B]">
                          {formatLatestRemark(project)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Action Buttons: Add New Project (Green) & Edit Project (Red) */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleCreateProject}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-[#16A34A] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[#15803D] shadow-xs cursor-pointer"
            >
              + Add New Project
            </button>
            <button
              type="button"
              onClick={() => {
                const target = selectedBoardProject || visibleBoardProjects[0];
                if (target) {
                  handleEditProject(target);
                } else {
                  handleCreateProject();
                }
              }}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-[#DC2626] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[#B91C1C] shadow-xs cursor-pointer"
            >
              + Edit Project
            </button>
          </div>

        </section>

        <ProjectModal
          project={modalMode === 'create' ? null : selectedProject}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSave={handleProjectSave}
          onDelete={canDeleteProject ? handleDeleteProject : undefined}
          users={users}
          onCommentAdded={onCommentAdded}
        />
      </>
    );
  }

  const getStatusColor = (status: Project['status']) => {
    switch (status) {
      case 'Current':
      case 'Ongoing': return 'bg-green-100 text-green-800';
      case 'Upcoming': return 'bg-blue-100 text-blue-800';
      case 'Sleeping (On Hold)': return 'bg-yellow-100 text-yellow-800';
      case 'Completed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress === 100) return 'bg-green-500';
    if (progress >= 75) return 'bg-blue-500';
    if (progress >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const exportProjects = () => {
    const csvContent = [
      ['Project Name', 'Project Number', 'Location', 'Contact Details', 'Status', 'Description'],
      ...projects.map(project => [
        project.projectName,
        project.projectNumber,
        project.location,
        project.contactDetails || '',
        normalizeProjectStatus(project.status),
        project.description
      ])
    ].map(row => row.map(field => `"${field}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'projects.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div style={{
      backgroundColor: '#ffffff',
      borderRadius: '8px',
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid #e5e7eb'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <h2 style={{
              fontSize: '20px',
              fontWeight: '600',
              color: '#111827',
              margin: 0
            }}>
              Projects
            </h2>
            <p style={{
              fontSize: '14px',
              color: '#6b7280',
              marginTop: '4px',
              margin: 0
            }}>
              {user?.role === 'Director' ? 'Full access - Create, Edit, Delete' :
                user?.role === 'Project Head' ? 'Create & Edit access' :
                  'View only - Employee access'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            {onStatusFilterChange && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                Project Status:
                <select
                  value={statusFilter || 'all'}
                  onChange={(e) => onStatusFilterChange(e.target.value)}
                  style={{
                    padding: '7px 10px',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#334155',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  {PROJECT_STATUS_FILTER_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            )}
            <button
              onClick={exportProjects}
              style={{
                padding: '8px 16px',
                color: '#374151',
                backgroundColor: '#f3f4f6',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                transition: 'background-color 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '14px',
                fontWeight: '500'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#e5e7eb';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#f3f4f6';
              }}
            >
              <Download size={16} />
              Export
            </button>
            {canCreateProject && (
              <button
                onClick={handleCreateProject}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#1d4ed8';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#2563eb';
                }}
              >
                <Plus size={16} />
                New Project
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Projects Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{
          minWidth: '100%',
          borderCollapse: 'separate',
          borderSpacing: 0
        }}>
          <thead style={{ backgroundColor: '#f9fafb' }}>
            <tr>
              <th style={{
                padding: '12px 24px',
                textAlign: 'left',
                fontSize: '12px',
                fontWeight: '500',
                color: '#6b7280',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                borderBottom: '1px solid #e5e7eb'
              }}>
                Project Name
              </th>
              <th style={{
                padding: '12px 24px',
                textAlign: 'left',
                fontSize: '12px',
                fontWeight: '500',
                color: '#6b7280',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                borderBottom: '1px solid #e5e7eb'
              }}>
                Project Number
              </th>
              <th style={{
                padding: '12px 24px',
                textAlign: 'left',
                fontSize: '12px',
                fontWeight: '500',
                color: '#6b7280',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                borderBottom: '1px solid #e5e7eb'
              }}>
                Project Description (in short)
              </th>
              <th style={{
                padding: '12px 24px',
                textAlign: 'left',
                fontSize: '12px',
                fontWeight: '500',
                color: '#6b7280',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                borderBottom: '1px solid #e5e7eb'
              }}>
                Location
              </th>
              <th style={{
                padding: '12px 24px',
                textAlign: 'left',
                fontSize: '12px',
                fontWeight: '500',
                color: '#6b7280',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                borderBottom: '1px solid #e5e7eb'
              }}>
                Status
              </th>
              <th style={{
                padding: '12px 24px',
                textAlign: 'left',
                fontSize: '12px',
                fontWeight: '500',
                color: '#6b7280',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                borderBottom: '1px solid #e5e7eb'
              }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody style={{ backgroundColor: '#ffffff' }}>
            {projects.length === 0 ? (
              <tr>
                <td colSpan={6} style={{
                  padding: '48px 24px',
                  textAlign: 'center',
                  color: '#6b7280'
                }}>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>📁</div>
                  <p style={{ margin: 0, fontSize: '16px' }}>No projects found</p>
                  {canCreateProject && (
                    <button
                      onClick={handleCreateProject}
                      style={{
                        marginTop: '12px',
                        padding: '8px 16px',
                        backgroundColor: '#2563eb',
                        color: '#ffffff',
                        borderRadius: '8px',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s ease',
                        fontSize: '14px',
                        fontWeight: '500'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = '#1d4ed8';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = '#2563eb';
                      }}
                    >
                      Create Your First Project
                    </button>
                  )}
                  {!canCreateProject && (
                    <p style={{
                      fontSize: '14px',
                      color: '#6b7280',
                      marginTop: '8px',
                      margin: 0
                    }}>
                      Only Directors can create new projects
                    </p>
                  )}
                </td>
              </tr>
            ) : (
              projects.map((project) => (
                <tr key={project.id || project._id} style={{
                  borderBottom: '1px solid #e5e7eb',
                  transition: 'background-color 0.2s ease',
                  backgroundColor: '#ffffff'
                }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f9fafb';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#ffffff';
                  }}>
                  {/* Project Name */}
                  <td style={{
                    padding: '16px 24px',
                    whiteSpace: 'nowrap'
                  }}>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#111827'
                    }}>
                      <CodeBadge code={project.projectCode} />
                      {(() => {
                        const name = project.projectName || (project as any).name || '';
                        const code = String(project.projectCode || '');
                        if (!name) return code ? null : '-';
                        if (code && name.replace(/[^a-z0-9]/gi, '').toLowerCase() === code.replace(/[^a-z0-9]/gi, '').toLowerCase()) {
                          return null;
                        }
                        return name;
                      })()}
                    </div>
                  </td>
                  {/* Project Number */}
                  <td style={{
                    padding: '16px 24px',
                    whiteSpace: 'nowrap'
                  }}>
                    <div style={{
                      fontSize: '14px',
                      color: '#111827'
                    }}>
                      {project.projectNumber || '-'}
                    </div>
                  </td>
                  {/* Project Description (in short) */}
                  <td style={{
                    padding: '16px 24px',
                    whiteSpace: 'normal',
                    maxWidth: '400px'
                  }}>
                    <div style={{
                      fontSize: '14px',
                      color: '#6b7280',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      lineHeight: '1.4'
                    }}>
                      {project.description || '-'}
                    </div>
                  </td>
                  {/* Location */}
                  <td style={{
                    padding: '16px 24px',
                    whiteSpace: 'nowrap'
                  }}>
                    <div style={{
                      fontSize: '14px',
                      color: '#111827'
                    }}>
                      {project.location || '-'}
                    </div>
                  </td>
                  <td style={{
                    padding: '16px 24px',
                    whiteSpace: 'nowrap'
                  }}>
                    <ProjectStatusBadge status={normalizeProjectStatus(project.status)} />
                  </td>
                  <td style={{
                    padding: '16px 24px',
                    whiteSpace: 'nowrap',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button
                        onClick={() => handleViewProject(project)}
                        style={{
                          color: '#2563eb',
                          backgroundColor: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '4px',
                          borderRadius: '4px',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.color = '#1d4ed8';
                          e.currentTarget.style.backgroundColor = '#dbeafe';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.color = '#2563eb';
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                        title="View Project"
                      >
                        <Eye size={16} />
                      </button>
                      {/* Show Edit button for Directors and Project Heads */}
                      {canEditProject && (project.id || project._id) && (
                        <button
                          onClick={() => handleEditProject(project)}
                          style={{
                            color: '#16a34a',
                            backgroundColor: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.color = '#15803d';
                            e.currentTarget.style.backgroundColor = '#dcfce7';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.color = '#16a34a';
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                          title="Edit Project"
                        >
                          <Edit size={16} />
                        </button>
                      )}
                      {/* Show Complete button for Directors and Project Heads */}
                      {canEditProject && (project.id || project._id) && onProjectComplete && project.status !== 'Completed' && (
                        <button
                          onClick={() => onProjectComplete(project)}
                          style={{
                            color: '#15803d',
                            backgroundColor: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.color = '#166534';
                            e.currentTarget.style.backgroundColor = '#dcfce7';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.color = '#15803d';
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                          title="Mark as Completed"
                        >
                          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                      )}
                      {/* Show Delete button for Directors only */}
                      {canDeleteProject && (project.id || project._id) && (
                        <button
                          onClick={() => handleDeleteProject((project.id || project._id)!)}
                          style={{
                            color: '#dc2626',
                            backgroundColor: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.color = '#922d2dff';
                            e.currentTarget.style.backgroundColor = '#fecaca';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.color = '#dc2626';
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                          title="Delete Project"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                      {/* Show View Only for non-Director/Project Head users */}
                      {!canEditProject && !canDeleteProject && (
                        <span style={{
                          fontSize: '12px',
                          color: '#9ca3af',
                          padding: '4px 8px',
                          backgroundColor: '#f3f4f6',
                          borderRadius: '4px'
                        }}>
                          View Only
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Project Modal */}
      <ProjectModal
        project={modalMode === 'create' ? null : selectedProject}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleProjectSave}
        onDelete={canDeleteProject ? handleDeleteProject : undefined}
        users={users}
        onCommentAdded={onCommentAdded}
      />
    </div>
  );
};

export default ProjectList;
