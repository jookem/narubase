import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { addGrammarToBank, deleteGrammarEntry, type GrammarBankEntry } from '@/lib/api/grammar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

const MASTERY_COLORS = [
  'bg-gray-100 text-gray-500',
  'bg-yellow-100 text-yellow-700',
  'bg-brand-light text-brand-dark',
  'bg-green-100 text-green-700',
]
const MASTERY_LABELS = ['New', 'Seen', 'Familiar', 'Mastered']

interface LessonGrammarPoint {
  lessonId: string
  lessonDate: string
  point: string
  explanation: string
  examples: string[]
}

interface Props {
  studentId: string
}

export function GrammarBankManager({ studentId }: Props) {
  const [entries, setEntries] = useState<GrammarBankEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Add from lesson
  const [lessonGrammar, setLessonGrammar] = useState<LessonGrammarPoint[]>([])
  const [showLessonPicker, setShowLessonPicker] = useState(false)
  const [adding, setAdding] = useState(false)

  // Manual add
  const [showManual, setShowManual] = useState(false)
  const [manualPoint, setManualPoint] = useState('')
  const [manualExplanation, setManualExplanation] = useState('')
  const [manualExample, setManualExample] = useState('')
  const [savingManual, setSavingManual] = useState(false)

  async function load() {
    const { data, error } = await supabase
      .from('grammar_bank')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })

    if (error) console.error(error.message)
    setEntries((data ?? []) as GrammarBankEntry[])
    setLoading(false)
  }

  async function loadLessonGrammar() {
    // Fetch lesson notes for this student that have grammar_points
    const { data: notes } = await supabase
      .from('lesson_notes')
      .select('lesson_id, grammar_points, lesson:lessons(scheduled_start)')
      .eq('student_id', studentId)
      .not('grammar_points', 'eq', '[]')

    // Also fetch group notes (student_id is null, but student is a participant)
    const { data: participations } = await supabase
      .from('lesson_participants')
      .select('lesson_id')
      .eq('student_id', studentId)

    const participantLessonIds = (participations ?? []).map((p: any) => p.lesson_id)

    let groupNotes: any[] = []
    if (participantLessonIds.length > 0) {
      const { data: gn } = await supabase
        .from('lesson_notes')
        .select('lesson_id, grammar_points, lesson:lessons(scheduled_start)')
        .in('lesson_id', participantLessonIds)
        .is('student_id', null)
        .not('grammar_points', 'eq', '[]')
      groupNotes = gn ?? []
    }

    const allNotes = [...(notes ?? []), ...groupNotes]
    const existingPoints = new Set(entries.map(e => e.point))

    const points: LessonGrammarPoint[] = []
    for (const note of allNotes) {
      const gps = note.grammar_points ?? []
      for (const gp of gps) {
        if (!gp.point || existingPoints.has(gp.point)) continue
        points.push({
          lessonId: note.lesson_id,
          lessonDate: (note.lesson as any)?.scheduled_start ?? '',
          point: gp.point,
          explanation: gp.explanation ?? '',
          examples: gp.examples ?? [],
        })
      }
    }

    setLessonGrammar(points)
    setShowLessonPicker(true)
  }

  useEffect(() => { load() }, [studentId])

  async function handleAddFromLesson(gp: LessonGrammarPoint) {
    setAdding(true)
    const { error } = await addGrammarToBank([{
      student_id: studentId,
      point: gp.point,
      explanation: gp.explanation,
      examples: gp.examples,
      lesson_id: gp.lessonId,
    }])
    setAdding(false)
    if (error) toast.error(error)
    else {
      toast.success(`"${gp.point}" added to grammar bank`)
      await load()
      setLessonGrammar(prev => prev.filter(p => p.point !== gp.point))
    }
  }

  async function handleAddAll() {
    if (!lessonGrammar.length) return
    setAdding(true)
    const { error } = await addGrammarToBank(
      lessonGrammar.map(gp => ({
        student_id: studentId,
        point: gp.point,
        explanation: gp.explanation,
        examples: gp.examples,
        lesson_id: gp.lessonId,
      }))
    )
    setAdding(false)
    if (error) toast.error(error)
    else {
      toast.success(`${lessonGrammar.length} grammar points added`)
      setShowLessonPicker(false)
      await load()
    }
  }

  async function handleManualAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!manualPoint.trim() || !manualExplanation.trim()) return
    setSavingManual(true)
    const { error } = await addGrammarToBank([{
      student_id: studentId,
      point: manualPoint.trim(),
      explanation: manualExplanation.trim(),
      examples: manualExample.trim() ? [manualExample.trim()] : [],
    }])
    setSavingManual(false)
    if (error) toast.error(error)
    else {
      setManualPoint(''); setManualExplanation(''); setManualExample('')
      setShowManual(false)
      await load()
      toast.success('Grammar point added')
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    const { error } = await deleteGrammarEntry(id)
    setDeleting(null)
    if (error) toast.error(error)
    else setEntries(prev => prev.filter(e => e.id !== id))
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">
            Grammar Bank
            {!loading && (
              <span className="ml-2 text-xs font-normal text-gray-400">
                {entries.length} point{entries.length !== 1 ? 's' : ''}
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowManual(s => !s); setShowLessonPicker(false) }}
              className="text-xs text-gray-500 hover:text-brand transition-colors border border-gray-200 px-2 py-1 rounded-md"
            >
              + Manual
            </button>
            <button
              onClick={() => { loadLessonGrammar(); setShowManual(false) }}
              className="text-xs text-brand hover:text-brand/80 transition-colors border border-brand/30 px-2 py-1 rounded-md"
            >
              + From Lessons
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Manual add form */}
        {showManual && (
          <form onSubmit={handleManualAdd} className="border rounded-xl p-4 bg-gray-50 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Input value={manualPoint} onChange={e => setManualPoint(e.target.value)} placeholder="Grammar point * (e.g. 〜ている)" required />
              <Input value={manualExample} onChange={e => setManualExample(e.target.value)} placeholder="Example sentence" />
            </div>
            <Input value={manualExplanation} onChange={e => setManualExplanation(e.target.value)} placeholder="Explanation / meaning *" required />
            <div className="flex gap-2">
              <button type="submit" disabled={savingManual} className="px-3 py-1.5 bg-brand text-white text-sm rounded-md disabled:opacity-50">
                {savingManual ? 'Adding…' : 'Add'}
              </button>
              <button type="button" onClick={() => setShowManual(false)} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700">
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Lesson grammar picker */}
        {showLessonPicker && (
          <div className="border rounded-xl p-4 bg-gray-50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">
                Grammar from lessons {lessonGrammar.length > 0 ? `(${lessonGrammar.length} new)` : ''}
              </span>
              <div className="flex gap-2">
                {lessonGrammar.length > 1 && (
                  <button onClick={handleAddAll} disabled={adding} className="text-xs text-brand hover:text-brand/80 disabled:opacity-50">
                    {adding ? 'Adding…' : 'Add all'}
                  </button>
                )}
                <button onClick={() => setShowLessonPicker(false)} className="text-xs text-gray-400 hover:text-gray-600">
                  Close
                </button>
              </div>
            </div>

            {lessonGrammar.length === 0 ? (
              <p className="text-xs text-gray-400">No new grammar points found in lesson notes.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {lessonGrammar.map((gp, i) => (
                  <div key={i} className="flex items-start gap-2 bg-white rounded-lg px-3 py-2 border border-gray-200">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-gray-900">{gp.point}</span>
                      <p className="text-xs text-gray-500 mt-0.5">{gp.explanation}</p>
                    </div>
                    <button
                      onClick={() => handleAddFromLesson(gp)}
                      disabled={adding}
                      className="text-xs text-brand hover:text-brand/80 shrink-0 disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Entry list */}
        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
          </div>
        ) : entries.length === 0 ? (
          <p className="text-sm text-gray-400">No grammar points added yet.</p>
        ) : (
          <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
            {entries.map(e => (
              <div key={e.id} className="flex items-start gap-2 py-2 border-b border-gray-100 last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-gray-900">{e.point}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${MASTERY_COLORS[e.mastery_level]}`}>
                      {MASTERY_LABELS[e.mastery_level]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{e.explanation}</p>
                  {e.examples.length > 0 && (
                    <p className="text-xs text-gray-400 italic mt-0.5">"{e.examples[0]}"</p>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(e.id)}
                  disabled={deleting === e.id}
                  className="text-xs text-gray-300 hover:text-red-500 transition-colors shrink-0 disabled:opacity-50"
                >
                  {deleting === e.id ? '…' : 'Remove'}
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
