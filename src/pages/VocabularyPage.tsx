import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { VocabularyFlashcard } from '@/components/lesson/VocabularyFlashcard'
import { StudySession } from '@/components/lesson/StudySession'
import type { VocabularyBankEntry } from '@/lib/types/database'

const MASTERY_LABELS = ['新しい', '見た', '覚えてる', 'マスター']
const MASTERY_LABELS_EN = ['New', 'Seen', 'Familiar', 'Mastered']

export function VocabularyPage() {
  const { user } = useAuth()
  const [vocab, setVocab] = useState<VocabularyBankEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [studyCards, setStudyCards] = useState<VocabularyBankEntry[] | null>(null)

  async function loadVocab() {
    if (!user) return
    const { data } = await supabase
      .from('vocabulary_bank')
      .select('*')
      .eq('student_id', user.id)
      .order('mastery_level', { ascending: true })
      .order('created_at', { ascending: false })

    setVocab(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadVocab()
  }, [user])

  if (loading) {
    return <div className="h-48 bg-gray-200 rounded-lg animate-pulse" />
  }

  const dueForReview = vocab.filter(v => {
    if (!v.next_review) return v.mastery_level < 3
    return new Date(v.next_review) <= new Date()
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
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">単語 / Vocabulary</h1>
            <p className="text-gray-500 text-sm mt-1">
              {vocab.length}語 collected · {dueForReview.length} due for review
            </p>
          </div>

          {vocab.length > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              {dueForReview.length > 0 && (
                <button
                  onClick={() => setStudyCards(dueForReview)}
                  className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors"
                >
                  Review Due ({dueForReview.length})
                </button>
              )}
              <button
                onClick={() => setStudyCards([...vocab])}
                className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand/90 transition-colors"
              >
                Study All
              </button>
            </div>
          )}
        </div>

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

        {byMastery.map(({ level, words }) =>
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
