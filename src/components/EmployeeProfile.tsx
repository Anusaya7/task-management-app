'use client'

import React, { useState, useEffect } from 'react'
import {
  User,
  Mail,
  Phone,
  Calendar,
  Building,
  Shield,
  Briefcase,
  CheckCircle2,
  Clock,
  Hourglass,
  Bell,
  RefreshCw,
  AlertCircle,
  Inbox,
  Check
} from 'lucide-react'
import { Employee } from '../types'
import { useAuth } from '../contexts/AuthContext'
import { getEmployeeById } from '../services/employeeService'

interface WorkSummaryStats {
  assigned: number
  inProgress: number
  completed: number
  pending: number
}

const EmployeeProfile: React.FC = () => {
  const { user } = useAuth()
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [workStats, setWorkStats] = useState<WorkSummaryStats>({
    assigned: 0,
    inProgress: 0,
    completed: 0,
    pending: 0
  })
  const [unreadNotifications, setUnreadNotifications] = useState<number>(0)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [error, setError] = useState<string>('')

  const loadProfileData = async (showRefreshSpinner = false) => {
    if (!user?.id) {
      setError('User session not found')
      setIsLoading(false)
      return
    }

    if (showRefreshSpinner) {
      setIsRefreshing(true)
    }

    try {
      // 1. Load Employee Record
      const empData = await getEmployeeById(user.id, user.email)
      setEmployee(empData)

      // 2. Fetch Tasks for authentic work summary metrics
      const tasksRes = await fetch('/api/tasks')
      if (tasksRes.ok) {
        const tasks = await tasksRes.json()
        if (Array.isArray(tasks)) {
          const assigned = tasks.length
          const completed = tasks.filter((t: any) => t.status === 'Completed').length
          const inProgress = tasks.filter((t: any) => t.status === 'In Progress' || (t.status === 'Pending' && (t.workDone || 0) > 0)).length
          const pending = tasks.filter((t: any) => t.status === 'Pending' && (t.workDone || 0) === 0).length

          setWorkStats({
            assigned,
            inProgress,
            completed,
            pending
          })
        }
      }

      // 3. Fetch Notification unread count
      const notifRes = await fetch('/api/notifications')
      if (notifRes.ok) {
        const notifData = await notifRes.json()
        setUnreadNotifications(notifData.unreadCount || 0)
      }

      setError('')
    } catch (err: any) {
      console.error('Error loading employee profile data:', err)
      setError(`Failed to load profile details: ${err.response?.data?.message || err.message || 'Server error'}`)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    loadProfileData()
  }, [user?.id])

  // Get Initials for Avatar
  const getInitials = (firstName?: string, lastName?: string): string => {
    const f = firstName ? firstName.trim().charAt(0).toUpperCase() : ''
    const l = lastName ? lastName.trim().charAt(0).toUpperCase() : ''
    if (f && l) return `${f}${l}`
    if (f) return f
    if (user?.name) {
      const parts = user.name.trim().split(' ')
      if (parts.length >= 2) return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase()
      return user.name.charAt(0).toUpperCase()
    }
    return 'E'
  }

  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'N/A'
    try {
      const d = new Date(dateString)
      if (isNaN(d.getTime())) return 'N/A'
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return 'N/A'
    }
  }

  const formatEmployeeId = (id?: string): string => {
    if (!id) return 'EMP-000000'
    const cleanId = id.replace(/[^a-zA-Z0-9]/g, '')
    return `EMP-${cleanId.slice(-6).toUpperCase()}`
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <div className="w-10 h-10 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="text-xs font-semibold text-slate-500">Loading Profile Details...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl max-w-xl mx-auto my-8">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-rose-900">Error Loading Profile</h3>
            <p className="text-xs text-rose-700 mt-1">{error}</p>
            <button
              onClick={() => loadProfileData(true)}
              className="mt-4 px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition"
            >
              Retry Loading
            </button>
          </div>
        </div>
      </div>
    )
  }

  const displayName = employee
    ? `${employee.firstName} ${employee.lastName}`
    : user?.name || 'Employee'
  const displayRole = employee?.role || user?.role || 'Employee'
  const displayEmail = employee?.email || user?.email || 'N/A'
  const displayPhone = employee?.phone || 'N/A'
  const initials = getInitials(employee?.firstName, employee?.lastName)
  const empId = formatEmployeeId(employee?._id || employee?.id || user?.id)
  const status = employee?.status || 'Active'

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* 1. PROFILE HERO SECTION */}
      <div className="bg-[#0B1428] rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-slate-800">
        {/* Subtle Decorative Backdrop Elements */}
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute right-32 -bottom-20 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {/* Dynamic Initials Circular Avatar */}
            <div className="relative shrink-0">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 border-4 border-white/10 shadow-lg flex items-center justify-center text-white text-2xl sm:text-3xl font-extrabold tracking-wider">
                {initials}
              </div>
              <span className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-500 border-2 border-[#0B1428] rounded-full" title="Active"></span>
            </div>

            {/* Profile Core Details */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {displayName}
                </h1>
                <span className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 px-3 py-0.5 rounded-full text-xs font-extrabold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                  {status}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 font-medium">
                <span className="bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full border border-blue-400/20 font-bold">
                  {displayRole}
                </span>
                <span className="bg-slate-800/80 text-slate-300 px-3 py-1 rounded-md font-mono text-[11px] border border-slate-700/80">
                  {empId}
                </span>
                <span className="text-slate-400 flex items-center gap-1">
                  <Building size={14} className="text-blue-400" />
                  KORALS DESIGN PVT. LTD.
                </span>
              </div>
            </div>
          </div>

          {/* Quick Refresh / Status Action */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-end pt-4 md:pt-0 border-t md:border-t-0 border-slate-800">
            <button
              onClick={() => loadProfileData(true)}
              disabled={isRefreshing}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 border border-white/10 cursor-pointer disabled:opacity-50"
              title="Refresh profile details"
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh Data'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. EMPLOYEE WORK SUMMARY */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div>
            <h2 className="text-lg font-black text-[#0B1428] tracking-tight flex items-center gap-2">
              <Briefcase size={20} className="text-[#2563EB]" />
              <span>Employee Work Summary</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Authentic task allocation metrics for {displayName}
            </p>
          </div>
          <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
            Database Verified
          </span>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-5 bg-white rounded-2xl border border-slate-200/90 shadow-sm space-y-2 hover:border-blue-300 transition">
            <div className="flex items-center justify-between text-blue-600">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Assigned</span>
              <div className="p-2 bg-blue-50 rounded-xl">
                <Briefcase size={18} />
              </div>
            </div>
            <p className="text-3xl font-black text-[#0F172A]">{workStats.assigned}</p>
            <p className="text-[11px] text-slate-500 font-medium">Total assigned tasks</p>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-slate-200/90 shadow-sm space-y-2 hover:border-amber-300 transition">
            <div className="flex items-center justify-between text-amber-600">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">In Progress</span>
              <div className="p-2 bg-amber-50 rounded-xl">
                <Clock size={18} />
              </div>
            </div>
            <p className="text-3xl font-black text-[#0F172A]">{workStats.inProgress}</p>
            <p className="text-[11px] text-slate-500 font-medium">Active work in progress</p>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-slate-200/90 shadow-sm space-y-2 hover:border-emerald-300 transition">
            <div className="flex items-center justify-between text-emerald-600">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Completed</span>
              <div className="p-2 bg-emerald-50 rounded-xl">
                <CheckCircle2 size={18} />
              </div>
            </div>
            <p className="text-3xl font-black text-[#0F172A]">{workStats.completed}</p>
            <p className="text-[11px] text-slate-500 font-medium">Verified completed tasks</p>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-slate-200/90 shadow-sm space-y-2 hover:border-indigo-300 transition">
            <div className="flex items-center justify-between text-indigo-600">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Pending</span>
              <div className="p-2 bg-indigo-50 rounded-xl">
                <Hourglass size={18} />
              </div>
            </div>
            <p className="text-3xl font-black text-[#0F172A]">{workStats.pending}</p>
            <p className="text-[11px] text-slate-500 font-medium">Awaiting action</p>
          </div>
        </div>

        {/* Professional Empty State when no tasks exist */}
        {workStats.assigned === 0 && (
          <div className="p-8 bg-white rounded-2xl border border-slate-200 shadow-xs text-center space-y-3">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto">
              <Inbox size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-extrabold text-[#0F172A] uppercase tracking-wide">
                No Work Assigned Yet
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                No work has been assigned to you yet. Your assigned work will appear here when the Director creates and allocates tasks to your account.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 3. PERSONAL & WORK INFORMATION GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* PERSONAL INFORMATION CARD */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="p-2 bg-blue-50 text-[#2563EB] rounded-xl">
              <User size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#0B1428]">Personal Information</h3>
              <p className="text-[11px] text-slate-400 font-medium">Verified employee profile details</p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-500 font-bold">Full Name</span>
              <span className="font-extrabold text-[#0F172A] text-sm">{displayName}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-500 font-bold flex items-center gap-1.5">
                <Mail size={14} className="text-slate-400" />
                Email Address
              </span>
              <span className="font-bold text-[#0F172A]">{displayEmail}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-500 font-bold flex items-center gap-1.5">
                <Phone size={14} className="text-slate-400" />
                Phone Number
              </span>
              <span className="font-bold text-[#0F172A]">{displayPhone}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-500 font-bold">Employee ID</span>
              <span className="font-mono font-extrabold text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded text-[11px]">
                {empId}
              </span>
            </div>
          </div>
        </div>

        {/* WORK INFORMATION CARD */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="p-2 bg-indigo-50 text-[#4338CA] rounded-xl">
              <Building size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#0B1428]">Work Information</h3>
              <p className="text-[11px] text-slate-400 font-medium">Organizational status and role</p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-500 font-bold">Primary Role</span>
              <span className="font-extrabold text-[#4338CA] bg-indigo-50 px-2.5 py-0.5 rounded-full text-xs">
                {displayRole}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-500 font-bold">Department</span>
              <span className="font-bold text-[#0F172A]">KORALS DESIGN</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-500 font-bold">Employment Status</span>
              <span className="font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full text-xs flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                {status}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-500 font-bold flex items-center gap-1.5">
                <Calendar size={14} className="text-slate-400" />
                Joining / Profile Created
              </span>
              <span className="font-bold text-[#0F172A]">{formatDate(employee?.createdAt?.toString())}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. ACCOUNT INFORMATION & NOTIFICATIONS SECURITY GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ACCOUNT INFORMATION CARD */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Shield size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#0B1428]">Account Security Information</h3>
              <p className="text-[11px] text-slate-400 font-medium">Security & credential status</p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-500 font-bold">Authenticated User</span>
              <span className="font-bold text-[#0F172A]">{displayEmail}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-500 font-bold">Account Security</span>
              <span className="font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full text-xs flex items-center gap-1">
                <Check size={12} /> Password Encrypted & Protected
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-500 font-bold">Profile Created</span>
              <span className="font-bold text-[#0F172A]">{formatDate(employee?.createdAt?.toString())}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-500 font-bold">Last System Update</span>
              <span className="font-bold text-[#0F172A]">{formatDate(employee?.updatedAt?.toString())}</span>
            </div>
          </div>
        </div>

        {/* NOTIFICATION READINESS & PREFERENCES CARD */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <Bell size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#0B1428]">Notification Center Readiness</h3>
              <p className="text-[11px] text-slate-400 font-medium">Real-time alerts & auto-sync state</p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between p-3 bg-purple-50/50 rounded-xl border border-purple-100">
              <span className="text-purple-900 font-bold">Unread Notifications</span>
              <span className="font-extrabold text-white bg-purple-600 px-3 py-0.5 rounded-full text-xs">
                {unreadNotifications} unread
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-bold">Database Persistence</span>
                <span className="text-emerald-600 font-extrabold">Active</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Director task assignments, return revisions, flag replies, and completion approvals trigger persistent alerts automatically stored in MongoDB.
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-bold">Background Sync Engine</span>
                <span className="text-blue-600 font-extrabold">Silent Polling (10s)</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Background updates refresh silently without UI flickering, page re-mounts, or repeated database writes.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EmployeeProfile
