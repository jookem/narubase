import type { Situation } from '@/lib/api/situations'
import { SituationCard } from './SituationCard'

interface Props {
  situations: Situation[]
  onSelect: (situation: Situation) => void
  loading: boolean
}

const categoryEmoji: Record<string, string> = {
  restaurant: '🍽️',
  school:     '🏫',
  shopping:   '🛒',
  workplace:  '💼',
  medical:    '🏥',
  travel:     '✈️',
  social:     '👥',
  general:    '💬',
}

export function SituationList({ situations, onSelect, loading }: Props) {
  if (situations.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400">
        <p className="text-4xl mb-2">🎭</p>
        <p className="text-sm">No situations available yet.</p>
        <p className="text-xs mt-1">Your teacher will add situations here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700">Choose a situation</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {situations.map(situation => (
          <SituationCard
            key={situation.id}
            situation={situation}
            emoji={categoryEmoji[situation.category] ?? '💬'}
            onSelect={() => onSelect(situation)}
            disabled={loading}
          />
        ))}
      </div>
    </div>
  )
}
