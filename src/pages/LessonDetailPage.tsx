import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { formatInTimeZone } from 'date-fns-tz'
import { LessonNotesEditor } from '@/components/lesson/LessonNotesEditor'
import { LessonAttachments } from '@/components/lesson/LessonAttachments'
import { markLessonComplete, updateGroupName } from '@/lib/api/lessons'
import { cancelLesson } from '@/lib/api/bookings'
import { toast } from 'sonner'
import type { VocabularyItem, GrammarPoint } from '@/lib/types/database'
import { PDFDownloadButton } from '@/components/pdf/PDFDownloadButton'
import { LessonNotesPDF } from '@/components/pdf/LessonNotesPDF'

export function LessonDetailPage() {
  const { lessonId } = useParams<{ lessonId: string }>()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [lesson, setLesson] = useState<any>(null)
  const [notes, setNotes] = useState<any>(null)
  const [goals, setGoals] = useState<any[]>([])
  const [participants, setParticipants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [editingGroupName, setEditingGroupName] = useState(false)
  const [groupNameValue, setGroupNameValue] = useState('')

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
        supabase.from('lesson_notes').select('*').eq('lesson_id', lessonId).single(),
        supabase.from('student_goals').select('*').eq('teacher_id', user.id).eq('status', 'active'),
        supabase
          .from('lesson_participants')
          .select('student_id, student:profiles!lesson_participants_student_id_fkey(id, full_name)')
          .eq('lesson_id', lessonId),
      ])

      if (!lessonResult.data) { navigate('/lessons'); return }
      setLesson(lessonResult.data)
      setNotes(notesResult.data ?? null)
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

      const [lessonResult, notesResult] = await Promise.all([
        lessonQuery,
        supabase
          .from('lesson_notes')
          .select('summary, vocabulary, grammar_points, homework, strengths, areas_to_focus')
          .eq('lesson_id', lessonId)
          .eq('is_visible_to_student', true)
          .single(),
      ])

      if (!lessonResult.data) { navigate('/lessons'); return }
      setLesson(lessonResult.data)
      setNotes(notesResult.data ?? null)
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
      <div className="flex items-start justify-between">
        <div>
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
            {formatInTimeZone(new Date(lesson.scheduled_start), 'Asia/Tokyo', 'EEEE, MMMM d, yyyy · h:mm a')}
            {' - '}
            {formatInTimeZone(new Date(lesson.scheduled_end), 'Asia/Tokyo', 'h:mm a')}
            {' JST'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="capitalize">{lesson.lesson_type}</Badge>
          <span className={`text-sm px-2 py-0.5 rounded-full font-medium capitalize ${
            lesson.status === 'scheduled' ? 'bg-brand-light text-brand-dark' :
            lesson.status === 'completed' ? 'bg-green-100 text-green-700' :
            'bg-gray-100 text-gray-700'
          }`}>
            {lesson.status}
          </span>
          {isTeacher && notes && (
            <PDFDownloadButton
              document={
                <LessonNotesPDF
                  lesson={lesson}
                  notes={notes}
                  studentName={lesson.student?.full_name ?? ''}
                  teacherName={lesson.teacher?.full_name ?? ''}
                  participants={participants}
                />
              }
              filename={`lesson-notes-${lesson.student?.full_name?.replace(/\s+/g, '-').toLowerCase()}-${lesson.scheduled_start.slice(0, 10)}.pdf`}
              label="Export PDF"
            />
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
          {lesson.status === 'scheduled' && (
            confirmCancel ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Cancel this lesson?</span>
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

      {/* Notes — teacher gets full editor, student gets read-only view */}
      {isTeacher ? (
        <Card>
          <CardContent className="pt-6">
            <LessonNotesEditor
              lessonId={lessonId!}
              studentId={lesson.student_id}
              studentIds={participants.length > 1 ? participants.map((p: any) => p.id) : undefined}
              initialNotes={notes ?? undefined}
              goals={goals}
              onSaved={loadData}
            />
          </CardContent>
        </Card>
      ) : notes ? (
        <Card>
          <CardContent className="pt-6 space-y-5">
            <h2 className="text-lg font-semibold">Lesson Notes</h2>

            {notes.summary && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Summary</p>
                <p className="text-sm text-gray-700">{notes.summary}</p>
              </div>
            )}

            {notes.vocabulary?.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Vocabulary</p>
                <div className="space-y-1.5">
                  {(notes.vocabulary as VocabularyItem[]).map((v, i) => (
                    <div key={i} className="p-2.5 bg-brand-light rounded-lg">
                      <span className="font-medium text-brand-dark">{v.word}</span>
                      <span className="text-gray-500 mx-2">—</span>
                      <span className="text-gray-700 text-sm">{v.definition}</span>
                      {v.example && (
                        <p className="text-xs text-gray-400 italic mt-0.5">&ldquo;{v.example}&rdquo;</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {notes.grammar_points?.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Grammar Points</p>
                <div className="space-y-1.5">
                  {(notes.grammar_points as GrammarPoint[]).map((gp, i) => (
                    <div key={i} className="p-2.5 bg-green-50 rounded-lg">
                      <p className="font-medium text-green-900 text-sm">{gp.point}</p>
                      <p className="text-xs text-gray-600">{gp.explanation}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {notes.homework && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Homework / 宿題</p>
                <p className="text-sm text-gray-700">{notes.homework}</p>
              </div>
            )}

            {(notes.strengths || notes.areas_to_focus) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {notes.strengths && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-green-600 uppercase tracking-wider">Strengths</p>
                    <p className="text-sm text-gray-700">{notes.strengths}</p>
                  </div>
                )}
                {notes.areas_to_focus && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-orange-600 uppercase tracking-wider">Areas to Focus</p>
                    <p className="text-sm text-gray-700">{notes.areas_to_focus}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* Attachments */}
      <Card>
        <CardContent className="pt-6">
          <LessonAttachments lessonId={lessonId!} canUpload={isTeacher} />
        </CardContent>
      </Card>
    </div>
  )
}
