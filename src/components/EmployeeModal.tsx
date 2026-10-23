'use client'

import React, { useState, useEffect } from 'react';
import { Employee, EmployeeStatus, Project, UserRole } from '../types';
import { X, AlertCircle, Key, UserX } from 'lucide-react';

interface EmployeeModalProps {
  employee?: Employee | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (employeeData: any) => Promise<void>;
  onDelete?: (employeeId: string) => void;
  projects?: Project[];
  employees?: Employee[];
  tasks?: any[];
  preventDeactivation?: boolean;
}

const ROLES: UserRole[] = ['Director', 'Project Head', 'Employee'];
const STATUSES: EmployeeStatus[] = ['Active', 'Absent', 'Inactive'];
const inputClassName = 'w-full rounded-md border border-[#FF2B2B] bg-white px-2 py-2 text-sm text-[#FF2B2B] outline-none transition focus:ring-2 focus:ring-[#FF2B2B]/20';

const EmployeeModal: React.FC<EmployeeModalProps> = ({
  employee,
  isOpen,
  onClose,
  onSave,
  onDelete,
  projects = [],
  employees = [],
  preventDeactivation = false
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [joiningDate, setJoiningDate] = useState('');
  const [role, setRole] = useState<UserRole>('Employee');
  const [status, setStatus] = useState<EmployeeStatus>('Active');
  const [assignedProjects, setAssignedProjects] = useState<string[]>([]);
  const [assignedEmployees, setAssignedEmployees] = useState<string[]>([]);
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (employee) {
      setName(`${employee.firstName || ''} ${employee.lastName || ''}`.trim());
      setEmail(employee.email || '');
      setPhone(employee.phone || '');
      setJoiningDate(employee.joiningDate || '');
      setRole(employee.role || 'Employee');
      setStatus(employee.status || 'Active');
      setAssignedProjects(employee.assignedProjects || []);
      setAssignedEmployees(employee.assignedEmployees || []);
      setPassword('');
      setNewPassword('');
    } else {
      setName('');
      setEmail('');
      setPhone('');
      setJoiningDate(new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date()));
      setRole('Employee');
      setStatus('Active');
      setAssignedProjects([]);
      setAssignedEmployees([]);
      setPassword('password'); // Default initial password
      setNewPassword('');
    }
    setError('');
    setConfirmDeactivate(false);
  }, [isOpen, employee?.id || (employee as any)?._id]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !email.trim()) {
      setError('Name and Email are required.');
      return;
    }

    if (!employee && !password.trim()) {
      setError('Password is required for new employees.');
      return;
    }

    setIsSubmitting(true);
    try {
      const nameParts = name.trim().split(/\s+/);
      const unchangedName = employee &&
        name.trim() === `${employee.firstName || ''} ${employee.lastName || ''}`.trim();
      const payload: any = {
        id: employee?.id || employee?._id,
        firstName: unchangedName && employee ? employee.firstName : nameParts[0],
        lastName: unchangedName && employee ? employee.lastName : nameParts.slice(1).join(' '),
        email: email.trim(),
        phone: phone.trim(),
        joiningDate,
        role,
        status,
        ...(role === 'Project Head' ? { assignedProjects, assignedEmployees } : {})
      };

      if (!employee) {
        payload.password = password.trim();
      } else if (newPassword.trim()) {
        payload.newPassword = newPassword.trim();
      }

      await onSave(payload);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save employee');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeEmployees = employees.filter(
    candidate => candidate.role === 'Employee' && candidate.status === 'Active'
  );
  const toggleAssignment = (
    id: string,
    current: string[],
    setSelected: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setSelected(current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-700/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="employee-modal-title"
        className="flex h-[580px] max-h-[calc(100dvh-32px)] w-full max-w-[940px] flex-col overflow-hidden rounded-md bg-white shadow-2xl"
      >
        <div className="flex min-h-[49px] items-center justify-between bg-[#1F4E79] px-5 py-3">
          <h3 id="employee-modal-title" className="text-xl font-bold text-white">
          {employee ? 'Edit (pop-up window)' : 'New Employee (pop-up window)'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close employee form"
            className="rounded p-1 text-white transition hover:bg-white/10 focus-visible:outline-white"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-y-auto px-7 py-5">
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
            <div>
              <label htmlFor="employee-name" className="mb-1 block text-sm font-semibold text-[#334155]">Name *</label>
              <input
                id="employee-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className={inputClassName}
              />
            </div>
            <div>
              <label htmlFor="employee-role" className="mb-1 block text-sm font-semibold text-[#334155]">Role *</label>
              <select
                id="employee-role"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className={inputClassName}
              >
                {ROLES.map(r => (
                  <option key={r} value={r}>{r === 'Project Head' ? 'Project Co-ordinator' : r}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="employee-email" className="mb-1 block text-sm font-semibold text-[#334155]">Email *</label>
              <input
                id="employee-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={inputClassName}
              />
            </div>

            <div>
              <label htmlFor="employee-phone" className="mb-1 block text-sm font-semibold text-[#334155]">Phone</label>
              <input
                id="employee-phone"
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputClassName}
              />
            </div>

            <div>
              <label htmlFor="employee-status" className="mb-1 block text-sm font-semibold text-[#334155]">Status *</label>
              <select
                id="employee-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as EmployeeStatus)}
                className={inputClassName}
              >
                {STATUSES.map(s => (
                  <option key={s} value={s} disabled={s === 'Inactive' && preventDeactivation}>{s}</option>
                ))}
              </select>
              {preventDeactivation && (
                <p className="mt-1 text-xs text-slate-500">
                  Keep at least one Director account available.
                </p>
              )}
            </div>

            <div>
              <label htmlFor="employee-joining-date" className="mb-1 block text-sm font-semibold text-[#334155]">Joining date</label>
              <input
                id="employee-joining-date"
                type="date"
                value={joiningDate}
                onChange={event => setJoiningDate(event.target.value)}
                className={inputClassName}
              />
            </div>
          </div>

          {role === 'Project Head' && (
            <section className="space-y-4 rounded-lg border border-indigo-100 bg-indigo-50/60 p-4" aria-label="Project Head access">
              <div>
                <h4 className="text-sm font-bold text-slate-800">Project Head Access</h4>
                <p className="mt-1 text-xs text-slate-600">
                  Choose which projects this Project Head can manage and which active employees they can assign tasks to.
                </p>
              </div>
              <fieldset>
                <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Projects ({assignedProjects.length} selected)
                </legend>
                <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-slate-200 bg-white p-2">
                  {projects.length === 0 ? (
                    <p className="px-1 py-2 text-xs text-slate-500">Create projects before assigning access.</p>
                  ) : projects.map(project => {
                    const id = String(project.id || project._id || '');
                    if (!id) return null;
                    return (
                      <label key={id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1.5 text-xs text-slate-700 hover:bg-indigo-50">
                        <input
                          type="checkbox"
                          checked={assignedProjects.includes(id)}
                          onChange={() => toggleAssignment(id, assignedProjects, setAssignedProjects)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>{project.projectNumber} - {project.projectName}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <fieldset>
                <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Active Employees ({assignedEmployees.length} selected)
                </legend>
                <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-slate-200 bg-white p-2">
                  {activeEmployees.length === 0 ? (
                    <p className="px-1 py-2 text-xs text-slate-500">No active employees available.</p>
                  ) : activeEmployees.map(candidate => {
                    const id = String(candidate.id || candidate._id || '');
                    if (!id) return null;
                    return (
                      <label key={id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1.5 text-xs text-slate-700 hover:bg-indigo-50">
                        <input
                          type="checkbox"
                          checked={assignedEmployees.includes(id)}
                          onChange={() => toggleAssignment(id, assignedEmployees, setAssignedEmployees)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>{candidate.firstName} {candidate.lastName}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </section>
          )}

          {employee && (
            <details className="mt-4 border-t border-slate-200 pt-3">
              <summary className="cursor-pointer text-sm font-semibold text-[#334155]">Reset password</summary>
              <div className="relative mt-3">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Leave blank to keep current password"
                  aria-label="New password"
                  className={inputClassName}
                />
                <Key size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </details>
          )}

          <div className="mt-auto pt-5">
            <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center">
              {/* Deactivate (soft delete) — only for existing employees, with a two-step inline confirmation */}
              {employee && onDelete && (
                <div>
                  {confirmDeactivate ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-rose-700">Deactivate this account?</span>
                      <button
                        type="button"
                        onClick={() => {
                          const empId = String(employee.id || (employee as any)?._id || '');
                          if (!empId) return;
                          onDelete(empId);
                          onClose();
                        }}
                        className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
                      >
                        Yes, Deactivate
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeactivate(false)}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeactivate(true)}
                      disabled={preventDeactivation}
                      title={preventDeactivation ? 'At least one Director account must stay available.' : undefined}
                      className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
                    >
                      <UserX size={16} />
                      <span>Deactivate</span>
                    </button>
                  )}
                </div>
              )}
              <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-[46px] w-full rounded-md bg-[#16A34A] px-5 py-2 text-sm font-bold text-white transition hover:bg-[#13883f] disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 sm:max-w-[334px]"
                >
                  {isSubmitting ? 'Saving...' : 'Save Employee'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[46px] w-full rounded-md bg-[#64748B] px-5 py-2 text-sm font-bold text-white transition hover:bg-[#526176] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 sm:max-w-[158px]"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmployeeModal;
