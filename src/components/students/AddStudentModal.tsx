'use client'

import { useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { addStudentByEmail } from '@/app/actions/students'

const GRADE_OPTIONS = [
  { value: '', label: '— Select —' },
  { value: 'elementary_1', label: 'Elementary 1st grade' },
  { value: 'elementary_2', label: 'Elementary 2nd grade' },
  { value: 'elementary_3', label: 'Elementary 3rd grade' },
  { value: 'elementary_4', label: 'Elementary 4th grade' },
  { value: 'elementary_5', label: 'Elementary 5th grade' },
  { value: 'elementary_6', label: 'Elementary 6th grade' },
  { value: 'middle_1', label: 'Middle School 1st year' },
  { value: 'middle_2', label: 'Middle School 2nd year' },
  { value: 'middle_3', label: 'Middle School 3rd year' },
  { value: 'high_1', label: 'High School 1st year' },
  { value: 'high_2', label: 'High School 2nd year' },
  { value: 'high_3', label: 'High School 3rd year' },
  { value: 'university', label: 'University Student' },
  { value: 'adult', label: 'Adult / Working' },
  { value: 'other', label: 'Other' },
]

const EIKEN_OPTIONS = [
  { value: '', label: '— None / Unknown —' },
  { value: '5', label: '5級 (Grade 5)' },
  { value: '4', label: '4級 (Grade 4)' },
  { value: '3', label: '3級 (Grade 3)' },
  { value: 'pre-2', label: '準2級 (Pre-2)' },
  { value: '2', label: '2級 (Grade 2)' },
  { value: 'pre-1', label: '準1級 (Pre-1)' },
  { value: '1', label: '1級 (Grade 1)' },
]

const CEFR_OPTIONS = ['', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']

type Field = {
  email: string
  age: string
  grade: string
  school_name: string
  occupation: string
  eiken_grade: string
  toeic_score: string
  ielts_score: string
  toefl_score: string
  self_cefr: string
  hobbies: string
  likes: string
  dislikes: string
  learning_goals: string
  notes: string
}

const EMPTY: Field = {
  email: '', age: '', grade: '', school_name: '', occupation: '',
  eiken_grade: '', toeic_score: '', ielts_score: '', toefl_score: '', self_cefr: '',
  hobbies: '', likes: '', dislikes: '', learning_goals: '', notes: '',
}

export function AddStudentModal() {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState<Field>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function set(key: keyof Field, value: string) {
    setF(prev => ({ ...prev, [key]: value }))
  }

  const isAdult = f.grade === 'adult' || f.grade === 'university' || f.grade === 'other'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!f.email.trim()) { setError('Email is required.'); return }
    setLoading(true)
    setError('')

    const result = await addStudentByEmail(f.email, {
      age: f.age ? parseInt(f.age) : null,
      grade: f.grade || null,
      school_name: f.school_name || null,
      occupation: f.occupation || null,
      eiken_grade: f.eiken_grade || null,
      toeic_score: f.toeic_score ? parseInt(f.toeic_score) : null,
      ielts_score: f.ielts_score ? parseFloat(f.ielts_score) : null,
      toefl_score: f.toefl_score ? parseInt(f.toefl_score) : null,
      self_cefr: f.self_cefr || null,
      hobbies: f.hobbies || null,
      likes: f.likes || null,
      dislikes: f.dislikes || null,
      learning_goals: f.learning_goals || null,
      notes: f.notes || null,
    })

    setLoading(false)
    if (result.error) {
      setError(result.error)
    } else {
      setF(EMPTY)
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">+ Add Student</Button>
        }
      />
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Student</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>
          )}

          {/* Account */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Account</h3>
            <div>
              <Label className="text-xs">Student Email <span className="text-red-500">*</span></Label>
              <Input
                type="email"
                placeholder="student@example.com"
                value={f.email}
                onChange={e => set('email', e.target.value)}
                className="mt-1"
                required
              />
              <p className="text-xs text-gray-400 mt-1">The student must have already created an account with this email.</p>
            </div>
          </section>

          {/* Background */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Background</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Age</Label>
                <Input
                  type="number"
                  min={3}
                  max={100}
                  placeholder="e.g. 12"
                  value={f.age}
                  onChange={e => set('age', e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Grade / Level</Label>
                <select
                  value={f.grade}
                  onChange={e => set('grade', e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {GRADE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {!isAdult && (
              <div>
                <Label className="text-xs">School Name</Label>
                <Input
                  placeholder="e.g. Toyooka Elementary School"
                  value={f.school_name}
                  onChange={e => set('school_name', e.target.value)}
                  className="mt-1"
                />
              </div>
            )}

            {isAdult && (
              <div>
                <Label className="text-xs">Occupation</Label>
                <Input
                  placeholder="e.g. Office worker, Nurse, Engineer..."
                  value={f.occupation}
                  onChange={e => set('occupation', e.target.value)}
                  className="mt-1"
                />
              </div>
            )}
          </section>

          {/* English Proficiency */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">English Proficiency</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">EIKEN Grade</Label>
                <select
                  value={f.eiken_grade}
                  onChange={e => set('eiken_grade', e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {EIKEN_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">Self-assessed CEFR</Label>
                <select
                  value={f.self_cefr}
                  onChange={e => set('self_cefr', e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {CEFR_OPTIONS.map(o => (
                    <option key={o} value={o}>{o || '— Unknown —'}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">TOEIC Score <span className="text-gray-400 font-normal">(10–990)</span></Label>
                <Input
                  type="number"
                  min={10}
                  max={990}
                  step={5}
                  placeholder="e.g. 650"
                  value={f.toeic_score}
                  onChange={e => set('toeic_score', e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">IELTS Band <span className="text-gray-400 font-normal">(0–9)</span></Label>
                <Input
                  type="number"
                  min={0}
                  max={9}
                  step={0.5}
                  placeholder="e.g. 6.5"
                  value={f.ielts_score}
                  onChange={e => set('ielts_score', e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">TOEFL iBT <span className="text-gray-400 font-normal">(0–120)</span></Label>
                <Input
                  type="number"
                  min={0}
                  max={120}
                  placeholder="e.g. 80"
                  value={f.toefl_score}
                  onChange={e => set('toefl_score', e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </section>

          {/* Personal */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Personal</h3>
            <div>
              <Label className="text-xs">Hobbies &amp; Interests</Label>
              <Textarea
                placeholder="e.g. Soccer, anime, cooking..."
                value={f.hobbies}
                onChange={e => set('hobbies', e.target.value)}
                rows={2}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Likes</Label>
                <Textarea
                  placeholder="Topics they enjoy talking about..."
                  value={f.likes}
                  onChange={e => set('likes', e.target.value)}
                  rows={2}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Dislikes</Label>
                <Textarea
                  placeholder="Topics or activities to avoid..."
                  value={f.dislikes}
                  onChange={e => set('dislikes', e.target.value)}
                  rows={2}
                  className="mt-1"
                />
              </div>
            </div>
          </section>

          {/* Goals & Notes */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Goals &amp; Notes</h3>
            <div>
              <Label className="text-xs">Learning Goals</Label>
              <Textarea
                placeholder="What does this student want to achieve? e.g. Pass EIKEN 2, travel abroad, improve business English..."
                value={f.learning_goals}
                onChange={e => set('learning_goals', e.target.value)}
                rows={3}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Additional Notes</Label>
              <Textarea
                placeholder="Anything else worth noting — learning style, family situation, special considerations..."
                value={f.notes}
                onChange={e => set('notes', e.target.value)}
                rows={2}
                className="mt-1"
              />
            </div>
          </section>

          <div className="flex gap-2 pt-2 border-t">
            <Button type="submit" disabled={loading || !f.email.trim()}>
              {loading ? 'Adding...' : 'Add Student'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => { setOpen(false); setF(EMPTY); setError('') }}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
