import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { VocabularyFlashcard } from '@/components/lesson/VocabularyFlashcard'
import { StudySession } from '@/components/lesson/StudySession'
import type { VocabularyBankEntry } from '@/lib/types/database'
import { PageError } from '@/components/shared/PageError'
import { AnkiImporter } from '@/components/students/AnkiImporter'

const MASTERY_LABELS = ['新しい', '見た', '覚えてる', 'マスター']
const MASTERY_LABELS_EN = ['New', 'Seen', 'Familiar', 'Mastered']

type DeckGroup = {
  deckId: string | null
  deckName: string
  words: VocabularyBankEntry[]
}

export function VocabularyPage() {
  const { user } = useAuth()
  const [vocab, setVocab] = useState<VocabularyBankEntry[]>([])
  const [deckNames, setDeckNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [studyCards, setStudyCards] = useState<VocabularyBankEntry[] | null>(null)
  const [view, setView] = useState<'decks' | 'mastery'>('decks')

  async function loadVocab() {
    if (!user) return
    try {
      const { data, error: err } = await supabase
        .from('vocabulary_bank')
        .select('*')
        .eq('student_id', user.id)
        .order('created_at', { ascending: false })
      if (err) throw err

      const entries = data ?? []
      setVocab(entries)

      const deckIds = [...new Set(entries.map(v => v.deck_id).filter(Boolean) as string[])]
      if (deckIds.length > 0) {
        const { data: decks } = await supabase
          .from('vocabulary_decks')
          .select('id, name')
          .in('id', deckIds)
        if (decks) {
          const map: Record<string, string> = {}
          for (const d of decks) map[d.id] = d.name
          setDeckNames(map)
        }
      }
      setError(null)
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load vocabulary')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadVocab() }, [user])

  if (error) return <PageError message={error} onRetry={loadVocab} />

  if (loading) {
    return <div className="h-48 bg-gray-200 rounded-lg animate-pulse" />
  }

  const dueForReview = vocab.filter(v => {
    if (!v.next_review) return v.mastery_level < 3
    return new Date(v.next_review) <= new Date()
  })

  // Build deck groups
  const deckGroupMap = new Map<string | null, DeckGroup>()
  for (const v of vocab) {
    const dId = v.deck_id ?? null
    if (!deckGroupMap.has(dId)) {
      const deckName = dId ? (deckNames[dId] ?? 'Assigned Deck') : 'その他 / Other'
      deckGroupMap.set(dId, { deckId: dId, deckName, words: [] })
    }
    deckGroupMap.get(dId)!.words.push(v)
  }
  // Named decks first, then ungrouped
  const deckGroups = [...deckGroupMap.values()].sort((a, b) => {
    if (a.deckId && !b.deckId) return -1
    if (!a.deckId && b.deckId) return 1
    return a.deckName.localeCompare(b.deckName)
  })

  const byMastery = [0, 1, 2, 3].map(level => ({
    level,
    words: vocab.filter(v => v.mastery_level === level),
  }))

  return (
    <>
      {studyCards && (
        <StudySession
          cards={studyCards}
          onClose={() => setStudyCards(null)}
          onComplete={() => { setStudyCards(null); loadVocab() }}
        />
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">単語 / Vocabulary</h1>
            <p className="text-gray-500 text-sm mt-1">
              {vocab.length}語 collected · {dueForReview.length} due for review
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            <AnkiImporter studentId={user!.id} onImported={loadVocab} />
            {dueForReview.length > 0 && (
              <button
                onClick={() => setStudyCards(dueForReview)}
                className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors"
              >
                復習 ({dueForReview.length})
              </button>
            )}
            {vocab.length > 0 && (
              <button
                onClick={() => setStudyCards([...vocab])}
                className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand/90 transition-colors"
              >
                全部学習
              </button>
            )}
          </div>
        </div>

        {/* View toggle */}
        {vocab.length > 0 && (
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
            <button
              onClick={() => setView('decks')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${view === 'decks' ? 'bg-white shadow-sm font-medium text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              デッキ別
            </button>
            <button
              onClick={() => setView('mastery')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${view === 'mastery' ? 'bg-white shadow-sm font-medium text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              レベル別
            </button>
          </div>
        )}

        {/* Due for review banner */}
        {dueForReview.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-orange-600 uppercase tracking-wide">
              復習が必要 / Review Due ({dueForReview.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {dueForReview.map(word => (
                <VocabularyFlashcard key={word.id} entry={word} onMasteryChanged={loadVocab} />
              ))}
            </div>
          </section>
        )}

        {/* Deck view */}
        {view === 'decks' && deckGroups.map(({ deckId, deckName, words }) => (
          <section key={deckId ?? '__other__'} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-gray-600 uppercase tracking-wide">
                {deckName} ({words.length})
              </h2>
              <button
                onClick={() => setStudyCards(words)}
                className="text-xs text-gray-400 hover:text-brand transition-colors"
              >
                このデッキを学習 →
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {words.map(word => (
                <VocabularyFlashcard key={word.id} entry={word} onMasteryChanged={loadVocab} />
              ))}
            </div>
          </section>
        ))}

        {/* Mastery view */}
        {view === 'mastery' && byMastery.map(({ level, words }) =>
          words.length === 0 ? null : (
            <section key={level} className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                  {MASTERY_LABELS[level]} / {MASTERY_LABELS_EN[level]} ({words.length})
                </h2>
                <button
                  onClick={() => setStudyCards(words)}
                  className="text-xs text-gray-400 hover:text-brand transition-colors"
                >
                  Study this group →
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {words.map(word => (
                  <VocabularyFlashcard key={word.id} entry={word} onMasteryChanged={loadVocab} />
                ))}
              </div>
            </section>
          )
        )}

        {vocab.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500">単語がまだありません。</p>
              <p className="text-sm text-gray-400 mt-1">Your teacher will add vocabulary words from your lessons here.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
