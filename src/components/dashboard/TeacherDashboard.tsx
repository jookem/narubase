import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { formatInTimeZone } from 'date-fns-tz'
import { format } from 'date-fns'

export async function TeacherDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const today = new Date()
  const todayStart = new Date(today.setHours(0, 0, 0, 0)).toISOString()
  const todayEnd = new Date(today.setHours(23, 59, 59, 999)).toISOString()

  const [lessonsResult, pendingBookingsResult, studentsResult] = await Promise.all([
    supabase
      .from('lessons')
      .select(`
        *,
        student:profiles!lessons_student_id_fkey(id, full_name, display_name, avatar_url)
      `)
      .eq('teacher_id', user.id)
      .eq('status', 'scheduled')
      .gte('scheduled_start', new Date().toISOString())
      .order('scheduled_start', { ascending: true })
      .limit(5),

    supabase
      .from('booking_requests')
      .select(`
        *,
        student:profiles!booking_requests_student_id_fkey(id, full_name, display_name)
      `)
      .eq('teacher_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),

    supabase
      .from('teacher_student_relationships')
      .select('id')
      .eq('teacher_id', user.id)
      .eq('status', 'active'),
  ])

  const upcomingLessons = lessonsResult.data ?? []
  const pendingBookings = pendingBookingsResult.data ?? []
  const studentCount = studentsResult.data?.length ?? 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </p>
      </div>

      {/* Stats */}
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
            <div className="text-3xl font-bold text-blue-600">{pendingBookings.length}</div>
            <div className="text-sm text-gray-500 mt-1">Pending Requests</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Lessons */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Upcoming Lessons</CardTitle>
            <Link href="/lessons" className="text-sm text-blue-600 hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {upcomingLessons.length === 0 ? (
              <p className="text-sm text-gray-500">No upcoming lessons.</p>
            ) : (
              <div className="space-y-3">
                {upcomingLessons.map((lesson: any) => (
                  <div key={lesson.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {lesson.student?.full_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatInTimeZone(
                          new Date(lesson.scheduled_start),
                          'Asia/Tokyo',
                          'MMM d, h:mm a'
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs capitalize">
                        {lesson.lesson_type}
                      </Badge>
                      <Link
                        href={`/lessons/${lesson.id}`}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Booking Requests */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Booking Requests</CardTitle>
            <Link href="/calendar" className="text-sm text-blue-600 hover:underline">
              Calendar
            </Link>
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
                      <Badge className="text-xs bg-yellow-100 text-yellow-700 border-yellow-200">
                        Pending
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500">
                      {formatInTimeZone(
                        new Date(req.requested_start),
                        'Asia/Tokyo',
                        'MMM d, h:mm a'
                      )}{' '}
                      -{' '}
                      {formatInTimeZone(
                        new Date(req.requested_end),
                        'Asia/Tokyo',
                        'h:mm a'
                      )}
                    </p>
                    {req.student_note && (
                      <p className="text-xs text-gray-600 italic">&ldquo;{req.student_note}&rdquo;</p>
                    )}
                    <div className="flex gap-2">
                      <ApproveBookingButton requestId={req.id} lessonStart={req.requested_start} lessonEnd={req.requested_end} studentId={req.student_id} teacherId={req.teacher_id} />
                    </div>
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

function ApproveBookingButton({
  requestId,
  lessonStart,
  lessonEnd,
  studentId,
  teacherId,
}: {
  requestId: string
  lessonStart: string
  lessonEnd: string
  studentId: string
  teacherId: string
}) {
  return (
    <Link
      href={`/calendar?request=${requestId}`}
      className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors"
    >
      Review
    </Link>
  )
}
