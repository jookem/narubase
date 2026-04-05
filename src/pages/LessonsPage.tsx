import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { LessonCard } from '@/components/lesson/LessonCard'
import { ScheduleLessonModal } from '@/components/lesson/ScheduleLessonModal'

export function LessonsPage() {
  const { user, profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedStudentId = searchParams.get('student') ?? undefined
  const isTeacher = profile?.role === 'teacher'

  const [students, setStudents] = useState<any[]>([])
  const [lessons, setLessons] = useState<any[]>([])
  const [selectedStudent, setSelectedStudent] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !profile) return

    if (isTeacher) {
      loadTeacherData()
    } else {
      loadStudentLessons()
    }
  }, [user, profile, selectedStudentId])

  async function loadTeacherData() {
    const { data: relationships } = await supabase
      .from('teacher_student_relationships')
      .select('student:profiles!teacher_student_relationships_student_id_fkey(id, full_name, email)')
      .eq('teacher_id', user!.id)
      .eq('status', 'active')
      .order('started_at')

    const studentList = (relationships ?? []).map((r: any) => r.student).filter(Boolean)
    setStudents(studentList)

    if (selectedStudentId) {
      const found = studentList.find((s: any) => s.id === selectedStudentId)
      setSelectedStudent(found ?? null)

      if (found) {
        // Get lessons where student is primary + lessons where student is a participant
        const { data: participations } = await supabase
          .from('lesson_participants')
          .select('lesson_id')
          .eq('student_id', selectedStudentId)
        const participantLessonIds = (participations ?? []).map((p: any) => p.lesson_id)

        const orFilter = participantLessonIds.length
          ? `student_id.eq.${selectedStudentId},id.in.(${participantLessonIds.join(',')})`
          : `student_id.eq.${selectedStudentId}`

        const { data } = await supabase
          .from('lessons')
          .select('id, scheduled_start, scheduled_end, status, lesson_type, is_group, lesson_notes(summary, areas_to_focus, homework), lesson_participants(student_id, student:profiles!lesson_participants_student_id_fkey(full_name))')
          .eq('teacher_id', user!.id)
          .or(orFilter)
          .order('scheduled_start', { ascending: false })
        setLessons(data ?? [])
      }
    } else {
      setSelectedStudent(null)
      setLessons([])
    }

    setLoading(false)
  }

  async function loadStudentLessons() {
    const { data: participations } = await supabase
      .from('lesson_participants')
      .select('lesson_id')
      .eq('student_id', user!.id)
    const participantLessonIds = (participations ?? []).map((p: any) => p.lesson_id)

    const orFilter = participantLessonIds.length
      ? `student_id.eq.${user!.id},id.in.(${participantLessonIds.join(',')})`
      : `student_id.eq.${user!.id}`

    const { data } = await supabase
      .from('lessons')
      .select('*, teacher:profiles!lessons_teacher_id_fkey(id, full_name), lesson_notes(summary, areas_to_focus, homework), lesson_participants(student_id, student:profiles!lesson_participants_student_id_fkey(full_name))')
      .or(orFilter)
      .order('scheduled_start', { ascending: false })
    setLessons(data ?? [])
    setLoading(false)
  }

  if (loading) {
    return <div className="h-48 bg-gray-200 rounded-lg animate-pulse" />
  }

  if (!isTeacher) {
    const upcoming = lessons.filter((l: any) => l.status === 'scheduled')
    const past = lessons.filter((l: any) => l.status !== 'scheduled')

    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">My Lessons</h1>
        {upcoming.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Upcoming</h2>
            <div className="space-y-2">
              {upcoming.map((lesson: any) => (
                <LessonCard key={lesson.id} lesson={lesson} notes={lesson.lesson_notes ?? null} />
              ))}
            </div>
          </section>
        )}
        {past.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Past Lessons</h2>
            <div className="space-y-2">
              {past.map((lesson: any) => (
                <LessonCard key={lesson.id} lesson={lesson} notes={lesson.lesson_notes ?? null} />
              ))}
            </div>
          </section>
        )}
        {lessons.length === 0 && <p className="text-sm text-gray-500">No lessons yet.</p>}
      </div>
    )
  }

  return (
    <div className="flex flex-col md:flex-row gap-0 md:gap-6 min-h-0">
      <aside className="w-full md:w-56 shrink-0">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Students</h2>
        {students.length === 0 ? (
          <p className="text-sm text-gray-400">No students yet.</p>
        ) : (
          <nav className="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
            {students.map((s: any) => {
              const initials = s.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
              const active = s.id === selectedStudentId
              return (
                <button
                  key={s.id}
                  onClick={() => setSearchParams({ student: s.id })}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors shrink-0 text-left ${
                    active ? 'bg-brand text-white' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarFallback className={`text-xs font-semibold ${active ? 'bg-white/20 text-white' : 'bg-brand-light text-brand-dark'}`}>
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">{s.full_name.split(' ')[0]}</span>
                </button>
              )
            })}
          </nav>
        )}
      </aside>

      <div className="flex-1 min-w-0 border-t md:border-t-0 md:border-l border-gray-200 md:pl-6 pt-4 md:pt-0">
        {!selectedStudentId ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <p className="text-sm">Select a student to view their lessons</p>
          </div>
        ) : !selectedStudent ? (
          <p className="text-sm text-gray-500">Student not found.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold">{selectedStudent.full_name}</h1>
                <p className="text-sm text-gray-500">{selectedStudent.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <ScheduleLessonModal
                  studentId={selectedStudent.id}
                  studentName={selectedStudent.full_name}
                  onSaved={loadTeacherData}
                />
                <Link to={`/students/${selectedStudent.id}`} className="text-xs text-brand hover:underline">
                  Student profile →
                </Link>
              </div>
            </div>

            <div className="flex gap-4 text-sm">
              <span className="text-gray-500">
                <strong className="text-gray-900">{lessons.length}</strong> total
              </span>
              <span className="text-gray-500">
                <strong className="text-green-700">{lessons.filter((l: any) => l.status === 'completed').length}</strong> completed
              </span>
              <span className="text-gray-500">
                <strong className="text-brand">{lessons.filter((l: any) => l.status === 'scheduled').length}</strong> upcoming
              </span>
            </div>

            {lessons.length === 0 ? (
              <div className="text-center py-12 text-gray-400 border border-dashed border-gray-200 rounded-lg">
                <p className="text-sm">No lessons yet for this student.</p>
                <p className="text-xs mt-1">Use &quot;+ Add Lesson&quot; to schedule an upcoming lesson or record a past one.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {lessons.map((lesson: any) => (
                  <LessonCard key={lesson.id} lesson={lesson} notes={lesson.lesson_notes ?? null} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
