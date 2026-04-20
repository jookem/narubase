import { Link, NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard, Users, Calendar, Clock, BookOpen,
  Home, CalendarPlus, Target, Languages, GraduationCap, Gamepad2,
} from 'lucide-react'
import { AvatarMenu } from '@/components/shared/AvatarMenu'
import { useAuth } from '@/contexts/AuthContext'
import { NotificationBell } from '@/components/shared/NotificationBell'
import { useDueCounts } from '@/lib/hooks/useDueCounts'
import { GuideModal } from '@/components/guide/GuideModal'

const teacherNav = [
  { href: '/dashboard', label: 'Dashboard', shortLabel: 'Home', icon: LayoutDashboard },
  { href: '/students', label: 'Students', shortLabel: 'Students', icon: Users },
  { href: '/calendar', label: 'Calendar', shortLabel: 'Calendar', icon: Calendar },
  { href: '/availability', label: 'Availability', shortLabel: 'Hours', icon: Clock },
  { href: '/lessons', label: 'Lessons', shortLabel: 'Lessons', icon: BookOpen },
]

const studentNav = [
  { href: '/dashboard', label: 'ホーム', sub: 'Home', icon: Home },
  { href: '/lessons', label: 'レッスン', sub: 'Lessons', icon: BookOpen },
  { href: '/book', label: '予約', sub: 'Book', icon: CalendarPlus },
  { href: '/goals', label: '目標', sub: 'Goals', icon: Target },
  { href: '/vocabulary', label: '単語', sub: 'Vocab', icon: Languages },
  { href: '/grammar', label: '文法', sub: 'Grammar', icon: GraduationCap },
  { href: '/games', label: 'ゲーム', sub: 'Games', icon: Gamepad2 },
]

export function AppLayout() {
  const { profile, loading } = useAuth()
  if (!profile) return (
    <div className="min-h-screen flex items-center justify-center text-gray-400">
      {loading ? 'Loading…' : 'Something went wrong. Please refresh.'}
    </div>
  )

  const isTeacher = profile.role === 'teacher'
  const nav = isTeacher ? teacherNav : studentNav
  const { counts: due } = useDueCounts()
  const dueBadge: Record<string, number> = {
    '/grammar': due.grammar,
    '/vocabulary': due.vocab,
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-8">
              <Link to="/dashboard" className="flex items-center gap-1.5">
                {/* icon height = text height (20px) × 1.333 ≈ 27px */}
                <img src="/narubase_logo.svg" alt="" aria-hidden="true" style={{ height: 27, width: 'auto' }} />
                <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 300, fontSize: 20, color: '#3D3DB4', letterSpacing: '0.01em', lineHeight: 1 }}>
                  NaruBase
                </span>
              </Link>
              <nav aria-label="Main navigation" className="hidden md:flex items-center gap-1">
                {nav.map(item => {
                  const badge = dueBadge[item.href] ?? 0
                  return (
                    <NavLink
                      key={item.href}
                      to={item.href}
                      className={({ isActive }: { isActive: boolean }) =>
                        `relative px-3 py-1.5 text-sm rounded-md transition-colors ${
                          isActive
                            ? 'text-brand font-medium bg-brand-light'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`
                      }
                    >
                      {item.label}
                      {'sub' in item && typeof item.sub === 'string' && (
                        <span className="ml-1 text-xs text-gray-400">{item.sub}</span>
                      )}
                      {badge > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                          {badge > 99 ? '99+' : badge}
                        </span>
                      )}
                    </NavLink>
                  )
                })}
              </nav>
            </div>
            <div className="flex items-center gap-2">
              <GuideModal />
              <NotificationBell />
              <AvatarMenu profile={profile} />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-6">
        <Outlet />
      </main>

      <nav aria-label="Mobile navigation" className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-10">
        <div className={`grid h-16 ${isTeacher ? 'grid-cols-5' : 'grid-cols-7'}`}>
          {nav.map(item => {
            const badge = dueBadge[item.href] ?? 0
            return (
              <NavLink
                key={item.href}
                to={item.href}
                className={({ isActive }: { isActive: boolean }) =>
                  `flex flex-col items-center justify-center gap-0.5 transition-colors ${
                    isActive ? 'text-brand' : 'text-gray-500 hover:text-brand'
                  }`
                }
              >
                <span className="relative">
                  <item.icon size={isTeacher ? 20 : 17} />
                  {badge > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-3.5 px-0.5 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </span>
                <span className="text-[9px] leading-tight text-center">
                  {isTeacher
                    ? ('shortLabel' in item ? item.shortLabel : item.label)
                    : ('sub' in item ? item.sub : item.label)}
                </span>
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
