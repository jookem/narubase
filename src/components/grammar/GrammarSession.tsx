import { useState, useEffect } from 'react'
import { rateGrammarCard, type GrammarBankEntry, type GrammarRating } from '@/lib/api/grammar'
import { CelebrationScreen } from '@/components/shared/CelebrationScreen'

interface Props {
  cards: GrammarBankEntry[]
  onClose: () => void
  onComplete: () => void
}

type Phase = 'question' | 'revealed'

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

export function GrammarSession({ cards, onClose, onComplete }: Props) {
  const [queue, setQueue] = useState<GrammarBankEntry[]>([...cards])
  const [againQueue, setAgainQueue] = useState<GrammarBankEntry[]>([])
  const [current, setCurrent] = useState<GrammarBankEntry | null>(cards[0] ?? null)
  const [choices, setChoices] = useState<string[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('question')
  const [rating, setRating] = useState(false)
  const [done, setDone] = useState(false)
  const [stats, setStats] = useState({ correct: 0, incorrect: 0 })
  const total = cards.length

  useEffect(() => {
    if (current && !done) {
      setChoices(buildChoices(current))
      setSelected(null)
      setPhase('question')
    }
  }, [current, done])

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

    if (nextQueue.length > 0) {
      setQueue(nextQueue)
      setAgainQueue(newAgainQueue)
      setCurrent(nextQueue[0])
    } else if (newAgainQueue.length > 0) {
      setQueue(newAgainQueue)
      setAgainQueue([])
      setCurrent(newAgainQueue[0])
    } else {
      setDone(true)
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

          {/* After answer: SRS rating */}
          {phase === 'revealed' && (
            <div className="grid grid-cols-2 gap-2">
              {isCorrect ? (
                <>
                  <button onClick={() => handleRate('good')} disabled={rating} className="py-3 rounded-xl bg-green-500/20 text-green-400 hover:bg-green-500/30 text-sm font-medium transition-colors disabled:opacity-50">
                    <span className="block">Good</span>
                    <span className="block text-xs opacity-60 mt-0.5">+level</span>
                  </button>
                  <button onClick={() => handleRate('easy')} disabled={rating} className="py-3 rounded-xl bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 text-sm font-medium transition-colors disabled:opacity-50">
                    <span className="block">Easy</span>
                    <span className="block text-xs opacity-60 mt-0.5">skip ahead</span>
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => handleRate('again')} disabled={rating} className="py-3 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 text-sm font-medium transition-colors disabled:opacity-50">
                    <span className="block">Again</span>
                    <span className="block text-xs opacity-60 mt-0.5">retry</span>
                  </button>
                  <button onClick={() => handleRate('hard')} disabled={rating} className="py-3 rounded-xl bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 text-sm font-medium transition-colors disabled:opacity-50">
                    <span className="block">Hard</span>
                    <span className="block text-xs opacity-60 mt-0.5">same interval</span>
                  </button>
                </>
              )}
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
