import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { NotificationsProvider } from '@/contexts/NotificationsContext'
import { AppLayout } from '@/layouts/AppLayout'
import { LandingPage } from '@/pages/LandingPage'
import { LoginPage } from '@/pages/LoginPage'
import { SignupPage } from '@/pages/SignupPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { StudentsPage } from '@/pages/StudentsPage'
import { StudentDetailPage } from '@/pages/StudentDetailPage'
import { LessonsPage } from '@/pages/LessonsPage'
import { LessonDetailPage } from '@/pages/LessonDetailPage'
import { CalendarPage } from '@/pages/CalendarPage'
import { AvailabilityPage } from '@/pages/AvailabilityPage'
import { BookPage } from '@/pages/BookPage'
import { GoalsPage } from '@/pages/GoalsPage'
import { VocabularyPage } from '@/pages/VocabularyPage'
import { GrammarPage } from '@/pages/GrammarPage'
import { GamePage } from '@/pages/GamePage'
import { SpellingPage } from '@/pages/SpellingPage'
import { GamesPage } from '@/pages/GamesPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { PendingApprovalPage } from '@/pages/PendingApprovalPage'
import { AdminTeachersPage } from '@/pages/AdminTeachersPage'
import { SituationsPage } from '@/pages/SituationsPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>
  if (!user) return <Navigate to="/login" replace />
  if (profile?.role === 'teacher' && profile?.approval_status === 'pending') {
    return <PendingApprovalPage />
  }
  return <>{children}</>
}

function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>
  if (user) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RedirectIfAuthed><LandingPage /></RedirectIfAuthed>} />
      <Route path="/login" element={<RedirectIfAuthed><LoginPage /></RedirectIfAuthed>} />
      <Route path="/signup" element={<RedirectIfAuthed><SignupPage /></RedirectIfAuthed>} />

      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/students" element={<StudentsPage />} />
        <Route path="/students/:studentId" element={<StudentDetailPage />} />
        <Route path="/lessons" element={<LessonsPage />} />
        <Route path="/lessons/:lessonId" element={<LessonDetailPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/availability" element={<AvailabilityPage />} />
        <Route path="/book" element={<BookPage />} />
        <Route path="/goals" element={<GoalsPage />} />
        <Route path="/vocabulary" element={<VocabularyPage />} />
        <Route path="/grammar" element={<GrammarPage />} />
        <Route path="/game" element={<GamePage />} />
        <Route path="/spelling" element={<SpellingPage />} />
        <Route path="/games" element={<GamesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/admin/teachers" element={<AdminTeachersPage />} />
        <Route path="/situations" element={<SituationsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AuthProvider>
          <NotificationsProvider>
            <AppRoutes />
            <Toaster />
          </NotificationsProvider>
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
