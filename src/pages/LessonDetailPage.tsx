import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { formatInTimeZone } from 'date-fns-tz'
import { useTimezone } from '@/lib/hooks/useTimezone'
import { LessonNotesEditor } from '@/components/lesson/LessonNotesEditor'
import { LessonAttachments } from '@/components/lesson/LessonAttachments'
import { markLessonComplete, updateGroupName, addLessonParticipant } from '@/lib/api/lessons'
import { cancelLesson } from '@/lib/api/bookings'
import { toast } from 'sonner'
import { PDFDownloadButton } from '@/components/pdf/PDFDownloadButton'
import { LessonNotesPDF } from '@/components/pdf/LessonNotesPDF'
import { NotesReadView } from '@/components/lesson/NotesReadView'

export function LessonDetailPage() {
  const { lessonId } = useParams<{ lessonId: string }>()
  const { user, profile } = useAuth()
  const tz = useTimezone()
  const navigate = useNavigate()
  const [lesson, setLesson] = useState<any>(null)
  const [notesMap, setNotesMap] = useState<Record<string, any>>({})  // key: 'group' | student_id
  const [activeNoteTab, setActiveNoteTab] = useState<string>('group')
  const [studentNotes, setStudentNotes] = useState<any>(null)   // student view: individual note
  const [groupNotes, setGroupNotes] = useState<any>(null)        // student view: group note
  const [goals, setGoals] = useState<any[]>([])
  const [participants, setParticipants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [editingGroupName, setEditingGroupName] = useState(false)
  const [groupNameValue, setGroupNameValue] = useState('')
  const [addingStudent, setAddingStudent] = useState(false)
  const [addableStudents, setAddableStudents] = useState<{ id: string; full_name: string }[]>([])
  const [studentToAdd, setStudentToAdd] = useState('')
  const [savingParticipant, setSavingParticipant] = useState(false)

  const isTeacher = profile?.role === 'teacher'

  async function loadData() {
    if (!user || !lessonId) return

    if (isTeacher) {
      const [lessonResult, notesResult, goalsResult, participantsResult] = await Promise.all([
        supabase
          .from('lessons')
          .select('*, student:profiles!lessons_student_id_fkey(*), teacher:profiles!lessons_teacher_id_fkey(id, full_name)')
          .eq('id', lessonId)
          .eq('teacher_id', user.id)
          .single(),
        supabase.from('lesson_notes').select('*').eq('lesson_id', lessonId),
        supabase.from('student_goals').select('*').eq('teacher_id', user.id).eq('status', 'active'),
        supabase
          .from('lesson_participants')
          .select('student_id, student:profiles!lesson_participants_student_id_fkey(id, full_name)')
          .eq('lesson_id', lessonId),
      ])

      if (!lessonResult.data) { navigate('/lessons'); return }
      setLesson(lessonResult.data)
      // Build a map: 'group' -> group note, student_id -> individual note
      const map: Record<string, any> = {}
      for (const n of notesResult.data ?? []) {
        map[n.student_id ?? 'group'] = n
      }
      setNotesMap(map)
      const lessonData = lessonResult.data
      setGoals((goalsResult.data ?? []).filter((g: any) =>
        g.student_id === lessonData.student_id ||
        (participantsResult.data ?? []).some((p: any) => p.student_id === g.student_id)
      ))
      setParticipants((participantsResult.data ?? []).map((p: any) => p.student))
    } else {
      // Check if student is a participant in this lesson (handles group lesson secondary students)
      const { data: participation } = await supabase
        .from('lesson_participants')
        .select('lesson_id')
        .eq('lesson_id', lessonId)
        .eq('student_id', user.id)
        .maybeSingle()

      // Primary student: match by student_id. Secondary (participant): we verified access above, fetch by id only.
      const lessonQuery = participation
        ? supabase.from('lessons').select('*, teacher:profiles!lessons_teacher_id_fkey(id, full_name)').eq('id', lessonId).single()
        : supabase.from('lessons').select('*, teacher:profiles!lessons_teacher_id_fkey(id, full_name)').eq('id', lessonId).eq('student_id', user.id).single()

      const [lessonResult, groupNotesResult, individualNotesResult] = await Promise.all([
        lessonQuery,
        supabase
          .from('lesson_notes')
          .select('summary, vocabulary, grammar_points, homework, strengths, areas_to_focus')
          .eq('lesson_id', lessonId)
          .is('student_id', null)
          .eq('is_visible_to_student', true)
          .maybeSingle(),
        supabase
          .from('lesson_notes')
          .select('summary, vocabulary, grammar_points, homework, strengths, areas_to_focus')
          .eq('lesson_id', lessonId)
          .eq('student_id', user.id)
          .maybeSingle(),
      ])

      if (!lessonResult.data) { navigate('/lessons'); return }
      setLesson(lessonResult.data)
      setGroupNotes(groupNotesResult.data ?? null)
      setStudentNotes(individualNotesResult.data ?? null)
    }

    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [user, lessonId, isTeacher])

  async function handleSaveGroupName() {
    if (!lessonId) return
    const result = await updateGroupName(lessonId, groupNameValue.trim())
    if (result.error) {
      toast.error(result.error)
    } else {
      setLesson((prev: any) => ({ ...prev, group_name: groupNameValue.trim() }))
      setEditingGroupName(false)
    }
  }

  async function openAddStudent() {
    if (!user) return
    const { data } = await supabase
      .from('teacher_student_relationships')
      .select('student:profiles!teacher_student_relationships_student_id_fkey(id, full_name)')
      .eq('teacher_id', user.id)
      .eq('status', 'active')
    const taken = new Set([lesson.student_id, ...participants.map((p: any) => p.id)])
    const all = (data ?? []).map((r: any) => r.student).filter(Boolean)
    setAddableStudents(all.filter((s: any) => !taken.has(s.id)))
    setStudentToAdd('')
    setAddingStudent(true)
  }

  async function handleAddParticipant() {
    if (!lessonId || !studentToAdd) return
    setSavingParticipant(true)
    const result = await addLessonParticipant(lessonId, studentToAdd)
    setSavingParticipant(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      setAddingStudent(false)
      toast.success('Student added — this is now a group lesson.')
      await loadData()
    }
  }

  async function handleCancelLesson() {
    if (!lessonId) return
    setCancelling(true)
    const result = await cancelLesson(lessonId)
    if (result.error) {
      toast.error(result.error)
    } else {
      setLesson((prev: any) => ({ ...prev, status: 'cancelled' }))
      setConfirmCancel(false)
    }
    setCancelling(false)
  }

  async function handleMarkComplete() {
    if (!lessonId) return
    setCompleting(true)
    const result = await markLessonComplete(lessonId)
    if (result.error) {
      toast.error(result.error)
    } else {
      setLesson((prev: any) => ({ ...prev, status: 'completed' }))
    }
    setCompleting(false)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded w-64 animate-pulse" />
        <div className="h-48 bg-gray-200 rounded-lg animate-pulse" />
      </div>
    )
  }

  if (!lesson) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link to="/lessons" className="hover:text-gray-700">Lessons</Link>
            <span>/</span>
            {isTeacher ? (
              <Link to={`/students/${lesson.student_id}`} className="hover:text-gray-700">
                {lesson.student?.full_name}
              </Link>
            ) : (
              <span>{lesson.teacher?.full_name}</span>
            )}
          </div>
          {isTeacher && lesson.is_group ? (
            editingGroupName ? (
              <div className="flex items-center gap-2 mt-0.5">
                <input
                  autoFocus
                  value={groupNameValue}
                  onChange={e => setGroupNameValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveGroupName(); if (e.key === 'Escape') setEditingGroupName(false) }}
                  className="text-2xl font-semibold bg-transparent border-b-2 border-brand outline-none w-64"
                />
                <button onClick={handleSaveGroupName} className="text-sm text-brand hover:underline">Save</button>
                <button onClick={() => setEditingGroupName(false)} className="text-sm text-gray-400 hover:text-gray-600">Cancel</button>
              </div>
            ) : (
              <button
                onClick={() => { setGroupNameValue(lesson.group_name ?? ''); setEditingGroupName(true) }}
                className="group flex items-center gap-1.5 text-left"
              >
                <h1 className="text-2xl font-semibold">{lesson.group_name ?? 'Group Lesson'}</h1>
                <span className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">edit</span>
              </button>
            )
          ) : (
            <h1 className="text-2xl font-semibold">
              {isTeacher ? `${lesson.student?.full_name}'s Lesson` : 'Lesson'}
            </h1>
          )}
          {isTeacher && participants.length > 1 && (
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">Group</span>
              <span className="text-xs text-gray-500">{participants.map((p: any) => p.full_name.split(' ')[0]).join(', ')}</span>
            </div>
          )}
          <p className="text-gray-500 mt-1">
            {formatInTimeZone(new Date(lesson.scheduled_start), tz, 'EEEE, MMMM d, yyyy · h:mm a')}
            {' - '}
            {formatInTimeZone(new Date(lesson.scheduled_end), tz, 'h:mm a')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Badge variant="outline" className="capitalize">{lesson.lesson_type}</Badge>
          <span className={`text-sm px-2 py-0.5 rounded-full font-medium capitalize ${
            lesson.status === 'scheduled' ? 'bg-brand-light text-brand-dark' :
            lesson.status === 'completed' ? 'bg-green-100 text-green-700' :
            'bg-gray-100 text-gray-700'
          }`}>
            {lesson.status}
          </span>
          {isTeacher && notesMap['group'] && (
            <PDFDownloadButton
              document={
                <LessonNotesPDF
                  lesson={lesson}
                  notes={notesMap['group']}
                  studentName={lesson.student?.full_name ?? ''}
                  teacherName={lesson.teacher?.full_name ?? ''}
                  participants={participants}
                />
              }
              filename={`lesson-notes-${lesson.student?.full_name?.replace(/\s+/g, '-').toLowerCase()}-${lesson.scheduled_start.slice(0, 10)}.pdf`}
              label="Export PDF"
            />
          )}
          {!isTeacher && (studentNotes || groupNotes) && (
            <PDFDownloadButton
              document={
                <LessonNotesPDF
                  lesson={lesson}
                  notes={studentNotes ?? groupNotes}
                  studentName={profile?.full_name ?? ''}
                  teacherName={lesson.teacher?.full_name ?? ''}
                  participants={[]}
                />
              }
              filename={`lesson-notes-${lesson.scheduled_start.slice(0, 10)}.pdf`}
              label="Save PDF"
            />
          )}
          {isTeacher && lesson.status !== 'cancelled' && (
            addingStudent ? (
              <div className="flex items-center gap-1.5">
                <select
                  autoFocus
                  value={studentToAdd}
                  onChange={e => setStudentToAdd(e.target.value)}
                  className="text-sm border border-input rounded px-2 py-1 bg-background"
                >
                  <option value="">Select student…</option>
                  {addableStudents.map(s => (
                    <option key={s.id} value={s.id}>{s.full_name}</option>
                  ))}
                </select>
                <button
                  onClick={handleAddParticipant}
                  disabled={!studentToAdd || savingParticipant}
                  className="text-sm bg-brand text-white px-3 py-1 rounded hover:bg-brand-dark transition-colors disabled:opacity-50"
                >
                  {savingParticipant ? 'Adding…' : 'Add'}
                </button>
                <button
                  onClick={() => setAddingStudent(false)}
                  className="text-sm text-gray-500 hover:text-gray-700 px-1"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={openAddStudent}
                className="text-sm border border-gray-200 text-gray-600 px-3 py-1 rounded hover:bg-gray-50 transition-colors"
              >
                + Add Student
              </button>
            )
          )}
          {isTeacher && lesson.status === 'scheduled' && (
            <button
              onClick={handleMarkComplete}
              disabled={completing}
              className="text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {completing ? 'Saving…' : 'Mark Complete'}
            </button>
          )}
          {isTeacher && lesson.status === 'scheduled' && (
            confirmCancel ? (
              <div className="flex flex-col items-start gap-1.5">
                <span className="text-sm text-gray-600">Cancel this lesson?</span>
                <div className="flex gap-2">
                  <button
                    onClick={handleCancelLesson}
                    disabled={cancelling}
                    className="text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {cancelling ? 'Cancelling…' : 'Yes, cancel'}
                  </button>
                  <button
                    onClick={() => setConfirmCancel(false)}
                    className="text-sm text-gray-500 hover:text-gray-700 px-2"
                  >
                    No
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmCancel(true)}
                className="text-sm border border-red-200 text-red-600 px-3 py-1 rounded hover:bg-red-50 transition-colors"
              >
                Cancel Lesson
              </button>
            )
          )}
        </div>
      </div>

      {/* Meeting link */}
      {lesson.meeting_url && (
        <Card className="bg-brand-light border-brand/30">
          <CardContent className="py-3 flex items-center justify-between">
            <span className="text-sm text-brand-dark">Meeting link</span>
            <a href={lesson.meeting_url} target="_blank" rel="noopener noreferrer" className="text-sm text-brand hover:underline font-medium">
              Join Meeting
            </a>
          </CardContent>
        </Card>
      )}

      {/* Notes — teacher gets full editor with tabs, student gets read-only view */}
      {isTeacher ? (
        <Card>
          <CardContent className="pt-6">
            {/* Tab bar — only shown for group lessons */}
            {participants.length > 0 && (
              <div className="flex gap-1 mb-6 border-b border-gray-200">
                {(['group', ...participants.map((p: any) => p.id)] as string[]).map(tabId => {
                  const label = tabId === 'group' ? 'Group' : participants.find((p: any) => p.id === tabId)?.full_name?.split(' ')[0]
                  return (
                    <button
                      key={tabId}
                      onClick={() => setActiveNoteTab(tabId)}
                      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                        activeNoteTab === tabId
                          ? 'border-brand text-brand'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            )}
            <LessonNotesEditor
              key={activeNoteTab}
              lessonId={lessonId!}
              studentId={lesson.student_id}
              studentIds={participants.length > 0 ? participants.map((p: any) => p.id) : undefined}
              noteStudentId={activeNoteTab === 'group' ? null : activeNoteTab}
              initialNotes={notesMap[activeNoteTab] ?? undefined}
              goals={goals}
              onSaved={loadData}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Individual notes for this student */}
          {studentNotes && (
            <Card>
              <CardContent className="pt-6 space-y-5">
                <h2 className="text-lg font-semibold">Your Notes</h2>
                <NotesReadView notes={studentNotes} />
              </CardContent>
            </Card>
          )}
          {/* Group / shared notes */}
          {groupNotes && (
            <Card>
              <CardContent className="pt-6 space-y-5">
                <h2 className="text-lg font-semibold">{studentNotes ? 'Group Notes' : 'Lesson Notes'}</h2>
                <NotesReadView notes={groupNotes} />
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Attachments */}
      <Card>
        <CardContent className="pt-6">
          <LessonAttachments lessonId={lessonId!} canUpload={isTeacher} />
        </CardContent>
      </Card>
    </div>
  )
}
