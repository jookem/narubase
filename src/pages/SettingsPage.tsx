import { useState, useEffect } from 'react'
import { Copy, Check } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'
import { updateProfileName, updatePassword, updatePreferences } from '@/lib/api/settings'
import { joinTeacherByCode } from '@/lib/api/students'
import { toast } from 'sonner'

const DURATION_OPTIONS = [30, 45, 60, 90, 120]
const STUDY_SIZE_OPTIONS = [
  { label: '10 cards', value: 10 },
  { label: '20 cards', value: 20 },
  { label: '30 cards', value: 30 },
  { label: 'All cards', value: 0 },
]

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${checked ? 'bg-brand' : 'bg-gray-300'}`}
    >
      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
    </button>
  )
}

export function SettingsPage() {
  const { profile, refreshProfile } = useAuth()
  const isTeacher = profile?.role === 'teacher'

  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [savingName, setSavingName] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  const [inviteInput, setInviteInput] = useState('')
  const [joiningCode, setJoiningCode] = useState(false)

  const [copied, setCopied] = useState(false)

  // Preferences (DB-backed)
  const [emailNotifs, setEmailNotifs] = useState(profile?.notifications_email ?? true)
  const [defaultMins, setDefaultMins] = useState(profile?.default_lesson_mins ?? 60)
  const [savingPrefs, setSavingPrefs] = useState(false)

  // Preferences (localStorage)
  const [ttsAutoPlay, setTtsAutoPlay] = useState(() =>
    localStorage.getItem('tts_autoplay') !== 'false'
  )
  const [studySize, setStudySize] = useState(() =>
    parseInt(localStorage.getItem('study_size') ?? '20', 10)
  )

  useEffect(() => {
    setEmailNotifs(profile?.notifications_email ?? true)
    setDefaultMins(profile?.default_lesson_mins ?? 60)
  }, [profile])

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName.trim()) return
    setSavingName(true)
    const { error } = await updateProfileName(fullName)
    if (error) {
      toast.error(error)
    } else {
      await refreshProfile()
      toast.success('Name updated.')
    }
    setSavingName(false)
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword.length < 8) { toast.error('Password must be at least 8 characters.'); return }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match.'); return }
    setSavingPassword(true)
    const { error } = await updatePassword(newPassword)
    if (error) {
      toast.error(error)
    } else {
      setNewPassword('')
      setConfirmPassword('')
      toast.success('Password updated.')
    }
    setSavingPassword(false)
  }

  async function handleJoinTeacher(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteInput.trim()) return
    setJoiningCode(true)
    const { error, teacherName } = await joinTeacherByCode(inviteInput)
    if (error) {
      toast.error(error)
    } else {
      setInviteInput('')
      toast.success(`Joined ${teacherName}'s class!`)
    }
    setJoiningCode(false)
  }

  async function handleSavePrefs() {
    setSavingPrefs(true)
    const prefs: Record<string, unknown> = { notifications_email: emailNotifs }
    if (isTeacher) prefs.default_lesson_mins = defaultMins
    const { error } = await updatePreferences(prefs)
    if (error) {
      toast.error(error)
    } else {
      await refreshProfile()
      if (isTeacher) localStorage.setItem('default_lesson_mins', String(defaultMins))
      toast.success('Preferences saved.')
    }
    setSavingPrefs(false)
  }

  function handleTtsToggle(val: boolean) {
    setTtsAutoPlay(val)
    localStorage.setItem('tts_autoplay', String(val))
  }

  function handleStudySize(val: number) {
    setStudySize(val)
    localStorage.setItem('study_size', String(val))
  }

  function copyCode() {
    if (!profile?.invite_code) return
    navigator.clipboard.writeText(profile.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your account and preferences</p>
      </div>

      {/* Teacher: invite code */}
      {isTeacher && profile.invite_code && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Your Invite Code</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-500">
              Share this code with students so they can join your class.
            </p>
            <div className="flex items-center gap-3">
              <span className="font-mono text-3xl font-bold tracking-widest text-brand">
                {profile.invite_code}
              </span>
              <button
                onClick={copyCode}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
              >
                {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Student: join a teacher */}
      {!isTeacher && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Join a Teacher</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleJoinTeacher} className="space-y-4">
              <p className="text-sm text-gray-500">
                Enter the 6-character code your teacher gave you.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inviteInput}
                  onChange={e => setInviteInput(e.target.value.toUpperCase())}
                  placeholder="e.g. AB3K9X"
                  maxLength={6}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm font-mono tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                  required
                />
                <button
                  type="submit"
                  disabled={joiningCode || inviteInput.length < 6}
                  className="px-4 py-2 bg-brand text-white text-sm rounded-md hover:bg-brand/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {joiningCode ? 'Joining…' : 'Join Class'}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Notifications & Preferences */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Notifications & Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Email notifications */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-800">Email notifications</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Lesson confirmations and 1-hour reminders
              </p>
            </div>
            <Toggle checked={emailNotifs} onChange={setEmailNotifs} />
          </div>

          {/* TTS auto-play */}
          <div className="flex items-center justify-between gap-4 border-t pt-4">
            <div>
              <p className="text-sm font-medium text-gray-800">Auto-play pronunciation</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Speak each word aloud when a study card appears
              </p>
            </div>
            <Toggle checked={ttsAutoPlay} onChange={handleTtsToggle} />
          </div>

          {/* Teacher: default lesson duration */}
          {isTeacher && (
            <div className="border-t pt-4 space-y-2">
              <p className="text-sm font-medium text-gray-800">Default lesson duration</p>
              <p className="text-xs text-gray-400">Pre-fills end time when logging a lesson</p>
              <div className="flex gap-2 flex-wrap">
                {DURATION_OPTIONS.map(mins => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setDefaultMins(mins)}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                      defaultMins === mins
                        ? 'bg-brand text-white border-brand'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-brand/50'
                    }`}
                  >
                    {mins < 60 ? `${mins}m` : `${mins / 60}h`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Student: study session size */}
          {!isTeacher && (
            <div className="border-t pt-4 space-y-2">
              <p className="text-sm font-medium text-gray-800">Study session size</p>
              <p className="text-xs text-gray-400">How many cards to review per session</p>
              <div className="flex gap-2 flex-wrap">
                {STUDY_SIZE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleStudySize(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                      studySize === opt.value
                        ? 'bg-brand text-white border-brand'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-brand/50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="border-t pt-4">
            <button
              type="button"
              onClick={handleSavePrefs}
              disabled={savingPrefs}
              className="px-4 py-2 bg-brand text-white text-sm rounded-md hover:bg-brand/90 transition-colors disabled:opacity-50"
            >
              {savingPrefs ? 'Saving…' : 'Save Preferences'}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Profile */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveName} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={profile?.email ?? ''}
                disabled
                className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-400 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                required
              />
            </div>
            <button
              type="submit"
              disabled={savingName || !fullName.trim() || fullName === profile?.full_name}
              className="px-4 py-2 bg-brand text-white text-sm rounded-md hover:bg-brand/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingName ? 'Saving…' : 'Save Name'}
            </button>
          </form>
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Change Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                minLength={8}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                required
              />
            </div>
            <button
              type="submit"
              disabled={savingPassword || !newPassword || !confirmPassword}
              className="px-4 py-2 bg-brand text-white text-sm rounded-md hover:bg-brand/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingPassword ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
