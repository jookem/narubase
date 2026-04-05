import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Copy, Check } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { RemoveStudentButton } from '@/components/students/RemoveStudentButton'
import { createPlaceholderStudent, linkPlaceholderToStudent } from '@/lib/api/students'
import { toast } from 'sonner'

export function StudentsPage() {
  const { user, profile } = useAuth()
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  // Add student form
  const [addingName, setAddingName] = useState('')
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

  useEffect(() => {
    loadStudents()
  }, [user])

  async function handleAddStudent(e: React.FormEvent) {
    e.preventDefault()
    if (!addingName.trim()) return
    setAddingStudent(true)
    const { error } = await createPlaceholderStudent(addingName.trim())
    setAddingStudent(false)
    if (error) {
      toast.error(error)
    } else {
      setAddingName('')
      setShowAddForm(false)
      toast.success(`${addingName} added as a placeholder student`)
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
            <p className="text-sm font-medium text-brand-dark mb-1">Add a placeholder student</p>
            <p className="text-xs text-gray-500 mb-3">
              Creates a student record with just their name so you can build your schedule now.
              When they sign up later, you can link their real account from this page.
            </p>
            <form onSubmit={handleAddStudent} className="flex gap-2">
              <input
                type="text"
                value={addingName}
                onChange={e => setAddingName(e.target.value)}
                placeholder="Student's name"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                autoFocus
                required
              />
              <button
                type="submit"
                disabled={addingStudent || !addingName.trim()}
                className="px-4 py-2 bg-brand text-white text-sm rounded-md hover:bg-brand/90 transition-colors disabled:opacity-50"
              >
                {addingStudent ? 'Adding…' : 'Add'}
              </button>
              <button
                type="button"
                onClick={() => { setShowAddForm(false); setAddingName('') }}
                className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Cancel
              </button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Invite code banner */}
      {profile?.invite_code && (
        <div className="flex items-center gap-4 bg-brand-light border border-brand/20 rounded-xl px-5 py-4">
          <div className="flex-1">
            <p className="text-xs font-medium text-brand uppercase tracking-wide">Your Invite Code</p>
            <p className="text-xs text-gray-500 mt-0.5">Students enter this in Settings → Join a Teacher</p>
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
            <p className="text-sm mt-1">Add a placeholder student above, or share your invite code so students can join.</p>
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

  async function handleLink(e: React.FormEvent) {
    e.preventDefault()
    setLinking(true)
    const { error, realStudentName } = await linkPlaceholderToStudent(student.id, linkEmail)
    setLinking(false)
    if (error) {
      toast.error(error)
    } else {
      toast.success(`Linked to ${realStudentName}'s account — all lesson data transferred`)
      setShowLinkForm(false)
      onLinked()
    }
  }

  return (
    <Card className={`transition-colors ${isPlaceholder ? 'border-dashed border-gray-300' : 'hover:border-brand/50'}`}>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center gap-3">
          {isPlaceholder ? (
            <Link to={`/students/${student.id}`} className="flex items-center gap-3 flex-1 min-w-0">
              <div className="h-10 w-10 shrink-0 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
                <span className="text-sm font-semibold text-gray-400">{initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900 truncate">{student.full_name}</p>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium shrink-0">
                    Placeholder
                  </span>
                </div>
                <p className="text-xs text-gray-400">Waiting to sign up</p>
              </div>
            </Link>
          ) : (
            <Link to={`/students/${student.id}`} className="flex items-center gap-3 flex-1 min-w-0">
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage src={student.avatar_url} />
                <AvatarFallback className="bg-brand-light text-brand-dark font-semibold text-sm">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{student.full_name}</p>
                <p className="text-xs text-gray-500 truncate">{student.email}</p>
              </div>
            </Link>
          )}
          <RemoveStudentButton studentId={student.id} studentName={student.full_name} onRemoved={onRemoved} />
        </div>

        {/* Link account button for placeholders */}
        {isPlaceholder && !showLinkForm && (
          <button
            onClick={() => setShowLinkForm(true)}
            className="w-full text-xs px-3 py-1.5 rounded border border-brand/30 text-brand hover:bg-brand-light transition-colors"
          >
            Link to real account →
          </button>
        )}

        {isPlaceholder && showLinkForm && (
          <form onSubmit={handleLink} className="space-y-2">
            <p className="text-xs text-gray-500">Enter the email address the student used to sign up:</p>
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
                className="flex-1 py-1.5 bg-brand text-white text-xs rounded hover:bg-brand/90 transition-colors disabled:opacity-50"
              >
                {linking ? 'Linking…' : 'Link Account'}
              </button>
              <button
                type="button"
                onClick={() => { setShowLinkForm(false); setLinkEmail('') }}
                className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded"
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
