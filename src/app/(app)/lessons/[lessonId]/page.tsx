import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { LessonNotesEditor } from '@/components/lesson/LessonNotesEditor'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatInTimeZone } from 'date-fns-tz'
import Link from 'next/link'
import { markLessonComplete } from '@/app/actions/lessons'

export default async function LessonDetailPage({
  params,
}: {
  params: Promise<{ lessonId: string }>
}) {
  const { lessonId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [lessonResult, notesResult, goalsResult] = await Promise.all([
    supabase
      .from('lessons')
      .select(`
        *,
        student:profiles!lessons_student_id_fkey(*),
        teacher:profiles!lessons_teacher_id_fkey(id, full_name)
      `)
      .eq('id', lessonId)
      .eq('teacher_id', user.id)
      .single(),

    supabase
      .from('lesson_notes')
      .select('*')
      .eq('lesson_id', lessonId)
      .single(),

    supabase
      .from('student_goals')
      .select('*')
      .eq('teacher_id', user.id)
      .eq('status', 'active'),
  ])

  if (!lessonResult.data) notFound()

  const lesson = lessonResult.data as any
  const notes = notesResult.data
  const goals = goalsResult.data ?? []
  const studentGoals = goals.filter((g: any) => g.student_id === lesson.student_id)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/lessons" className="hover:text-gray-700">Lessons</Link>
            <span>/</span>
            <Link href={`/students/${lesson.student_id}`} className="hover:text-gray-700">
              {lesson.student?.full_name}
            </Link>
          </div>
          <h1 className="text-2xl font-semibold">
            {lesson.student?.full_name}&apos;s Lesson
          </h1>
          <p className="text-gray-500 mt-1">
            {formatInTimeZone(new Date(lesson.scheduled_start), 'Asia/Tokyo', 'EEEE, MMMM d, yyyy · h:mm a')}
            {' - '}
            {formatInTimeZone(new Date(lesson.scheduled_end), 'Asia/Tokyo', 'h:mm a')}
            {' JST'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="capitalize">{lesson.lesson_type}</Badge>
          <span className={`text-sm px-2 py-0.5 rounded-full font-medium capitalize ${
            lesson.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
            lesson.status === 'completed' ? 'bg-green-100 text-green-700' :
            'bg-gray-100 text-gray-700'
          }`}>
            {lesson.status}
          </span>
          {lesson.status === 'scheduled' && (
            <form action={async () => {
              'use server'
              await markLessonComplete(lessonId)
            }}>
              <button
                type="submit"
                className="text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition-colors"
              >
                Mark Complete
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Meeting URL */}
      {lesson.meeting_url && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="py-3 flex items-center justify-between">
            <span className="text-sm text-blue-800">Meeting link</span>
            <a
              href={lesson.meeting_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline font-medium"
            >
              Join Meeting
            </a>
          </CardContent>
        </Card>
      )}

      {/* Notes Editor */}
      <Card>
        <CardContent className="pt-6">
          <LessonNotesEditor
            lessonId={lessonId}
            studentId={lesson.student_id}
            initialNotes={notes ?? undefined}
            goals={studentGoals}
          />
        </CardContent>
      </Card>
    </div>
  )
}
