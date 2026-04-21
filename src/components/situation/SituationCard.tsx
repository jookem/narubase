import type { Situation } from '@/lib/api/situations'

interface Props {
  situation: Situation
  emoji: string
  onSelect: () => void
  disabled: boolean
}

const difficultyBadge: Record<string, string> = {
  beginner:     'text-green-700 bg-green-50 border-green-200',
  intermediate: 'text-amber-700 bg-amber-50 border-amber-200',
  advanced:     'text-red-700   bg-red-50   border-red-200',
}

export function SituationCard({ situation, emoji, onSelect, disabled }: Props) {
  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className="text-left w-full p-4 bg-white border border-gray-200 rounded-xl hover:border-brand hover:shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <div className="flex items-start gap-3">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
          style={{ backgroundColor: situation.background_color }}
        >
          {emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900 text-sm">{situation.title}</h3>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${difficultyBadge[situation.difficulty]}`}>
              {situation.difficulty}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{situation.description}</p>
          {situation.npc && (
            <p className="text-xs text-gray-400 mt-1.5">
              With: <span className="font-medium">{situation.npc.name}</span> · {situation.npc.role}
            </p>
          )}
        </div>
      </div>
    </button>
  )
}
