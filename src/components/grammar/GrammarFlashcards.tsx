import { useState } from 'react'
import { CelebrationScreen } from '@/components/shared/CelebrationScreen'
import type { GrammarBankEntry } from '@/lib/api/grammar'

interface Props {
  cards: GrammarBankEntry[]
  onComplete: () => void
  onClose: () => void
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5)
}

function PointDisplay({ point, answerJa }: { point: string; answerJa?: string | null }) {
  const parts = point.split('_____')
  if (parts.length === 1) {
    return <h2 className="text-2xl font-bold text-white">{point}</h2>
  }
  const fills = answerJa?.split(' / ') ?? null
  return (
    <h2 className="text-2xl font-bold text-white">
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && (
            fills
              ? <span className="text-yellow-300 font-bold">[{fills[i] ?? fills[fills.length - 1]}]</span>
              : <span className="inline-block min-w-[3rem] border-b-2 border-white/50 mx-1">_____</span>
          )}
        </span>
      ))}
    </h2>
  )
}

export function GrammarFlashcards({ cards, onComplete, onClose }: Props) {
  const [deck] = useState(() => shuffle(cards))
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [done, setDone] = useState(false)

  const card = deck[index]
  const pct = Math.round((index / deck.length) * 100)

  function handleNext() {
    if (index + 1 >= deck.length) {
      setDone(true)
    } else {
      setIndex(i => i + 1)
      setFlipped(false)
    }
  }

  if (done) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center p-4">
        <CelebrationScreen
          title="Pattern review done!"
          subtitle="You've reviewed all the grammar points. Time for the quiz."
          onClose={onComplete}
          closeLabel="Start Quiz →"
        />
      </div>
    )
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Grammar flashcards" className="fixed inset-0 z-50 bg-slate-900 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
        <button onClick={onClose} className="text-white/50 hover:text-white text-sm transition-colors">✕</button>
        <span className="text-white/50 text-xs font-medium tracking-wide uppercase">Pattern</span>
        <span className="text-white/40 text-xs">{index + 1} / {deck.length}</span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-white/10 mx-4 rounded-full overflow-hidden shrink-0">
        <div className="h-full bg-brand rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      {/* Card area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">

        {/* Front — always visible */}
        <div className="w-full max-w-lg bg-white/10 rounded-2xl p-6 text-center space-y-3">
          <p className="text-white/40 text-xs font-semibold uppercase tracking-widest">Grammar Point</p>
          <PointDisplay point={card.point} answerJa={card.answer_ja} />
        </div>

        {/* Back — revealed on flip */}
        {flipped ? (
          <div className="w-full max-w-lg space-y-3">
            <div className="bg-white rounded-2xl p-6 space-y-4 shadow-2xl">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Explanation</p>
                <p className="text-gray-900 text-base leading-relaxed">{card.explanation}</p>
              </div>
              {card.examples.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Examples</p>
                  <div className="space-y-2">
                    {card.examples.map((ex, i) => (
                      <div key={i} className="flex gap-2 text-sm">
                        <span className="text-brand font-bold shrink-0">{i + 1}.</span>
                        <span className="text-gray-700">{ex}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(card.sentence_with_blank || card.hint_ja) && (
                <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-1">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Pattern</p>
                  {card.hint_ja && (
                    <p className="text-brand text-sm font-medium">{card.hint_ja}</p>
                  )}
                  {card.sentence_with_blank && (
                    <p className="text-gray-700 text-sm font-medium">
                      {(() => {
                        const fills = (card.answer ?? '…').split(' / ')
                        return card.sentence_with_blank
                          .split('_____')
                          .map((part, i, arr) => i < arr.length - 1 ? `${part}[${fills[i] ?? '…'}]` : part)
                          .join('')
                      })()}
                    </p>
                  )}
                  {card.answer_ja && (
                    <p className="text-gray-500 text-xs">{card.answer_ja}</p>
                  )}
                  {card.sentence_ja && (
                    <p className="text-gray-500 text-xs">{card.sentence_ja}</p>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={handleNext}
              className="w-full py-3.5 bg-brand text-white text-sm font-semibold rounded-xl hover:bg-brand/90 transition-colors"
            >
              {index + 1 >= deck.length ? 'Finish Flashcards →' : 'Next →'}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setFlipped(true)}
            className="w-full max-w-lg py-3.5 bg-white text-slate-900 text-sm font-semibold rounded-xl hover:bg-white/90 transition-colors"
          >
            Show Explanation
          </button>
        )}
      </div>
    </div>
  )
}
