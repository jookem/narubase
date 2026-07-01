import { useEffect, useState } from 'react'
import { speak } from '@/lib/tts'
import type { PhonicsUnit } from '@/lib/phonicsContent'

const FONT = "'M PLUS Rounded 1c', system-ui, sans-serif"
const ACCENT = '#F2879B'

interface Props {
  unit: PhonicsUnit
  onDone: () => void
}

function renderHighlighted(text: string, highlights: string[]) {
  if (!highlights.length) return text
  const escaped = highlights.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`(${escaped.join('|')})`, 'gi')
  return text.split(re).map((part, i) => {
    const isMatch = highlights.some(h => h.toLowerCase() === part.toLowerCase())
    return isMatch
      ? <span key={i} style={{ color: ACCENT, fontWeight: 900 }}>{part}</span>
      : <span key={i}>{part}</span>
  })
}

// Page-by-page decodable mini-story starring the unit's recurring mascot.
// Self-paced (tap to advance, not a timer) with the target pattern's letters
// highlighted so the story reads as a continuation of what Word Builder /
// Family Match just taught, not a disconnected reward reel. No mic/
// pronunciation-check here — the teacher supervises reading aloud in person.
export function StoryReader({ unit, onDone }: Props) {
  const [pageIdx, setPageIdx] = useState(0)
  const pages = unit.storyPages
  const page = pages[pageIdx]
  const isLast = pageIdx === pages.length - 1

  useEffect(() => { setPageIdx(0) }, [unit])

  useEffect(() => {
    const t = setTimeout(() => speak(page.text), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIdx, unit])

  function next() {
    if (isLast) onDone()
    else setPageIdx(i => i + 1)
  }
  function prev() {
    setPageIdx(i => Math.max(0, i - 1))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: FONT, width: '100%', maxWidth: 420, margin: '0 auto', padding: '4px 4px 20px' }}>
      {/* Progress bar */}
      <div style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: '#A98B77', marginBottom: 4 }}>
          <span>{unit.mascotName}'s story</span>
          <span>{pageIdx + 1} / {pages.length}</span>
        </div>
        <div style={{ height: 8, background: '#EDE0D4', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${((pageIdx + 1) / pages.length) * 100}%`, background: '#8BC273', borderRadius: 8, transition: 'width .3s' }} />
        </div>
      </div>

      {/* Mascot */}
      <div style={{ textAlign: 'center', fontSize: 70, animation: 'kg-floaty 2.4s ease-in-out infinite' }}>
        {unit.mascotEmoji}
      </div>

      {/* Sentence card */}
      <div style={{ background: '#FFFFFF', borderRadius: 24, padding: '28px 24px', boxShadow: '0 8px 0 #EEDAC6', textAlign: 'center', minHeight: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: '#5A4336', lineHeight: 1.4 }}>
          {renderHighlighted(page.text, page.highlight)}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button
          onClick={() => speak(page.text)}
          style={{ border: 'none', cursor: 'pointer', fontFamily: FONT, fontWeight: 700, fontSize: 14, padding: '8px 18px', borderRadius: '999px', background: '#F0F8FF', color: '#7FB8E0' }}>
          🔊 Listen again
        </button>
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        {pageIdx > 0 && (
          <button onClick={prev} style={{ border: 'none', cursor: 'pointer', fontFamily: FONT, fontWeight: 700, fontSize: 15, padding: '10px 20px', borderRadius: '999px', background: '#FFFFFF', color: '#6B4F3F', boxShadow: '0 4px 0 #E7D3C0' }}>
            ← Back
          </button>
        )}
        <button onClick={next} style={{ border: 'none', cursor: 'pointer', fontFamily: FONT, fontWeight: 800, fontSize: 15, padding: '10px 24px', borderRadius: '999px', background: '#F2879B', color: '#fff', boxShadow: '0 4px 0 #D96C81' }}>
          {isLast ? 'Finish! 🎉' : 'Next →'}
        </button>
      </div>
    </div>
  )
}
