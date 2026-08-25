'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

// ──────────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────────
interface Notification {
  id: string
  type: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  title: string
  body: string
  metadata: Record<string, any>
  read: boolean
  created_at: string
}

// ──────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────
const PRIORITY_CONFIG: Record<string, { color: string; dot: string; badge: string; icon: string }> = {
  critical: {
    color: 'border-l-red-500 bg-red-50/60',
    dot: 'bg-red-500',
    badge: 'bg-red-500',
    icon: '🚨',
  },
  high: {
    color: 'border-l-orange-500 bg-orange-50/60',
    dot: 'bg-orange-500',
    badge: 'bg-orange-500',
    icon: '⚠️',
  },
  medium: {
    color: 'border-l-amber-400 bg-amber-50/60',
    dot: 'bg-amber-400',
    badge: 'bg-amber-400',
    icon: '📋',
  },
  low: {
    color: 'border-l-emerald-500 bg-emerald-50/60',
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-500',
    icon: '✅',
  },
}

const TYPE_ICON: Record<string, string> = {
  assignment_overdue: '🔴',
  score_critical: '🚨',
  attempt_limit: '⛔',
  assignment_completed: '✅',
  score_low: '⚠️',
  no_activity: '💤',
  training_started: '▶️',
  score_improved: '📈',
  deadline_approaching: '⏰',
  assignment_created: '📋',
  score_high: '🏆',
  scenario_updated: '🔄',
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.floor((now - then) / 1000)
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function groupNotifications(notifications: Notification[]) {
  const today: Notification[] = []
  const yesterday: Notification[] = []
  const earlier: Notification[] = []
  const now = Date.now()
  const dayMs = 86400000

  notifications.forEach(n => {
    const diff = now - new Date(n.created_at).getTime()
    if (diff < dayMs) today.push(n)
    else if (diff < 2 * dayMs) yesterday.push(n)
    else earlier.push(n)
  })

  return { today, yesterday, earlier }
}

// ──────────────────────────────────────────────────
// NOTIFICATION ITEM
// ──────────────────────────────────────────────────
function NotificationItem({
  notif,
  onRead,
}: {
  notif: Notification
  onRead: (id: string) => void
}) {
  const cfg = PRIORITY_CONFIG[notif.priority] || PRIORITY_CONFIG.medium
  const typeIcon = TYPE_ICON[notif.type] || '🔔'

  return (
    <button
      onClick={() => onRead(notif.id)}
      title="Click to dismiss"
      className={`w-full text-left group flex gap-3 px-4 py-3.5 border-l-4 transition-all duration-200 hover:brightness-95 ${cfg.color}`}
    >
      {/* Icon */}
      <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center text-base border border-white/80">
        {typeIcon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[13px] font-[700] text-[#1A2A3A] leading-tight line-clamp-1">{notif.title}</p>
          <span className="text-[10px] text-[#94A3B8] font-[500] whitespace-nowrap flex-shrink-0 mt-0.5">
            {timeAgo(notif.created_at)}
          </span>
        </div>
        <p className="text-[12px] text-[#475569] leading-relaxed mt-0.5 line-clamp-2">{notif.body}</p>
        {notif.metadata?.repName && (
          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-white/70 border border-[#E2E8F0] text-[10px] font-[600] text-[#64748B]">
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {notif.metadata.repName}
          </span>
        )}
      </div>

      {/* Unread dot */}
      {!notif.read && (
        <div className={`flex-shrink-0 w-2 h-2 rounded-full mt-1.5 ${cfg.dot} shadow-sm`} />
      )}
    </button>
  )
}

// ──────────────────────────────────────────────────
// NOTIFICATION PANEL
// ──────────────────────────────────────────────────
function NotificationPanel({
  notifications,
  unreadCount,
  loading,
  onRead,
  onReadAll,
  onClose,
}: {
  notifications: Notification[]
  unreadCount: number
  loading: boolean
  onRead: (id: string) => void
  onReadAll: () => void
  onClose: () => void
}) {
  const groups = groupNotifications(notifications)

  const renderGroup = (label: string, items: Notification[]) => {
    if (items.length === 0) return null
    return (
      <div key={label}>
        <div className="sticky top-0 px-4 py-1.5 bg-white/95 backdrop-blur-sm border-b border-[#F1F5F9] z-10">
          <p className="text-[10px] font-[800] text-[#94A3B8] uppercase tracking-widest">{label}</p>
        </div>
        <div className="divide-y divide-[#F1F5F9]">
          {items.map(n => (
            <NotificationItem key={n.id} notif={n} onRead={onRead} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      className="absolute right-0 top-full mt-2 w-[380px] max-h-[520px] bg-white rounded-2xl border border-[#E2E8F0] shadow-2xl shadow-slate-200/60 overflow-hidden flex flex-col z-50"
      style={{ animation: 'dropIn 0.18s cubic-bezier(0.16,1,0.3,1)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#F1F5F9] bg-gradient-to-r from-[#1E1B4B] to-[#312E81] flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-white text-base">🔔</span>
          <h3 className="text-sm font-[800] text-white tracking-tight">Notifications</h3>
          {unreadCount > 0 && (
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-[10px] font-[800] text-white shadow-sm">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={onReadAll}
              className="text-[11px] font-[600] text-indigo-200 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/10"
            >
              Mark all read
            </button>
          )}
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-indigo-200 hover:text-white hover:bg-white/10 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="overflow-y-auto flex-1 scroll-smooth">
        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-8 h-8 border-3 border-[#1E1B4B] border-t-transparent rounded-full animate-spin" />
            <p className="text-[12px] text-[#94A3B8] font-[500]">Loading notifications…</p>
          </div>
        )}

        {!loading && notifications.length === 0 && (
          <div className="flex flex-col items-center justify-center py-14 gap-3 text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center text-2xl">
              🔕
            </div>
            <p className="text-[13px] font-[700] text-[#1A2A3A]">All clear!</p>
            <p className="text-[12px] text-[#94A3B8]">No notifications yet. They'll appear here as your team trains.</p>
          </div>
        )}

        {!loading && notifications.length > 0 && (
          <>
            {renderGroup('Today', groups.today)}
            {renderGroup('Yesterday', groups.yesterday)}
            {renderGroup('Earlier', groups.earlier)}
          </>
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="px-4 py-2.5 border-t border-[#F1F5F9] bg-[#FAFBFF] flex-shrink-0">
          <p className="text-[10px] text-[#CBD5E1] text-center font-[500]">
            Click a notification to dismiss it · Auto-refreshes every 30s
          </p>
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────
// TOPBAR (main export)
// ──────────────────────────────────────────────────
export default function Topbar() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [orgName, setOrgName] = useState('')
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifLoading, setNotifLoading] = useState(false)
  const [bellPulse, setBellPulse] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const prevUnreadRef = useRef(0)

  const fetchNotifications = useCallback(async () => {
    const token = localStorage.getItem('token')
    if (!token) return
    try {
      const res = await fetch(`${API}/api/manager/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      setNotifications(data.notifications || [])
      const newUnread: number = data.unreadCount || 0
      if (newUnread > prevUnreadRef.current && prevUnreadRef.current !== -1) {
        // New notifications arrived — pulse bell
        setBellPulse(true)
        setTimeout(() => setBellPulse(false), 2000)
      }
      prevUnreadRef.current = newUnread
      setUnreadCount(newUnread)
    } catch {
      // Silently fail — notifications are non-critical
    }
  }, [])

  // Initial load + user info
  useEffect(() => {
    const token = localStorage.getItem('token')
    const orgId = localStorage.getItem('orgId')
    if (token) {
      fetch(`${API}/api/users/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(user => setUserName(user.name))
        .catch(() => {})
    }
    if (orgId && token) {
      fetch(`${API}/api/users/org-details`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(org => setOrgName(org.name))
        .catch(() => {})
    }

    // Initial fetch (mark ref as -1 to avoid false pulse on mount)
    prevUnreadRef.current = -1
    fetchNotifications().then(() => {
      // After first fetch, set actual value so future polls can detect changes
      prevUnreadRef.current = unreadCount
    })

    // Poll every 30 seconds
    const interval = setInterval(fetchNotifications, 30_000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  // NOTE: No fetch on panel open — we show cached data instantly.
  // The 30s background poll (below) keeps the data fresh without blocking the UI.

  // Close panel on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowNotifications(false)
      }
    }
    if (showNotifications) {
      document.addEventListener('mousedown', handleOutsideClick)
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [showNotifications])

  const handleMarkRead = async (id: string) => {
    const token = localStorage.getItem('token')
    if (!token) return
    // Remove the notification from the list immediately (optimistic)
    setNotifications(prev => prev.filter(n => n.id !== id))
    setUnreadCount(prev => Math.max(0, prev - 1))
    prevUnreadRef.current = Math.max(0, prevUnreadRef.current - 1)
    try {
      await fetch(`${API}/api/manager/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch {}
  }

  const handleMarkAllRead = async () => {
    const token = localStorage.getItem('token')
    if (!token) return
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
    prevUnreadRef.current = 0
    try {
      await fetch(`${API}/api/manager/notifications/read-all`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch {}
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    router.push('/login')
  }

  return (
    <>
      <style>{`
        @keyframes dropIn {
          from { opacity: 0; transform: translateY(-8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)  scale(1); }
        }
        @keyframes bellShake {
          0%, 100% { transform: rotate(0deg); }
          15%       { transform: rotate(10deg); }
          30%       { transform: rotate(-8deg); }
          45%       { transform: rotate(6deg); }
          60%       { transform: rotate(-4deg); }
          75%       { transform: rotate(2deg); }
        }
        @keyframes pulseBadge {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); }
          50%       { box-shadow: 0 0 0 5px rgba(239,68,68,0); }
        }
        .bell-shake { animation: bellShake 0.6s ease-in-out; }
        .badge-pulse { animation: pulseBadge 1.5s ease-in-out infinite; }
      `}</style>

      <header className="h-16 bg-white border-b border-[#E2E8F0] flex items-center justify-between px-8 sticky top-0 z-30">
        <div />

        <div className="flex items-center gap-3">
          {/* ── Bell Icon ── */}
          <div className="relative" ref={panelRef}>
            <button
              id="notifications-bell"
              onClick={() => setShowNotifications(v => !v)}
              className={`relative w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 border border-transparent hover:border-[#E2E8F0] hover:bg-[#F8FAFC] ${showNotifications ? 'bg-[#F8FAFC] border-[#E2E8F0]' : ''} ${bellPulse ? 'bell-shake' : ''}`}
              aria-label="Open notifications"
            >
              <svg
                className={`w-5 h-5 transition-colors duration-200 ${unreadCount > 0 ? 'text-[#1E1B4B]' : 'text-[#94A3B8]'}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>

              {/* Unread badge */}
              {unreadCount > 0 && (
                <span
                  className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-[10px] font-[800] text-white shadow-md leading-none badge-pulse`}
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification dropdown panel */}
            {showNotifications && (
              <NotificationPanel
                notifications={notifications}
                unreadCount={unreadCount}
                loading={notifLoading}
                onRead={handleMarkRead}
                onReadAll={handleMarkAllRead}
                onClose={() => setShowNotifications(false)}
              />
            )}
          </div>

          {/* ── User Menu ── */}
          <div className="relative group">
            <button className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#F8FAFC] rounded-xl transition-all border border-transparent hover:border-[#E2E8F0]">
              {userName && ['barani', 'lokesh', 'pankaj', 'reddy', 'sujeevan', 'sridhar'].includes(userName.toLowerCase()) ? (
                <img
                  src={`/avatars/${userName.toLowerCase()}${userName.toLowerCase() === 'pankaj' ? '.jpeg' : '.jpg'}`}
                  alt={userName}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 bg-[#2C5282] rounded-full flex items-center justify-center text-sm font-bold text-white">
                  {userName ? userName.charAt(0).toUpperCase() : 'M'}
                </div>
              )}
              <span className="text-base font-semibold text-[#1A2A3A] hidden md:block">
                {userName ? `${userName} (Manager)` : 'Manager'}
              </span>
              <svg className="w-4 h-4 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <div className="absolute right-0 w-44 pt-2 opacity-0 translate-y-1 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-150 z-50">
              <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-lg overflow-hidden">
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-3 text-sm text-red-500 hover:bg-red-50 transition-all flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>
    </>
  )
}
