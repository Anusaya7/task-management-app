'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../contexts/AuthContext'
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  User,
  Briefcase,
  Building,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Layers,
  Activity,
  AlertCircle,
  LayoutDashboard
} from 'lucide-react'

type RoleChoice = 'SELECT' | 'Employee' | 'Director' | 'Project Head'

const Login: React.FC = () => {
  const [selectedRole, setSelectedRole] = useState<RoleChoice>('SELECT')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()
  const router = useRouter()

  const handleRoleSelect = (role: 'Employee' | 'Director' | 'Project Head') => {
    setSelectedRole(role)
    setError('')
    setEmail('')
    setPassword('')
  }

  const handleBackToSelect = () => {
    setSelectedRole('SELECT')
    setError('')
    setEmail('')
    setPassword('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail) {
      setError('Please enter your email address.')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(cleanEmail)) {
      setError('Please enter a valid email address format.')
      return
    }

    if (!password) {
      setError('Please enter your password.')
      return
    }

    setIsLoading(true)

    try {
      const res = await login(cleanEmail, password)
      if (res.success && res.user) {
        // Authenticated user role check
        if (res.user.role === 'Director') {
          router.push('/director')
        } else if (res.user.role === 'Project Head') {
          router.push('/project-head')
        } else {
          router.push('/employee')
        }
      } else if (res.success) {
        router.push('/')
      } else {
        setError(res.error || 'Invalid email or password.')
      }
    } catch (err) {
      setError('An unexpected error occurred during login.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F8FC] flex flex-col justify-between selection:bg-blue-500 selection:text-white">
      {/* Split-Screen Main Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-screen">
        
        {/* LEFT SIDE PANEL — Deep Navy Corporate Branding (#0B1428) */}
        <div className="lg:col-span-5 bg-[#0B1428] text-white p-8 sm:p-12 lg:p-16 flex flex-col justify-between relative overflow-hidden border-r border-slate-800">
          {/* Ambient Background Blur Elements */}
          <div className="absolute -left-20 -top-20 w-80 h-80 bg-blue-600/15 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute right-0 bottom-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

          {/* Top Brand Block */}
          <div className="relative z-10 space-y-6">
            <div className="inline-flex items-center gap-3.5 bg-white/5 border border-white/10 px-4 py-2.5 rounded-2xl backdrop-blur-md shadow-md">
              <img
                src="/logo.png"
                alt="Korals Design Logo"
                className="h-10 w-auto object-contain bg-black px-2 py-1 rounded-xl border border-slate-700/80 shadow-sm"
              />
              <div>
                <span className="text-xs font-black tracking-widest text-blue-400 uppercase block">KORALS DESIGN</span>
                <span className="text-[10px] text-slate-400 font-bold tracking-wider uppercase">PVT. LTD.</span>
              </div>
            </div>

            <div className="space-y-3">
              <span className="inline-block px-3 py-1 bg-blue-500/20 text-blue-300 text-[11px] font-extrabold tracking-wider rounded-full border border-blue-400/20 uppercase">
                Enterprise Workspace
              </span>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
                Project Monitoring & Task Management System
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 font-medium leading-relaxed max-w-md">
                One unified workspace for task allocation, daily work tracking, team coordination, and performance monitoring.
              </p>
            </div>
          </div>

          {/* Middle Architecture & Work Features */}
          <div className="relative z-10 my-8 hidden sm:block">
            <div className="grid grid-cols-2 gap-3 max-w-md">
              <div className="p-3.5 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-xs space-y-1.5 hover:bg-white/10 transition">
                <div className="flex items-center gap-2 text-blue-400">
                  <Layers size={16} />
                  <span className="text-xs font-extrabold text-white">Project Control</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Structured tracking across multi-stage architecture deliverables.
                </p>
              </div>

              <div className="p-3.5 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-xs space-y-1.5 hover:bg-white/10 transition">
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 size={16} />
                  <span className="text-xs font-extrabold text-white">Daily Board</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Real-time 8-hour daily entry logs and milestone verification.
                </p>
              </div>

              <div className="p-3.5 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-xs space-y-1.5 hover:bg-white/10 transition">
                <div className="flex items-center gap-2 text-indigo-400">
                  <Activity size={16} />
                  <span className="text-xs font-extrabold text-white">Performance</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Weekly & monthly performance analytics with free-hour logic.
                </p>
              </div>

              <div className="p-3.5 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-xs space-y-1.5 hover:bg-white/10 transition">
                <div className="flex items-center gap-2 text-amber-400">
                  <ShieldCheck size={16} />
                  <span className="text-xs font-extrabold text-white">Role Security</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Strict authorization for Director, Project Head, & Employees.
                </p>
              </div>
            </div>
          </div>

          {/* Left Panel Footer */}
          <div className="relative z-10 pt-4 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>&copy; {new Date().getFullYear()} Korals Design Pvt. Ltd.</span>
            <span className="flex items-center gap-1.5 font-bold text-emerald-400">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              System Online
            </span>
          </div>
        </div>

        {/* RIGHT SIDE PANEL — WORKSPACE ROLE SELECTION OR ROLE-SPECIFIC FORM */}
        <div className="lg:col-span-7 bg-[#F5F8FC] p-6 sm:p-12 lg:p-16 flex flex-col justify-center items-center">
          
          {/* STEP 1: ROLE SELECTION CARDS */}
          {selectedRole === 'SELECT' && (
            <div className="w-full max-w-lg space-y-8">
              <div className="text-center sm:text-left space-y-3">
                <div className="inline-block">
                  <img
                    src="/logo.png"
                    alt="Korals Design Logo"
                    className="h-12 w-auto object-contain bg-black px-3 py-1.5 rounded-2xl border border-slate-700/80 shadow-md"
                  />
                </div>
                <div>
                  <span className="text-xs font-extrabold text-[#2563EB] uppercase tracking-wider bg-blue-50 px-3 py-1 rounded-full border border-blue-200 inline-block mb-2">
                    Authentication Center
                  </span>
                  <h2 className="text-3xl sm:text-4xl font-black text-[#0F172A] tracking-tight">
                    Welcome to Korals Design
                  </h2>
                  <p className="text-xs sm:text-sm text-[#64748B] font-medium mt-1">
                    Choose your workspace to continue to your sign-in portal.
                  </p>
                </div>
              </div>

              {/* 3 Separate Role Cards */}
              <div className="space-y-4">
                {/* 1. EMPLOYEE ROLE CARD */}
                <div
                  onClick={() => handleRoleSelect('Employee')}
                  className="p-5 bg-white hover:bg-blue-50/40 border border-slate-200 hover:border-[#2563EB] rounded-3xl shadow-sm hover:shadow-md transition cursor-pointer group flex items-start gap-4"
                >
                  <div className="p-3.5 bg-blue-50 text-[#2563EB] group-hover:bg-[#2563EB] group-hover:text-white rounded-2xl transition shrink-0">
                    <User size={24} />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-[#0F172A] group-hover:text-[#2563EB] transition">
                        Employee
                      </h3>
                      <span className="text-xs font-extrabold text-[#2563EB] bg-blue-50 group-hover:bg-blue-100 px-2.5 py-1 rounded-full border border-blue-200 flex items-center gap-1">
                        <span>Continue</span>
                        <ArrowRight size={12} />
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed">
                      Manage assigned work, daily task board entries, reminders, and performance history.
                    </p>
                  </div>
                </div>

                {/* 2. DIRECTOR ROLE CARD */}
                <div
                  onClick={() => handleRoleSelect('Director')}
                  className="p-5 bg-white hover:bg-indigo-50/40 border border-slate-200 hover:border-[#4338CA] rounded-3xl shadow-sm hover:shadow-md transition cursor-pointer group flex items-start gap-4"
                >
                  <div className="p-3.5 bg-indigo-50 text-[#4338CA] group-hover:bg-[#4338CA] group-hover:text-white rounded-2xl transition shrink-0">
                    <Briefcase size={24} />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-[#0F172A] group-hover:text-[#4338CA] transition">
                        Director
                      </h3>
                      <span className="text-xs font-extrabold text-[#4338CA] bg-indigo-50 group-hover:bg-indigo-100 px-2.5 py-1 rounded-full border border-indigo-200 flex items-center gap-1">
                        <span>Continue</span>
                        <ArrowRight size={12} />
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed">
                      Manage organization teams, task assignments, project creation, private ratings, and executive reports.
                    </p>
                  </div>
                </div>

                {/* 3. PROJECT HEAD ROLE CARD */}
                <div
                  onClick={() => handleRoleSelect('Project Head')}
                  className="p-5 bg-white hover:bg-sky-50/40 border border-slate-200 hover:border-sky-600 rounded-3xl shadow-sm hover:shadow-md transition cursor-pointer group flex items-start gap-4"
                >
                  <div className="p-3.5 bg-sky-50 text-sky-600 group-hover:bg-sky-600 group-hover:text-white rounded-2xl transition shrink-0">
                    <LayoutDashboard size={24} />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-[#0F172A] group-hover:text-sky-600 transition">
                        Project Head
                      </h3>
                      <span className="text-xs font-extrabold text-sky-700 bg-sky-50 group-hover:bg-sky-100 px-2.5 py-1 rounded-full border border-sky-200 flex items-center gap-1">
                        <span>Continue</span>
                        <ArrowRight size={12} />
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed">
                      Monitor assigned project execution, supervise employee tasks, process flags, and review work progress.
                    </p>
                  </div>
                </div>
              </div>

              {/* Bottom Footer */}
              <div className="text-center text-xs font-semibold text-[#64748B] pt-4 border-t border-slate-200">
                Task Management System &bull; Phase 1 Production Build
              </div>
            </div>
          )}

          {/* STEP 2: DEDICATED ROLE-SPECIFIC LOGIN FORM */}
          {selectedRole !== 'SELECT' && (
            <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200/90 p-8 sm:p-10 space-y-7">
              
              {/* Back to Workspaces Navigation Button */}
              <button
                onClick={handleBackToSelect}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#0F172A] bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition cursor-pointer"
              >
                <ArrowLeft size={14} />
                <span>Back to Workspaces</span>
              </button>

              {/* Role Header Banner */}
              <div className="space-y-2">
                <span
                  className={`inline-block px-3 py-1 text-xs font-extrabold uppercase tracking-wider rounded-full border ${
                    selectedRole === 'Employee'
                      ? 'bg-blue-50 text-[#2563EB] border-blue-200'
                      : selectedRole === 'Director'
                      ? 'bg-indigo-50 text-[#4338CA] border-indigo-200'
                      : 'bg-sky-50 text-sky-700 border-sky-200'
                  }`}
                >
                  {selectedRole} Workspace
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight">
                  {selectedRole} Sign In
                </h2>
                <p className="text-xs sm:text-sm text-[#64748B] font-medium">
                  Sign in with your email address and password to access your {selectedRole.toLowerCase()} workspace.
                </p>
              </div>

              {/* Dedicated Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Email Field */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail size={18} />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={
                        selectedRole === 'Employee'
                          ? 'e.g. sarita@koralsdesign.com'
                          : selectedRole === 'Director'
                          ? 'e.g. director@company.com'
                          : 'e.g. projecthead@company.com'
                      }
                      required
                      className="w-full pl-10 pr-4 py-3 bg-[#F5F8FC] border border-slate-300 rounded-xl text-sm font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:bg-white transition"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock size={18} />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-10 pr-11 py-3 bg-[#F5F8FC] border border-slate-300 rounded-xl text-sm font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:bg-white transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Error Alert Box */}
                {error && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 flex items-center gap-2">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Sign In Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`w-full py-3.5 px-5 font-extrabold text-white rounded-xl shadow-md text-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:bg-slate-300 disabled:cursor-not-allowed ${
                    selectedRole === 'Employee'
                      ? 'bg-[#2563EB] hover:bg-[#1D4ED8]'
                      : selectedRole === 'Director'
                      ? 'bg-[#4338CA] hover:bg-[#3730A3]'
                      : 'bg-sky-600 hover:bg-sky-700'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In as {selectedRole}</span>
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </form>

              {/* Bottom Footer */}
              <div className="pt-4 text-center text-xs font-semibold text-[#64748B] border-t border-slate-200/80">
                Task Management System &bull; Phase 1 Production Build
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Login