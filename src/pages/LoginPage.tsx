import { useState, useEffect, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { PasswordInput } from '@/components/auth/PasswordInput'
import { login } from '@/lib/api/auth'
import { supabase } from '@/lib/supabase'

type Teacher = { id: string; full_name: string; avatar_url: string | null }
type Student = { id: string; full_name: string; email: string }

export function LoginPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'teacher' | 'student'>('student')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Teacher selection
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loadingTeachers, setLoadingTeachers] = useState(false)
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null)

  // Student selection + login
  const [students, setStudents] = useState<Student[]>([])
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [selectedStudentEmail, setSelectedStudentEmail] = useState('')
  const [studentPassword, setStudentPassword] = useState('')

  useEffect(() => {
    if (mode === 'student') loadTeachers()
  }, [mode])

  async function loadTeachers() {
    setLoadingTeachers(true)
    const { data } = await supabase.rpc('get_all_teachers')
    setTeachers(data ?? [])
    setLoadingTeachers(false)
  }

  async function handleSelectTeacher(teacher: Teacher) {
    setSelectedTeacher(teacher)
    setStudents([])
    setSelectedStudentEmail('')
    setError('')
    setLoadingStudents(true)
    const { data, error: rpcError } = await supabase.rpc('get_teacher_students', {
      p_teacher_id: teacher.id,
    })
    setLoadingStudents(false)
    if (rpcError || !data?.length) {
      setError(rpcError?.message ?? 'No students found for this teacher.')
      return
    }
    setStudents(data)
  }

  async function handleTeacherLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const form = new FormData(e.currentTarget)
    const result = await login(form.get('email') as string, form.get('password') as string)
    if (result.error) { setError(result.error); setLoading(false) }
    else navigate('/dashboard')
  }

  async function handleStudentLogin(e: FormEvent) {
    e.preventDefault()
    if (!selectedStudentEmail || !studentPassword) return
    setError('')
    setLoading(true)
    const result = await login(selectedStudentEmail, studentPassword)
    if (result.error) { setError('Incorrect password. Try again.'); setLoading(false) }
    else navigate('/dashboard')
  }

  function switchMode(m: 'teacher' | 'student') {
    setMode(m)
    setError('')
    setSelectedTeacher(null)
    setStudents([])
    setSelectedStudentEmail('')
    setStudentPassword('')
  }

  function getInitials(name: string) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-4">
          <div className="flex items-center justify-center gap-3 mb-2">
            {/* icon = text (32px) × 1.333 ≈ 43px */}
            <img src="/narubase.svg" alt="" aria-hidden="true" style={{ height: 43, width: 'auto' }} />
            <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 300, fontSize: 32, color: '#3D3DB4', letterSpacing: '0.01em', lineHeight: 1 }}>
              NaruBase
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {/* Mode tabs */}
          <div className="flex gap-1 p-1 bg-gray-100 rounded-lg mb-6">
            <button
              onClick={() => switchMode('student')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === 'student' ? 'bg-white shadow text-brand' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              学生 · Student
            </button>
            <button
              onClick={() => switchMode('teacher')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === 'teacher' ? 'bg-white shadow text-brand' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              先生 · Teacher
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
              {error}
            </div>
          )}

          {/* ── Teacher login ── */}
          {mode === 'teacher' && (
            <form onSubmit={handleTeacherLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" required placeholder="you@example.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <PasswordInput id="password" name="password" required placeholder="••••••••" />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign In'}
              </Button>
              <p className="text-center text-sm text-gray-500">
                New teacher?{' '}
                <Link to="/signup" className="text-brand hover:underline">Create account</Link>
              </p>
            </form>
          )}

          {/* ── Student login ── */}
          {mode === 'student' && (
            <div className="space-y-5">
              {/* Step 1 — Teacher selection (character select screen) */}
              {!selectedTeacher ? (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
                    Choose your teacher
                  </p>
                  {loadingTeachers ? (
                    <div className="grid grid-cols-3 gap-3">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="flex flex-col items-center gap-2 animate-pulse">
                          <div className="w-16 h-16 rounded-full bg-gray-200" />
                          <div className="h-3 w-16 bg-gray-200 rounded" />
                        </div>
                      ))}
                    </div>
                  ) : teachers.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">No teachers found.</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      {teachers.map(teacher => (
                        <button
                          key={teacher.id}
                          type="button"
                          onClick={() => handleSelectTeacher(teacher)}
                          className="flex flex-col items-center gap-2 p-3 rounded-xl border-2 border-transparent hover:border-brand/40 hover:bg-brand-light transition-all group"
                        >
                          {teacher.avatar_url ? (
                            <img
                              src={teacher.avatar_url}
                              alt={teacher.full_name}
                              className="w-16 h-16 rounded-full object-cover ring-2 ring-transparent group-hover:ring-brand/40 transition-all"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-full bg-brand flex items-center justify-center ring-2 ring-transparent group-hover:ring-brand/40 transition-all">
                              <span className="text-white text-xl font-bold">
                                {getInitials(teacher.full_name)}
                              </span>
                            </div>
                          )}
                          <span className="text-xs font-medium text-gray-700 text-center leading-tight">
                            {teacher.full_name}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* Step 2 — Student name + password */
                <div className="space-y-4">
                  {/* Selected teacher banner */}
                  <div className="flex items-center gap-3 bg-brand-light border border-brand/20 rounded-xl px-4 py-3">
                    {selectedTeacher.avatar_url ? (
                      <img
                        src={selectedTeacher.avatar_url}
                        alt={selectedTeacher.full_name}
                        className="w-9 h-9 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-brand flex items-center justify-center shrink-0">
                        <span className="text-white text-sm font-bold">
                          {getInitials(selectedTeacher.full_name)}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500">Teacher</p>
                      <p className="text-sm font-semibold text-brand truncate">{selectedTeacher.full_name}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setSelectedTeacher(null); setStudents([]); setError('') }}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      Change
                    </button>
                  </div>

                  {loadingStudents ? (
                    <p className="text-sm text-gray-400 text-center py-2">Loading students…</p>
                  ) : students.length > 0 && (
                    <form onSubmit={handleStudentLogin} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Who are you?</Label>
                        <select
                          value={selectedStudentEmail}
                          onChange={e => setSelectedStudentEmail(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand"
                          required
                        >
                          <option value="">Select your name…</option>
                          {students.map(s => (
                            <option key={s.id} value={s.email}>{s.full_name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="student-password">Password</Label>
                        <PasswordInput
                          id="student-password"
                          value={studentPassword}
                          onChange={e => setStudentPassword(e.target.value)}
                          placeholder="••••••••"
                          required
                        />
                      </div>
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={loading || !selectedStudentEmail || !studentPassword}
                      >
                        {loading ? 'Signing in…' : 'Sign In'}
                      </Button>
                    </form>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
