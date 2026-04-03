import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { formatInTimeZone } from 'date-fns-tz'

const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  no_show: 'bg-gray-100 text-gray-700',
}

export default async function TeacherLessonsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: lessons } = await supabase
    .from('lessons')
    .select(`
      *,
      student:profiles!lessons_student_id_fkey(id, full_name, display_name)
    `)
    .eq('teacher_id', user.id)
    .order('scheduled_start', { ascending: false })
    .limit(50)

  const upcoming = lessons?.filter(l => l.status === 'scheduled') ?? []
  const past = lessons?.filter(l => l.status !== 'scheduled') ?? []

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Lessons</h1>

      {upcoming.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
            Upcoming
          </h2>
          <div className="space-y-2">
            {upcoming.map((lesson: any) => (
              <LessonRow key={lesson.id} lesson={lesson} />
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
            Past Lessons
          </h2>
          <div className="space-y-2">
            {past.map((lesson: any) => (
              <LessonRow key={lesson.id} lesson={lesson} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function LessonRow({ lesson }: { lesson: any }) {
  return (
    <Card>
      <CardContent className="py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <p className="font-medium text-gray-900">{lesson.student?.full_name}</p>
              <p className="text-sm text-gray-500">
                {formatInTimeZone(new Date(lesson.scheduled_start), 'Asia/Tokyo', 'MMM d, yyyy · h:mm a')}
                {' - '}
                {formatInTimeZone(new Date(lesson.scheduled_end), 'Asia/Tokyo', 'h:mm a')}
                {' JST'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${statusColors[lesson.status] ?? 'bg-gray-100 text-gray-700'}`}>
              {lesson.status}
            </span>
            <Badge variant="outline" className="text-xs capitalize">
              {lesson.lesson_type}
            </Badge>
            <Link
              href={`/lessons/${lesson.id}`}
              className="text-sm text-blue-600 hover:underline"
            >
              View
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
