import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { formatInTimeZone } from 'date-fns-tz'
import { useTimezone } from '@/lib/hooks/useTimezone'
import { format, differenceInDays, subDays } from 'date-fns'
import { listMilestones, getStudyStreak } from '@/lib/api/goals'
import { useDueCounts } from '@/lib/hooks/useDueCounts'

const MASTERY_LABELS = ['New', 'Seen', 'Familiar', 'Mastered']
const MASTERY_BAR_COLORS = ['bg-gray-300', 'bg-yellow-400', 'bg-brand', 'bg-green-400']

function MasteryProgress({ counts, total, label, href }: {
  counts: number[]
  total: number
  label: string
  href: string
}) {
  if (total === 0) return null
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Link to={href} className="text-sm font-medium text-gray-700 hover:text-brand transition-colors">
          {label}
        </Link>
        <span className="text-xs text-gray-400">{total}語</span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden bg-gray-100">
        {counts.map((c, i) => c > 0 && (
          <div
            key={i}
            className={MASTERY_BAR_COLORS[i]}
            style={{ width: `${(c / total) * 100}%` }}
            title={`${MASTERY_LABELS[i]}: ${c}`}
          />
        ))}
      </div>
      <div className="flex gap-3 flex-wrap">
        {counts.map((c, i) => c > 0 && (
          <span key={i} className="text-[10px] text-gray-400">
            {MASTERY_LABELS[i]} {c}
          </span>
        ))}
      </div>
    </div>
  )
}

function ActivityCalendar({ studiedDates }: { studiedDates: Set<string> }) {
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = subDays(new Date(), 29 - i)
    const key = format(d, 'yyyy-MM-dd')
    return { key, day: format(d, 'd'), isToday: i === 29, studied: studiedDates.has(key) }
  })

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Past 30 Days</p>
      <div className="flex gap-1 flex-wrap">
        {days.map(({ key, day, isToday, studied }) => (
          <div
            key={key}
            title={key}
            className={`w-6 h-6 rounded text-[9px] font-medium flex items-center justify-center transition-colors ${
              studied
                ? 'bg-brand text-white'
                : isToday
                ? 'bg-gray-100 text-gray-500 ring-1 ring-brand/40'
                : 'bg-gray-100 text-gray-300'
            }`}
          >
            {day}
          </div>
        ))}
      </div>
    </div>
  )
}

function SkillBar({ label, score }: { label: string; score: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium text-gray-800">{score}/10</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-brand rounded-full transition-all"
          style={{ width: `${(score / 10) * 100}%` }}
        />
      </div>
    </div>
  )
}

function isTodayBirthday(birthday: string | null | undefined): boolean {
  if (!birthday) return false
  const b = new Date(birthday)
  const t = new Date()
  return b.getMonth() === t.getMonth() && b.getDate() === t.getDate()
}

export function StudentDashboard() {
  const { user } = useAuth()
  const tz = useTimezone()
  const [upcomingLessons, setUpcomingLessons] = useState<any[]>([])
  const [goals, setGoals] = useState<any[]>([])
  const [featuredGoal, setFeaturedGoal] = useState<any | null>(null)
  const [featuredMilestones, setFeaturedMilestones] = useState<any[]>([])
  const [streak, setStreak] = useState(0)
  const [recentNotes, setRecentNotes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [myBirthday, setMyBirthday] = useState<string | null>(null)

  // Progress data
  const [grammarCounts, setGrammarCounts] = useState([0, 0, 0, 0])
  const [vocabCounts, setVocabCounts] = useState([0, 0, 0, 0])
  const [studiedDates, setStudiedDates] = useState<Set<string>>(new Set())
  const [latestSnapshot, setLatestSnapshot] = useState<any | null>(null)
  const [completedLessons, setCompletedLessons] = useState(0)

  useEffect(() => {
    if (!user) return

    async function load() {
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString().split('T')[0]

      const [
        lessonsResult, goalsResult, recentNotesResult, streakResult,
        grammarResult, vocabResult, studyLogsResult, snapshotResult, completedResult, birthdayResult,
      ] = await Promise.all([
        supabase
          .from('lessons')
          .select('*, teacher:profiles!lessons_teacher_id_fkey(id, full_name, display_name)')
          .eq('student_id', user!.id)
          .eq('status', 'scheduled')
          .gte('scheduled_start', new Date().toISOString())
          .order('scheduled_start', { ascending: true })
          .limit(3),

        supabase
          .from('student_goals')
          .select('*')
          .eq('student_id', user!.id)
          .eq('status', 'active')
          .order('target_date', { ascending: true, nullsFirst: false }),

        supabase
          .from('lesson_notes')
          .select('*, lesson:lessons(scheduled_start, teacher:profiles!lessons_teacher_id_fkey(full_name))')
          .eq('is_visible_to_student', true)
          .or(`student_id.eq.${user!.id},student_id.is.null`)
          .order('created_at', { ascending: false })
          .limit(3),

        getStudyStreak(user!.id),

        supabase.from('grammar_bank').select('mastery_level').eq('student_id', user!.id),
        supabase.from('vocabulary_bank').select('mastery_level').eq('student_id', user!.id).eq('is_active', true),
        supabase.from('study_logs').select('studied_date').eq('student_id', user!.id).gte('studied_date', thirtyDaysAgo),
        supabase.from('progress_snapshots').select('*').eq('student_id', user!.id).order('snapshot_date', { ascending: false }).limit(1),
        supabase.from('lessons').select('id', { count: 'exact', head: true }).eq('student_id', user!.id).eq('status', 'completed'),
        supabase.from('student_details').select('birthday').eq('student_id', user!.id).maybeSingle(),
      ])

      setUpcomingLessons(lessonsResult.data ?? [])
      setGoals(goalsResult.data ?? [])
      setRecentNotes(recentNotesResult.data ?? [])
      setStreak(streakResult)
      setCompletedLessons(completedResult.count ?? 0)

      // Mastery counts
      const gc = [0, 0, 0, 0]
      for (const r of grammarResult.data ?? []) gc[r.mastery_level]++
      setGrammarCounts(gc)

      const vc = [0, 0, 0, 0]
      for (const r of vocabResult.data ?? []) vc[r.mastery_level]++
      setVocabCounts(vc)

      setStudiedDates(new Set((studyLogsResult.data ?? []).map((r: any) => r.studied_date)))
      setLatestSnapshot(snapshotResult.data?.[0] ?? null)
      setMyBirthday(birthdayResult.data?.birthday ?? null)

      // Featured goal = soonest target date (or first active if no dates)
      const activeGoals: any[] = goalsResult.data ?? []
      const withDate = activeGoals.filter(g => g.target_date)
      const featured = withDate[0] ?? activeGoals[0] ?? null
      setFeaturedGoal(featured)
      if (featured) {
        const { milestones } = await listMilestones(featured.id)
        setFeaturedMilestones(milestones ?? [])
      }

      setLoading(false)
    }

    load()
  }, [user])

  const { counts: due } = useDueCounts()
  const nextLesson = upcomingLessons[0]

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
        <div className="h-24 bg-gray-200 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-48 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-48 bg-gray-200 rounded-lg animate-pulse" />
        </div>
      </div>
    )
  }

  const daysUntil = featuredGoal?.target_date
    ? differenceInDays(new Date(featuredGoal.target_date), new Date())
    : null
  const completedMilestones = featuredMilestones.filter(m => m.completed).length
  const totalMilestones = featuredMilestones.length
  const milestonePct = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : null

  const grammarTotal = grammarCounts.reduce((a, b) => a + b, 0)
  const vocabTotal = vocabCounts.reduce((a, b) => a + b, 0)
  const grammarMastered = grammarCounts[3]
  const vocabMastered = vocabCounts[3]

  const hasSkills = latestSnapshot && (
    latestSnapshot.speaking_score || latestSnapshot.listening_score ||
    latestSnapshot.reading_score || latestSnapshot.writing_score
  )

  const isMyBirthday = isTodayBirthday(myBirthday)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          こんにちは！<span className="text-gray-500 font-normal text-lg ml-2">Welcome back</span>
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {format(new Date(), 'yyyy年M月d日')} ({format(new Date(), 'EEEE')})
        </p>
      </div>

      {/* Birthday celebration */}
      {isMyBirthday && (
        <div className="bg-gradient-to-r from-pink-50 via-purple-50 to-pink-50 border border-pink-200 rounded-2xl p-6 text-center space-y-2">
          <p className="text-5xl">🎂🎉🎈</p>
          <p className="text-2xl font-bold text-pink-700">お誕生日おめでとう！</p>
          <p className="text-base text-pink-600">Happy Birthday! Have an amazing day ✨</p>
        </div>
      )}

      {due.total > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">
                今日の復習 / Due Today
              </p>
              <div className="flex flex-wrap gap-2 mt-1">
                {due.grammar > 0 && (
                  <span className="inline-flex items-center gap-1.5 bg-white border border-amber-200 text-amber-800 text-sm font-medium px-3 py-1 rounded-full">
                    <span className="text-base">📝</span>
                    {due.grammar} grammar card{due.grammar !== 1 ? 's' : ''}
                  </span>
                )}
                {due.vocab > 0 && (
                  <span className="inline-flex items-center gap-1.5 bg-white border border-amber-200 text-amber-800 text-sm font-medium px-3 py-1 rounded-full">
                    <span className="text-base">📚</span>
                    {due.vocab} vocab word{due.vocab !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              {due.grammar > 0 && (
                <Link
                  to="/grammar?review=true"
                  className="px-4 py-2 bg-brand text-white text-sm font-semibold rounded-xl hover:bg-brand/90 transition-colors"
                >
                  文法を復習 →
                </Link>
              )}
              {due.vocab > 0 && (
                <Link
                  to="/vocabulary?review=true"
                  className="px-4 py-2 bg-amber-600 text-white text-sm font-semibold rounded-xl hover:bg-amber-700 transition-colors"
                >
                  単語を復習 →
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {nextLesson && (
        <Card className="bg-brand-light border-brand/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-brand font-medium uppercase tracking-wide">
                  Next Lesson / 次のレッスン
                </p>
                <p className="text-lg font-semibold text-gray-900 mt-1">
                  {formatInTimeZone(new Date(nextLesson.scheduled_start), tz, 'M月d日 (EEE) HH:mm')}
                </p>
                <p className="text-sm text-gray-600">with {nextLesson.teacher?.full_name}</p>
              </div>
              <div className="flex flex-col gap-2">
                {nextLesson.meeting_url && (
                  <a
                    href={nextLesson.meeting_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm bg-brand text-white px-4 py-2 rounded hover:bg-brand-dark transition-colors"
                  >
                    Join / 参加する
                  </a>
                )}
                <Link to={`/lessons/${nextLesson.id}`} className="text-sm text-center text-brand hover:underline">
                  Details
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Goal countdown + streak row */}
      {(featuredGoal || streak > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Featured goal countdown */}
          {featuredGoal && (
            <Link to="/goals" className="lg:col-span-2 block group">
              <div className="bg-gradient-to-br from-brand to-brand/80 rounded-2xl p-5 text-white h-full">
                <p className="text-white/60 text-xs font-medium uppercase tracking-wide mb-1">目標 / Goal</p>
                <p className="text-lg font-semibold leading-tight">{featuredGoal.title}</p>

                {daysUntil !== null && (
                  <div className="mt-3 flex items-end gap-2">
                    <span className={`text-5xl font-bold leading-none ${daysUntil < 0 ? 'text-red-300' : daysUntil < 14 ? 'text-yellow-300' : 'text-white'}`}>
                      {Math.abs(daysUntil)}
                    </span>
                    <span className="text-white/70 text-sm mb-1.5">
                      {daysUntil < 0 ? '日経過 / days past' : '日 / days to go'}
                    </span>
                  </div>
                )}

                {milestonePct !== null && (
                  <div className="mt-4 space-y-1">
                    <div className="flex justify-between text-xs text-white/60">
                      <span>Milestones</span>
                      <span>{completedMilestones} / {totalMilestones}</span>
                    </div>
                    <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white rounded-full transition-all"
                        style={{ width: `${milestonePct}%` }}
                      />
                    </div>
                  </div>
                )}

                {goals.length > 1 && (
                  <p className="mt-3 text-xs text-white/50">+{goals.length - 1} more active goal{goals.length > 2 ? 's' : ''} →</p>
                )}
              </div>
            </Link>
          )}

          {/* Study streak */}
          {streak > 0 && (
            <div className="bg-orange-50 border border-orange-100 rounded-2xl p-5 flex flex-col items-center justify-center text-center">
              <span className="text-5xl mb-1">🔥</span>
              <span className="text-4xl font-bold text-orange-600">{streak}</span>
              <p className="text-orange-500 text-sm font-medium mt-1">day streak!</p>
              <p className="text-orange-400 text-xs mt-1">Keep studying every day</p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Goals list */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">目標 Goals</CardTitle>
            <Link to="/goals" className="text-sm text-brand hover:underline">すべて見る</Link>
          </CardHeader>
          <CardContent>
            {goals.length === 0 ? (
              <p className="text-sm text-gray-500">No goals set yet.</p>
            ) : (
              <div className="space-y-3">
                {goals.slice(0, 4).map((goal: any) => {
                  const days = goal.target_date ? differenceInDays(new Date(goal.target_date), new Date()) : null
                  return (
                    <div key={goal.id} className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{goal.title}</p>
                        {days !== null && (
                          <p className={`text-xs ${days < 0 ? 'text-red-500' : days < 30 ? 'text-orange-500' : 'text-gray-400'}`}>
                            {days < 0 ? `${Math.abs(days)}日経過` : `あと${days}日`}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-brand-dark bg-brand-light px-2 py-0.5 rounded-full shrink-0">進行中</span>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">最近のノート Lesson Notes</CardTitle>
            <Link to="/lessons" className="text-sm text-brand hover:underline">すべて見る</Link>
          </CardHeader>
          <CardContent>
            {recentNotes.length === 0 ? (
              <p className="text-sm text-gray-500">No lesson notes yet.</p>
            ) : (
              <div className="space-y-3">
                {recentNotes.map((note: any) => (
                  <div key={note.id} className="border rounded-lg p-3">
                    <p className="text-xs text-gray-500">
                      {note.lesson?.scheduled_start &&
                        formatInTimeZone(new Date(note.lesson.scheduled_start), tz, 'M月d日')}
                    </p>
                    {note.summary && (
                      <p className="text-sm text-gray-700 mt-1 line-clamp-2">{note.summary}</p>
                    )}
                    {note.homework && (
                      <p className="text-xs text-orange-700 mt-1">宿題: {note.homework}</p>
                    )}
                    <Link to={`/lessons/${note.lesson_id}`} className="text-xs text-brand hover:underline mt-1 block">
                      詳細を見る →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Progress section */}
      {(grammarTotal > 0 || vocabTotal > 0) && (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-gray-700">学習の進捗 / Study Progress</h2>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-3 lg:col-span-1 lg:grid-cols-1">
              <div className="bg-white border border-gray-100 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{completedLessons}</p>
                <p className="text-xs text-gray-400 mt-0.5">Lessons done</p>
              </div>
              <div className="bg-white border border-gray-100 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{grammarMastered}</p>
                <p className="text-xs text-gray-400 mt-0.5">Grammar mastered</p>
              </div>
              <div className="bg-white border border-gray-100 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{vocabMastered}</p>
                <p className="text-xs text-gray-400 mt-0.5">Words mastered</p>
              </div>
            </div>

            {/* Mastery bars + activity */}
            <Card className="lg:col-span-2">
              <CardContent className="pt-5 space-y-5">
                <MasteryProgress counts={grammarCounts} total={grammarTotal} label="文法 Grammar" href="/grammar" />
                <MasteryProgress counts={vocabCounts} total={vocabTotal} label="単語 Vocabulary" href="/vocabulary" />
                <ActivityCalendar studiedDates={studiedDates} />
              </CardContent>
            </Card>
          </div>

          {/* Skills from latest teacher snapshot */}
          {hasSkills && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">スキル評価 / Skill Assessment</CardTitle>
                  <div className="text-right">
                    {latestSnapshot.cefr_level && (
                      <span className="text-xs font-bold bg-brand text-white px-2 py-0.5 rounded-full">{latestSnapshot.cefr_level}</span>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {latestSnapshot.snapshot_date
                        ? format(new Date(latestSnapshot.snapshot_date), 'yyyy年M月d日')
                        : 'Latest assessment'}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {latestSnapshot.speaking_score && <SkillBar label="Speaking / スピーキング" score={latestSnapshot.speaking_score} />}
                  {latestSnapshot.listening_score && <SkillBar label="Listening / リスニング" score={latestSnapshot.listening_score} />}
                  {latestSnapshot.reading_score && <SkillBar label="Reading / リーディング" score={latestSnapshot.reading_score} />}
                  {latestSnapshot.writing_score && <SkillBar label="Writing / ライティング" score={latestSnapshot.writing_score} />}
                </div>
                {latestSnapshot.notes && (
                  <p className="text-sm text-gray-600 italic border-t pt-3">"{latestSnapshot.notes}"</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Card className="bg-gray-900 text-white border-0">
        <CardContent className="pt-6 flex items-center justify-between">
          <div>
            <p className="font-medium">Ready for your next lesson?</p>
            <p className="text-gray-400 text-sm">次のレッスンを予約しましょう</p>
          </div>
          <Link
            to="/book"
            className="bg-white text-gray-900 px-4 py-2 rounded font-medium text-sm hover:bg-gray-100 transition-colors"
          >
            予約する / Book
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
