import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { login } from '@/lib/api/auth'
import { supabase } from '@/lib/supabase'

export function LoginPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'teacher' | 'student'>('student')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Student flow state
  const [classCode, setClassCode] = useState('')
  const [students, setStudents] = useState<{ id: string; full_name: string; email: string }[]>([])
  const [selectedStudentEmail, setSelectedStudentEmail] = useState('')
  const [studentPassword, setStudentPassword] = useState('')
  const [loadingClass, setLoadingClass] = useState(false)

  async function handleTeacherLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const form = new FormData(e.currentTarget)
    const result = await login(form.get('email') as string, form.get('password') as string)
    if (result.error) { setError(result.error); setLoading(false) }
    else navigate('/dashboard')
  }

  async function handleFindClass(e: FormEvent) {
    e.preventDefault()
    if (!classCode.trim()) return
    setError('')
    setLoadingClass(true)
    setStudents([])
    setSelectedStudentEmail('')

    const { data, error: rpcError } = await supabase.rpc('get_class_students', {
      class_code: classCode.trim().toUpperCase(),
    })

    setLoadingClass(false)
    if (rpcError || !data?.length) {
      setError(rpcError ? rpcError.message : 'No class found with that code. Check with your teacher.')
      return
    }
    setStudents(data)
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
    setStudents([])
    setClassCode('')
    setSelectedStudentEmail('')
    setStudentPassword('')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-2xl">TLC English</CardTitle>
          <p className="text-sm text-gray-500 mt-1">Teaching &amp; Learning Center</p>
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
                <Input id="password" name="password" type="password" required placeholder="••••••••" />
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
              {/* Step 1: class code */}
              <form onSubmit={handleFindClass} className="space-y-3">
                <Label>Step 1 — Enter your class code</Label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={classCode}
                    onChange={e => { setClassCode(e.target.value.toUpperCase()); setStudents([]); setSelectedStudentEmail('') }}
                    placeholder="e.g. AB3K9X"
                    maxLength={6}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm font-mono tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                  <Button type="submit" variant="outline" disabled={loadingClass || classCode.length < 6}>
                    {loadingClass ? '…' : 'Find'}
                  </Button>
                </div>
              </form>

              {/* Step 2: pick name + password */}
              {students.length > 0 && (
                <form onSubmit={handleStudentLogin} className="space-y-4 border-t pt-4">
                  <div className="space-y-2">
                    <Label>Step 2 — Who are you?</Label>
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
                    <Input
                      id="student-password"
                      type="password"
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
        </CardContent>
      </Card>
    </div>
  )
}
