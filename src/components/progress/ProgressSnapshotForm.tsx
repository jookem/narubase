'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createProgressSnapshot } from '@/app/actions/goals'

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

export function ProgressSnapshotForm({ studentId, teacherId }: { studentId: string; teacherId: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [cefrLevel, setCefrLevel] = useState<string>('')
  const [scores, setScores] = useState({ speaking: 5, listening: 5, reading: 5, writing: 5 })
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit() {
    setLoading(true)
    setError('')
    const result = await createProgressSnapshot({
      student_id: studentId,
      cefr_level: cefrLevel as any || undefined,
      speaking_score: scores.speaking,
      listening_score: scores.listening,
      reading_score: scores.reading,
      writing_score: scores.writing,
      notes: notes.trim() || undefined,
    })
    setLoading(false)
    if (result.error) {
      setError(result.error)
    } else {
      setOpen(false)
      setNotes('')
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="w-full">
        + Record Assessment
      </Button>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">New Assessment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="space-y-1">
          <Label className="text-xs">CEFR Level</Label>
          <div className="flex gap-1 flex-wrap">
            {CEFR_LEVELS.map(level => (
              <button
                key={level}
                onClick={() => setCefrLevel(cefrLevel === level ? '' : level)}
                className={`px-3 py-1 rounded text-sm border transition-colors ${
                  cefrLevel === level
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        {(['speaking', 'listening', 'reading', 'writing'] as const).map(skill => (
          <div key={skill} className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-xs capitalize">{skill}</Label>
              <span className="text-xs font-medium">{scores[skill]}/10</span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={scores[skill]}
              onChange={e => setScores(prev => ({ ...prev, [skill]: Number(e.target.value) }))}
              className="w-full accent-blue-600"
            />
          </div>
        ))}

        <div className="space-y-1">
          <Label className="text-xs">Notes (optional)</Label>
          <Textarea
            value={notes}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
            placeholder="Assessment notes..."
            rows={2}
          />
        </div>

        <div className="flex gap-2">
          <Button size="sm" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Saving...' : 'Save Assessment'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
