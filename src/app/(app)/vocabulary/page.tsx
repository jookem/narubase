import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { VocabularyFlashcard } from '@/components/lesson/VocabularyFlashcard'

const MASTERY_LABELS = ['新しい', '見た', '覚えてる', 'マスター']
const MASTERY_LABELS_EN = ['New', 'Seen', 'Familiar', 'Mastered']

export default async function VocabularyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: vocab } = await supabase
    .from('vocabulary_bank')
    .select('*')
    .eq('student_id', user.id)
    .order('mastery_level', { ascending: true })
    .order('created_at', { ascending: false })

  const byMastery = [0, 1, 2, 3].map(level => ({
    level,
    words: (vocab ?? []).filter(v => v.mastery_level === level),
  }))

  const dueForReview = (vocab ?? []).filter(v => {
    if (!v.next_review) return false
    return new Date(v.next_review) <= new Date()
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">単語 / Vocabulary</h1>
        <p className="text-gray-500 text-sm mt-1">
          {vocab?.length ?? 0}語 collected · {dueForReview.length} due for review
        </p>
      </div>

      {/* Due for review */}
      {dueForReview.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-orange-600 uppercase tracking-wide">
            復習が必要 / Review Due ({dueForReview.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {dueForReview.map(word => (
              <VocabularyFlashcard key={word.id} entry={word} />
            ))}
          </div>
        </section>
      )}

      {/* By mastery level */}
      {byMastery.map(({ level, words }) =>
        words.length === 0 ? null : (
          <section key={level} className="space-y-3">
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              {MASTERY_LABELS[level]} / {MASTERY_LABELS_EN[level]} ({words.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {words.map(word => (
                <VocabularyFlashcard key={word.id} entry={word} />
              ))}
            </div>
          </section>
        )
      )}

      {(vocab?.length ?? 0) === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">単語がまだありません。</p>
            <p className="text-sm text-gray-400 mt-1">Your teacher will add vocabulary words from your lessons here.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
