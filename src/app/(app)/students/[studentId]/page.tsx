import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format, differenceInDays } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import Link from 'next/link'
import { GoalForm } from '@/components/progress/GoalForm'
import { ProgressSnapshotForm } from '@/components/progress/ProgressSnapshotForm'

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ studentId: string }>
}) {
  const { studentId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [studentResult, goalsResult, lessonsResult, snapshotsResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .eq('id', studentId)
      .single(),

    supabase
      .from('student_goals')
      .select('*')
      .eq('student_id', studentId)
      .eq('teacher_id', user.id)
      .order('created_at', { ascending: false }),

    supabase
      .from('lessons')
      .select('*, lesson_notes(*)')
      .eq('teacher_id', user.id)
      .eq('student_id', studentId)
      .order('scheduled_start', { ascending: false })
      .limit(10),

    supabase
      .from('progress_snapshots')
      .select('*')
      .eq('student_id', studentId)
      .eq('teacher_id', user.id)
      .order('snapshot_date', { ascending: false })
      .limit(5),
  ])

  if (!studentResult.data) notFound()

  const student = studentResult.data
  const goals = goalsResult.data ?? []
  const lessons = lessonsResult.data ?? []
  const snapshots = snapshotsResult.data ?? []
  const latestSnapshot = snapshots[0]

  const completedLessons = lessons.filter((l: any) => l.status === 'completed').length
  const activeGoals = goals.filter(g => g.status === 'active').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-gray-500 mb-1">
            <Link href="/students" className="hover:text-gray-700">Students</Link>
            <span className="mx-2">/</span>
            <span>{student.full_name}</span>
          </div>
          <h1 className="text-2xl font-semibold">{student.full_name}</h1>
          <p className="text-gray-500 text-sm">{student.email}</p>
        </div>
        {latestSnapshot?.cefr_level && (
          <Badge className="text-sm px-3 py-1 bg-blue-100 text-blue-700 border-blue-200">
            {latestSnapshot.cefr_level}
          </Badge>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{completedLessons}</div>
            <div className="text-xs text-gray-500 mt-0.5">Lessons completed</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{activeGoals}</div>
            <div className="text-xs text-gray-500 mt-0.5">Active goals</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">
              {latestSnapshot
                ? `${Math.round(((latestSnapshot.speaking_score ?? 0) + (latestSnapshot.listening_score ?? 0) + (latestSnapshot.reading_score ?? 0) + (latestSnapshot.writing_score ?? 0)) / 4 * 10) / 10}`
                : '—'}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">Avg skill score</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Goals */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Goals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {goals.length === 0 && (
                <p className="text-sm text-gray-500">No goals yet.</p>
              )}
              {goals.map(goal => {
                const daysUntil = goal.target_date
                  ? differenceInDays(new Date(goal.target_date), new Date())
                  : null
                return (
                  <div key={goal.id} className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{goal.title}</p>
                      {goal.target_date && (
                        <p className="text-xs text-gray-400">
                          {format(new Date(goal.target_date), 'MMM d, yyyy')}
                          {daysUntil !== null && goal.status === 'active' && (
                            <span className={`ml-2 ${daysUntil < 0 ? 'text-red-500' : daysUntil < 30 ? 'text-orange-500' : ''}`}>
                              {daysUntil < 0 ? `${Math.abs(daysUntil)}d overdue` : `${daysUntil}d left`}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
                      goal.status === 'active' ? 'bg-blue-100 text-blue-700' :
                      goal.status === 'achieved' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {goal.status}
                    </span>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* Add goal form */}
          <GoalForm studentId={studentId} teacherId={user.id} />
        </div>

        {/* Progress snapshot */}
        <div className="space-y-4">
          {latestSnapshot && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Latest Assessment
                  <span className="ml-2 text-xs font-normal text-gray-400">
                    {format(new Date(latestSnapshot.snapshot_date), 'MMM d, yyyy')}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { label: 'Speaking', score: latestSnapshot.speaking_score },
                  { label: 'Listening', score: latestSnapshot.listening_score },
                  { label: 'Reading', score: latestSnapshot.reading_score },
                  { label: 'Writing', score: latestSnapshot.writing_score },
                ].map(({ label, score }) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-20">{label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${((score ?? 0) / 10) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-8 text-right">{score ?? '—'}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <ProgressSnapshotForm studentId={studentId} teacherId={user.id} />
        </div>
      </div>

      {/* Recent lessons */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Lessons</CardTitle>
        </CardHeader>
        <CardContent>
          {lessons.length === 0 ? (
            <p className="text-sm text-gray-500">No lessons yet.</p>
          ) : (
            <div className="space-y-2">
              {lessons.map((lesson: any) => (
                <div key={lesson.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">
                      {formatInTimeZone(new Date(lesson.scheduled_start), 'Asia/Tokyo', 'MMM d, yyyy')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatInTimeZone(new Date(lesson.scheduled_start), 'Asia/Tokyo', 'h:mm a')}
                      {' - '}
                      {formatInTimeZone(new Date(lesson.scheduled_end), 'Asia/Tokyo', 'h:mm a')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {lesson.lesson_notes && (
                      <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">
                        Notes
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                      lesson.status === 'completed' ? 'bg-green-100 text-green-700' :
                      lesson.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {lesson.status}
                    </span>
                    <Link href={`/lessons/${lesson.id}`} className="text-xs text-blue-600 hover:underline">
                      View
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
