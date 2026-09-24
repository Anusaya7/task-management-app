import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  CheckSquare,
  FolderOpen,
  Users,
  LogOut,
  User,
  Flag,
  Bell,
  BarChart3,
  CheckCircle2,
  CalendarCheck,
  Menu,
  X,
  Briefcase,
  ListTodo
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
}

const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  flagCount = 0,
  reminderCount = 0
}) => {
  const { logout, user, isDirector, isProjectHead, isEmployee } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Grouped Navigation Sections for Director
  const directorGroups: { section: string; items: { id: TabType; label: string; icon: any; badge?: number }[] }[] = [
    {
      section: 'PROJECT MONITORING',
      items: [
        { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'today-work', label: 'Daily Task Board', icon: CalendarCheck },
        { id: 'my-tasks', label: 'My Tasks', icon: CheckSquare },
        { id: 'reports', label: 'Daily Reports', icon: BarChart3 },
        { id: 'completed', label: 'Completed History', icon: CheckCircle2 },
        { id: 'reminders', label: 'Reminders', icon: Bell, badge: reminderCount },
        { id: 'flags', label: 'Flags', icon: Flag, badge: flagCount },
        { id: 'performance', label: 'My Performance', icon: BarChart3 },
        { id: 'profile', label: 'Profile', icon: User }
      ]
    },
    {
      section: 'MANAGEMENT',
      items: [
        { id: 'projects', label: 'Projects', icon: FolderOpen },
        { id: 'employees', label: 'Employees', icon: Users },
        { id: 'tasks', label: 'All Tasks Overview', icon: ListTodo }
      ]
    }
  ];

  const handleTabClick = (tabId: TabType) => {
    onTabChange(tabId);
    setIsMobileOpen(false);
  };

  const navContent = (
    <div className="flex flex-col h-full bg-[#0F172A] text-slate-100 font-sans">
      {/* Company Branding */}
      <div className="p-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Korals Design Logo"
            className="h-10 w-auto object-contain bg-black px-2 py-1 rounded-xl border border-slate-700/80 shadow-md flex-shrink-0"
          />
          <div className="min-w-0">
            <h1 className="text-xs font-black text-white tracking-wider uppercase leading-tight truncate">
              KORALS DESIGN
            </h1>
            <h2 className="text-[11px] font-bold text-blue-400 mt-0.5 leading-tight tracking-tight">
              PROJECT MONITORING
            </h2>
            <span className="inline-block mt-1 px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
              {user?.role ? `${user.role.toUpperCase()} DASHBOARD` : 'DASHBOARD'}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <div className="flex-1 py-4 px-3 overflow-y-auto space-y-5">
        {isDirector ? (
          directorGroups.map((group) => (
            <div key={group.section} className="space-y-1">
              <p className="px-3 text-[10px] font-extrabold text-[#94A3B8] uppercase tracking-wider mb-1.5">
                {group.section}
              </p>
              {group.items.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabClick(tab.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ${isActive
                        ? 'bg-[#2563EB] text-white shadow-md shadow-blue-900/30'
                        : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={17} className={isActive ? 'text-white' : 'text-slate-400'} />
                      <span>{tab.label}</span>
                    </div>
                    {tab.badge && tab.badge > 0 ? (
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${isActive ? 'bg-white text-blue-700' : 'bg-rose-500 text-white shadow-sm'
                          }`}
                      >
                        {tab.badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))
        ) : (
          <nav className="space-y-1">
            {(isProjectHead
              ? [
                { id: 'overview' as TabType, label: 'Dashboard', icon: LayoutDashboard },
                { id: 'projects' as TabType, label: 'My Projects', icon: FolderOpen },
                { id: 'tasks' as TabType, label: 'Tasks', icon: CheckSquare },
                { id: 'employees' as TabType, label: 'Employees', icon: Users },
                { id: 'completed' as TabType, label: 'Completed Tasks', icon: CheckCircle2 },
                { id: 'flags' as TabType, label: 'Flags', icon: Flag, badge: flagCount },
                { id: 'profile' as TabType, label: 'Profile', icon: User }
              ]
              : [
                  { id: 'overview' as TabType, label: 'Dashboard', icon: LayoutDashboard },
                  { id: 'today-work' as TabType, label: 'Daily Task Board', icon: CalendarCheck },
                  { id: 'completed' as TabType, label: 'Completed History', icon: CheckCircle2 },
                  { id: 'reminders' as TabType, label: 'Reminder', icon: Bell, badge: reminderCount },
                  { id: 'flags' as TabType, label: 'Flags', icon: Flag, badge: flagCount },
                  { id: 'performance' as TabType, label: 'My Performance', icon: BarChart3 },
                  { id: 'profile' as TabType, label: 'Profile', icon: User }
                ]
            ).map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ${isActive
                      ? 'bg-[#2563EB] text-white shadow-md'
                      : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={17} className={isActive ? 'text-white' : 'text-slate-400'} />
                    <span>{tab.label}</span>
                  </div>
                  {tab.badge && tab.badge > 0 ? (
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${isActive ? 'bg-white text-blue-700' : 'bg-rose-500 text-white'}`}>
                      {tab.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        )}
      </div>

      {/* User Info & Sign Out */}
      <div className="p-4 border-t border-slate-800/80">
        <div className="flex items-center gap-3 p-2.5 bg-slate-800/50 rounded-xl mb-3 border border-slate-700/40">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0 shadow-sm">
            {user?.name?.charAt(0) || user?.email?.charAt(0).toUpperCase() || 'D'}
          </div>
          <div className="flex-1 min-w-0">
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
