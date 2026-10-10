import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  FolderOpen,
  Users,
  LogOut,
  User,
  BarChart3,
  CheckCircle2,
  CalendarCheck,
  Menu,
  X
} from 'lucide-react';

export type TabType =
  | 'overview'
  | 'today-work'
  | 'my-tasks'
  | 'projects'
  | 'tasks'
  | 'current-tasks'
  | 'employees'
  | 'performance'
  | 'completed'
  | 'flags'
  | 'reminders'
  | 'reports'
  | 'profile';

interface SidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  flagCount?: number;
  reminderCount?: number;
  cartCount?: number;
}

type NavItem = { id: TabType; label: string; icon: any };

const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  cartCount = 0
}) => {
  const { logout, user, isDirector, isProjectHead } = useAuth();
  const isManagementDashboard = isDirector || isProjectHead;
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Director — requirement tabs (order fixed)
  const directorTabs: NavItem[] = [
    { id: 'overview', label: 'Dash Board', icon: LayoutDashboard },
    { id: 'today-work', label: 'Daily Task Board', icon: CalendarCheck },
    { id: 'projects', label: 'Project Board', icon: FolderOpen },
    { id: 'employees', label: 'Employee Board', icon: Users },
    { id: 'completed', label: 'Completed Task History', icon: CheckCircle2 },
    { id: 'performance', label: 'Performance', icon: BarChart3 },
    { id: 'profile', label: 'Profile', icon: User }
  ];

  // Project Head — same as Director tabs excluding Project Board / Employee Board
  const projectHeadTabs: NavItem[] = [
    { id: 'overview', label: 'Dash Board', icon: LayoutDashboard },
    { id: 'today-work', label: 'Daily Task Board', icon: CalendarCheck },
    { id: 'completed', label: 'Completed Task History', icon: CheckCircle2 },
    { id: 'performance', label: 'Performance', icon: BarChart3 },
    { id: 'profile', label: 'Profile', icon: User }
  ];

  // Employee — view-focused tabs
  const employeeTabs: NavItem[] = [
    { id: 'overview', label: 'Dash Board', icon: LayoutDashboard },
    { id: 'today-work', label: 'Daily Task Board', icon: CalendarCheck },
    { id: 'completed', label: 'Completed Task History', icon: CheckCircle2 },
    { id: 'performance', label: 'Performance', icon: BarChart3 },
    { id: 'profile', label: 'Profile', icon: User }
  ];

  const navTabs: NavItem[] = isDirector
    ? directorTabs
    : isProjectHead
      ? projectHeadTabs
      : employeeTabs;

  const handleTabClick = (tabId: TabType) => {
    onTabChange(tabId);
    setIsMobileOpen(false);
  };

  const renderNavButtons = () => (
    <nav className="space-y-1">
      {navTabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            className={`w-full flex items-center justify-between rounded-xl font-semibold transition-all duration-150 ${isManagementDashboard ? 'px-3.5 py-3.5 text-sm' : 'px-3.5 py-2.5 text-xs'} ${isActive
                ? 'bg-[#2563EB] text-white shadow-md shadow-blue-900/30'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
          >
            <div className="flex items-center gap-3 min-w-0">
                {!isManagementDashboard && (
                  <Icon size={17} className={`flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                )}
                <span className="truncate">{tab.label}</span>
              </div>
            {tab.id === 'today-work' && cartCount > 0 && (
              <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-extrabold flex items-center justify-center ${
                isActive ? 'bg-white text-[#2563EB]' : 'bg-[#2563EB] text-white'
              }`}>
                {cartCount}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );

  const navContent = (
    <div className="flex h-full flex-col bg-[#0D1729] font-sans text-slate-100">
      {/* Company Branding */}
      <div className={`p-4 ${isManagementDashboard ? 'pt-6' : 'border-b border-slate-800/80'}`}>
        <div className="flex items-center gap-3">
          {!isManagementDashboard && (
            <img
              src="/logo.png"
              alt="Korals Design Logo"
              className="h-10 w-auto flex-shrink-0 rounded-xl border border-slate-700/80 bg-black px-2 py-1 object-contain shadow-md"
            />
          )}
          <div className="min-w-0">
            <h1 className={`truncate font-black uppercase leading-tight text-white ${isManagementDashboard ? 'text-base tracking-wide' : 'text-xs tracking-wider'}`}>
              KORALS DESIGN
            </h1>
            <h2 className="mt-1 text-[11px] font-bold leading-tight tracking-tight text-blue-400">
              PROJECT MONITORING
            </h2>
            <span className="mt-1 inline-block rounded border border-blue-500/30 bg-blue-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-blue-300">
              {user?.role ? `${user.role.toUpperCase()} DASHBOARD` : 'DASHBOARD'}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <div className={`flex-1 overflow-y-auto px-3 ${isManagementDashboard ? 'py-4' : 'space-y-5 py-4'}`}>
        <div className="space-y-1">
          {!isManagementDashboard && (
            <p className="mb-1.5 px-3 text-[10px] font-extrabold uppercase tracking-wider text-[#94A3B8]">
              {isProjectHead ? 'PROJECT HEAD MENU' : 'EMPLOYEE MENU'}
            </p>
          )}
          {renderNavButtons()}
        </div>
      </div>

      {/* User Info & Sign Out */}
      <div className="border-t border-slate-800/80 p-4">
        <div className={`mb-3 rounded-xl border border-slate-700/40 bg-slate-800/60 ${isManagementDashboard ? 'p-3' : 'flex items-center gap-3 p-2.5'}`}>
          {!isManagementDashboard && (
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shadow-sm">
              {user?.name?.charAt(0) || user?.email?.charAt(0).toUpperCase() || 'D'}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-white truncate">
              {user?.name || user?.email}
            </p>
            <p className="text-[10px] text-blue-400 font-semibold tracking-wide uppercase">
              {user?.role}
            </p>
          </div>
        </div>

        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition font-medium border border-transparent hover:border-slate-700"
        >
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Header Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 z-30">
        <div className="flex items-center gap-2.5">
          <img
            src="/logo.png"
            alt="Korals Design Logo"
            className="h-8 w-auto object-contain bg-black px-1.5 py-0.5 rounded-lg border border-slate-700 shadow-sm flex-shrink-0"
          />
          <div>
            <h1 className="text-xs font-bold text-white uppercase tracking-tight">KORALS DESIGN PVT. LTD.</h1>
            <p className="text-[10px] text-blue-400 font-medium">Task Management System</p>
          </div>
        </div>

        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
          aria-label="Toggle navigation menu"
        >
          {isMobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile Slide-Over Drawer */}
      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileOpen(false)}
          />
          <div className="relative w-72 max-w-xs h-full z-50 shadow-2xl flex flex-col pt-16">
            {navContent}
          </div>
        </div>
      )}

      {/* Desktop Fixed Sidebar */}
      <div className="hidden md:flex w-64 h-screen fixed left-0 top-0 z-20 shadow-xl border-r border-slate-800 flex-col">
        {navContent}
      </div>
    </>
  );
};

export default Sidebar;
