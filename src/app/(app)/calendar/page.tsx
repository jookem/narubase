import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BookingRequestCard } from '@/components/booking/BookingRequestCard'
import type { BookingRequestWithProfiles } from '@/lib/types/database'

export default async function TeacherCalendarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: pendingRequests } = await supabase
    .from('booking_requests')
    .select(`
      *,
      student:profiles!booking_requests_student_id_fkey(id, full_name, display_name, avatar_url),
      teacher:profiles!booking_requests_teacher_id_fkey(id, full_name, display_name, avatar_url)
    `)
    .eq('teacher_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  const { data: upcomingLessons } = await supabase
    .from('lessons')
    .select(`
      *,
      student:profiles!lessons_student_id_fkey(id, full_name, display_name)
    `)
    .eq('teacher_id', user.id)
    .eq('status', 'scheduled')
    .gte('scheduled_start', new Date().toISOString())
    .order('scheduled_start', { ascending: true })
    .limit(20)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Calendar</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending booking requests */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
            Pending Requests ({pendingRequests?.length ?? 0})
          </h2>
          {!pendingRequests?.length ? (
            <p className="text-sm text-gray-500">No pending requests.</p>
          ) : (
            pendingRequests.map(req => (
              <BookingRequestCard key={req.id} request={req as unknown as BookingRequestWithProfiles} />
            ))
          )}
        </section>

        {/* Upcoming lessons */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
            Upcoming Lessons
          </h2>
          {!upcomingLessons?.length ? (
            <p className="text-sm text-gray-500">No upcoming lessons.</p>
          ) : (
            upcomingLessons.map((lesson: any) => (
              <Card key={lesson.id}>
                <CardContent className="py-3">
                  <p className="font-medium">{lesson.student?.full_name}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(lesson.scheduled_start).toLocaleString('ja-JP', {
                      timeZone: 'Asia/Tokyo',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })} JST
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </section>
      </div>
    </div>
  )
}
