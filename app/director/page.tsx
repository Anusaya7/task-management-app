'use client'

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/src/contexts/AuthContext'
import Dashboard from '@/src/components/Dashboard'

export default function DirectorPage() {
  const { user, loading, initError, retryAuth, isDirector, isProjectHead, isEmployee } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/')
      } else if (!isDirector) {
        if (isProjectHead) {
          router.replace('/project-head')
        } else if (isEmployee) {
          router.replace('/employee')
        } else {
          router.replace('/')
        }
      }
    }
  }, [user, loading, isDirector, isProjectHead, isEmployee, router])


  if (loading || !user || !isDirector) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-semibold text-slate-300">KORALS DESIGN PVT. LTD.</p>
        <p className="text-xs text-slate-500 mt-1">Verifying Director Authorization...</p>
      </div>
    )
  }

  return <Dashboard />
}
