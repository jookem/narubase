'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createGoal, updateGoalStatus } from '@/app/actions/goals'

export function GoalForm({ studentId, teacherId }: { studentId: string; teacherId: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!title.trim()) return
    setLoading(true)
    setError('')
    const result = await createGoal({
      student_id: studentId,
      title: title.trim(),
      description: description.trim() || undefined,
      target_date: targetDate || undefined,
    })
    setLoading(false)
    if (result.error) {
      setError(result.error)
    } else {
      setTitle('')
      setDescription('')
      setTargetDate('')
      setOpen(false)
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="w-full">
        + Add Goal
      </Button>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">New Goal</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="space-y-1">
          <Label className="text-xs">Goal</Label>
          <Input
            value={title}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
            placeholder="e.g. Pass EIKEN Grade 2"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Description (optional)</Label>
          <Textarea
            value={description}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
            placeholder="More details..."
            rows={2}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Target Date (optional)</Label>
          <Input
            type="date"
            value={targetDate}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTargetDate(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSubmit} disabled={loading || !title.trim()}>
            {loading ? 'Saving...' : 'Save Goal'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
