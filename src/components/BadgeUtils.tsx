'use client'

import React from 'react';
import { TaskPriority, ProjectStatus, EmployeeStatus } from '../types';

export const PriorityBadge: React.FC<{ priority: TaskPriority | string }> = ({ priority }) => {
  const p = (priority || 'Medium').toString().toUpperCase();
  let bg = 'bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]';

  if (p === 'URGENT') {
    bg = 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]';
  } else if (p === 'MEDIUM') {
    bg = 'bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]';
  } else if (p === 'LOW') {
    bg = 'bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]';
  } else if (p === 'SELF') {
    bg = 'bg-[#F5F3FF] text-[#7C3AED] border-[#DDD6FE]';
  } else if (p === 'DAILY') {
    bg = 'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]';
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-bold rounded-full border uppercase tracking-wide ${bg}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
      {p}
    </span>
  );
};

export const ProjectStatusBadge: React.FC<{ status: ProjectStatus | string }> = ({ status }) => {
  const s = (status || 'Current').toString();
  let bg = 'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]';
  let label = 'CURRENT';

  if (s === 'Current') {
    bg = 'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]';
    label = 'CURRENT';
  } else if (s === 'Upcoming') {
    bg = 'bg-[#F5F3FF] text-[#7C3AED] border-[#DDD6FE]';
    label = 'UPCOMING';
  } else if (s === 'Sleeping (On Hold)') {
    bg = 'bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]';
    label = 'SLEEPING';
  } else if (s === 'Completed') {
    bg = 'bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]';
    label = 'COMPLETED';
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-bold rounded-full border uppercase tracking-wider ${bg}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
      {label}
    </span>
  );
};

export const EmployeeStatusBadge: React.FC<{ status: EmployeeStatus | string }> = ({ status }) => {
  const s = (status || 'Active').toString();
  let bg = 'bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]';
  let label = 'ACTIVE';

  if (s === 'Active') {
    bg = 'bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]';
    label = 'ACTIVE';
  } else if (s === 'Absent') {
    bg = 'bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]';
    label = 'ABSENT';
  } else if (s === 'Inactive') {
    bg = 'bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0]';
    label = 'INACTIVE';
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-bold rounded-full border uppercase tracking-wider ${bg}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
      {label}
    </span>
  );
};

export const EmployeeAvatar: React.FC<{ name: string; size?: 'sm' | 'md' | 'lg' }> = ({ name, size = 'md' }) => {
  const cleanName = (name || 'Staff').trim();
  const parts = cleanName.split(' ');
  const initials = parts.length >= 2 
    ? `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase() 
    : cleanName.substring(0, 2).toUpperCase();

  const colors = [
    'bg-blue-600 text-white',
    'bg-indigo-600 text-white',
    'bg-purple-600 text-white',
    'bg-emerald-600 text-white',
    'bg-amber-600 text-white',
    'bg-rose-600 text-white'
  ];
  let charSum = 0;
  for (let i = 0; i < cleanName.length; i++) charSum += cleanName.charCodeAt(i);
  const colorClass = colors[charSum % colors.length];

  const sizeClasses = {
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm'
  };

  return (
    <div className={`${sizeClasses[size]} rounded-full ${colorClass} flex items-center justify-center font-bold tracking-tight shadow-xs flex-shrink-0`}>
      {initials}
    </div>
  );
};

export const SkeletonCard: React.FC = () => (
  <div className="bg-white p-5 rounded-[14px] border border-[#E2E8F0] shadow-xs animate-pulse space-y-3">
    <div className="h-4 w-24 bg-slate-200 rounded"></div>
    <div className="h-8 w-16 bg-slate-300 rounded"></div>
    <div className="h-3 w-20 bg-slate-200 rounded"></div>
  </div>
);

export const SkeletonTable: React.FC = () => (
  <div className="bg-white rounded-[14px] border border-[#E2E8F0] p-6 space-y-4 animate-pulse">
    <div className="h-6 w-48 bg-slate-200 rounded mb-4"></div>
    <div className="space-y-3">
      {[1, 2, 3, 4].map(n => (
        <div key={n} className="h-10 bg-slate-100 rounded-lg w-full"></div>
      ))}
    </div>
  </div>
);
