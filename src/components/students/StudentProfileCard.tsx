import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { format } from 'date-fns'
import { updateStudentDetails, type StudentDetailsInput } from '@/lib/api/students'

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
  { value: 'pre-2-plus', label: '準2級プラス (Pre-2 Plus)' },
  { value: '2', label: '2級 (Grade 2)' },
  { value: 'pre-1', label: '準1級 (Pre-1)' },
  { value: '1', label: '1級 (Grade 1)' },
]

const CEFR_OPTIONS = ['', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']

const GRADE_LABELS: Record<string, string> = Object.fromEntries(
  GRADE_OPTIONS.filter(o => o.value).map(o => [o.value, o.label])
)
const EIKEN_LABELS: Record<string, string> = {
  '5': '5級', '4': '4級', '3': '3級', 'pre-2': '準2級', 'pre-2-plus': '準2級プラス', '2': '2級', 'pre-1': '準1級', '1': '1級',
}

type Details = StudentDetailsInput & { student_id?: string }

function toField(d: Details | null): Record<string, string> {
  return {
    age: d?.age?.toString() ?? '',
    birthday: d?.birthday ?? '',
    grade: d?.grade ?? '',
    school_name: d?.school_name ?? '',
    occupation: d?.occupation ?? '',
    eiken_grade: d?.eiken_grade ?? '',
    toeic_score: d?.toeic_score?.toString() ?? '',
    ielts_score: d?.ielts_score?.toString() ?? '',
    toefl_score: d?.toefl_score?.toString() ?? '',
    self_cefr: d?.self_cefr ?? '',
    hobbies: d?.hobbies ?? '',
    likes: d?.likes ?? '',
    dislikes: d?.dislikes ?? '',
    learning_goals: d?.learning_goals ?? '',
    notes: d?.notes ?? '',
  }
}

export function StudentProfileCard({
  studentId,
  details: initialDetails,
  onSaved,
}: {
  studentId: string
  details: Details | null
  onSaved?: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [f, setF] = useState(() => toField(initialDetails))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function set(key: string, value: string) {
    setF(prev => ({ ...prev, [key]: value }))
  }

  const isAdult = f.grade === 'adult' || f.grade === 'university' || f.grade === 'other'

  async function handleSave() {
    setLoading(true)
    setError('')
    const result = await updateStudentDetails(studentId, {
      age: f.age ? parseInt(f.age) : null,
      birthday: f.birthday || null,
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
      setEditing(false)
      onSaved?.()
    }
  }

  function handleCancel() {
    setF(toField(initialDetails))
    setError('')
    setEditing(false)
  }

  const d = initialDetails

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Profile</CardTitle>
          {!editing && (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="space-y-6">
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}

            <section className="space-y-3">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Background</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Birthday</Label>
                  <input
                    type="date"
                    value={f.birthday}
                    onChange={e => set('birthday', e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <Label className="text-xs">Age</Label>
                  <Input type="number" min={3} max={100} placeholder="e.g. 12" value={f.age} onChange={e => set('age', e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Grade / Level</Label>
                  <select
                    value={f.grade}
                    onChange={e => set('grade', e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {GRADE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              {!isAdult ? (
                <div>
                  <Label className="text-xs">School Name</Label>
                  <Input placeholder="e.g. Toyooka Elementary School" value={f.school_name} onChange={e => set('school_name', e.target.value)} className="mt-1" />
                </div>
              ) : (
                <div>
                  <Label className="text-xs">Occupation</Label>
                  <Input placeholder="e.g. Office worker, Nurse, Engineer..." value={f.occupation} onChange={e => set('occupation', e.target.value)} className="mt-1" />
                </div>
              )}
            </section>

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
                    {EIKEN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Self-assessed CEFR</Label>
                  <select
                    value={f.self_cefr}
                    onChange={e => set('self_cefr', e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {CEFR_OPTIONS.map(o => <option key={o} value={o}>{o || '— Unknown —'}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">TOEIC Score <span className="text-gray-400 font-normal">(10–990)</span></Label>
                  <Input type="number" min={10} max={990} step={5} placeholder="e.g. 650" value={f.toeic_score} onChange={e => set('toeic_score', e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">IELTS Band <span className="text-gray-400 font-normal">(0–9)</span></Label>
                  <Input type="number" min={0} max={9} step={0.5} placeholder="e.g. 6.5" value={f.ielts_score} onChange={e => set('ielts_score', e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">TOEFL iBT <span className="text-gray-400 font-normal">(0–120)</span></Label>
                  <Input type="number" min={0} max={120} placeholder="e.g. 80" value={f.toefl_score} onChange={e => set('toefl_score', e.target.value)} className="mt-1" />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Personal</h3>
              <div>
                <Label className="text-xs">Hobbies &amp; Interests</Label>
                <Textarea placeholder="e.g. Soccer, anime, cooking..." value={f.hobbies} onChange={e => set('hobbies', e.target.value)} rows={2} className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Likes</Label>
                  <Textarea placeholder="Topics they enjoy talking about..." value={f.likes} onChange={e => set('likes', e.target.value)} rows={2} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Dislikes</Label>
                  <Textarea placeholder="Topics or activities to avoid..." value={f.dislikes} onChange={e => set('dislikes', e.target.value)} rows={2} className="mt-1" />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Goals &amp; Notes</h3>
              <div>
                <Label className="text-xs">Dreams</Label>
                <Textarea placeholder="What does this student want to achieve?" value={f.learning_goals} onChange={e => set('learning_goals', e.target.value)} rows={3} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Additional Notes</Label>
                <Textarea placeholder="Anything else worth noting..." value={f.notes} onChange={e => set('notes', e.target.value)} rows={2} className="mt-1" />
              </div>
            </section>

            <div className="flex gap-2 pt-2 border-t">
              <Button onClick={handleSave} disabled={loading}>
                {loading ? 'Saving...' : 'Save'}
              </Button>
              <Button variant="outline" onClick={handleCancel} disabled={loading}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            {!d || !(d.age || d.grade || d.school_name || d.occupation || d.eiken_grade || d.self_cefr || d.toeic_score || d.ielts_score || d.toefl_score || d.hobbies || d.likes || d.dislikes || d.learning_goals || d.notes) ? (
              <p className="text-sm text-gray-400">No profile information yet.</p>
            ) : (
              <div className="space-y-4">
                {(d.birthday || d.age || d.grade || d.school_name || d.occupation) && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Background</p>
                    <dl className="grid gap-x-6 gap-y-1.5 text-sm" style={{ gridTemplateColumns: 'max-content auto' }}>
                      {d.birthday && <><dt className="text-gray-500">Birthday</dt><dd>{format(new Date(d.birthday), 'MMMM d')}{(() => { const today = new Date(); const bday = new Date(d.birthday!); const isBday = bday.getMonth() === today.getMonth() && bday.getDate() === today.getDate(); return isBday ? ' 🎂' : '' })()}</dd></>}
                      {d.birthday
                        ? <><dt className="text-gray-500">Age</dt><dd>{(() => { const b = new Date(d.birthday!); const t = new Date(); let age = t.getFullYear() - b.getFullYear(); if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) age--; return age })()} years old</dd></>
                        : d.age ? <><dt className="text-gray-500">Age</dt><dd>{d.age}</dd></> : null
                      }
                      {d.grade && <><dt className="text-gray-500">Grade / Level</dt><dd>{GRADE_LABELS[d.grade] ?? d.grade}</dd></>}
                      {!isAdult && d.school_name && <><dt className="text-gray-500">School</dt><dd>{d.school_name}</dd></>}
                      {isAdult && d.occupation && <><dt className="text-gray-500">Occupation</dt><dd>{d.occupation}</dd></>}
                    </dl>
                  </div>
                )}

                {(d.eiken_grade || d.self_cefr || d.toeic_score || d.ielts_score || d.toefl_score) && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">English Proficiency</p>
                    <dl className="grid gap-x-6 gap-y-1.5 text-sm" style={{ gridTemplateColumns: 'max-content auto' }}>
                      {d.self_cefr && <><dt className="text-gray-500">Self-assessed CEFR</dt><dd>{d.self_cefr}</dd></>}
                      {d.eiken_grade && <><dt className="text-gray-500">EIKEN</dt><dd>{EIKEN_LABELS[d.eiken_grade] ?? d.eiken_grade}</dd></>}
                      {d.toeic_score && <><dt className="text-gray-500">TOEIC</dt><dd>{d.toeic_score}</dd></>}
                      {d.ielts_score && <><dt className="text-gray-500">IELTS</dt><dd>{d.ielts_score}</dd></>}
                      {d.toefl_score && <><dt className="text-gray-500">TOEFL iBT</dt><dd>{d.toefl_score}</dd></>}
                    </dl>
                  </div>
                )}

                {(d.hobbies || d.likes || d.dislikes) && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Personal</p>
                    <dl className="space-y-1.5 text-sm">
                      {d.hobbies && <><dt className="text-gray-500">Hobbies &amp; Interests</dt><dd>{d.hobbies}</dd></>}
                      {d.likes && <><dt className="text-gray-500">Likes</dt><dd>{d.likes}</dd></>}
                      {d.dislikes && <><dt className="text-gray-500">Dislikes</dt><dd>{d.dislikes}</dd></>}
                    </dl>
                  </div>
                )}

                {(d.learning_goals || d.notes) && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Goals &amp; Notes</p>
                    <dl className="space-y-1.5 text-sm">
                      {d.learning_goals && <><dt className="text-gray-500">Dreams</dt><dd className="whitespace-pre-wrap">{d.learning_goals}</dd></>}
                      {d.notes && <><dt className="text-gray-500">Notes</dt><dd className="whitespace-pre-wrap">{d.notes}</dd></>}
                    </dl>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
