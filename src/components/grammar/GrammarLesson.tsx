import { useState } from 'react'
import type { GrammarLessonSlide } from '@/lib/api/grammar'
import { renderMarkdown } from '@/lib/renderMarkdown'

// Wrap [text] in a highlight span. Teachers write e.g. "She [has been] waiting."
function renderHighlighted(text: string): React.ReactNode {
  const parts = text.split(/(\[[^\]]+\])/)
  if (parts.length === 1) return text
  return parts.map((part, i) => {
    if (part.startsWith('[') && part.endsWith(']')) {
      return (
        <mark key={i} className="bg-brand/20 text-brand font-bold px-0.5 rounded not-italic">
          {part.slice(1, -1)}
        </mark>
      )
    }
    return part
  })
}

interface Props {
  slides: GrammarLessonSlide[]
  deckName: string
  initialIndex?: number
  onComplete: () => void   // proceed to practice
  onClose: () => void      // exit entirely
}

export function GrammarLesson({ slides, deckName, initialIndex = 0, onComplete, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex)
  const slide = slides[index]
  const isLast = index === slides.length - 1
  const pct = slides.length > 1 ? Math.round((index / (slides.length - 1)) * 100) : 100

  return (
    <div role="dialog" aria-modal="true" aria-label="Grammar lesson" className="fixed inset-0 z-50 bg-slate-900 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
        <button onClick={onClose} className="text-white/50 hover:text-white text-sm transition-colors">✕</button>
        <span className="text-white/50 text-xs font-medium tracking-wide uppercase">Lesson · {deckName}</span>
        <button
          onClick={onComplete}
          className="text-white/50 hover:text-white text-xs transition-colors"
        >
          Skip →
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-white/10 mx-4 rounded-full overflow-hidden shrink-0">
        <div
          className="h-full bg-brand rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Slide counter */}
      <p className="text-center text-white/30 text-xs mt-2 shrink-0">
        {index + 1} / {slides.length}
      </p>

      {/* Slide content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-lg mx-auto space-y-6">
          {/* Title */}
          <div className="text-center space-y-1">
            <h1 className="text-3xl font-bold text-white leading-tight">{slide.title}</h1>
          </div>

          {/* Explanation */}
          {slide.explanation && (
            <div className="bg-white/10 rounded-2xl p-5 text-white/90 text-base leading-relaxed [&_strong]:font-bold [&_strong]:text-white [&_em]:italic [&_ol]:mt-1 [&_ul]:mt-1 [&_li]:leading-relaxed">
              {renderMarkdown(slide.explanation)}
            </div>
          )}

          {/* Japanese hint */}
          {slide.hint_ja && (
            <div className="bg-brand/20 border border-brand/30 rounded-xl px-4 py-3">
              <p className="text-brand-light text-sm leading-relaxed">{slide.hint_ja}</p>
            </div>
          )}

          {/* Examples */}
          {slide.examples.length > 0 && (
            <div className="space-y-2">
              <p className="text-white/40 text-xs font-semibold uppercase tracking-wide">Examples</p>
              <div className="space-y-3">
                {slide.examples.map((ex, i) => {
                  const [english, japanese] = ex.includes('\n') ? ex.split('\n') : [ex, null]
                  return (
                    <div key={i} className="flex gap-3 items-start">
                      <span className="text-brand text-xs font-bold mt-1 shrink-0">{i + 1}.</span>
                      <div>
                        <p className="text-white/85 text-base leading-relaxed">{renderHighlighted(english)}</p>
                        {japanese && <p className="text-white/45 text-sm leading-relaxed mt-0.5">{japanese}</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="px-6 pb-8 pt-4 shrink-0">
        <div className="max-w-lg mx-auto flex gap-3">
          {index > 0 && (
            <button
              onClick={() => setIndex(i => i - 1)}
              className="flex-1 py-3 rounded-xl bg-white/10 text-white/70 text-sm font-medium hover:bg-white/15 transition-colors"
            >
              ← Back
            </button>
          )}
          {isLast ? (
            <button
              onClick={onComplete}
              className="flex-1 py-3 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors"
            >
              Start Practice →
            </button>
          ) : (
            <button
              onClick={() => setIndex(i => i + 1)}
              className="flex-1 py-3 rounded-xl bg-white text-slate-900 text-sm font-semibold hover:bg-white/90 transition-colors"
            >
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
