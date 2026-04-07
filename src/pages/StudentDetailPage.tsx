import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { format, differenceInDays } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import { GoalForm } from '@/components/progress/GoalForm'
import { ProgressSnapshotForm } from '@/components/progress/ProgressSnapshotForm'
import { StudentVocabManager } from '@/components/students/StudentVocabManager'
import { GrammarBankManager } from '@/components/students/GrammarBankManager'
import { StudentProfileCard } from '@/components/students/StudentProfileCard'
import { ScheduleLessonModal } from '@/components/lesson/ScheduleLessonModal'
import { updateStudentName } from '@/lib/api/students'
import { toast } from 'sonner'
import { PDFDownloadButton } from '@/components/pdf/PDFDownloadButton'
import { StudentProfilePDF } from '@/components/pdf/StudentProfilePDF'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

export function StudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [student, setStudent] = useState<any>(null)
  const [goals, setGoals] = useState<any[]>([])
  const [lessons, setLessons] = useState<any[]>([])
  const [snapshots, setSnapshots] = useState<any[]>([])
  const [details, setDetails] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState('')

  async function loadData() {
    if (!user || !studentId) return

    const [studentResult, goalsResult, lessonsResult, snapshotsResult, detailsResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', studentId).single(),
      supabase.from('student_goals').select('*').eq('student_id', studentId).eq('teacher_id', user.id).order('created_at', { ascending: false }),
      supabase.from('lessons').select('*, lesson_notes(*), lesson_participants(student:profiles!lesson_participants_student_id_fkey(full_name))').eq('teacher_id', user.id).eq('student_id', studentId).neq('status', 'cancelled').order('scheduled_start', { ascending: false }).limit(10),
      supabase.from('progress_snapshots').select('*').eq('student_id', studentId).eq('teacher_id', user.id).order('snapshot_date', { ascending: false }).limit(5),
      supabase.from('student_details').select('*').eq('student_id', studentId).single(),
    ])

    if (!studentResult.data) {
      navigate('/students')
      return
    }

    setStudent(studentResult.data)
    setGoals(goalsResult.data ?? [])
    setLessons(lessonsResult.data ?? [])
    setSnapshots(snapshotsResult.data ?? [])
    setDetails(detailsResult.data ?? null)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [user, studentId])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded-lg animate-pulse" />)}
        </div>
      </div>
    )
  }

  if (!student) return null

  const latestSnapshot = snapshots[0]
  const completedLessons = lessons.filter((l: any) => l.status === 'completed').length
  const activeGoals = goals.filter(g => g.status === 'active').length

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-gray-500 mb-1">
            <Link to="/students" className="hover:text-gray-700">Students</Link>
            <span className="mx-2">/</span>
            <span>{student.full_name}</span>
          </div>
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={nameValue}
                onChange={e => setNameValue(e.target.value)}
                onKeyDown={async e => {
                  if (e.key === 'Enter') {
                    const trimmed = nameValue.trim()
                    if (!trimmed) return
                    const result = await updateStudentName(studentId!, trimmed)
                    if (result.error) { toast.error(result.error) }
                    else { setStudent((s: any) => ({ ...s, full_name: trimmed })); setEditingName(false) }
                  }
                  if (e.key === 'Escape') setEditingName(false)
                }}
                className="text-2xl font-semibold bg-transparent border-b-2 border-brand outline-none w-64"
              />
              <button
                onClick={async () => {
                  const trimmed = nameValue.trim()
                  if (!trimmed) return
                  const result = await updateStudentName(studentId!, trimmed)
                  if (result.error) { toast.error(result.error) }
                  else { setStudent((s: any) => ({ ...s, full_name: trimmed })); setEditingName(false) }
                }}
                className="text-sm text-brand hover:underline"
              >Save</button>
              <button onClick={() => setEditingName(false)} className="text-sm text-gray-400 hover:text-gray-600">Cancel</button>
            </div>
          ) : (
            <button
              onClick={() => { setNameValue(student.full_name); setEditingName(true) }}
              className="group flex items-center gap-1.5 text-left"
            >
              <h1 className="text-2xl font-semibold">{student.full_name}</h1>
              <span className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">edit</span>
            </button>
          )}
          <p className="text-gray-500 text-sm">{student.email}</p>
        </div>
        <div className="flex items-center gap-2">
          {latestSnapshot?.cefr_level && (
            <Badge className="text-sm px-3 py-1 bg-brand-light text-brand-dark border-brand/30">
              {latestSnapshot.cefr_level}
            </Badge>
          )}
          <PDFDownloadButton
            document={
              <StudentProfilePDF
                student={student}
                details={details}
                goals={goals}
                latestSnapshot={snapshots[0] ?? null}
                teacherName={profile?.full_name ?? ''}
              />
            }
            filename={`${student.full_name.replace(/\s+/g, '-').toLowerCase()}-profile.pdf`}
            label="Export PDF"
          />
        </div>
      </div>

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

      <StudentProfileCard studentId={studentId!} details={details} onSaved={loadData} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Goals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {goals.length === 0 && <p className="text-sm text-gray-500">No goals yet.</p>}
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
                      goal.status === 'active' ? 'bg-brand-light text-brand-dark' :
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
          <GoalForm studentId={studentId!} teacherId={user!.id} onSaved={loadData} />
        </div>

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
                      <div className="bg-brand h-2 rounded-full" style={{ width: `${((score ?? 0) / 10) * 100}%` }} />
                    </div>
                    <span className="text-sm font-medium w-8 text-right">{score ?? '—'}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {snapshots.length > 1 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Skill Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart
                    data={[...snapshots].reverse().map(s => ({
                      date: format(new Date(s.snapshot_date), 'M/d'),
                      Speaking: s.speaking_score,
                      Listening: s.listening_score,
                      Reading: s.reading_score,
                      Writing: s.writing_score,
                    }))}
                    margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
                  >
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 10]} allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="Speaking" stroke="#02508E" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Listening" stroke="#9b51e0" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Reading" stroke="#10b981" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Writing" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
          <ProgressSnapshotForm studentId={studentId!} teacherId={user!.id} onSaved={loadData} />
        </div>
      </div>

      <StudentVocabManager studentId={studentId!} />
      <GrammarBankManager studentId={studentId!} />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Recent Lessons</CardTitle>
            <ScheduleLessonModal
              studentId={studentId!}
              studentName={student.full_name}
              onSaved={loadData}
            />
          </div>
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
                    {(lesson.is_group || lesson.lesson_participants?.length > 0) && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
                        {lesson.group_name ?? 'Group'}
                      </span>
                    )}
                    {lesson.lesson_notes && (
                      <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">Notes</span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                      lesson.status === 'completed' ? 'bg-green-100 text-green-700' :
                      lesson.status === 'scheduled' ? 'bg-brand-light text-brand-dark' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {lesson.status}
                    </span>
                    <Link to={`/lessons/${lesson.id}`} className="text-xs text-brand hover:underline">View</Link>
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
