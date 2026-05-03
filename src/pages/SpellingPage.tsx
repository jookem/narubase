import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { getStudentVocab } from '@/lib/api/lessons'
import { Card, CardContent } from '@/components/ui/card'
import { SpellingGame } from '@/components/spelling/SpellingGame'
import { CelebrationScreen } from '@/components/shared/CelebrationScreen'
import type { VocabularyBankEntry } from '@/lib/types/database'

type DeckGroup = {
  deckId: string | null
  deckName: string
  words: VocabularyBankEntry[]
}

function getStudyBatch(words: VocabularyBankEntry[]): VocabularyBankEntry[] {
  const size = parseInt(localStorage.getItem('study_size') ?? '20', 10)
  // Only use words with 2+ letters (single-letter words aren't useful for spelling)
  const eligible = words.filter(w => w.word.trim().length >= 2)
  const shuffled = [...eligible].sort(() => Math.random() - 0.5)
  return size === 0 ? shuffled : shuffled.slice(0, size)
}

export function SpellingPage() {
  const { user } = useAuth()
  const [decks, setDecks] = useState<DeckGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [activeWords, setActiveWords] = useState<VocabularyBankEntry[] | null>(null)
  const [sessionDone, setSessionDone] = useState(false)

  async function load() {
    if (!user) return
    const { entries } = await getStudentVocab(user.id)

    // Fetch deck names
    const deckIds = [...new Set(entries.map(v => v.deck_id).filter(Boolean) as string[])]
    const deckNameMap: Record<string, string> = {}
    if (deckIds.length > 0) {
      const { data: deckData } = await supabase
        .from('vocabulary_decks')
        .select('id, name')
        .in('id', deckIds)
      for (const d of deckData ?? []) deckNameMap[d.id] = d.name
    }

    // Group by deck
    const grouped: Record<string, DeckGroup> = {}
    for (const entry of entries) {
      const key = entry.deck_id ?? '__none__'
      if (!grouped[key]) {
        grouped[key] = {
          deckId: entry.deck_id,
          deckName: entry.deck_id ? (deckNameMap[entry.deck_id] ?? 'Unknown Deck') : 'Other',
          words: [],
        }
      }
      grouped[key].words.push(entry)
    }

    setDecks(Object.values(grouped).filter(g => g.words.some(w => w.word.trim().length >= 2)))
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  function startDeck(deck: DeckGroup) {
    const batch = getStudyBatch(deck.words)
    if (!batch.length) return
    setActiveWords(batch)
    setSessionDone(false)
  }

  function handleClose() {
    setActiveWords(null)
    setSessionDone(false)
  }

  function handleComplete() {
    setSessionDone(true)
  }

  // Active game
  if (activeWords && !sessionDone) {
    return (
      <SpellingGame
        words={activeWords}
        onClose={handleClose}
        onComplete={handleComplete}
      />
    )
  }

  // Session complete
  if (sessionDone && activeWords) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center p-4">
        <CelebrationScreen
          title="スペリング完了！ 🎉"
          subtitle={`You practiced ${activeWords.length} word${activeWords.length !== 1 ? 's' : ''}`}
          onClose={handleClose}
          closeLabel="Back to Decks"
        />
      </div>
    )
  }

  if (loading) return <div className="h-48 bg-gray-200 rounded-lg animate-pulse" />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">🔤 スペリング / Spelling</h1>
        <p className="text-gray-500 text-sm mt-1">単語のつづりを練習しよう</p>
      </div>

      {decks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-4xl mb-3">🔤</p>
            <p className="text-gray-500">単語がまだありません。</p>
            <p className="text-sm text-gray-400 mt-1">Your teacher will assign vocabulary here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {decks.map(deck => {
            const eligible = deck.words.filter(w => w.word.trim().length >= 2)
            return (
              <Card key={deck.deckId ?? '__none__'}>
                <CardContent className="py-4 space-y-3">
                  <div>
                    <h2 className="font-semibold text-gray-900">{deck.deckName}</h2>
                    <p className="text-sm text-gray-500">{eligible.length} word{eligible.length !== 1 ? 's' : ''}</p>
                  </div>
                  <button
                    onClick={() => startDeck(deck)}
                    className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand/90 transition-colors"
                  >
                    Start Spelling
                  </button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
