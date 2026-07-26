import { useEffect } from 'react'
import { launchConfetti } from '@/lib/confetti'
import { Emoji, EmojiText } from '@/components/shared/Emoji'

const MASCOT_REACTIONS = [
  { emoji: '🤖', message: 'システム確認完了！すごいぞ！', sub: 'Systems confirmed — you crushed it!' },
  { emoji: '🦊', message: 'やったね！天才だ！', sub: 'You did it! Absolute genius!' },
  { emoji: '🐉', message: '伝説だ！！', sub: 'LEGENDARY performance!!' },
  { emoji: '🦉', message: 'すばらしい知恵だ！', sub: 'Remarkable wisdom shown today!' },
  { emoji: '⭐', message: 'スーパースター！', sub: 'You are a total superstar!' },
  { emoji: '🚀', message: '宇宙まで飛んでいけ！', sub: 'You are out of this world!' },
]

interface Props {
  title: string
  subtitle?: string
  stats?: React.ReactNode
  onClose: () => void
  closeLabel?: string
}

export function CelebrationScreen({ title, subtitle, stats, onClose, closeLabel = 'Done' }: Props) {
  const mascot = MASCOT_REACTIONS[Math.floor(Math.random() * MASCOT_REACTIONS.length)]

  useEffect(() => {
    launchConfetti()
  }, [])

  return (
    <div className="w-full max-w-lg text-center space-y-6 animate-[fadeIn_0.4s_ease]">
      {/* Mascot */}
      <div className="flex flex-col items-center gap-2">
        <div className="text-7xl animate-[bounce_1s_ease_2]"><Emoji>{mascot.emoji}</Emoji></div>
        <div className="bg-white/10 rounded-2xl px-5 py-3 max-w-xs">
          <p className="text-white font-bold text-lg">{mascot.message}</p>
          <p className="text-gray-300 text-sm mt-0.5">{mascot.sub}</p>
        </div>
      </div>

      {/* Result */}
      <div>
        <h2 className="text-2xl font-bold text-white"><EmojiText>{title}</EmojiText></h2>
        {subtitle && <p className="text-gray-400 mt-1"><EmojiText>{subtitle}</EmojiText></p>}
      </div>

      {/* Stats */}
      {stats}

      <button
        onClick={onClose}
        className="px-10 py-3 bg-brand text-white rounded-xl font-medium hover:bg-brand/90 transition-colors text-base"
      >
        {closeLabel}
      </button>
    </div>
  )
}
