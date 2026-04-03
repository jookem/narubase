import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AvatarMenu } from '@/components/shared/AvatarMenu'
import type { Profile } from '@/lib/types/database'
import Link from 'next/link'

const teacherNav = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/students', label: 'Students' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/availability', label: 'Availability' },
  { href: '/lessons', label: 'Lessons' },
]

const studentNav = [
  { href: '/dashboard', label: 'ホーム', sub: 'Home' },
  { href: '/lessons', label: 'レッスン', sub: 'Lessons' },
  { href: '/book', label: '予約', sub: 'Book' },
  { href: '/goals', label: '目標', sub: 'Goals' },
  { href: '/vocabulary', label: '単語', sub: 'Vocab' },
]

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const isTeacher = profile.role === 'teacher'
  const nav = isTeacher ? teacherNav : studentNav

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-8">
              <Link href="/dashboard" className="font-semibold text-gray-900">
                TLC English
              </Link>
              <nav className="hidden md:flex items-center gap-1">
                {nav.map(item => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                  >
                    {item.label}
                    {'sub' in item && typeof item.sub === 'string' && (
                      <span className="ml-1 text-xs text-gray-400">{item.sub}</span>
                    )}
                  </Link>
                ))}
              </nav>
            </div>
            <AvatarMenu profile={profile as Profile} />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      {/* Mobile bottom nav — student only */}
      {!isTeacher && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-10">
          <div className="grid grid-cols-5 h-16">
            {studentNav.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center text-gray-600 hover:text-blue-600 transition-colors"
              >
                <span className="text-base">{item.label}</span>
                <span className="text-xs">{item.sub}</span>
              </Link>
            ))}
          </div>
        </nav>
      )}
    </div>
  )
}
