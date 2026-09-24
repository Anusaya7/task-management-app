'use client'

import { useAuth } from '../src/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Login from '../src/components/Login'

export default function Home() {
  const { user, loading, initError, retryAuth, isDirector, isProjectHead, isEmployee } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      if (isDirector) {
        router.replace('/director')
      } else if (isProjectHead) {
        router.replace('/project-head')
      } else {
        router.replace('/employee')
      }
    }
  }, [user, loading, isDirector, isProjectHead, isEmployee, router])

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-semibold text-slate-300">KORALS DESIGN PVT. LTD.</p>
        <p className="text-xs text-slate-500 mt-1">Loading Task Management System...</p>
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  return null
}
