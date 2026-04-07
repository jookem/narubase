import { useState, useEffect } from 'react'
import { rateGrammarCard, type GrammarBankEntry, type GrammarRating } from '@/lib/api/grammar'

interface Props {
  cards: GrammarBankEntry[]
  onClose: () => void
  onComplete: () => void
}

type Phase = 'question' | 'revealed'

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5)
}

function isEnglish(text: string): boolean {
  return text.trim().length > 0 && !/[\u3040-\u30FF\u4E00-\u9FFF]/.test(text)
}

function buildChoices(current: GrammarBankEntry, all: GrammarBankEntry[]): string[] {
  const correct = current.explanation

  // Only use English explanations as distractors
  const pool = all
    .filter(e => e.id !== current.id && isEnglish(e.explanation))
    .map(e => e.explanation)
    .filter(e => e !== correct)

  const distractors = shuffle(pool).slice(0, 3)

  // Pad with English fallbacks if not enough entries
  const fallbacks = [
    'Used to express a past action',
    'Indicates a continuing state',
    'Expresses desire or wish',
    'Shows a conditional relationship',
    'Used for making requests',
    'Expresses obligation or necessity',
    'Describes a habitual action',
    'Used to give or receive something',
  ].filter(f => f !== correct && !distractors.includes(f))

  while (distractors.length < 3) {
    distractors.push(fallbacks[distractors.length])
  }

  return shuffle([correct, ...distractors.slice(0, 3)])
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
      setChoices(buildChoices(current, cards))
      setSelected(null)
      setPhase('question')
    }
  }, [current, done])

  const progress = total > 0 ? Math.round(((total - queue.length) / total) * 100) : 100

  function handleSelect(choice: string) {
    if (phase !== 'question' || !current) return
    setSelected(choice)
    setPhase('revealed')
    if (choice === current.explanation) {
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

  const isCorrect = selected === current?.explanation

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="w-full max-w-lg flex items-center justify-between mb-6">
        <div className="text-sm text-gray-400">
          {done ? (
            <span className="text-white font-medium">Session complete!</span>
          ) : (
            <span>{total - queue.length} / {total}</span>
          )}
        </div>
        <button onClick={handleClose} className="text-gray-500 hover:text-white text-sm transition-colors">
          ✕ Exit
        </button>
      </div>

      {/* Progress bar */}
      {!done && (
        <div className="w-full max-w-lg h-1 bg-gray-700 rounded-full mb-8">
          <div className="h-full bg-brand rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      )}

      {done ? (
        <div className="w-full max-w-lg text-center space-y-6">
          <div className="text-5xl mb-2">🎉</div>
          <h2 className="text-2xl font-bold text-white">Session Complete</h2>
          <p className="text-gray-400">You reviewed {total} grammar point{total !== 1 ? 's' : ''}</p>
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
          <button
            onClick={handleClose}
            className="px-8 py-3 bg-brand text-white rounded-xl font-medium hover:bg-brand/90 transition-colors"
          >
            Done
          </button>
        </div>
      ) : current ? (
        <div className="w-full max-w-lg space-y-4">
          {/* Grammar point card */}
          <div className="bg-white rounded-2xl p-8 shadow-2xl text-center">
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-3">Grammar Point</p>
            <p className="text-4xl font-bold text-gray-900">{current.point}</p>
          </div>

          {/* Choices */}
          <div className="space-y-2">
            {choices.map((choice, i) => {
              const isThis = choice === current.explanation
              let cls = 'w-full text-left px-4 py-3 rounded-xl text-sm transition-colors border-2 '
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
                  <span className="opacity-50 mr-2">{String.fromCharCode(65 + i)}.</span>
                  {choice}
                </button>
              )
            })}
          </div>

          {/* After answer: examples + rating */}
          {phase === 'revealed' && (
            <div className="space-y-3">
              {current.examples.length > 0 && (
                <div className="bg-gray-800 rounded-xl px-4 py-3 space-y-1">
                  {current.examples.map((ex, i) => (
                    <p key={i} className="text-sm text-gray-300 italic">"{ex}"</p>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                {isCorrect ? (
                  <>
                    <button onClick={() => handleRate('good')} disabled={rating} className="py-3 rounded-xl bg-green-500/20 text-green-400 hover:bg-green-500/30 text-sm font-medium transition-colors disabled:opacity-50">
                      <span className="block text-xs mb-0.5">Good</span>
                      <span className="block text-xs opacity-60">+level</span>
                    </button>
                    <button onClick={() => handleRate('easy')} disabled={rating} className="py-3 rounded-xl bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 text-sm font-medium transition-colors disabled:opacity-50">
                      <span className="block text-xs mb-0.5">Easy</span>
                      <span className="block text-xs opacity-60">skip ahead</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => handleRate('again')} disabled={rating} className="py-3 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 text-sm font-medium transition-colors disabled:opacity-50">
                      <span className="block text-xs mb-0.5">Again</span>
                      <span className="block text-xs opacity-60">retry</span>
                    </button>
                    <button onClick={() => handleRate('hard')} disabled={rating} className="py-3 rounded-xl bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 text-sm font-medium transition-colors disabled:opacity-50">
                      <span className="block text-xs mb-0.5">Hard</span>
                      <span className="block text-xs opacity-60">same interval</span>
                    </button>
                  </>
                )}
              </div>
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
