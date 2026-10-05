'use client'

import { useAuth } from '../src/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Login from '../src/components/Login'

export default function Home() {
  const { user, loading, initError, retryAuth, isDirector, isProjectHead, isEmployee } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user) {
      if (isDirector) {
        router.replace('/director')
      } else if (isProjectHead) {
        router.replace('/project-head')
      } else {
        router.replace('/employee')
      }
    }
  }, [user, isDirector, isProjectHead, isEmployee, router])

  if (user) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-semibold text-slate-300">KORALS DESIGN PVT. LTD.</p>
        <p className="text-xs text-slate-500 mt-1">Opening your workspace...</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-semibold text-slate-300">KORALS DESIGN PVT. LTD.</p>
        <p className="text-xs text-slate-500 mt-1">Loading Task Management System...</p>
      </div>
    )
  }

  if (initError) {
    return (
      <>
        <div className="fixed inset-x-4 top-4 z-50 mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-lg">
          <span>Unable to verify your existing session. You can retry or sign in below.</span>
          <button
            onClick={() => void retryAuth()}
            className="rounded-lg bg-amber-700 px-4 py-2 text-xs font-bold text-white hover:bg-amber-800"
          >
            Retry Session
          </button>
        </div>
        <Login />
      </>
    )
  }

  return <Login />
}
