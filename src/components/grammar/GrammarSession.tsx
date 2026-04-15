import { useState, useEffect } from 'react'
import { rateGrammarCard, type GrammarBankEntry, type GrammarRating } from '@/lib/api/grammar'
import { supabase } from '@/lib/supabase'
import { CelebrationScreen } from '@/components/shared/CelebrationScreen'

interface Props {
  cards: GrammarBankEntry[]
  onClose: () => void
  onComplete: () => void
}

type Phase = 'question' | 'revealed'

interface SavedGrammarSession {
  queueIds: string[]
  againQueueIds: string[]
  stats: { correct: number; incorrect: number }
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5)
}

function buildChoices(current: GrammarBankEntry): string[] {
  const answer = current.answer ?? current.explanation
  const teacherDistractors = (current.distractors ?? []).filter(d => d && d !== answer)

  // Use teacher-defined distractors first, pad with generic fallbacks only if needed
  const fallbacks = [
    'am', 'is', 'are', 'was', 'were', 'be', 'been',
    'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'can', 'could', 'should', 'may', 'might',
  ].filter(f => f !== answer && !teacherDistractors.includes(f))

  const distractors = [...teacherDistractors]
  while (distractors.length < 3) {
    distractors.push(fallbacks[distractors.length] ?? `option ${distractors.length + 1}`)
  }

  return shuffle([answer, ...distractors.slice(0, 3)])
}

// Render the sentence with the blank highlighted or filled
function SentenceDisplay({
  sentence,
  fill,
  fillColor = 'text-white',
}: {
  sentence: string
  fill?: string
  fillColor?: string
}) {
  const parts = sentence.split('_____')
  if (parts.length === 1) return <span className="text-3xl font-bold text-gray-900">{sentence}</span>

  return (
    <span className="text-3xl font-bold text-gray-900">
      {parts[0]}
      <span className={`inline-block min-w-[3rem] text-center font-bold text-3xl mx-1 px-2 rounded-lg border-b-4 ${
        fill
          ? 'bg-green-500 border-green-600 text-white'
          : 'bg-transparent border-gray-300 text-transparent select-none'
      }`}>
        {fill ?? '_____'}
      </span>
      {parts[1]}
    </span>
  )
}

function sessionKey(userId: string) {
  return `narubase_session_grammar_${userId}`
}

function buildQueue(cards: GrammarBankEntry[]): GrammarBankEntry[] {
  // Group by category, shuffle within each group, then concatenate groups
  const groups = new Map<string, GrammarBankEntry[]>()
  for (const c of cards) {
    const key = c.category ?? ''
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(c)
  }
  const result: GrammarBankEntry[] = []
  for (const group of groups.values()) {
    result.push(...shuffle(group))
  }
  return result
}

export function GrammarSession({ cards, onClose, onComplete }: Props) {
  const [queue, setQueue] = useState<GrammarBankEntry[]>(() => buildQueue(cards))
  const [againQueue, setAgainQueue] = useState<GrammarBankEntry[]>([])
  const initialQueue = buildQueue(cards)
  const [current, setCurrent] = useState<GrammarBankEntry | null>(initialQueue[0] ?? null)
  const [choices, setChoices] = useState<string[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('question')
  const [rating, setRating] = useState(false)
  const [done, setDone] = useState(false)
  const [stats, setStats] = useState({ correct: 0, incorrect: 0 })
  const [userId, setUserId] = useState<string | null>(null)
  const [showResumePrompt, setShowResumePrompt] = useState(false)
  const [resumeData, setResumeData] = useState<SavedGrammarSession | null>(null)
  const total = cards.length

  useEffect(() => {
    if (current && !done) {
      setChoices(buildChoices(current))
      setSelected(null)
      setPhase('question')
    }
  }, [current, done])

  // Load user ID and check for saved session
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      setUserId(data.user.id)
      const saved = localStorage.getItem(sessionKey(data.user.id))
      if (saved) {
        try {
          const parsed: SavedGrammarSession = JSON.parse(saved)
          if (parsed.queueIds?.length > 0) {
            setResumeData(parsed)
            setShowResumePrompt(true)
          }
        } catch {}
      }
    })
  }, [])

  function handleResume() {
    if (!resumeData) return
    const cardById = new Map(cards.map(c => [c.id, c]))
    const restoredQueue = resumeData.queueIds.map(id => cardById.get(id)).filter(Boolean) as GrammarBankEntry[]
    const restoredAgain = resumeData.againQueueIds.map(id => cardById.get(id)).filter(Boolean) as GrammarBankEntry[]
    if (restoredQueue.length === 0) { setShowResumePrompt(false); return }
    setQueue(restoredQueue)
    setAgainQueue(restoredAgain)
    setCurrent(restoredQueue[0])
    setStats(resumeData.stats)
    setShowResumePrompt(false)
  }

  function handleStartFresh() {
    if (userId) localStorage.removeItem(sessionKey(userId))
    setShowResumePrompt(false)
  }

  const progress = total > 0 ? Math.round(((total - queue.length) / total) * 100) : 100

  function handleSelect(choice: string) {
    if (phase !== 'question' || !current) return
    setSelected(choice)
    setPhase('revealed')
    const answer = current.answer ?? current.explanation
    if (choice === answer) {
      setStats(s => ({ ...s, correct: s.correct + 1 }))
    } else {
      setStats(s => ({ ...s, incorrect: s.incorrect + 1 }))
    }
  }

  async function handleRate(r: GrammarRating) {
    if (!current || rating) return
    setRating(true)
    await rateGrammarCard(current.id, current.mastery_level, r)

    const nextQueue = queue.slice(1)
    const newAgainQueue = r === 'again' ? [...againQueue, current] : againQueue

    // Compute new stats (may have been updated by handleSelect above)
    // We capture by reading current state ref after the answer was processed
    const answer = current.answer ?? current.explanation
    const wasCorrect = selected === answer

    if (nextQueue.length > 0) {
      setQueue(nextQueue)
      setAgainQueue(newAgainQueue)
      setCurrent(nextQueue[0])
      if (userId) {
        // stats state may not have updated yet, so use functional update reference
        setStats(s => {
          localStorage.setItem(sessionKey(userId), JSON.stringify({
            queueIds: nextQueue.map(c => c.id),
            againQueueIds: newAgainQueue.map(c => c.id),
            stats: s,
          }))
          return s
        })
      }
    } else if (newAgainQueue.length > 0) {
      setQueue(newAgainQueue)
      setAgainQueue([])
      setCurrent(newAgainQueue[0])
      if (userId) {
        setStats(s => {
          localStorage.setItem(sessionKey(userId), JSON.stringify({
            queueIds: newAgainQueue.map(c => c.id),
            againQueueIds: [],
            stats: s,
          }))
          return s
        })
      }
    } else {
      setDone(true)
      if (userId) {
        localStorage.removeItem(sessionKey(userId))
        // Log study activity for streak tracking
        supabase.from('study_logs').upsert({ student_id: userId, studied_date: new Date().toISOString().split('T')[0] }, { onConflict: 'student_id,studied_date', ignoreDuplicates: true }).then(() => {})
      }
    }
    setRating(false)
  }

  function handleClose() {
    if (done) onComplete()
    onClose()
  }

  if (!current && !done) return null

  const answer = current ? (current.answer ?? current.explanation) : ''
  const isCorrect = selected === answer
  const sentence = current?.sentence_with_blank ?? current?.point ?? ''

  return (
    <div role="dialog" aria-modal="true" aria-label="Grammar study session" className="fixed inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center p-4">

      {/* Resume prompt overlay */}
      {showResumePrompt && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full text-center space-y-4">
            <p className="text-white font-semibold text-lg">Resume session?</p>
            <p className="text-gray-400 text-sm">
              You have {resumeData?.queueIds.length ?? 0} question{resumeData?.queueIds.length !== 1 ? 's' : ''} remaining from your last session.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleResume}
                className="w-full py-2.5 bg-brand text-white rounded-xl text-sm font-semibold"
              >
                Resume
              </button>
              <button
                onClick={handleStartFresh}
                className="w-full py-2.5 bg-gray-800 text-gray-300 rounded-xl text-sm"
              >
                Start fresh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="w-full max-w-lg flex items-center justify-between mb-4">
        <span className="text-sm text-gray-400">
          {done ? <span className="text-white font-medium">Session complete!</span> : `${total - queue.length} / ${total}`}
        </span>
        <button aria-label="Exit grammar session" onClick={handleClose} className="text-gray-500 hover:text-white text-sm transition-colors">✕ Exit</button>
      </div>

      {/* Progress bar */}
      {!done && (
        <div className="w-full max-w-lg h-1 bg-gray-700 rounded-full mb-8">
          <div className="h-full bg-brand rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      )}

      {done ? (
        <CelebrationScreen
          title="Session Complete!"
          subtitle={`You reviewed ${total} question${total !== 1 ? 's' : ''}`}
          onClose={handleClose}
          stats={
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-800 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-green-400">{stats.correct}</div>
                <div className="text-xs text-gray-500 mt-1">Correct</div>
              </div>
              <div className="bg-gray-800 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-red-400">{stats.incorrect}</div>
                <div className="text-xs text-gray-500 mt-1">Incorrect</div>
              </div>
            </div>
          }
        />
      ) : current ? (
        <div className="w-full max-w-lg space-y-4">
          {/* Category label */}
          {current.category && (
            <div className="text-center">
              <span className="inline-block px-3 py-1 text-xs font-semibold text-purple-300 bg-purple-500/20 rounded-full tracking-wide uppercase">
                {current.category}
              </span>
            </div>
          )}

          {/* Question card */}
          <div className="bg-white rounded-2xl p-8 shadow-2xl text-center space-y-4">
            <div className="text-sm text-gray-800 leading-relaxed">
              <SentenceDisplay
                sentence={sentence}
                fill={phase === 'revealed' ? answer : undefined}
              />
            </div>
            {current.hint_ja && (
              <p className="text-base text-gray-500 font-medium">{current.hint_ja}</p>
            )}
          </div>

          {/* Choices */}
          <div className="grid grid-cols-2 gap-2">
            {choices.map((choice, i) => {
              const isThis = choice === answer
              let cls = 'w-full text-left px-4 py-3 rounded-xl text-base font-medium transition-colors border-2 '
              if (phase === 'question') {
                cls += 'bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700 hover:border-gray-600'
              } else if (isThis) {
                cls += 'bg-green-500/20 border-green-500 text-green-300'
              } else if (choice === selected) {
                cls += 'bg-red-500/20 border-red-500 text-red-300'
              } else {
                cls += 'bg-gray-800 border-gray-700 text-gray-500'
              }
              return (
                <button key={i} onClick={() => handleSelect(choice)} disabled={phase === 'revealed'} className={cls}>
                  <span className="opacity-50 mr-2 text-sm">{String.fromCharCode(65 + i)}.</span>
                  {choice}
                </button>
              )
            })}
          </div>

          {/* After answer: explanation + sentence_ja */}
          {phase === 'revealed' && (
            <div className={`rounded-xl px-4 py-3 space-y-2 ${isCorrect ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
              <p className={`text-xs font-semibold uppercase tracking-wide ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                {isCorrect ? '✓ Correct' : `✗ The answer is "${answer}"`}
              </p>
              {current.explanation && (
                <p className="text-white/80 text-sm leading-relaxed">{current.explanation}</p>
              )}
              {current.sentence_ja && (
                <p className="text-white/50 text-xs leading-relaxed">{current.sentence_ja}</p>
              )}
            </div>
          )}

          {/* After answer: simplified SRS */}
          {phase === 'revealed' && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleRate('again')}
                disabled={rating}
                className="py-3.5 rounded-xl bg-gray-700 text-gray-300 hover:bg-gray-600 text-sm font-medium transition-colors disabled:opacity-50"
              >
                もう一度
              </button>
              <button
                onClick={() => handleRate(isCorrect ? 'good' : 'hard')}
                disabled={rating}
                className="py-3.5 rounded-xl bg-brand text-white hover:bg-brand/90 text-sm font-semibold transition-colors disabled:opacity-50"
              >
                わかった ✓
              </button>
            </div>
          )}

          {phase === 'question' && (
            <p className="text-center text-xs text-gray-600">{queue.length} remaining</p>
          )}
        </div>
      ) : null}
    </div>
  )
}
