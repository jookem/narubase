import { useEffect, useRef, useState } from 'react'
import { Bell, X, CheckCircle, XCircle, CalendarClock } from 'lucide-react'
import { useNotifications } from '@/contexts/NotificationsContext'
import { useAuth } from '@/contexts/AuthContext'
import { approveBookingRequest, declineBookingRequest } from '@/lib/api/bookings'
import { toast } from 'sonner'

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function NotificationBell() {
  const { items, unreadCount, loading, clearUnread, reload } = useNotifications()
  const { profile } = useAuth()
  const [open, setOpen] = useState(false)
  const [actioning, setActioning] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (!panelRef.current?.contains(e.target as Node) && !buttonRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function toggle() {
    setOpen(v => {
      if (!v) clearUnread()
      return !v
    })
  }

  async function handleApprove(requestId: string) {
    setActioning(requestId)
    const { error } = await approveBookingRequest(requestId)
    setActioning(null)
    if (error) toast.error(error)
    else { toast.success('Lesson confirmed!'); reload() }
  }

  async function handleDecline(requestId: string) {
    setActioning(requestId)
    const { error } = await declineBookingRequest(requestId)
    setActioning(null)
    if (error) toast.error(error)
    else { toast.success('Request declined.'); reload() }
  }

  const isTeacher = profile?.role === 'teacher'

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={toggle}
        className="relative p-1.5 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-900">Notifications</span>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X size={15} />
            </button>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
            {loading ? (
              <div className="p-4 space-y-3">
                {[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell size={24} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-400">No notifications</p>
              </div>
            ) : (
              items.map(item => (
                <div key={item.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 mt-0.5">
                      {item.type === 'booking_request' && <CalendarClock size={16} className="text-brand" />}
                      {item.type === 'booking_approved' && <CheckCircle size={16} className="text-green-500" />}
                      {item.type === 'booking_declined' && <XCircle size={16} className="text-red-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{item.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-snug">{item.body}</p>
                      <p className="text-[11px] text-gray-400 mt-1">{timeAgo(item.date)}</p>

                      {/* Teacher: approve/decline actions on booking requests */}
                      {isTeacher && item.type === 'booking_request' && item.requestId && (
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => handleApprove(item.requestId!)}
                            disabled={actioning === item.requestId}
                            className="px-2.5 py-1 text-xs bg-brand text-white rounded-md hover:bg-brand/90 transition-colors disabled:opacity-50"
                          >
                            {actioning === item.requestId ? '…' : 'Confirm'}
                          </button>
                          <button
                            onClick={() => handleDecline(item.requestId!)}
                            disabled={actioning === item.requestId}
                            className="px-2.5 py-1 text-xs border border-gray-200 text-gray-600 rounded-md hover:bg-gray-100 transition-colors disabled:opacity-50"
                          >
                            Decline
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
