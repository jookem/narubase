import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import Link from 'next/link'

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Students</h1>
        <Badge variant="outline">{students.filter((s: any) => s.status === 'active').length} active</Badge>
      </div>

      {students.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <p>No students yet.</p>
            <p className="text-sm mt-1">Students will appear here once they join and you establish a relationship.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {students.map((rel: any) => (
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
    <Link href={`/students/${student.id}`}>
      <Card className="hover:border-blue-300 transition-colors cursor-pointer">
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={student.avatar_url} />
              <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold text-sm">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">{student.full_name}</p>
              <p className="text-xs text-gray-500 truncate">{student.email}</p>
            </div>
            <Badge
              variant="outline"
              className={`text-xs ${
                relationship.status === 'active'
                  ? 'text-green-700 border-green-200'
                  : 'text-gray-500'
              }`}
            >
              {relationship.status}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
