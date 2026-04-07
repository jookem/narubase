import { useState, useEffect } from 'react'
import { rateVocabCard } from '@/lib/api/lessons'
import { speak } from '@/lib/tts'
import type { VocabularyBankEntry, MasteryLevel } from '@/lib/types/database'
import { CelebrationScreen } from '@/components/shared/CelebrationScreen'

type Rating = 'again' | 'hard' | 'good' | 'easy'

interface Stats {
  again: number
  hard: number
  good: number
  easy: number
}

interface Props {
  cards: VocabularyBankEntry[]
  onClose: () => void
  onComplete: () => void
}

export function StudySession({ cards, onClose, onComplete }: Props) {
  const [queue, setQueue] = useState<VocabularyBankEntry[]>([...cards])
  const [againQueue, setAgainQueue] = useState<VocabularyBankEntry[]>([])
  const [current, setCurrent] = useState<VocabularyBankEntry | null>(cards[0] ?? null)
  const [flipped, setFlipped] = useState(false)
  const [rating, setRating] = useState(false)
  const [stats, setStats] = useState<Stats>({ again: 0, hard: 0, good: 0, easy: 0 })
  const [done, setDone] = useState(false)
  const total = cards.length

  // Auto-play word when card changes (respects user setting)
  useEffect(() => {
    if (current && !done && localStorage.getItem('tts_autoplay') !== 'false') {
      speak(current.word)
    }
  }, [current, done])

  const remaining = queue.length + againQueue.length
  const reviewed = total - remaining + (done ? 0 : 0)
  const progress = total > 0 ? Math.round(((total - queue.length) / total) * 100) : 100

  async function handleRate(r: Rating) {
    if (!current || rating) return
    setRating(true)

    await rateVocabCard(current.id, current.mastery_level as MasteryLevel, r)

    setStats(prev => ({ ...prev, [r]: prev[r] + 1 }))

    const nextQueue = queue.slice(1)
    const newAgainQueue = r === 'again' ? [...againQueue, current] : againQueue

    if (nextQueue.length > 0) {
      setQueue(nextQueue)
      setAgainQueue(newAgainQueue)
      setCurrent(nextQueue[0])
      setFlipped(false)
    } else if (newAgainQueue.length > 0) {
      // Main queue exhausted — loop through "again" cards
      setQueue(newAgainQueue)
      setAgainQueue([])
      setCurrent(newAgainQueue[0])
      setFlipped(false)
    } else {
      setDone(true)
    }

    setRating(false)
  }

  function handleClose() {
    if (done) {
      onComplete()
    }
    onClose()
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Vocabulary study session" className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="w-full max-w-lg flex items-center justify-between mb-6">
        <div className="text-sm text-gray-400">
          {done ? (
            <span className="text-white font-medium">Session complete!</span>
          ) : (
            <span>{total - queue.length} / {total}</span>
          )}
        </div>
        <button
          aria-label="Exit study session"
          onClick={handleClose}
          className="text-gray-500 hover:text-white text-sm transition-colors"
        >
          ✕ Exit
        </button>
      </div>

      {/* Progress bar */}
      {!done && (
        <div className="w-full max-w-lg h-1 bg-gray-700 rounded-full mb-8">
          <div
            className="h-full bg-brand rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {done ? (
        <CelebrationScreen
          title="Session Complete!"
          subtitle={`You reviewed ${total} word${total !== 1 ? 's' : ''}`}
          onClose={handleClose}
          stats={
            <div className="grid grid-cols-4 gap-3">
              {([
                { label: 'Again', key: 'again', color: 'text-red-400' },
                { label: 'Hard', key: 'hard', color: 'text-yellow-400' },
                { label: 'Good', key: 'good', color: 'text-green-400' },
                { label: 'Easy', key: 'easy', color: 'text-blue-400' },
              ] as const).map(({ label, key, color }) => (
                <div key={key} className="bg-gray-800 rounded-xl p-3 text-center">
                  <div className={`text-2xl font-bold ${color}`}>{stats[key]}</div>
                  <div className="text-xs text-gray-500 mt-1">{label}</div>
                </div>
              ))}
            </div>
          }
        />
      ) : current ? (
        /* Card */
        <div className="w-full max-w-lg space-y-6">
          <div
            onClick={() => !flipped && setFlipped(true)}
            className={`min-h-52 bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center justify-center transition-all ${
              !flipped ? 'cursor-pointer hover:shadow-brand/20' : ''
            }`}
          >
            {!flipped ? (
              <div className="text-center space-y-3">
                <p className="text-5xl font-bold text-gray-900 font-sans">{current.word}</p>
                {current.reading && (
                  <p className="text-xl text-gray-400">{current.reading}</p>
                )}
                <button
                  onClick={e => { e.stopPropagation(); speak(current.word) }}
                  className="text-2xl opacity-40 hover:opacity-80 transition-opacity"
                  title="Listen again"
                >
                  🔊
                </button>
                <p className="text-sm text-gray-300 mt-4">Tap to reveal</p>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center space-y-3">
                {current.image_url && (
                  <img
                    src={current.image_url}
                    alt={current.word}
                    className="max-h-48 object-contain rounded-lg mb-1"
                  />
                )}
                {current.definition_ja && (
                  <p className="text-5xl font-medium text-gray-900" dangerouslySetInnerHTML={{ __html: current.definition_ja }} />
                )}
                {current.definition_en && (
                  <p className="text-lg text-gray-500 font-sans" dangerouslySetInnerHTML={{ __html: current.definition_en }} />
                )}
                {current.example && (
                  <p className="text-sm text-gray-400 italic border-t pt-3 mt-3 w-full" dangerouslySetInnerHTML={{ __html: `&ldquo;${current.example}&rdquo;` }} />
                )}
              </div>
            )}
          </div>

          {/* Rating buttons — only show after flip */}
          {flipped && (
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => handleRate('again')}
                disabled={rating}
                className="py-3 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 text-sm font-medium transition-colors disabled:opacity-50"
              >
                <span className="block text-xs mb-0.5">Again</span>
                <span className="block text-xs opacity-60">+1 day</span>
              </button>
              <button
                onClick={() => handleRate('hard')}
                disabled={rating}
                className="py-3 rounded-xl bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 text-sm font-medium transition-colors disabled:opacity-50"
              >
                <span className="block text-xs mb-0.5">Hard</span>
                <span className="block text-xs opacity-60">same</span>
              </button>
              <button
                onClick={() => handleRate('good')}
                disabled={rating}
                className="py-3 rounded-xl bg-green-500/20 text-green-400 hover:bg-green-500/30 text-sm font-medium transition-colors disabled:opacity-50"
              >
                <span className="block text-xs mb-0.5">Good</span>
                <span className="block text-xs opacity-60">+level</span>
              </button>
              <button
                onClick={() => handleRate('easy')}
                disabled={rating}
                className="py-3 rounded-xl bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 text-sm font-medium transition-colors disabled:opacity-50"
              >
                <span className="block text-xs mb-0.5">Easy</span>
                <span className="block text-xs opacity-60">skip</span>
              </button>
            </div>
          )}

          {!flipped && (
            <p className="text-center text-xs text-gray-600">
              {queue.length} remaining{againQueue.length > 0 ? ` · ${againQueue.length} to repeat` : ''}
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}
