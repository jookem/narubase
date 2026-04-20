import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'

const ADMIN_EMAIL = 'tegamikureru@gmail.com'

type PendingTeacher = {
  id: string
  full_name: string
  email: string
  created_at: string
  approval_status: string
}

export function AdminTeachersPage() {
  const { user } = useAuth()
  const [teachers, setTeachers] = useState<PendingTeacher[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  if (user?.email !== ADMIN_EMAIL) return <Navigate to="/dashboard" replace />

  useEffect(() => {
    loadTeachers()
  }, [])

  async function loadTeachers() {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, created_at, approval_status')
      .eq('role', 'teacher')
      .order('created_at', { ascending: false })
    setTeachers((data ?? []) as PendingTeacher[])
    setLoading(false)
  }

  async function updateStatus(id: string, status: 'approved' | 'rejected') {
    setUpdating(id)
    await supabase.from('profiles').update({ approval_status: status }).eq('id', id)
    await loadTeachers()
    setUpdating(null)
  }

  const statusBadge: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-600',
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      <h1 className="text-2xl font-semibold">Teacher Accounts</h1>
      {loading ? (
        <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />
      ) : teachers.length === 0 ? (
        <p className="text-sm text-gray-500">No teacher accounts found.</p>
      ) : (
        <div className="space-y-3">
          {teachers.map(t => (
            <div key={t.id} className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium text-sm text-gray-900 truncate">{t.full_name}</p>
                <p className="text-xs text-gray-500 truncate">{t.email}</p>
                <p className="text-xs text-gray-400 mt-0.5">{new Date(t.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${statusBadge[t.approval_status] ?? 'bg-gray-100 text-gray-500'}`}>
                  {t.approval_status}
                </span>
                {t.approval_status !== 'approved' && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={updating === t.id}
                    onClick={() => updateStatus(t.id, 'approved')}
                  >
                    Approve
                  </Button>
                )}
                {t.approval_status !== 'rejected' && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={updating === t.id}
                    onClick={() => updateStatus(t.id, 'rejected')}
                    className="text-red-600 border-red-200 hover:bg-red-50"
                  >
                    Reject
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
