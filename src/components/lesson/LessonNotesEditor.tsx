import { useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { saveLessonNotes, addVocabularyToBank } from '@/lib/api/lessons'
import { toast } from 'sonner'
import type { LessonNotes, VocabularyItem, GrammarPoint, StudentGoal } from '@/lib/types/database'

interface LessonNotesEditorProps {
  lessonId: string
  studentId: string
  studentIds?: string[]
  noteStudentId?: string | null  // null = group note, string = individual note for that student
  initialNotes?: Partial<LessonNotes>
  goals?: StudentGoal[]
  onSaved?: () => void
}

export function LessonNotesEditor({
  lessonId,
  studentId,
  studentIds,
  noteStudentId,
  initialNotes,
  goals = [],
  onSaved,
}: LessonNotesEditorProps) {
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [summary, setSummary] = useState(initialNotes?.summary ?? '')
  const [homework, setHomework] = useState(initialNotes?.homework ?? '')
  const [strengths, setStrengths] = useState(initialNotes?.strengths ?? '')
  const [areasToFocus, setAreasToFocus] = useState(initialNotes?.areas_to_focus ?? '')
  const [teacherNotes, setTeacherNotes] = useState(initialNotes?.teacher_notes ?? '')
  const [isVisible, setIsVisible] = useState(initialNotes?.is_visible_to_student ?? true)
  const [selectedGoalIds, setSelectedGoalIds] = useState<string[]>(initialNotes?.goal_ids ?? [])

  const [vocabulary, setVocabulary] = useState<VocabularyItem[]>(initialNotes?.vocabulary ?? [])
  const [grammarPoints, setGrammarPoints] = useState<GrammarPoint[]>(initialNotes?.grammar_points ?? [])

  const [newWord, setNewWord] = useState('')
  const [newDefinition, setNewDefinition] = useState('')
  const [newExample, setNewExample] = useState('')

  const [newGrammarPoint, setNewGrammarPoint] = useState('')
  const [newGrammarExplanation, setNewGrammarExplanation] = useState('')

  const triggerAutoSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      await saveLessonNotes({
        lesson_id: lessonId,
        student_id: noteStudentId,
        summary,
        vocabulary,
        grammar_points: grammarPoints,
        homework,
        strengths,
        areas_to_focus: areasToFocus,
        teacher_notes: teacherNotes,
        goal_ids: selectedGoalIds,
        is_visible_to_student: isVisible,
      })
      setSaving(false)
      setSavedAt(new Date())
    }, 2000)
  }, [lessonId, summary, vocabulary, grammarPoints, homework, strengths, areasToFocus, teacherNotes, selectedGoalIds, isVisible])

  function addVocabItem() {
    if (!newWord.trim() || !newDefinition.trim()) return
    const item: VocabularyItem = {
      word: newWord.trim(),
      definition: newDefinition.trim(),
      example: newExample.trim() || undefined,
    }
    setVocabulary(prev => [...prev, item])
    setNewWord('')
    setNewDefinition('')
    setNewExample('')
    triggerAutoSave()
  }

  function removeVocabItem(index: number) {
    setVocabulary(prev => prev.filter((_, i) => i !== index))
    triggerAutoSave()
  }

  function addGrammarPoint() {
    if (!newGrammarPoint.trim() || !newGrammarExplanation.trim()) return
    const point: GrammarPoint = {
      point: newGrammarPoint.trim(),
      explanation: newGrammarExplanation.trim(),
    }
    setGrammarPoints(prev => [...prev, point])
    setNewGrammarPoint('')
    setNewGrammarExplanation('')
    triggerAutoSave()
  }

  function removeGrammarPoint(index: number) {
    setGrammarPoints(prev => prev.filter((_, i) => i !== index))
    triggerAutoSave()
  }

  function toggleGoal(goalId: string) {
    setSelectedGoalIds(prev =>
      prev.includes(goalId) ? prev.filter(id => id !== goalId) : [...prev, goalId]
    )
    triggerAutoSave()
  }

  async function handleSaveToVocabBank() {
    if (vocabulary.length === 0) return
    const allStudents = studentIds?.length ? studentIds : [studentId]
    const result = await addVocabularyToBank(
      allStudents.flatMap(sid =>
        vocabulary.map(v => ({
          student_id: sid,
          word: v.word,
          definition_en: v.definition,
          example: v.example,
          lesson_id: lessonId,
        }))
      )
    )
    if (result.error) {
      toast.error('Failed to save to vocab bank: ' + result.error)
    } else {
      toast.success(`${vocabulary.length} word${vocabulary.length !== 1 ? 's' : ''} saved to vocab bank`)
    }
  }

  async function handleManualSave() {
    setSaving(true)
    await saveLessonNotes({
      lesson_id: lessonId,
      summary,
      vocabulary,
      grammar_points: grammarPoints,
      homework,
      strengths,
      areas_to_focus: areasToFocus,
      teacher_notes: teacherNotes,
      goal_ids: selectedGoalIds,
      is_visible_to_student: isVisible,
    })
    setSaving(false)
    setSavedAt(new Date())
    onSaved?.()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Lesson Notes</h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            {saving ? 'Saving...' : savedAt ? `Saved ${savedAt.toLocaleTimeString()}` : ''}
          </span>
          <Button size="sm" onClick={handleManualSave} disabled={saving}>
            Save Notes
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="is_visible"
          checked={isVisible}
          onChange={e => { setIsVisible(e.target.checked); triggerAutoSave() }}
          className="rounded"
        />
        <Label htmlFor="is_visible" className="text-sm cursor-pointer">
          Visible to student
        </Label>
      </div>

      <div className="space-y-2">
        <Label>Session Summary</Label>
        <Textarea
          value={summary}
          onChange={e => { setSummary(e.target.value); triggerAutoSave() }}
          placeholder="What did you cover in this lesson? How did the student do overall?"
          rows={3}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Vocabulary ({vocabulary.length} words)</Label>
          {vocabulary.length > 0 && (
            <Button size="sm" variant="outline" onClick={handleSaveToVocabBank}>
              Save all to Vocab Bank
            </Button>
          )}
        </div>

        {vocabulary.map((item, i) => (
          <div key={i} className="flex items-start gap-2 p-3 bg-brand-light rounded-lg">
            <div className="flex-1">
              <span className="font-medium text-brand-dark">{item.word}</span>
              <span className="text-gray-600 mx-2">—</span>
              <span className="text-gray-700">{item.definition}</span>
              {item.example && (
                <p className="text-sm text-gray-500 italic mt-0.5">&ldquo;{item.example}&rdquo;</p>
              )}
            </div>
            <button onClick={() => removeVocabItem(i)} className="text-gray-400 hover:text-red-500 text-xs">
              Remove
            </button>
          </div>
        ))}

        <div className="grid grid-cols-3 gap-2">
          <Input value={newWord} onChange={e => setNewWord(e.target.value)} placeholder="Word" />
          <Input value={newDefinition} onChange={e => setNewDefinition(e.target.value)} placeholder="Definition" />
          <Input value={newExample} onChange={e => setNewExample(e.target.value)} placeholder="Example (optional)" />
        </div>
        <Button size="sm" variant="outline" onClick={addVocabItem} disabled={!newWord || !newDefinition}>
          + Add Word
        </Button>
      </div>

      <div className="space-y-3">
        <Label>Grammar Points ({grammarPoints.length})</Label>

        {grammarPoints.map((gp, i) => (
          <div key={i} className="flex items-start gap-2 p-3 bg-green-50 rounded-lg">
            <div className="flex-1">
              <p className="font-medium text-green-900">{gp.point}</p>
              <p className="text-sm text-gray-700">{gp.explanation}</p>
            </div>
            <button onClick={() => removeGrammarPoint(i)} className="text-gray-400 hover:text-red-500 text-xs">
              Remove
            </button>
          </div>
        ))}

        <div className="grid grid-cols-2 gap-2">
          <Input value={newGrammarPoint} onChange={e => setNewGrammarPoint(e.target.value)} placeholder="Grammar point (e.g. Past perfect)" />
          <Input value={newGrammarExplanation} onChange={e => setNewGrammarExplanation(e.target.value)} placeholder="Explanation" />
        </div>
        <Button size="sm" variant="outline" onClick={addGrammarPoint} disabled={!newGrammarPoint || !newGrammarExplanation}>
          + Add Grammar Point
        </Button>
      </div>

      <div className="space-y-2">
        <Label>Homework / 宿題</Label>
        <Textarea
          value={homework}
          onChange={e => { setHomework(e.target.value); triggerAutoSave() }}
          placeholder="What should the student do before the next lesson?"
          rows={2}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-green-700">Strengths</Label>
          <Textarea
            value={strengths}
            onChange={e => { setStrengths(e.target.value); triggerAutoSave() }}
            placeholder="What did the student do well?"
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-orange-700">Areas to Focus</Label>
          <Textarea
            value={areasToFocus}
            onChange={e => { setAreasToFocus(e.target.value); triggerAutoSave() }}
            placeholder="What should the student work on?"
            rows={3}
          />
        </div>
      </div>

      {goals.length > 0 && (
        <div className="space-y-2">
          <Label>Goals Addressed in This Lesson</Label>
          <div className="flex flex-wrap gap-2">
            {goals.map(goal => (
              <button
                key={goal.id}
                onClick={() => toggleGoal(goal.id)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  selectedGoalIds.includes(goal.id)
                    ? 'bg-brand text-white border-brand'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-brand/50'
                }`}
              >
                {goal.title}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2 border-t pt-4">
        <Label className="flex items-center gap-2">
          <span>Private Teacher Notes</span>
          <Badge variant="outline" className="text-xs">Not visible to student</Badge>
        </Label>
        <Textarea
          value={teacherNotes}
          onChange={e => { setTeacherNotes(e.target.value); triggerAutoSave() }}
          placeholder="Private observations, teaching strategy notes, things to remember..."
          rows={3}
          className="bg-amber-50 border-amber-200"
        />
      </div>
    </div>
  )
}
