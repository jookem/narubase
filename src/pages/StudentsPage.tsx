import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Copy, Check } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { RemoveStudentButton } from '@/components/students/RemoveStudentButton'
import { createPlaceholderStudent, linkPlaceholderToStudent, setStudentPassword } from '@/lib/api/students'
import { toast } from 'sonner'

export function StudentsPage() {
  const { user, profile } = useAuth()
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const [addingName, setAddingName] = useState('')
  const [addingPassword, setAddingPassword] = useState('')
  const [addingStudent, setAddingStudent] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)

  function copyCode() {
    if (!profile?.invite_code) return
    navigator.clipboard.writeText(profile.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function loadStudents() {
    if (!user) return
    const { data } = await supabase
      .from('teacher_student_relationships')
      .select('*, student:profiles!teacher_student_relationships_student_id_fkey(*)')
      .eq('teacher_id', user.id)
      .eq('status', 'active')
      .order('started_at', { ascending: false })
    setStudents(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadStudents() }, [user])

  async function handleAddStudent(e: React.FormEvent) {
    e.preventDefault()
    if (!addingName.trim() || !addingPassword.trim()) return
    if (addingPassword.length < 6) { toast.error('Password must be at least 6 characters.'); return }
    setAddingStudent(true)
    const { error } = await createPlaceholderStudent(addingName.trim(), addingPassword)
    setAddingStudent(false)
    if (error) {
      toast.error(error)
    } else {
      setAddingName('')
      setAddingPassword('')
      setShowAddForm(false)
      toast.success(`${addingName} added. They can now log in with class code + their name.`)
      loadStudents()
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded-lg animate-pulse" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Students</h1>
          <p className="text-sm text-gray-500 mt-0.5">{students.length} active</p>
        </div>
        <button
          onClick={() => setShowAddForm(s => !s)}
          className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand/90 transition-colors"
        >
          + Add Student
        </button>
      </div>

      {/* Add student form */}
      {showAddForm && (
        <Card className="border-brand/30 bg-brand-light">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm font-medium text-brand-dark mb-1">Add a student</p>
            <p className="text-xs text-gray-500 mb-3">
              Set a name and initial password. The student logs in by entering your class code,
              selecting their name, and entering this password.
            </p>
            <form onSubmit={handleAddStudent} className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={addingName}
                  onChange={e => setAddingName(e.target.value)}
                  placeholder="Student's full name"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  autoFocus
                  required
                />
                <input
                  type="text"
                  value={addingPassword}
                  onChange={e => setAddingPassword(e.target.value)}
                  placeholder="Initial password (min 6)"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  required
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={addingStudent || !addingName.trim() || !addingPassword.trim()}
                  className="px-4 py-2 bg-brand text-white text-sm rounded-md hover:bg-brand/90 transition-colors disabled:opacity-50"
                >
                  {addingStudent ? 'Adding…' : 'Add Student'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddForm(false); setAddingName(''); setAddingPassword('') }}
                  className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Invite code — for adult students who sign up themselves */}
      {profile?.invite_code && (
        <div className="flex items-center gap-4 bg-brand-light border border-brand/20 rounded-xl px-5 py-4">
          <div className="flex-1">
            <p className="text-xs font-medium text-brand uppercase tracking-wide">Class Code</p>
            <p className="text-xs text-gray-500 mt-0.5">Students need this to log in · Adults can also use it in Settings → Join a Teacher</p>
          </div>
          <span className="font-mono text-2xl font-bold tracking-widest text-brand">
            {profile.invite_code}
          </span>
          <button
            onClick={copyCode}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-brand/20 rounded-md hover:bg-gray-50 transition-colors"
          >
            {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}

      {students.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <p>No students yet.</p>
            <p className="text-sm mt-1">Click "+ Add Student" to add your first student.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {students.map((rel: any) => (
            <StudentCard key={rel.id} relationship={rel} onRemoved={loadStudents} onLinked={loadStudents} />
          ))}
        </div>
      )}
    </div>
  )
}

function StudentCard({
  relationship,
  onRemoved,
  onLinked,
}: {
  relationship: any
  onRemoved: () => void
  onLinked: () => void
}) {
  const student = relationship.student
  const isPlaceholder = student.is_placeholder
  const initials = student.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)

  const [showLinkForm, setShowLinkForm] = useState(false)
  const [linkEmail, setLinkEmail] = useState('')
  const [linking, setLinking] = useState(false)

  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [settingPassword, setSettingPassword] = useState(false)

  async function handleLink(e: React.FormEvent) {
    e.preventDefault()
    setLinking(true)
    const { error, realStudentName } = await linkPlaceholderToStudent(student.id, linkEmail)
    setLinking(false)
    if (error) {
      toast.error(error)
    } else {
      toast.success(`Linked to ${realStudentName}'s account`)
      setShowLinkForm(false)
      onLinked()
    }
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword.length < 6) { toast.error('Password must be at least 6 characters.'); return }
    setSettingPassword(true)
    const { error } = await setStudentPassword(student.id, newPassword)
    setSettingPassword(false)
    if (error) {
      toast.error(error)
    } else {
      toast.success(`Password updated for ${student.full_name}`)
      setShowPasswordForm(false)
      setNewPassword('')
    }
  }

  return (
    <Card className={`transition-colors ${isPlaceholder ? 'border-dashed border-gray-300' : 'hover:border-brand/50'}`}>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center gap-3">
          <Link to={`/students/${student.id}`} className="flex items-center gap-3 flex-1 min-w-0">
            {isPlaceholder ? (
              <div className="h-10 w-10 shrink-0 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
                <span className="text-sm font-semibold text-gray-400">{initials}</span>
              </div>
            ) : (
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage src={student.avatar_url} />
                <AvatarFallback className="bg-brand-light text-brand-dark font-semibold text-sm">
                  {initials}
                </AvatarFallback>
              </Avatar>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">{student.full_name}</p>
              <p className="text-xs text-gray-400 truncate">
                {isPlaceholder ? 'Teacher-created account' : student.email}
              </p>
            </div>
          </Link>
          <RemoveStudentButton studentId={student.id} studentName={student.full_name} onRemoved={onRemoved} />
        </div>

        {/* Action buttons */}
        {!showLinkForm && !showPasswordForm && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowPasswordForm(true)}
              className="flex-1 text-xs px-3 py-1.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Set Password
            </button>
            {isPlaceholder && (
              <button
                onClick={() => setShowLinkForm(true)}
                className="flex-1 text-xs px-3 py-1.5 rounded border border-brand/30 text-brand hover:bg-brand-light transition-colors"
              >
                Link Email →
              </button>
            )}
          </div>
        )}

        {/* Set password form */}
        {showPasswordForm && (
          <form onSubmit={handleSetPassword} className="space-y-2">
            <input
              type="text"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="New password (min 6 chars)"
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-brand"
              autoFocus
              required
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={settingPassword || newPassword.length < 6}
                className="flex-1 py-1.5 bg-brand text-white text-xs rounded hover:bg-brand/90 disabled:opacity-50"
              >
                {settingPassword ? 'Saving…' : 'Save Password'}
              </button>
              <button
                type="button"
                onClick={() => { setShowPasswordForm(false); setNewPassword('') }}
                className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Link email form */}
        {showLinkForm && (
          <form onSubmit={handleLink} className="space-y-2">
            <p className="text-xs text-gray-500">Enter the email the student used to sign up:</p>
            <input
              type="email"
              value={linkEmail}
              onChange={e => setLinkEmail(e.target.value)}
              placeholder="student@email.com"
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-brand"
              autoFocus
              required
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={linking || !linkEmail}
                className="flex-1 py-1.5 bg-brand text-white text-xs rounded hover:bg-brand/90 disabled:opacity-50"
              >
                {linking ? 'Linking…' : 'Link Account'}
              </button>
              <button
                type="button"
                onClick={() => { setShowLinkForm(false); setLinkEmail('') }}
                className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
