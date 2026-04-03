import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import Link from 'next/link'
import { AddStudentModal } from '@/components/students/AddStudentModal'
import { RemoveStudentButton } from '@/components/students/RemoveStudentButton'

export default async function StudentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: relationships } = await supabase
    .from('teacher_student_relationships')
    .select(`
      *,
      student:profiles!teacher_student_relationships_student_id_fkey(*)
    `)
    .eq('teacher_id', user.id)
    .order('started_at', { ascending: false })

  const students = relationships ?? []
  const activeStudents = students.filter((s: any) => s.status === 'active')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Students</h1>
          <p className="text-sm text-gray-500 mt-0.5">{activeStudents.length} active</p>
        </div>
        <AddStudentModal />
      </div>

      {activeStudents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <p>No students yet.</p>
            <p className="text-sm mt-1">Add a student by entering their email address above.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeStudents.map((rel: any) => (
            <StudentCard key={rel.id} relationship={rel} />
          ))}
        </div>
      )}
    </div>
  )
}

function StudentCard({ relationship }: { relationship: any }) {
  const student = relationship.student
  const initials = student.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <Card className="hover:border-brand/50 transition-colors">
      <CardContent className="pt-4">
        <div className="flex items-center gap-3">
          <Link href={`/students/${student.id}`} className="flex items-center gap-3 flex-1 min-w-0">
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
          <RemoveStudentButton studentId={student.id} studentName={student.full_name} />
        </div>
      </CardContent>
    </Card>
  )
}
