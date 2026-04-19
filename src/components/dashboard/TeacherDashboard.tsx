import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { formatInTimeZone } from 'date-fns-tz'
import { useTimezone } from '@/lib/hooks/useTimezone'
import { format, subWeeks, startOfWeek, endOfWeek } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

function isTodayBirthday(birthday: string | null | undefined): boolean {
  if (!birthday) return false
  const b = new Date(birthday)
  const t = new Date()
  return b.getMonth() === t.getMonth() && b.getDate() === t.getDate()
}

function buildWeeklyData(lessons: { scheduled_start: string }[]) {
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const ref = subWeeks(new Date(), 7 - i)
    return {
      label: format(startOfWeek(ref, { weekStartsOn: 1 }), 'M/d'),
      start: startOfWeek(ref, { weekStartsOn: 1 }),
      end: endOfWeek(ref, { weekStartsOn: 1 }),
      count: 0,
    }
  })

  for (const lesson of lessons) {
    const date = new Date(lesson.scheduled_start)
    for (const week of weeks) {
      if (date >= week.start && date <= week.end) {
        week.count++
        break
      }
    }
  }

  return weeks.map(w => ({ label: w.label, count: w.count }))
}

export function TeacherDashboard() {
  const { user, profile } = useAuth()
  const tz = useTimezone()
  const [upcomingLessons, setUpcomingLessons] = useState<any[]>([])
  const [pendingBookings, setPendingBookings] = useState<any[]>([])
  const [studentCount, setStudentCount] = useState(0)
  const [weeklyData, setWeeklyData] = useState<{ label: string; count: number }[]>([])
  const [birthdayStudents, setBirthdayStudents] = useState<{ id: string; full_name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return

    async function load() {
      try {
      const [lessonsResult, pendingBookingsResult, studentsResult, completedResult, bdayResult] = await Promise.all([
        supabase
          .from('lessons')
          .select('*, student:profiles!lessons_student_id_fkey(id, full_name, display_name, avatar_url)')
          .eq('teacher_id', user!.id)
          .eq('status', 'scheduled')
          .gte('scheduled_start', new Date().toISOString())
          .order('scheduled_start', { ascending: true })
          .limit(5),

        supabase
          .from('booking_requests')
          .select('*, student:profiles!booking_requests_student_id_fkey(id, full_name, display_name)')
          .eq('teacher_id', user!.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),

        supabase
          .from('teacher_student_relationships')
          .select('id')
          .eq('teacher_id', user!.id)
          .eq('status', 'active'),

        supabase
          .from('lessons')
          .select('scheduled_start')
          .eq('teacher_id', user!.id)
          .eq('status', 'completed')
          .gte('scheduled_start', subWeeks(new Date(), 8).toISOString()),

        // Students with their birthdays (to check today's birthdays client-side)
        supabase
          .from('teacher_student_relationships')
          .select('student:profiles!teacher_student_relationships_student_id_fkey(id, full_name), detail:student_details(birthday)')
          .eq('teacher_id', user!.id)
          .eq('status', 'active'),
      ])

      setUpcomingLessons(lessonsResult.data ?? [])
      setPendingBookings(pendingBookingsResult.data ?? [])
      setStudentCount(studentsResult.data?.length ?? 0)
      setWeeklyData(buildWeeklyData(completedResult.data ?? []))

      const bdayList = (bdayResult.data ?? [])
        .filter((r: any) => r.student && isTodayBirthday(r.detail?.[0]?.birthday ?? r.detail?.birthday))
        .map((r: any) => r.student)
      setBirthdayStudents(bdayList)
      } catch (e: any) {
        setError(e?.message ?? 'Failed to load dashboard')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [user])

  if (error) return <p className="text-sm text-red-500 p-4">Failed to load dashboard: {error}</p>

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const isMyBirthday = isTodayBirthday(profile?.birthday)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </p>
      </div>

      {/* Teacher's own birthday */}
      {isMyBirthday && (
        <div className="bg-gradient-to-r from-pink-50 to-purple-50 border border-pink-200 rounded-2xl p-5 text-center">
          <p className="text-4xl mb-2">🎂</p>
          <p className="text-xl font-bold text-pink-700">Happy Birthday!</p>
          <p className="text-sm text-pink-500 mt-1">Wishing you a wonderful day</p>
        </div>
      )}

      {/* Students with birthdays today */}
      {birthdayStudents.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl px-5 py-4 flex items-center gap-4 flex-wrap">
          <span className="text-3xl">🎉</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-yellow-800">Student birthday{birthdayStudents.length > 1 ? 's' : ''} today!</p>
            <p className="text-sm text-yellow-700 mt-0.5">
              {birthdayStudents.map(s => s.full_name).join(', ')}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-gray-900">{studentCount}</div>
            <div className="text-sm text-gray-500 mt-1">Active Students</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-gray-900">{upcomingLessons.length}</div>
            <div className="text-sm text-gray-500 mt-1">Upcoming Lessons</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-brand">{pendingBookings.length}</div>
            <div className="text-sm text-gray-500 mt-1">Pending Requests</div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly lessons chart */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Lessons Completed — Last 8 Weeks</CardTitle>
        </CardHeader>
        <CardContent>
          {weeklyData.every(w => w.count === 0) ? (
            <p className="text-sm text-gray-500">No completed lessons in the last 8 weeks.</p>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={weeklyData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value) => [value, 'Lessons']}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {weeklyData.map((_, i) => (
                    <Cell key={i} fill={i === weeklyData.length - 1 ? '#02508E' : '#93bcd6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Upcoming Lessons</CardTitle>
            <Link to="/lessons" className="text-sm text-brand hover:underline">View all</Link>
          </CardHeader>
          <CardContent>
            {upcomingLessons.length === 0 ? (
              <p className="text-sm text-gray-500">No upcoming lessons.</p>
            ) : (
              <div className="space-y-3">
                {upcomingLessons.map((lesson: any) => (
                  <div key={lesson.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{lesson.student?.full_name}</p>
                      <p className="text-xs text-gray-500">
                        {formatInTimeZone(new Date(lesson.scheduled_start), tz, 'MMM d, h:mm a')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs capitalize">{lesson.lesson_type}</Badge>
                      <Link to={`/lessons/${lesson.id}`} className="text-xs text-brand hover:underline">View</Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Booking Requests</CardTitle>
            <Link to="/calendar" className="text-sm text-brand hover:underline">Calendar</Link>
          </CardHeader>
          <CardContent>
            {pendingBookings.length === 0 ? (
              <p className="text-sm text-gray-500">No pending requests.</p>
            ) : (
              <div className="space-y-3">
                {pendingBookings.map((req: any) => (
                  <div key={req.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{req.student?.full_name}</p>
                      <Badge className="text-xs bg-yellow-100 text-yellow-700 border-yellow-200">Pending</Badge>
                    </div>
                    <p className="text-xs text-gray-500">
                      {formatInTimeZone(new Date(req.requested_start), tz, 'MMM d, h:mm a')}
                      {' - '}
                      {formatInTimeZone(new Date(req.requested_end), tz, 'h:mm a')}
                    </p>
                    {req.student_note && (
                      <p className="text-xs text-gray-600 italic">&ldquo;{req.student_note}&rdquo;</p>
                    )}
                    <Link
                      to={`/calendar?request=${req.id}`}
                      className="text-xs bg-brand text-white px-3 py-1 rounded hover:bg-brand-dark transition-colors inline-block"
                    >
                      Review
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
