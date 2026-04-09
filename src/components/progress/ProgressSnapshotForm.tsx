import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createProgressSnapshot } from '@/lib/api/goals'

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

type PreviousSnapshot = {
  speaking_score?: number | null
  listening_score?: number | null
  reading_score?: number | null
  writing_score?: number | null
  cefr_level?: string | null
}

export function ProgressSnapshotForm({
  studentId,
  teacherId,
  latestSnapshot,
  onSaved,
}: {
  studentId: string
  teacherId: string
  latestSnapshot?: PreviousSnapshot | null
  onSaved?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [cefrLevel, setCefrLevel] = useState<string>('')
  const [scores, setScores] = useState({ speaking: 0, listening: 0, reading: 0, writing: 0 })
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  function handleOpen() {
    if (latestSnapshot) {
      setScores({
        speaking: latestSnapshot.speaking_score ?? 0,
        listening: latestSnapshot.listening_score ?? 0,
        reading: latestSnapshot.reading_score ?? 0,
        writing: latestSnapshot.writing_score ?? 0,
      })
      setCefrLevel(latestSnapshot.cefr_level ?? '')
    } else {
      setScores({ speaking: 0, listening: 0, reading: 0, writing: 0 })
      setCefrLevel('')
    }
    setNotes('')
    setError('')
    setOpen(true)
  }

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
      onSaved?.()
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={handleOpen} className="w-full">
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
                    ? 'bg-brand text-white border-brand'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-brand/50'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        {([
          { key: 'speaking',  color: '#02508E' },
          { key: 'listening', color: '#9b51e0' },
          { key: 'reading',   color: '#10b981' },
          { key: 'writing',   color: '#f59e0b' },
        ] as const).map(({ key, color }) => (
          <div key={key} className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-xs capitalize">{key}</Label>
              <span className="text-xs font-medium" style={{ color }}>{scores[key]}/10</span>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              value={scores[key]}
              onChange={e => setScores(prev => ({ ...prev, [key]: Number(e.target.value) }))}
              className="w-full"
              style={{ accentColor: color }}
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
