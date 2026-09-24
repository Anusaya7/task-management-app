'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Bell, Check, ExternalLink, Clock, Sparkles } from 'lucide-react'
import { Notification } from '../types'

interface NotificationCenterProps {
  onSelectTask?: (taskId: string) => void
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ onSelectTask }) => {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [hasError, setHasError] = useState<boolean>(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications')
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications || [])
        setUnreadCount(data.unreadCount || 0)
        setHasError(false)
      } else {
        setHasError(true)
      }
    } catch (err) {
      console.error('Error fetching notifications:', err)
      setHasError(true)
    }
  }

  useEffect(() => {
    fetchNotifications()
    // Auto-poll every 10 seconds for real-time updates
    const interval = setInterval(fetchNotifications, 10000)
    return () => clearInterval(interval)
  }, [])

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      setNotifications(prev => prev.map(n => n._id === notificationId || n.id === notificationId ? { ...n, isRead: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))

      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId })
      })
    } catch (err) {
      console.error('Failed to mark notification as read:', err)
    }
  }

  const handleMarkAllRead = async () => {
    try {
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
      setUnreadCount(0)

      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true })
      })
    } catch (err) {
      console.error('Failed to mark all as read:', err)
    }
  }

  const handleNotificationClick = (notif: Notification) => {
    const notifId = notif.id || notif._id
    if (notifId && !notif.isRead) {
      handleMarkAsRead(notifId)
    }
    if (notif.taskId && onSelectTask) {
      onSelectTask(notif.taskId)
      setIsOpen(false)
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return ''
    const d = new Date(dateString)
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition flex items-center gap-1.5 focus:outline-none"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell size={20} className="text-slate-300" />
        <span className="hidden sm:inline text-xs font-semibold">Notifications</span>
        {unreadCount > 0 && (
          <span className="bg-rose-500 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full animate-pulse shadow-sm">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden text-slate-900">
          
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-slate-900 text-white border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Bell size={18} className="text-indigo-400" />
              <h3 className="text-sm font-bold tracking-wide">Notifications</h3>
              {unreadCount > 0 && (
                <span className="bg-indigo-600 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-indigo-300 hover:text-white flex items-center gap-1 font-semibold transition"
              >
                <Check size={14} />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Sparkles size={32} className="mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-medium">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const notifId = notif.id || notif._id || ''
                return (
                  <div
                    key={notifId}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-3.5 hover:bg-slate-50 transition cursor-pointer flex gap-3 items-start ${
                      !notif.isRead ? 'bg-indigo-50/50 border-l-4 border-indigo-600' : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className={`text-xs font-bold truncate ${!notif.isRead ? 'text-indigo-900' : 'text-slate-900'}`}>
                          {notif.title}
                        </span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1 whitespace-nowrap">
                          <Clock size={11} />
                          {formatDate(notif.createdAt)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed mb-2">
                        {notif.message}
                      </p>

                      {notif.taskId && (
                        <div className="flex items-center justify-between pt-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleNotificationClick(notif)
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200"
                          >
                            <span>View Task</span>
                            <ExternalLink size={12} />
                          </button>

                          {!notif.isRead && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleMarkAsRead(notifId)
                              }}
                              className="text-[10px] font-semibold text-slate-400 hover:text-slate-600"
                            >
                              Mark read
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-center">
            {hasError ? (
              <span className="text-[11px] font-semibold text-amber-600">
                Notifications temporarily unavailable
              </span>
            ) : (
              <span className="text-[11px] text-slate-400">
                Auto-sync active &bull; KORALS DESIGN PVT. LTD.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default NotificationCenter
