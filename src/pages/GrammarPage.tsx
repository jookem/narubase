import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { listGrammar, type GrammarBankEntry } from '@/lib/api/grammar'
import { Card, CardContent } from '@/components/ui/card'
import { GrammarSession } from '@/components/grammar/GrammarSession'
import { PageError } from '@/components/shared/PageError'

const MASTERY_LABELS = ['新しい', '見た', '覚えてる', 'マスター']
const MASTERY_LABELS_EN = ['New', 'Seen', 'Familiar', 'Mastered']
const MASTERY_COLORS = [
  'bg-gray-100 text-gray-500',
  'bg-yellow-100 text-yellow-700',
  'bg-brand-light text-brand-dark',
  'bg-green-100 text-green-700',
]

export function GrammarPage() {
  const { user } = useAuth()
  const [entries, setEntries] = useState<GrammarBankEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [studyCards, setStudyCards] = useState<GrammarBankEntry[] | null>(null)

  async function load() {
    if (!user) return
    try {
      const { entries: e, error: err } = await listGrammar(user.id)
      if (err) throw new Error(String(err))
      setEntries(e ?? [])
      setError(null)
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load grammar')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [user])

  if (error) return <PageError message={error} onRetry={load} />
  if (loading) return <div className="h-48 bg-gray-200 rounded-lg animate-pulse" />

  const due = entries.filter(e => {
    if (!e.next_review) return e.mastery_level < 3
    return new Date(e.next_review) <= new Date()
  })

  const byMastery = [0, 1, 2, 3].map(level => ({
    level,
    items: entries.filter(e => e.mastery_level === level),
  }))

  return (
    <>
      {studyCards && (
        <GrammarSession
          cards={studyCards}
          onClose={() => setStudyCards(null)}
          onComplete={() => { setStudyCards(null); load() }}
        />
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-3">
          <div>
            <h1 className="text-2xl font-semibold">文法 / Grammar</h1>
            <p className="text-gray-500 text-sm mt-1">
              {entries.length}点 collected · {due.length} due for review
            </p>
          </div>
          {entries.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {due.length > 0 && (
                <button
                  onClick={() => setStudyCards(due)}
                  className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors"
                >
                  復習 ({due.length})
                </button>
              )}
              <button
                onClick={() => setStudyCards([...entries])}
                className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand/90 transition-colors"
              >
                全部学習
              </button>
            </div>
          )}
        </div>

        {/* Due section */}
        {due.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-orange-600 uppercase tracking-wide">
              復習が必要 / Review Due ({due.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {due.map(e => <GrammarCard key={e.id} entry={e} onStudy={() => setStudyCards([e])} />)}
            </div>
          </section>
        )}

        {/* By mastery */}
        {byMastery.map(({ level, items }) =>
          items.length === 0 ? null : (
            <section key={level} className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                  {MASTERY_LABELS[level]} / {MASTERY_LABELS_EN[level]} ({items.length})
                </h2>
                <button
                  onClick={() => setStudyCards(items)}
                  className="text-xs text-gray-400 hover:text-brand transition-colors"
                >
                  Study this group →
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map(e => <GrammarCard key={e.id} entry={e} onStudy={() => setStudyCards([e])} />)}
              </div>
            </section>
          )
        )}

        {entries.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center space-y-2">
              <p className="text-4xl">📖</p>
              <p className="text-gray-600 font-medium">文法がまだありません。</p>
              <p className="text-sm text-gray-400">Your teacher will add grammar points from your lessons here.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}

function GrammarCard({ entry, onStudy }: { entry: GrammarBankEntry; onStudy: () => void }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-4 pb-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-lg font-bold text-gray-900">{entry.point}</p>
          <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${MASTERY_COLORS[entry.mastery_level]}`}>
            {MASTERY_LABELS_EN[entry.mastery_level]}
          </span>
        </div>
        <p className="text-sm text-gray-600">{entry.explanation}</p>
        {entry.examples.length > 0 && (
          <p className="text-xs text-gray-400 italic">"{entry.examples[0]}"</p>
        )}
        <button
          onClick={onStudy}
          className="text-xs text-brand hover:text-brand/80 transition-colors mt-1"
        >
          Practice →
        </button>
      </CardContent>
    </Card>
  )
}
