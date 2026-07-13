import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, isToday,
  addMonths, subMonths, format,
} from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import { useTimezone } from '@/lib/hooks/useTimezone'
import { supabase } from '@/lib/supabase'
import { NotesReadView } from '@/components/lesson/NotesReadView'

type Lesson = {
  id: string
  teacher_id?: string
  scheduled_start: string
  scheduled_end: string
  status: string
  is_group?: boolean
  group_name?: string | null
  student?: { full_name: string } | null
  teacher?: { full_name: string } | null
  lesson_participants?: { student: { full_name: string } | null }[]
}

type BookingRequest = {
  id: string
  requested_start: string
  status: string
  student?: { full_name: string } | null
  teacher?: { full_name: string } | null
}

type TeacherColor = { bg: string; text: string }

type Props = {
  lessons: Lesson[]
  pendingRequests: BookingRequest[]
  role: 'teacher' | 'student'
  teacherColorMap?: Record<string, TeacherColor>
  onRequestHandled?: () => void
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function lessonStudentNames(l: Lesson): string[] {
  // For group lessons, lesson_participants contains ALL students (including primary) — use it exclusively
  if (l.is_group && l.lesson_participants?.length) {
    return (l.lesson_participants).map(p => p.student?.full_name).filter(Boolean) as string[]
  }
  return l.student?.full_name ? [l.student.full_name] : []
}

function lessonLabel(l: Lesson): string {
  if (l.is_group) return l.group_name ?? 'Group'
  return l.student?.full_name?.split(' ')[0] ?? ''
}

export function MonthCalendar({ lessons, pendingRequests, role, teacherColorMap }: Props) {
  const [current, setCurrent] = useState(() => new Date())
  const [selected, setSelected] = useState<Date | null>(null)
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null)
  const [notesCache, setNotesCache] = useState<Record<string, any | null>>({})
  const [loadingNoteId, setLoadingNoteId] = useState<string | null>(null)
  const TZ = useTimezone()

  async function toggleNotes(lessonId: string) {
    if (expandedNoteId === lessonId) {
      setExpandedNoteId(null)
      return
    }
    setExpandedNoteId(lessonId)
    if (lessonId in notesCache) return

    setLoadingNoteId(lessonId)
    let notes: any = null
    if (role === 'teacher') {
      const { data } = await supabase
        .from('lesson_notes')
        .select('summary, vocabulary, grammar_points, homework, strengths, areas_to_focus')
        .eq('lesson_id', lessonId)
        .is('student_id', null)
        .maybeSingle()
      notes = data
    } else {
      // Try individual note first, fall back to group note
      const { data: auth } = await supabase.auth.getUser()
      const uid = auth.user?.id
      const [indRes, grpRes] = await Promise.all([
        uid
          ? supabase.from('lesson_notes').select('summary, vocabulary, grammar_points, homework, strengths, areas_to_focus').eq('lesson_id', lessonId).eq('student_id', uid).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from('lesson_notes').select('summary, vocabulary, grammar_points, homework, strengths, areas_to_focus').eq('lesson_id', lessonId).is('student_id', null).eq('is_visible_to_student', true).maybeSingle(),
      ])
      notes = indRes.data ?? grpRes.data
    }
    setNotesCache(prev => ({ ...prev, [lessonId]: notes }))
    setLoadingNoteId(null)
  }

  const monthStart = startOfMonth(current)
  const monthEnd = endOfMonth(current)
  const gridStart = startOfWeek(monthStart)
  const gridEnd = endOfWeek(monthEnd)
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  function lessonsOnDay(day: Date) {
    return lessons.filter(l => isSameDay(new Date(l.scheduled_start), day))
  }

  function requestsOnDay(day: Date) {
    return pendingRequests.filter(r => isSameDay(new Date(r.requested_start), day))
  }

  const selectedLessons = selected ? lessonsOnDay(selected) : []
  const selectedRequests = selected ? requestsOnDay(selected) : []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => setCurrent(d => subMonths(d, 1))} className="p-2 rounded hover:bg-gray-100 text-gray-600">
          ‹
        </button>
        <h2 className="text-lg font-semibold">{format(current, 'MMMM yyyy')}</h2>
        <button onClick={() => setCurrent(d => addMonths(d, 1))} className="p-2 rounded hover:bg-gray-100 text-gray-600">
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 text-center">
        {DAY_LABELS.map(d => (
          <div key={d} className="text-xs font-medium text-gray-400 py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 border-l border-t border-gray-200">
        {days.map(day => {
          const dayLessons = lessonsOnDay(day)
          const dayRequests = requestsOnDay(day)
          const isCurrentMonth = isSameMonth(day, current)
          const isSelected = selected ? isSameDay(day, selected) : false
          const today = isToday(day)

          return (
            <button
              key={day.toISOString()}
              onClick={() => setSelected(isSelected ? null : day)}
              className={`
                relative min-h-[128px] p-1.5 text-left border-r border-b border-gray-200 transition-colors
                ${isCurrentMonth ? 'bg-white hover:bg-gray-50' : 'bg-gray-50'}
                ${isSelected ? 'ring-2 ring-inset ring-brand' : ''}
              `}
            >
              <span className={`
                absolute top-1.5 left-1.5 text-xs font-medium inline-flex h-6 w-6 items-center justify-center rounded-full
                ${today ? 'bg-brand text-white' : isCurrentMonth ? 'text-gray-900' : 'text-gray-300'}
              `}>
                {format(day, 'd')}
              </span>

              <div className="mt-7 space-y-[2px]">
                {dayLessons.slice(0, 5).map(l => {
                  const tc = l.teacher_id && teacherColorMap ? teacherColorMap[l.teacher_id] : null
                  return (
                  <div
                    key={l.id}
                    className={`text-[10px] leading-tight px-1 py-[1px] rounded truncate ${
                      l.status === 'completed' ? 'bg-green-100 text-green-700' :
                      l.status === 'cancelled' ? 'bg-gray-100 text-gray-400 line-through' :
                      tc ? `${tc.bg} ${tc.text}` : 'bg-brand-light text-brand-dark'
                    }`}
                  >
                    {formatInTimeZone(new Date(l.scheduled_start), TZ, 'h:mm')}
                    {' '}
                    {role === 'teacher' ? lessonLabel(l) : l.teacher?.full_name?.split(' ')[0]}
                  </div>
                  )
                })}
                {dayRequests.slice(0, 2).map(r => (
                  <div key={r.id} className="text-[10px] leading-tight px-1 py-[1px] rounded truncate bg-orange-100 text-orange-700">
                    {formatInTimeZone(new Date(r.requested_start), TZ, 'h:mm')} req
                  </div>
                ))}
                {(dayLessons.length + dayRequests.length) > 7 && (
                  <div className="text-[10px] text-gray-400 px-1">
                    +{dayLessons.length + dayRequests.length - 7} more
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {selected && (selectedLessons.length > 0 || selectedRequests.length > 0) && (
        <div className="border border-gray-200 rounded-lg p-4 space-y-3">
          <h3 className="font-medium text-sm">{format(selected, 'EEEE, MMMM d')}</h3>

          {selectedLessons.map(l => {
            const tc = l.teacher_id && teacherColorMap ? teacherColorMap[l.teacher_id] : null
            const isExpanded = expandedNoteId === l.id
            const notes = notesCache[l.id]
            return (
            <div key={l.id} className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium flex items-center gap-1.5">
                    {role === 'teacher'
                      ? l.is_group ? (l.group_name ?? 'Group') : l.student?.full_name
                      : l.teacher?.full_name}
                    {tc && role === 'teacher' && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-normal ${tc.bg} ${tc.text}`}>
                        {l.teacher?.full_name?.split(' ')[0]}
                      </span>
                    )}
                  </p>
                  {role === 'teacher' && l.is_group && (
                    <p className="text-xs text-gray-400">{lessonStudentNames(l).map(n => n.split(' ')[0]).join(', ')}</p>
                  )}
                  <p className="text-xs text-gray-500">
                    {formatInTimeZone(new Date(l.scheduled_start), TZ, 'h:mm a')}
                    {' – '}
                    {formatInTimeZone(new Date(l.scheduled_end), TZ, 'h:mm a')} JST
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    l.status === 'completed' ? 'bg-green-100 text-green-700' :
                    l.status === 'cancelled' ? 'bg-gray-100 text-gray-500' :
                    tc ? `${tc.bg} ${tc.text}` : 'bg-brand-light text-brand-dark'
                  }`}>
                    {l.status}
                  </span>
                  {l.status !== 'cancelled' && (
                    <button
                      onClick={() => toggleNotes(l.id)}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      {loadingNoteId === l.id ? '…' : isExpanded ? 'Notes ▴' : 'Notes ▾'}
                    </button>
                  )}
                  <Link to={`/lessons/${l.id}`} className="text-xs text-brand hover:underline">View</Link>
                </div>
              </div>
              {isExpanded && (
                <div className="ml-0 pl-3 border-l-2 border-gray-200">
                  {loadingNoteId === l.id ? (
                    <p className="text-xs text-gray-400">Loading…</p>
                  ) : notes ? (
                    <NotesReadView notes={notes} />
                  ) : (
                    <p className="text-xs text-gray-400">No notes for this lesson.</p>
                  )}
                </div>
              )}
            </div>
            )
          })}

          {selectedRequests.map(r => (
            <div key={r.id} className="flex items-center justify-between gap-3 text-sm">
              <div>
                <p className="font-medium">
                  {role === 'teacher' ? r.student?.full_name : r.teacher?.full_name}
                  <span className="ml-2 text-xs text-orange-600 font-normal">booking request</span>
                </p>
                <p className="text-xs text-gray-500">
                  {formatInTimeZone(new Date(r.requested_start), TZ, 'h:mm a')} JST
                </p>
              </div>
              {role === 'teacher' && (
                <Link to="/calendar" className="text-xs text-brand hover:underline">Review</Link>
              )}
            </div>
          ))}
        </div>
      )}

      {selected && selectedLessons.length === 0 && selectedRequests.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-2">
          No lessons on {format(selected, 'MMMM d')}.
        </p>
      )}
    </div>
  )
}
