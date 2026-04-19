import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Copy, Check, ChevronDown, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { RemoveStudentButton } from '@/components/students/RemoveStudentButton'
import { createPlaceholderStudent, linkPlaceholderToStudent, setStudentPassword } from '@/lib/api/students'
import { toast } from 'sonner'
import { PageError } from '@/components/shared/PageError'

type TeacherGroup = {
  teacherId: string
  teacherName: string
  relationships: any[]
}

export function StudentsPage() {
  const { user, profile } = useAuth()
  const [teacherGroups, setTeacherGroups] = useState<TeacherGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

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
    try {
      const { data, error: err } = await supabase
        .from('teacher_student_relationships')
        .select('*, student:profiles!teacher_student_relationships_student_id_fkey(*), teacher:profiles!teacher_student_relationships_teacher_id_fkey(id, full_name)')
        .eq('status', 'active')
        .order('started_at', { ascending: false })
      if (err) throw err

      // Group by teacher, current teacher first
      const map = new Map<string, TeacherGroup>()
      for (const rel of data ?? []) {
        const tid = rel.teacher?.id ?? rel.teacher_id
        if (!map.has(tid)) {
          map.set(tid, { teacherId: tid, teacherName: rel.teacher?.full_name ?? 'Unknown Teacher', relationships: [] })
        }
        map.get(tid)!.relationships.push(rel)
      }

      const groups = [...map.values()].sort((a, b) => {
        if (a.teacherId === user.id) return -1
        if (b.teacherId === user.id) return 1
        return a.teacherName.localeCompare(b.teacherName)
      })

      setTeacherGroups(groups)
      setError(null)
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load students')
    } finally {
      setLoading(false)
    }
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
      toast.success(`${addingName} added.`)
      loadStudents()
    }
  }

  function toggleCollapse(tid: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(tid) ? next.delete(tid) : next.add(tid)
      return next
    })
  }

  const totalStudents = teacherGroups.reduce((a, g) => a + g.relationships.length, 0)

  if (error) return <PageError message={error} onRetry={loadStudents} />

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
          <p className="text-sm text-gray-500 mt-0.5">{totalStudents} active across {teacherGroups.length} teacher{teacherGroups.length !== 1 ? 's' : ''}</p>
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
              Set a name and initial password. The student logs in by entering your class code, selecting their name, and entering this password.
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

      {/* Invite code */}
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

      {totalStudents > 0 && (
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search students…"
          className="w-full sm:w-64 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
        />
      )}

      {teacherGroups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <p>No students yet.</p>
            <p className="text-sm mt-1">Click "+ Add Student" to add your first student.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {teacherGroups.map(group => {
            const q = search.trim().toLowerCase()
            const filtered = q
              ? group.relationships.filter((rel: any) =>
                  rel.student.full_name.toLowerCase().includes(q) ||
                  rel.student.email?.toLowerCase().includes(q)
                )
              : group.relationships

            if (q && filtered.length === 0) return null

            const isMe = group.teacherId === user?.id
            const isCollapsed = collapsed.has(group.teacherId)

            return (
              <div key={group.teacherId} className="space-y-3">
                {/* Teacher section header */}
                <button
                  onClick={() => toggleCollapse(group.teacherId)}
                  className="flex items-center gap-2 w-full text-left group"
                >
                  {isCollapsed
                    ? <ChevronRight size={16} className="text-gray-400 shrink-0" />
                    : <ChevronDown size={16} className="text-gray-400 shrink-0" />
                  }
                  <span className={`text-sm font-semibold ${isMe ? 'text-brand' : 'text-gray-700'}`}>
                    {isMe ? `${group.teacherName} (you)` : group.teacherName}
                  </span>
                  <span className="text-xs text-gray-400 font-normal">
                    {filtered.length} student{filtered.length !== 1 ? 's' : ''}
                  </span>
                  <div className="flex-1 h-px bg-gray-100 ml-1" />
                </button>

                {!isCollapsed && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map((rel: any) => (
                      <StudentCard
                        key={rel.id}
                        relationship={rel}
                        canManage={isMe}
                        onRemoved={loadStudents}
                        onLinked={loadStudents}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StudentCard({
  relationship,
  canManage,
  onRemoved,
  onLinked,
}: {
  relationship: any
  canManage: boolean
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
          {canManage && (
            <RemoveStudentButton studentId={student.id} studentName={student.full_name} onRemoved={onRemoved} />
          )}
        </div>

        {canManage && !showLinkForm && !showPasswordForm && (
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

        {canManage && showPasswordForm && (
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

        {canManage && showLinkForm && (
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
