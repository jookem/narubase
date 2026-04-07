import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { updateVocabMastery } from '@/lib/api/lessons'
import { speak } from '@/lib/tts'
import type { VocabularyBankEntry, MasteryLevel } from '@/lib/types/database'

const MASTERY = [
  { label: '新しい', labelEn: 'New', color: 'bg-gray-100 text-gray-600' },
  { label: '見た', labelEn: 'Seen', color: 'bg-yellow-100 text-yellow-700' },
  { label: '覚えてる', labelEn: 'Familiar', color: 'bg-brand-light text-brand-dark' },
  { label: 'マスター', labelEn: 'Mastered', color: 'bg-green-100 text-green-700' },
]

export function VocabularyFlashcard({
  entry,
  onMasteryChanged,
}: {
  entry: VocabularyBankEntry
  onMasteryChanged?: () => void
}) {
  const [flipped, setFlipped] = useState(false)
  const [mastery, setMastery] = useState(entry.mastery_level)
  const [updating, setUpdating] = useState(false)

  async function handleMastery(level: MasteryLevel) {
    setMastery(level)
    setUpdating(true)
    await updateVocabMastery(entry.id, level)
    setUpdating(false)
    onMasteryChanged?.()
  }

  return (
    <div className="cursor-pointer" onClick={() => setFlipped(f => !f)}>
      <Card className={`transition-all ${flipped ? 'bg-brand-light' : 'bg-white'}`}>
        <CardContent className="pt-4 pb-3 flex flex-col gap-2">
          {/* Content area — fixed height, centred on both sides */}
          <div className="min-h-[80px] flex flex-col items-center justify-center text-center">
            {!flipped ? (
              <>
                <div className="flex items-center justify-center gap-2">
                  <p className="text-2xl font-bold text-gray-900 font-sans">{entry.word}</p>
                  <button
                    onClick={e => { e.stopPropagation(); speak(entry.word) }}
                    className="text-gray-400 hover:text-brand transition-colors shrink-0"
                    title="Listen"
                  >
                    🔊
                  </button>
                </div>
                {entry.reading && <p className="text-sm text-gray-500 mt-0.5">{entry.reading}</p>}
                <p className="text-xs text-gray-400 mt-2">タップして意味を見る / Tap to reveal</p>
              </>
            ) : (
              <>
                {entry.image_url && (
                  <img
                    src={entry.image_url}
                    alt={entry.word}
                    className="max-h-24 object-contain rounded-md mb-2"
                  />
                )}
                {entry.definition_ja && (
                  <p className="text-2xl font-medium text-gray-900" dangerouslySetInnerHTML={{ __html: entry.definition_ja }} />
                )}
                {entry.definition_en && (
                  <p className="text-base text-gray-600 mt-0.5 font-sans" dangerouslySetInnerHTML={{ __html: entry.definition_en }} />
                )}
                {entry.example && (
                  <p className="text-xs text-gray-500 italic mt-2" dangerouslySetInnerHTML={{ __html: `&ldquo;${entry.example}&rdquo;` }} />
                )}
              </>
            )}
          </div>

          {/* Mastery buttons */}
          <div className="flex gap-1 justify-center" onClick={e => e.stopPropagation()}>
            {MASTERY.map((m, i) => (
              <button
                key={i}
                disabled={updating}
                onClick={() => handleMastery(i as MasteryLevel)}
                className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                  mastery === i
                    ? m.color + ' font-semibold ring-1 ring-current'
                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                }`}
                title={m.labelEn}
              >
                {m.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
