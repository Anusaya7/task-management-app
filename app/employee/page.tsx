'use client'

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/src/contexts/AuthContext'
import EmployeeDashboard from '@/src/components/EmployeeDashboard'

export default function EmployeePage() {
  const { user, loading, isDirector, isProjectHead } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/')
      } else if (isDirector) {
        router.replace('/director')
      } else if (isProjectHead) {
        router.replace('/project-head')
      }
    }
  }, [user, loading, isDirector, isProjectHead, router])

  if (loading || !user || isDirector || isProjectHead) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-semibold text-slate-300">KORALS DESIGN PVT. LTD.</p>
        <p className="text-xs text-slate-500 mt-1">Loading Employee Work Portal...</p>
      </div>
    )
  }

  return <EmployeeDashboard />
}
