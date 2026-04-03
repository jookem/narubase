import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { BookingCalendar } from '@/components/booking/BookingCalendar'

export default async function BookPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Get the student's teacher
  const { data: relationships } = await supabase
    .from('teacher_student_relationships')
    .select(`
      *,
      teacher:profiles!teacher_student_relationships_teacher_id_fkey(id, full_name, display_name, avatar_url)
    `)
    .eq('student_id', user.id)
    .eq('status', 'active')

  const teacherRel = relationships?.[0]

  if (!teacherRel) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">予約 / Book a Lesson</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">You are not currently enrolled with a teacher.</p>
            <p className="text-sm text-gray-400 mt-1">Please contact your teacher to be added.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const teacher = (teacherRel as any).teacher

  // Get teacher availability
  const { data: availabilitySlots } = await supabase
    .from('availability_slots')
    .select('*')
    .eq('teacher_id', teacher.id)
    .eq('is_active', true)

  // Get existing lessons (to show as blocked)
  const { data: existingLessons } = await supabase
    .from('lessons')
    .select('scheduled_start, scheduled_end, status, student_id')
    .eq('teacher_id', teacher.id)
    .in('status', ['scheduled'])
    .gte('scheduled_start', new Date().toISOString())

  // Get student's pending requests
  const { data: pendingRequests } = await supabase
    .from('booking_requests')
    .select('*')
    .eq('student_id', user.id)
    .eq('status', 'pending')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">予約 / Book a Lesson</h1>
        <p className="text-gray-500 text-sm mt-1">
          先生: {teacher.full_name}
        </p>
      </div>

      {pendingRequests && pendingRequests.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800 font-medium">
            保留中のリクエスト: {pendingRequests.length}件
          </p>
          <p className="text-xs text-yellow-600 mt-1">
            You have {pendingRequests.length} pending booking request(s) awaiting teacher approval.
          </p>
        </div>
      )}

      <BookingCalendar
        teacherId={teacher.id}
        teacherName={teacher.full_name}
        availabilitySlots={availabilitySlots ?? []}
        existingLessons={existingLessons ?? []}
        studentId={user.id}
      />
    </div>
  )
}
