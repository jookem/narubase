import { useState, useEffect, useRef } from 'react'
import { Copy, Check, Camera } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'
import { updateProfileName, updatePassword, updatePreferences, uploadAvatar } from '@/lib/api/settings'
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
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${checked ? 'bg-brand' : 'bg-gray-300'}`}
    >
      <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
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
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile?.avatar_url ?? null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Preferences (DB-backed)
  const [emailNotifs, setEmailNotifs] = useState(profile?.notifications_email ?? true)
  const [defaultMins, setDefaultMins] = useState(profile?.default_lesson_mins ?? 60)
  const [timezone, setTimezone] = useState(profile?.timezone ?? 'Asia/Tokyo')
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
    setTimezone(profile?.timezone ?? 'Asia/Tokyo')
    if (profile?.avatar_url) setAvatarPreview(profile.avatar_url)
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
    const prefs: Record<string, unknown> = { notifications_email: emailNotifs, timezone }
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

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarPreview(URL.createObjectURL(file))
    setUploadingAvatar(true)
    const { url, error } = await uploadAvatar(file)
    setUploadingAvatar(false)
    if (error) {
      toast.error(error)
    } else {
      await refreshProfile()
      toast.success('Photo updated.')
    }
  }

  function copyCode() {
    if (!profile?.invite_code) return
    navigator.clipboard.writeText(profile.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your account and preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* ── Left column ── */}
        <div className="space-y-6">

          {/* Teacher: avatar + invite code */}
          {isTeacher && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Profile Photo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-500">
                  Your photo appears on the student login screen so students can find you.
                </p>
                <div className="flex items-center gap-4">
                  <div className="relative shrink-0">
                    {avatarPreview ? (
                      <img
                        src={avatarPreview}
                        alt="Avatar"
                        className="w-20 h-20 rounded-full object-cover ring-2 ring-brand/20"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-brand flex items-center justify-center">
                        <span className="text-white text-2xl font-bold">
                          {profile?.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                        </span>
                      </div>
                    )}
                    <button
                      aria-label="Change profile photo"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="absolute -bottom-1 -right-1 w-7 h-7 bg-brand text-white rounded-full flex items-center justify-center shadow hover:bg-brand/90 transition-colors disabled:opacity-50"
                    >
                      <Camera size={13} />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarChange}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{profile?.full_name}</p>
                    {uploadingAvatar && <p className="text-xs text-gray-400 mt-0.5">Uploading…</p>}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="mt-1 text-xs text-brand hover:underline disabled:opacity-50"
                    >
                      {avatarPreview ? 'Change photo' : 'Upload photo'}
                    </button>
                  </div>
                </div>

                {profile.invite_code && (
                  <div className="border-t pt-4">
                    <p className="text-xs font-medium text-gray-500 mb-2">Class code (for adult students joining via Settings)</p>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-2xl font-bold tracking-widest text-brand">
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
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Student: avatar */}
          {!isTeacher && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Profile Photo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="relative shrink-0">
                    {avatarPreview ? (
                      <img
                        src={avatarPreview}
                        alt="Avatar"
                        className="w-20 h-20 rounded-full object-cover ring-2 ring-brand/20"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-brand flex items-center justify-center">
                        <span className="text-white text-2xl font-bold">
                          {profile?.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                        </span>
                      </div>
                    )}
                    <button
                      aria-label="Change profile photo"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="absolute -bottom-1 -right-1 w-7 h-7 bg-brand text-white rounded-full flex items-center justify-center shadow hover:bg-brand/90 transition-colors disabled:opacity-50"
                    >
                      <Camera size={13} />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarChange}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{profile?.full_name}</p>
                    {uploadingAvatar && <p className="text-xs text-gray-400 mt-0.5">Uploading…</p>}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="mt-1 text-xs text-brand hover:underline disabled:opacity-50"
                    >
                      {avatarPreview ? 'Change photo' : 'Upload photo'}
                    </button>
                  </div>
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
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={inviteInput}
                      onChange={e => setInviteInput(e.target.value.toUpperCase())}
                      placeholder="e.g. AB3K9X"
                      maxLength={6}
                      className="w-full sm:flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm font-mono tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                      required
                    />
                    <button
                      type="submit"
                      disabled={joiningCode || inviteInput.length < 6}
                      className="w-full sm:w-auto px-4 py-2 bg-brand text-white text-sm rounded-md hover:bg-brand/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {joiningCode ? 'Joining…' : 'Join Class'}
                    </button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

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
        </div>

        {/* ── Right column ── */}
        <div className="space-y-6">

          {/* Notifications & Preferences */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Notifications & Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">

              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-800">Timezone</p>
                <p className="text-xs text-gray-400">Used for all lesson times and scheduling</p>
                <select
                  value={timezone}
                  onChange={e => setTimezone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent bg-white"
                >
                  <option value="Asia/Tokyo">Asia/Tokyo (JST, UTC+9)</option>
                  <option value="Asia/Seoul">Asia/Seoul (KST, UTC+9)</option>
                  <option value="Asia/Shanghai">Asia/Shanghai (CST, UTC+8)</option>
                  <option value="Asia/Singapore">Asia/Singapore (SGT, UTC+8)</option>
                  <option value="Asia/Bangkok">Asia/Bangkok (ICT, UTC+7)</option>
                  <option value="Australia/Sydney">Australia/Sydney (AEDT, UTC+11)</option>
                  <option value="Pacific/Auckland">Pacific/Auckland (NZDT, UTC+13)</option>
                  <option value="Europe/London">Europe/London (GMT/BST)</option>
                  <option value="Europe/Paris">Europe/Paris (CET, UTC+1)</option>
                  <option value="America/New_York">America/New_York (EST, UTC-5)</option>
                  <option value="America/Chicago">America/Chicago (CST, UTC-6)</option>
                  <option value="America/Los_Angeles">America/Los_Angeles (PST, UTC-8)</option>
                  <option value="America/Vancouver">America/Vancouver (PST, UTC-8)</option>
                  <option value="America/Toronto">America/Toronto (EST, UTC-5)</option>
                </select>
              </div>

              <div className="flex items-center justify-between gap-4 border-t pt-4 pr-2">
                <div>
                  <p className="text-sm font-medium text-gray-800">Email notifications</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Lesson confirmations and 1-hour reminders
                  </p>
                </div>
                <Toggle checked={emailNotifs} onChange={setEmailNotifs} />
              </div>

              <div className="flex items-center justify-between gap-4 border-t pt-4 pr-2">
                <div>
                  <p className="text-sm font-medium text-gray-800">Auto-play pronunciation</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Speak each word aloud when a study card appears
                  </p>
                </div>
                <Toggle checked={ttsAutoPlay} onChange={handleTtsToggle} />
              </div>

              {isTeacher && (
                <div className="border-t pt-4 space-y-2">
                  <p className="text-sm font-medium text-gray-800">Default lesson duration</p>
                  <p className="text-xs text-gray-400">Pre-fills end time when adding a lesson</p>
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
      </div>
    </div>
  )
}
