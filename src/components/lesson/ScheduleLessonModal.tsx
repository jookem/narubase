import { useState, useEffect } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { createLesson, createRecurringLessons } from '@/lib/api/lessons'
import { toast } from 'sonner'

type Props = { studentId: string; studentName: string; onSaved?: () => void }

export function ScheduleLessonModal({ studentId, studentName, onSaved }: Props) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [lessonType, setLessonType] = useState<'trial' | 'regular' | 'intensive'>('regular')
  const [recurring, setRecurring] = useState(false)
  const [isGroup, setIsGroup] = useState(false)
  const [otherStudents, setOtherStudents] = useState<{ id: string; full_name: string }[]>([])
  const [selectedCoStudents, setSelectedCoStudents] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open && user) loadOtherStudents()
  }, [open, user])

  async function loadOtherStudents() {
    const { data } = await supabase
      .from('teacher_student_relationships')
      .select('student:profiles!teacher_student_relationships_student_id_fkey(id, full_name)')
      .eq('teacher_id', user!.id)
      .eq('status', 'active')
    const all = (data ?? []).map((r: any) => r.student).filter(Boolean)
    setOtherStudents(all.filter((s: any) => s.id !== studentId))
  }

  function toggleCoStudent(id: string) {
    setSelectedCoStudents(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!date || !startTime || !endTime) { setError('Date and times are required.'); return }

    const start = new Date(`${date}T${startTime}:00+09:00`)
    const end = new Date(`${date}T${endTime}:00+09:00`)
    if (end <= start) { setError('End time must be after start time.'); return }

    const allStudentIds = isGroup && selectedCoStudents.length
      ? [studentId, ...selectedCoStudents]
      : [studentId]

    setLoading(true)
    setError('')

    if (recurring) {
      const { created, skipped } = await createRecurringLessons({
        student_id: studentId,
        student_ids: allStudentIds,
        scheduled_start: start.toISOString(),
        scheduled_end: end.toISOString(),
        lesson_type: lessonType,
        weeks: 4,
      })

      setLoading(false)
      if (created === 0) { setError('All 4 slots conflict with existing lessons.'); return }

      setOpen(false)
      resetForm()
      toast.success(
        `${created} of 4 lessons scheduled${allStudentIds.length > 1 ? ` for ${allStudentIds.length} students` : ''}`,
        { description: skipped > 0 ? `${skipped} week${skipped > 1 ? 's' : ''} skipped due to conflicts.` : undefined }
      )
    } else {
      const result = await createLesson({
        student_id: studentId,
        student_ids: allStudentIds,
        scheduled_start: start.toISOString(),
        scheduled_end: end.toISOString(),
        lesson_type: lessonType,
      })

      setLoading(false)
      if (result.error) { setError(result.error); return }
      setOpen(false)
      resetForm()
    }

    onSaved?.()
  }

  function resetForm() {
    setDate('')
    setStartTime('')
    setEndTime('')
    setRecurring(false)
    setIsGroup(false)
    setSelectedCoStudents([])
    setError('')
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm() }}>
      <DialogTrigger render={<Button size="sm" variant="outline">+ Log Lesson</Button>} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Log Lesson — {studentName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && <p className="text-sm text-red-600">{error}</p>}

          <div>
            <Label className="text-xs">Date</Label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Start time (JST)</Label>
              <input
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>
            <div>
              <Label className="text-xs">End time (JST)</Label>
              <input
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Type</Label>
            <div className="flex gap-2 mt-1">
              {(['trial', 'regular', 'intensive'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setLessonType(t)}
                  className={`flex-1 py-1.5 rounded text-sm border capitalize transition-colors ${
                    lessonType === t
                      ? 'bg-brand text-white border-brand'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-brand/50'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Group lesson toggle */}
          {otherStudents.length > 0 && (
            <div>
              <div
                onClick={() => { setIsGroup(g => !g); setSelectedCoStudents([]) }}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  isGroup ? 'border-brand bg-brand-light' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${isGroup ? 'bg-brand' : 'bg-gray-300'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isGroup ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
                <div>
                  <p className={`text-sm font-medium ${isGroup ? 'text-brand-dark' : 'text-gray-700'}`}>Group lesson</p>
                  <p className="text-xs text-gray-400">Add more students to this lesson</p>
                </div>
              </div>

              {isGroup && (
                <div className="mt-2 space-y-1.5 pl-1">
                  <p className="text-xs text-gray-500 font-medium">Select co-participants:</p>
                  {otherStudents.map(s => (
                    <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedCoStudents.includes(s.id)}
                        onChange={() => toggleCoStudent(s.id)}
                        className="rounded"
                      />
                      <span className="text-sm text-gray-700">{s.full_name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Recurring toggle */}
          <div
            onClick={() => setRecurring(r => !r)}
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              recurring ? 'border-brand bg-brand-light' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${recurring ? 'bg-brand' : 'bg-gray-300'}`}>
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${recurring ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            <div>
              <p className={`text-sm font-medium ${recurring ? 'text-brand-dark' : 'text-gray-700'}`}>
                Repeat weekly × 4 weeks
              </p>
              <p className="text-xs text-gray-400">Schedules this lesson every week for a month</p>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading
                ? (recurring ? 'Scheduling…' : 'Saving…')
                : (recurring ? 'Schedule 4 Lessons' : 'Save Lesson')}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
