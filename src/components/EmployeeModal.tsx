'use client'

import React, { useState, useEffect } from 'react';
import { Employee, EmployeeStatus, Project, UserRole } from '../types';
import { X, Save, AlertCircle, Key, UserX } from 'lucide-react';

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
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
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
      setFirstName(employee.firstName || '');
      setLastName(employee.lastName || '');
      setEmail(employee.email || '');
      setPhone(employee.phone || '');
      setRole(employee.role || 'Employee');
      setStatus(employee.status || 'Active');
      setAssignedProjects(employee.assignedProjects || []);
      setAssignedEmployees(employee.assignedEmployees || []);
      setPassword('');
      setNewPassword('');
    } else {
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
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

    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setError('First Name, Last Name, and Email are required.');
      return;
    }

    if (!employee && !password.trim()) {
      setError('Password is required for new employees.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        id: employee?.id || employee?._id,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
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
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="text-lg font-bold text-slate-800">
            {employee ? 'Edit Employee' : 'Add New Employee'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">

          {error && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">First Name *</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Last Name *</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Email Address *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Phone Number</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">System Role *</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {ROLES.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Status *</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as EmployeeStatus)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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

          {!employee ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Initial Password *</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Reset Password (Leave blank to keep current)
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <Key size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-200">
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
                      className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
                    >
                      Yes, Deactivate
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeactivate(false)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
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
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
                  >
                    <UserX size={16} />
                    <span>Deactivate</span>
                  </button>
                )}
              </div>
            )}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg shadow-sm transition disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              >
                <Save size={16} />
                <span>{isSubmitting ? 'Saving...' : 'Save Employee'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmployeeModal;
