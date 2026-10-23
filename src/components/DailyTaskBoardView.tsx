'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Task, DailyEntry } from '../types';
import { X, Plus, AlertCircle, Check } from 'lucide-react';

interface DailyTaskBoardViewProps {
  user: any;
  role: 'Director' | 'Project Head' | 'Employee';
  tasks: Task[];
  dailyEntries: DailyEntry[];
  initialCartIds?: string[];
  onCartChange?: (ids: string[]) => void;
  onRefresh?: () => Promise<void> | void;
  showToast?: (type: 'success' | 'error', message: string) => void;
}

interface RowEdit {
  comment: string;
  hours: string;
  flagged: boolean;
}

export const taskKey = (task: { id?: string; _id?: string }): string =>
  String(task.id || task._id || '');

const getCurrentKolkataDate = (): string => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
};

const formatCommentDate = (dateStr: string, createdAt?: Date | string): string => {
  const d = createdAt ? new Date(createdAt) : new Date(`${String(dateStr || '').substring(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr || '-';
  const day = d.getDate();
  const suffix = ['th', 'st', 'nd', 'rd'][(day % 10 > 3 || Math.floor((day % 100) / 10) === 1) ? 0 : day % 10];
  const month = d.toLocaleDateString('en-GB', { month: 'short' });
  const time = createdAt ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '';
  return `${day}${suffix} ${month}${time ? `, ${time}` : ''}`;
};

const formatHoursDisplay = (hours: number): string => {
  if (!hours || hours <= 0) return '-';
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
};

export const getShortName = (name?: string, fallback = 'User'): string => {
  const parts = (name || fallback).trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0] || fallback;
};


export default function DailyTaskBoardView({
  user,
  role,
  tasks = [],
  dailyEntries = [],
  initialCartIds = [],
  onCartChange,
  onRefresh,
  showToast
}: DailyTaskBoardViewProps) {
  const todayStr = useMemo(() => getCurrentKolkataDate(), []);
  const signedInUserId = String(user?.id || user?._id || '');
  const userFirstName = user?.firstName || (user?.name ? user.name.split(' ')[0] : (role === 'Director' ? 'Director' : 'User'));

  // Active board task IDs
  const [boardTaskIds, setBoardTaskIds] = useState<string[]>(initialCartIds);
  const [boardEdits, setBoardEdits] = useState<Record<string, RowEdit>>({});
  const [submitting, setSubmitting] = useState(false);
  const [selectedTaskToAdd, setSelectedTaskToAdd] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync initialCartIds if updated externally
  useEffect(() => {
    if (initialCartIds && initialCartIds.length > 0) {
      setBoardTaskIds(prev => {
        const set = new Set([...prev, ...initialCartIds]);
        return Array.from(set);
      });
    }
  }, [initialCartIds]);

  // If board is empty, auto-populate with assigned / active tasks so the table isn't blank
  useEffect(() => {
    if (boardTaskIds.length === 0 && tasks.length > 0) {
      // Find tasks assigned to this user or non-completed tasks
      const myActive = tasks.filter(t => {
        if (t.status === 'Completed') return false;
        const assignees = (t.assignedEmployeeIds || []).map(String);
        return assignees.includes(signedInUserId) || t.projectHeadId === signedInUserId;
      });

      const fallback = myActive.length > 0 ? myActive : tasks.filter(t => t.status !== 'Completed');
      const defaults = fallback.slice(0, 3).map(taskKey);

      if (defaults.length > 0) {
        setBoardTaskIds(defaults);
        if (onCartChange) onCartChange(defaults);
      }
    }
  }, [tasks, boardTaskIds.length, signedInUserId, onCartChange]);

  // Tasks currently on board
  const boardTasks = useMemo(() => {
    return boardTaskIds
      .map(id => tasks.find(t => taskKey(t) === id))
      .filter((t): t is Task => Boolean(t));
  }, [boardTaskIds, tasks]);

  // Available tasks to add
  const availableTasksToAdd = useMemo(() => {
    return tasks.filter(t => !boardTaskIds.includes(taskKey(t)) && t.status !== 'Completed');
  }, [tasks, boardTaskIds]);

  // Today's logged hours already saved in DB
  const todayLoggedHours = useMemo(() => {
    const logged = dailyEntries
      .filter(entry => entry.employeeId === signedInUserId && entry.date === todayStr)
      .reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0);
    return Number(logged.toFixed(2));
  }, [dailyEntries, signedInUserId, todayStr]);

  // Current draft hours entered in inputs
  const draftHours = useMemo(() => {
    const draft = boardTasks.reduce((total, task) => {
      const edit = boardEdits[taskKey(task)];
      const h = parseFloat(edit?.hours || '0');
      return total + (Number.isFinite(h) && h > 0 ? h : 0);
    }, 0);
    return Number(draft.toFixed(2));
  }, [boardTasks, boardEdits]);

  const totalLoggedHours = Number((todayLoggedHours + draftHours).toFixed(2));
  const freeHours = Math.max(0, Number((8 - totalLoggedHours).toFixed(2)));

  const loggedBarWidth = `${Math.min(100, (totalLoggedHours / 8) * 100)}%`;
  const freeBarWidth = `${Math.max(0, 100 - Math.min(100, (totalLoggedHours / 8) * 100))}%`;

  // Free time breakdown string: e.g. (4 h + 2 h + 1 h = 7 h, so 1 h free)
  const breakdownString = useMemo(() => {
    const parts: string[] = [];
    boardTasks.forEach(task => {
      const edit = boardEdits[taskKey(task)];
      const h = parseFloat(edit?.hours || '0');
      if (Number.isFinite(h) && h > 0) {
        parts.push(`${Number.isInteger(h) ? h : h.toFixed(1)} h`);
      }
    });

    if (parts.length > 0) {
      return `(${parts.join(' + ')} = ${totalLoggedHours} h, so ${freeHours} h free)`;
    } else if (todayLoggedHours > 0) {
      return `(${todayLoggedHours} h = ${todayLoggedHours} h, so ${freeHours} h free)`;
    }
    return `(0 h = 0 h, so 8 h free)`;
  }, [boardTasks, boardEdits, totalLoggedHours, freeHours, todayLoggedHours]);

  const handleUpdateComment = (taskId: string, comment: string) => {
    setBoardEdits(prev => ({
      ...prev,
      [taskId]: {
        comment,
        hours: prev[taskId]?.hours || '',
        flagged: prev[taskId]?.flagged || false
      }
    }));
    setErrorMessage(null);
  };

  const handleUpdateHours = (taskId: string, hours: string) => {
    setBoardEdits(prev => ({
      ...prev,
      [taskId]: {
        comment: prev[taskId]?.comment || '',
        hours,
        flagged: prev[taskId]?.flagged || false
      }
    }));
    setErrorMessage(null);
  };

  const handleUpdateFlag = (taskId: string, flagged: boolean) => {
    setBoardEdits(prev => ({
      ...prev,
      [taskId]: {
        comment: prev[taskId]?.comment || '',
        hours: prev[taskId]?.hours || '',
        flagged
      }
    }));
  };

  const handleAddTaskToBoard = (taskId: string) => {
    if (!taskId) return;
    const nextIds = Array.from(new Set([...boardTaskIds, taskId]));
    setBoardTaskIds(nextIds);
    if (onCartChange) onCartChange(nextIds);
    if (showToast) showToast('success', 'Task added to Daily Task Board');
  };

  const handleRemoveTaskFromBoard = (taskId: string) => {
    const nextIds = boardTaskIds.filter(id => id !== taskId);
    setBoardTaskIds(nextIds);
    if (onCartChange) onCartChange(nextIds);
  };

  const handleSubmit = async () => {
    if (boardTasks.length === 0) {
      const msg = 'Please add at least one task to the Daily Task Board.';
      setErrorMessage(msg);
      if (showToast) showToast('error', msg);
      return;
    }

    // Find entries with inputs
    const prepared = boardTasks.map(task => {
      const id = taskKey(task);
      const edit = boardEdits[id] || { comment: '', hours: '', flagged: false };
      const hoursNum = parseFloat(edit.hours || '0');
      return {
        task,
        id,
        comment: (edit.comment || '').trim(),
        hours: Number.isFinite(hoursNum) ? hoursNum : 0,
        flagged: Boolean(edit.flagged)
      };
    });

    // Check mandatory fields: Comment and Hours
    const missingItems = prepared.filter(p => !p.comment || p.hours <= 0);
    if (missingItems.length > 0) {
      const msg = `Mandatory fields: Comment and Hours are required for "${missingItems[0].task.title}".`;
      setErrorMessage(msg);
      if (showToast) showToast('error', msg);
      return;
    }

    // Check 8-hour daily limit
    const submitTotal = prepared.reduce((sum, p) => sum + p.hours, 0);
    if (todayLoggedHours + submitTotal > 8.01) {
      const msg = `Daily time cannot exceed 8 hours. You have ${freeHours} hour(s) remaining today.`;
      setErrorMessage(msg);
      if (showToast) showToast('error', msg);
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const payload = prepared.map(p => ({
        taskId: p.id,
        projectId: p.task.projectId,
        projectName: p.task.projectName || '',
        taskTitle: p.task.title,
        details: p.task.description || p.task.title,
        actionTaken: p.comment,
        date: todayStr,
        hours: p.hours,
        flagged: p.flagged,
        status: 'In Progress'
      }));

      const res = await fetch('/api/daily-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        const errorMsg = data.error || 'Failed to submit daily entries.';
        setErrorMessage(errorMsg);
        if (showToast) showToast('error', errorMsg);
        return;
      }

      // Reset inputs after successful submission
      setBoardEdits(prev => {
        const next = { ...prev };
        prepared.forEach(p => {
          next[p.id] = { comment: '', hours: '', flagged: false };
        });
        return next;
      });

      if (showToast) showToast('success', 'Daily entry submitted successfully.');
      if (onRefresh) await onRefresh();
    } catch (err: any) {
      const msg = err.message || 'Network error while submitting daily entries.';
      setErrorMessage(msg);
      if (showToast) showToast('error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="min-w-0 space-y-4" aria-label="Daily Task Board">
      {/* Title & Quick Add Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight">
          Daily Task Board
        </h2>

        {availableTasksToAdd.length > 0 && (
          <div className="flex items-center gap-2">
            <select
              value={selectedTaskToAdd}
              onChange={e => {
                if (e.target.value) {
                  handleAddTaskToBoard(e.target.value);
                  setSelectedTaskToAdd('');
                }
              }}
              className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-semibold text-[#334155] shadow-xs focus:border-[#2563EB] focus:outline-none"
            >
              <option value="">+ Add task to board...</option>
              {availableTasksToAdd.map(t => (
                <option key={taskKey(t)} value={taskKey(t)}>
                  {t.projectName ? `${t.projectName} - ` : ''}{t.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">
          <AlertCircle size={16} className="text-red-600 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Table Matching User Screenshot */}
      <div className="overflow-x-auto border border-[#CBD5E1] bg-white shadow-xs">
        <table className="w-full min-w-[780px] table-fixed border-collapse text-left text-xs text-[#172033]">
          <colgroup>
            <col className="w-[28%]" />
            <col className="w-[52%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
          </colgroup>
          <thead>
            <tr className="bg-[#2D3A4B] text-white">
              <th className="border border-[#3D4C5E] px-3 py-2.5 font-bold">
                Project / Task / Subtasks
              </th>
              <th className="border border-[#3D4C5E] px-3 py-2.5 font-bold">
                Comment log (date wise) - today&apos;s comment is mandatory
              </th>
              <th className="border border-[#3D4C5E] px-3 py-2.5 text-center font-bold">
                Hours *
              </th>
              <th className="border border-[#3D4C5E] px-3 py-2.5 text-center font-bold">
                Flag
              </th>
            </tr>
          </thead>
          <tbody>
            {boardTasks.length === 0 ? (
              <tr className="bg-[#F8FAFC]">
                <td colSpan={4} className="px-4 py-12 text-center text-sm text-slate-500">
                  <p className="font-semibold text-slate-700">No tasks on the Daily Task Board.</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Select a task from &quot;+ Add task to board...&quot; above to start logging work.
                  </p>
                </td>
              </tr>
            ) : (
              boardTasks.map((task, index) => {
                const id = taskKey(task);
                const edit = boardEdits[id] || { comment: '', hours: '', flagged: false };
                const children = tasks.filter(item => item.parentTaskId === id);

                // Fetch prior daily entries
                const history = dailyEntries
                  .filter(entry => String(entry.taskId) === id)
                  .sort((a, b) => {
                    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : (a.date ? new Date(a.date).getTime() : 0);
                    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : (b.date ? new Date(b.date).getTime() : 0);
                    return timeA - timeB;
                  });

                // Build prior comment items
                const priorComments = history.length > 0
                  ? history.map((entry, idx) => ({
                      key: entry.id || entry._id || `${entry.date}-${idx}`,
                      numLabel: `Comment-${String(idx + 1).padStart(2, '0')}`,
                      dateLabel: formatCommentDate(entry.date, entry.createdAt),
                      authorLabel: entry.employeeName || 'Staff',
                      commentText: entry.actionTaken || '',
                      hours: Number(entry.hours) || 0
                    }))
                  : (task.comments || []).slice(-4).map((c, idx) => ({
                      key: c.id || String(idx),
                      numLabel: `Comment-${String(idx + 1).padStart(2, '0')}`,
                      dateLabel: formatCommentDate(c.timestamp),
                      authorLabel: c.userName || c.role || 'Staff',
                      commentText: c.content || '',
                      hours: 0
                    }));

                const todayNumLabel = `Comment-${String(priorComments.length + 1).padStart(2, '0')}`;

                return (
                  <tr
                    key={id}
                    className={`border-b border-[#E2E8F0] ${index % 2 === 0 ? 'bg-[#F8FAFC]' : 'bg-white'}`}
                  >
                    {/* Column 1: Project / Task / Subtasks */}
                    <td className="border-r border-[#E2E8F0] px-3 py-2.5 align-top">
                      <div className="flex items-start justify-between gap-1">
                        <p className="font-bold text-[#0F172A] text-xs sm:text-sm leading-tight">
                          {task.projectName || 'Project'}/{task.title}
                        </p>
                        {boardTasks.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveTaskFromBoard(id)}
                            title="Remove task from board"
                            className="text-slate-400 hover:text-rose-600 transition p-0.5 rounded"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>

                      {/* Subtasks */}
                      {children.map(child => (
                        <p
                          key={taskKey(child)}
                          className="mt-0.5 text-[11px] leading-tight text-[#475569]"
                        >
                          {task.projectName || 'Project'}/{task.title}/{child.title}
                        </p>
                      ))}

                      {/* Description */}
                      {task.description && (
                        <p className="mt-1 text-[11px] italic leading-tight text-slate-500">
                          Description of {task.title}: {task.description}
                        </p>
                      )}
                    </td>

                    {/* Column 2: Date-wise Comments & Today's Comment */}
                    <td className="border-r border-[#E2E8F0] px-3 py-2.5 align-top">
                      <div className="space-y-1">
                        {/* Prior Comments */}
                        {priorComments.map(item => (
                          <div key={item.key} className="text-xs text-[#1E293B] leading-tight min-h-[22px] flex items-center">
                            <span>
                              {item.numLabel} - ({item.dateLabel})({item.authorLabel})
                              {item.commentText ? `: ${item.commentText}` : ''}
                            </span>
                          </div>
                        ))}

                        {/* Today's Comment (in RED) */}
                        <div className="flex items-center gap-1.5 text-xs font-bold text-red-600 min-h-[26px]">
                          <span className="whitespace-nowrap">
                            {todayNumLabel} - (Today)({userFirstName})
                          </span>
                          <input
                            type="text"
                            placeholder="type comment here"
                            value={edit.comment}
                            onChange={e => handleUpdateComment(id, e.target.value)}
                            className="flex-1 bg-transparent border-0 border-b border-red-300 focus:border-red-600 px-1 py-0.5 text-xs font-semibold text-red-600 placeholder:text-red-400 focus:outline-none"
                          />
                        </div>
                      </div>
                    </td>

                    {/* Column 3: Hours * */}
                    <td className="border-r border-[#E2E8F0] px-2 py-2.5 align-top text-center">
                      <div className="space-y-1">
                        {/* Prior Hours */}
                        {priorComments.length > 0 ? (
                          priorComments.map(item => (
                            <div
                              key={`hours-${item.key}`}
                              className="text-xs text-[#1E293B] font-medium leading-tight min-h-[22px] flex items-center justify-center"
                            >
                              {formatHoursDisplay(item.hours)}
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-[#1E293B] font-medium leading-tight min-h-[22px] flex items-center justify-center">
                            -
                          </div>
                        )}

                        {/* Today's Hours (in RED brackets) */}
                        <div className="flex items-center justify-center text-xs font-bold text-red-600 min-h-[26px]">
                          <span className="text-red-600 font-bold text-sm">[</span>
                          <input
                            type="number"
                            min="0.25"
                            max="8"
                            step="0.25"
                            placeholder="0"
                            value={edit.hours}
                            onChange={e => handleUpdateHours(id, e.target.value)}
                            className="w-8 text-center bg-transparent border-0 px-0.5 text-xs font-bold text-red-600 placeholder:text-red-300 focus:outline-none"
                          />
                          <span className="text-red-600 font-bold text-sm">]</span>
                        </div>
                      </div>
                    </td>

                    {/* Column 4: Flag */}
                    <td className="px-2 py-2.5 align-top text-center">
                      <div className="flex items-center justify-center pt-1 min-h-[26px]">
                        <input
                          type="checkbox"
                          checked={Boolean(edit.flagged)}
                          onChange={e => handleUpdateFlag(id, e.target.checked)}
                          className="h-4 w-4 rounded border-2 border-red-500 accent-red-600 cursor-pointer focus:ring-0"
                          title="Tick if input / intervention is needed from Director"
                        />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Controls: Daily Time Bar & Submit Button */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
        {/* Left: 8-Hour Bar and Breakdown Calculation */}
        <div className="flex flex-col gap-1 min-w-[280px] flex-1 max-w-xl">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-[#0F172A] whitespace-nowrap">
              Daily time (8 hours)
            </span>
            <div className="flex h-7 flex-1 overflow-hidden border border-[#CBD5E1] bg-[#E2E8F0]">
              <div
                className="flex items-center justify-center bg-[#2563EB] text-xs font-bold text-white transition-all duration-200"
                style={{ width: loggedBarWidth }}
              >
                {totalLoggedHours > 0 ? `Logged ${totalLoggedHours} h` : ''}
              </div>
              <div
                className="flex items-center justify-center bg-[#16A34A] text-xs font-bold text-white transition-all duration-200"
                style={{ width: freeBarWidth }}
              >
                {freeHours > 0 ? `Free ${freeHours} h` : ''}
              </div>
            </div>
          </div>
          <p className="text-[11px] text-[#475569]">
            Free time = 8 h - hours entered today {breakdownString}
          </p>
        </div>

        {/* Right: Submit Button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={boardTasks.length === 0 || submitting}
          className="rounded-lg bg-[#2563EB] px-8 py-2.5 text-sm font-bold text-white transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-50 shadow-sm"
        >
          {submitting ? 'Submitting...' : 'Submit Daily Entry'}
        </button>
      </div>

    </section>
  );
}
