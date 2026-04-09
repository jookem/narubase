import { createContext, useContext, useEffect, useState, useRef, useCallback, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export interface NotificationItem {
  id: string
  type: 'booking_request' | 'booking_approved' | 'booking_declined'
  title: string
  body: string
  date: string
  requestId?: string
}

interface NotificationsContextValue {
  items: NotificationItem[]
  unreadCount: number
  loading: boolean
  clearUnread: () => void
  reload: () => void
}

const NotificationsContext = createContext<NotificationsContextValue>({
  items: [],
  unreadCount: 0,
  loading: false,
  clearUnread: () => {},
  reload: () => {},
})

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const load = useCallback(async () => {
    if (!user || !profile) return
    setLoading(true)

    if (profile.role === 'teacher') {
      const { data } = await supabase
        .from('booking_requests')
        .select('id, requested_start, requested_end, student_note, created_at, profiles!booking_requests_student_id_fkey(full_name)')
        .eq('teacher_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      const notifications: NotificationItem[] = (data ?? []).map((r: any) => {
        const start = new Date(r.requested_start)
        const dateStr = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
        const timeStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        return {
          id: r.id,
          type: 'booking_request',
          title: `${r.profiles?.full_name ?? 'A student'} requested a lesson`,
          body: `${dateStr} at ${timeStr}${r.student_note ? ` — "${r.student_note}"` : ''}`,
          date: r.created_at,
          requestId: r.id,
        }
      })
      setItems(notifications)
      setUnreadCount(notifications.length)
    } else {
      // Students: recent booking status changes
      const { data } = await supabase
        .from('booking_requests')
        .select('id, requested_start, status, teacher_note, updated_at, profiles!booking_requests_teacher_id_fkey(full_name)')
        .eq('student_id', user.id)
        .in('status', ['approved', 'declined'])
        .order('updated_at', { ascending: false })
        .limit(20)

      const notifications: NotificationItem[] = (data ?? []).map((r: any) => {
        const start = new Date(r.requested_start)
        const dateStr = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
        const timeStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        const approved = r.status === 'approved'
        return {
          id: r.id,
          type: approved ? 'booking_approved' : 'booking_declined',
          title: approved ? 'Lesson confirmed!' : 'Lesson request declined',
          body: `${dateStr} at ${timeStr}${r.teacher_note ? ` — "${r.teacher_note}"` : ''}`,
          date: r.updated_at,
        }
      })
      setItems(notifications)
      // Don't persist student unread count for now — just show all recent
      setUnreadCount(notifications.filter(n => n.type === 'booking_approved' || n.type === 'booking_declined').length)
    }

    setLoading(false)
  }, [user, profile])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!user || !profile) return

    const channelName = `notifications:${user.id}`
    const channel = supabase.channel(channelName)

    if (profile.role === 'teacher') {
      channel.on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'booking_requests',
        filter: `teacher_id=eq.${user.id}`,
      }, () => load())
      channel.on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'booking_requests',
        filter: `teacher_id=eq.${user.id}`,
      }, () => load())
    } else {
      channel.on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'booking_requests',
        filter: `student_id=eq.${user.id}`,
      }, (payload) => {
        const s = (payload.new as { status: string }).status
        if (s === 'approved' || s === 'declined') load()
      })
    }

    channel.subscribe()
    channelRef.current = channel
    return () => { channel.unsubscribe(); channelRef.current = null }
  }, [user, profile, load])

  function clearUnread() { setUnreadCount(0) }

  return (
    <NotificationsContext.Provider value={{ items, unreadCount, loading, clearUnread, reload: load }}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  return useContext(NotificationsContext)
}
