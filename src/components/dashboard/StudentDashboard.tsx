import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { formatInTimeZone } from 'date-fns-tz'
import { format } from 'date-fns'

export async function StudentDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [lessonsResult, goalsResult, recentNotesResult] = await Promise.all([
    supabase
      .from('lessons')
      .select(`
        *,
        teacher:profiles!lessons_teacher_id_fkey(id, full_name, display_name)
      `)
      .eq('student_id', user.id)
      .eq('status', 'scheduled')
      .gte('scheduled_start', new Date().toISOString())
      .order('scheduled_start', { ascending: true })
      .limit(3),

    supabase
      .from('student_goals')
      .select('*')
      .eq('student_id', user.id)
      .eq('status', 'active')
      .order('target_date', { ascending: true }),

    supabase
      .from('lesson_notes')
      .select(`
        *,
        lesson:lessons(scheduled_start, teacher:profiles!lessons_teacher_id_fkey(full_name))
      `)
      .eq('is_visible_to_student', true)
      .order('created_at', { ascending: false })
      .limit(3),
  ])

  const upcomingLessons = lessonsResult.data ?? []
  const goals = goalsResult.data ?? []
  const recentNotes = recentNotesResult.data ?? []

  const nextLesson = upcomingLessons[0]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          こんにちは！<span className="text-gray-500 font-normal text-lg ml-2">Welcome back</span>
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {format(new Date(), 'yyyy年M月d日')} ({format(new Date(), 'EEEE')})
        </p>
      </div>

      {/* Next Lesson Banner */}
      {nextLesson && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-600 font-medium uppercase tracking-wide">
                  Next Lesson / 次のレッスン
                </p>
                <p className="text-lg font-semibold text-gray-900 mt-1">
                  {formatInTimeZone(
                    new Date((nextLesson as any).scheduled_start),
                    'Asia/Tokyo',
                    'M月d日 (EEE) HH:mm'
                  )}
                </p>
                <p className="text-sm text-gray-600">
                  with {(nextLesson as any).teacher?.full_name}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                {(nextLesson as any).meeting_url && (
                  <a
                    href={(nextLesson as any).meeting_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                  >
                    Join / 参加する
                  </a>
                )}
                <Link
                  href={`/lessons/${(nextLesson as any).id}`}
                  className="text-sm text-center text-blue-600 hover:underline"
                >
                  Details
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Goals */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">目標 Goals</CardTitle>
            <Link href="/goals" className="text-sm text-blue-600 hover:underline">
              すべて見る
            </Link>
          </CardHeader>
          <CardContent>
            {goals.length === 0 ? (
              <p className="text-sm text-gray-500">No goals set yet.</p>
            ) : (
              <div className="space-y-3">
                {goals.map((goal: any) => (
                  <div key={goal.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{goal.title}</p>
                      {goal.target_date && (
                        <p className="text-xs text-gray-500">
                          目標日: {format(new Date(goal.target_date), 'M月d日')}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {goal.status === 'active' ? '進行中' : goal.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Lesson Notes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">最近のノート Lesson Notes</CardTitle>
            <Link href="/lessons" className="text-sm text-blue-600 hover:underline">
              すべて見る
            </Link>
          </CardHeader>
          <CardContent>
            {recentNotes.length === 0 ? (
              <p className="text-sm text-gray-500">No lesson notes yet.</p>
            ) : (
              <div className="space-y-3">
                {recentNotes.map((note: any) => (
                  <div key={note.id} className="border rounded-lg p-3">
                    <p className="text-xs text-gray-500">
                      {note.lesson?.scheduled_start &&
                        formatInTimeZone(
                          new Date(note.lesson.scheduled_start),
                          'Asia/Tokyo',
                          'M月d日'
                        )}
                    </p>
                    {note.summary && (
                      <p className="text-sm text-gray-700 mt-1 line-clamp-2">{note.summary}</p>
                    )}
                    {note.homework && (
                      <p className="text-xs text-orange-700 mt-1">
                        宿題: {note.homework}
                      </p>
                    )}
                    <Link
                      href={`/lessons/${note.lesson_id}`}
                      className="text-xs text-blue-600 hover:underline mt-1 block"
                    >
                      詳細を見る →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Book a Lesson CTA */}
      <Card className="bg-gray-900 text-white border-0">
        <CardContent className="pt-6 flex items-center justify-between">
          <div>
            <p className="font-medium">Ready for your next lesson?</p>
            <p className="text-gray-400 text-sm">次のレッスンを予約しましょう</p>
          </div>
          <Link
            href="/book"
            className="bg-white text-gray-900 px-4 py-2 rounded font-medium text-sm hover:bg-gray-100 transition-colors"
          >
            予約する / Book
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
