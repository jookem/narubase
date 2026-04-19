import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { BookingRequestCard } from '@/components/booking/BookingRequestCard'
import { MonthCalendar } from '@/components/calendar/MonthCalendar'
import type { BookingRequestWithProfiles } from '@/lib/types/database'
import { subMonths, addMonths } from 'date-fns'
import { PageError } from '@/components/shared/PageError'

// Fixed color palette — safe Tailwind classes (not dynamic)
const TEACHER_COLORS = [
  { bg: 'bg-blue-100',   text: 'text-blue-700',   active: 'bg-blue-500 text-white',   inactive: 'bg-white text-blue-600 border border-blue-200' },
  { bg: 'bg-purple-100', text: 'text-purple-700', active: 'bg-purple-500 text-white', inactive: 'bg-white text-purple-600 border border-purple-200' },
  { bg: 'bg-emerald-100',text: 'text-emerald-700',active: 'bg-emerald-500 text-white',inactive: 'bg-white text-emerald-600 border border-emerald-200' },
  { bg: 'bg-rose-100',   text: 'text-rose-700',   active: 'bg-rose-500 text-white',   inactive: 'bg-white text-rose-600 border border-rose-200' },
  { bg: 'bg-amber-100',  text: 'text-amber-700',  active: 'bg-amber-500 text-white',  inactive: 'bg-white text-amber-600 border border-amber-200' },
  { bg: 'bg-cyan-100',   text: 'text-cyan-700',   active: 'bg-cyan-500 text-white',   inactive: 'bg-white text-cyan-600 border border-cyan-200' },
]

export function CalendarPage() {
  const { user, profile } = useAuth()
  const isTeacher = profile?.role === 'teacher'

  const [allLessons, setAllLessons] = useState<any[]>([])
  const [allRequests, setAllRequests] = useState<any[]>([])
  const [teachers, setTeachers] = useState<{ id: string; full_name: string }[]>([])
  const [activeTeachers, setActiveTeachers] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadData() {
    if (!user || !profile) return
    try {
      const rangeStart = subMonths(new Date(), 6).toISOString()
      const rangeEnd = addMonths(new Date(), 6).toISOString()

      const baseSelect = 'id, teacher_id, scheduled_start, scheduled_end, status, is_group, group_name, student:profiles!lessons_student_id_fkey(full_name), teacher:profiles!lessons_teacher_id_fkey(full_name), lesson_participants(student:profiles!lesson_participants_student_id_fkey(full_name))'

      if (isTeacher) {
        const [lessonsRes, requestsRes, teachersRes] = await Promise.all([
          supabase
            .from('lessons')
            .select(baseSelect)
            .gte('scheduled_start', rangeStart)
            .lte('scheduled_start', rangeEnd)
            .order('scheduled_start', { ascending: true }),

          supabase
            .from('booking_requests')
            .select('*, student:profiles!booking_requests_student_id_fkey(id, full_name, display_name, avatar_url), teacher:profiles!booking_requests_teacher_id_fkey(id, full_name, display_name, avatar_url)')
            .eq('status', 'pending')
            .order('requested_start', { ascending: true }),

          supabase
            .from('profiles')
            .select('id, full_name')
            .eq('role', 'teacher')
            .order('full_name'),
        ])

        const teacherList = teachersRes.data ?? []
        setTeachers(teacherList)
        setActiveTeachers(new Set([user.id]))
        setAllLessons((lessonsRes.data ?? []).filter((l: any) => l.status !== 'cancelled'))
        setAllRequests(requestsRes.data ?? [])

      } else {
        // Student view — unchanged
        const { data: participations } = await supabase
          .from('lesson_participants')
          .select('lesson_id')
          .eq('student_id', user.id)
        const participantLessonIds = (participations ?? []).map((p: any) => p.lesson_id)
        const orFilter = participantLessonIds.length
          ? `student_id.eq.${user.id},id.in.(${participantLessonIds.join(',')})`
          : `student_id.eq.${user.id}`

        const [{ data: lessonsData }, { data: requestsData }] = await Promise.all([
          supabase
            .from('lessons')
            .select(baseSelect)
            .or(orFilter)
            .gte('scheduled_start', rangeStart)
            .lte('scheduled_start', rangeEnd)
            .order('scheduled_start', { ascending: true }),
          supabase
            .from('booking_requests')
            .select('id, requested_start, status, teacher:profiles!booking_requests_teacher_id_fkey(full_name)')
            .eq('student_id', user.id)
            .eq('status', 'pending'),
        ])
        setAllLessons((lessonsData ?? []).filter((l: any) => l.status !== 'cancelled'))
        setAllRequests(requestsData ?? [])
      }

      setError(null)
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load calendar')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [user, profile])

  function toggleTeacher(tid: string) {
    setActiveTeachers(prev => {
      const next = new Set(prev)
      next.has(tid) ? next.delete(tid) : next.add(tid)
      return next
    })
  }

  // Build color map: teacher_id → color classes
  const teacherColorMap: Record<string, { bg: string; text: string }> = {}
  teachers.forEach((t, i) => {
    const c = TEACHER_COLORS[i % TEACHER_COLORS.length]
    teacherColorMap[t.id] = { bg: c.bg, text: c.text }
  })

  // Filter lessons and requests to active teachers
  const visibleLessons = isTeacher && activeTeachers.size > 0
    ? allLessons.filter(l => activeTeachers.has(l.teacher_id))
    : allLessons

  const visibleRequests = isTeacher && activeTeachers.size > 0
    ? allRequests.filter(r => activeTeachers.has(r.teacher?.id ?? r.teacher_id))
    : allRequests

  if (error) return <PageError message={error} onRetry={loadData} />

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
        <div className="h-96 bg-gray-200 rounded-lg animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Calendar</h1>
      </div>

      {/* Teacher toggle buttons */}
      {isTeacher && teachers.length > 1 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-gray-400 font-medium uppercase tracking-wide mr-1">Show:</span>
          {teachers.map((t, i) => {
            const c = TEACHER_COLORS[i % TEACHER_COLORS.length]
            const isActive = activeTeachers.has(t.id)
            const isMe = t.id === user?.id
            return (
              <button
                key={t.id}
                onClick={() => toggleTeacher(t.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? c.active : c.inactive
                }`}
              >
                {isMe ? `${t.full_name} (you)` : t.full_name}
              </button>
            )
          })}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white border border-gray-200 rounded-lg p-4">
          <MonthCalendar
            lessons={visibleLessons}
            pendingRequests={visibleRequests}
            role={isTeacher ? 'teacher' : 'student'}
            teacherColorMap={teachers.length > 1 ? teacherColorMap : undefined}
            onRequestHandled={loadData}
          />
        </div>

        {isTeacher && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              Pending Requests ({visibleRequests.length})
            </h2>
            {visibleRequests.length === 0 ? (
              <p className="text-sm text-gray-500">No pending requests.</p>
            ) : (
              visibleRequests.map(req => (
                <BookingRequestCard
                  key={req.id}
                  request={req as unknown as BookingRequestWithProfiles}
                  onHandled={loadData}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
