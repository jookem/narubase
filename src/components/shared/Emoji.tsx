import { emojiToSrc } from '@/lib/emoji'

// Renders a single emoji as a self-hosted Twemoji <img> instead of letting
// the OS/browser draw it with its own (version-dependent, redesign-prone)
// emoji font — see src/lib/emoji.ts for why. Falls back to the raw
// character for anything outside our bundled set (see
// scripts/sync-emoji-assets.mjs) so nothing silently disappears.
//
// This is a plain prop-driven component (not a DOM-mutation trick like
// twemoji.parse()), so it updates correctly through React's normal
// reconciliation when the emoji prop changes — no stale-node hazard.
export function Emoji({
  children, className, style,
}: {
  children: string
  className?: string
  style?: React.CSSProperties
}) {
  const src = emojiToSrc(children)
  if (!src) return <span className={className} style={style}>{children}</span>
  return (
    <img
      src={src} alt={children} draggable={false}
      className={className ? `nb-emoji ${className}` : 'nb-emoji'}
      style={style}
    />
  )
}

const EMOJI_SPLIT_RE = /(\p{Extended_Pictographic}(?:️)?(?:‍\p{Extended_Pictographic}(?:️)?)*)/gu

// Like <Emoji>, but for strings that mix emoji with a label — "🔊 Listen
// again", "Finish! 🎉" — rather than one isolated character. Splits on
// emoji runs and renders each through <Emoji>, leaving the rest as plain
// text so mixed labels don't need to be hand-split at every call site.
export function EmojiText({ children }: { children: string }) {
  const parts = children.split(EMOJI_SPLIT_RE)
  return <>{parts.map((part, i) => (i % 2 === 1 ? <Emoji key={i}>{part}</Emoji> : part))}</>
}
