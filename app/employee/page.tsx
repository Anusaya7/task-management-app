'use client'

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/src/contexts/AuthContext'
import EmployeeDashboard from '@/src/components/EmployeeDashboard'
import Login from '@/src/components/Login'

export default function EmployeePage() {
  const { user, loading, initError, retryAuth, isDirector, isProjectHead, isEmployee } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/')
      } else if (isDirector) {
        router.replace('/director')
      } else if (isProjectHead) {
        router.replace('/project-head')
      } else if (!isEmployee) {
        router.replace('/')
      }
    }
  }, [user, loading, isDirector, isProjectHead, isEmployee, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-semibold text-slate-300">KORALS DESIGN PVT. LTD.</p>
        <p className="text-xs text-slate-500 mt-1">Verifying your Employee Work Portal session...</p>
      </div>
    )
  }

  if (!user) {
    if (initError) {
      return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-5 p-4 text-white">
          <div className="max-w-md text-center">
            <p className="text-sm font-semibold text-slate-300">KORALS DESIGN PVT. LTD.</p>
            <h1 className="mt-3 text-lg font-bold">Unable to load the Employee Work Portal.</h1>
            <p className="mt-2 text-sm text-slate-400">Session verification could not be completed. Please retry or sign in.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={() => void retryAuth()}
              className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Retry
            </button>
            <button
              onClick={() => router.replace('/')}
              className="rounded-lg border border-slate-600 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800"
            >
              Go to Login
            </button>
          </div>
        </div>
      )
    }
    return <Login />
  }

  if (isDirector || isProjectHead || !isEmployee) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-sm text-slate-300">
        Opening your authorized workspace...
      </div>
    )
  }

  return <EmployeeDashboard />
}
