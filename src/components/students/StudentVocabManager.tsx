import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { addVocabularyToBank, deleteVocabEntry } from '@/lib/api/lessons'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import type { VocabularyBankEntry } from '@/lib/types/database'

const MASTERY_COLORS = [
  'bg-gray-100 text-gray-500',
  'bg-yellow-100 text-yellow-700',
  'bg-brand-light text-brand-dark',
  'bg-green-100 text-green-700',
]
const MASTERY_LABELS = ['New', 'Seen', 'Familiar', 'Mastered']

interface Props {
  studentId: string
}

export function StudentVocabManager({ studentId }: Props) {
  const [vocab, setVocab] = useState<VocabularyBankEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [word, setWord] = useState('')
  const [defEn, setDefEn] = useState('')
  const [defJa, setDefJa] = useState('')
  const [example, setExample] = useState('')

  async function load() {
    const { data, error } = await supabase
      .from('vocabulary_bank')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
    if (error) console.error('VocabManager load error:', error.message)
    setVocab(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [studentId])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!word.trim() || !defEn.trim()) return
    setSaving(true)
    const result = await addVocabularyToBank([{
      student_id: studentId,
      word: word.trim(),
      definition_en: defEn.trim(),
      definition_ja: defJa.trim() || undefined,
      example: example.trim() || undefined,
    }])
    setSaving(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      setWord('')
      setDefEn('')
      setDefJa('')
      setExample('')
      // Reload directly from DB to show the saved word
      const { data, error: loadError } = await supabase
        .from('vocabulary_bank')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
      if (loadError) {
        toast.error('Word saved but failed to reload list: ' + loadError.message)
      } else {
        setVocab(data ?? [])
        toast.success(`"${word.trim()}" added to vocab bank`)
      }
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    const { error } = await deleteVocabEntry(id)
    setDeleting(null)
    if (error) {
      toast.error(error)
    } else {
      setVocab(prev => prev.filter(v => v.id !== id))
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span>Vocabulary Bank</span>
          {!loading && (
            <span className="text-xs font-normal text-gray-400">{vocab.length} word{vocab.length !== 1 ? 's' : ''}</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add word form */}
        <form onSubmit={handleAdd} className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={word}
              onChange={e => setWord(e.target.value)}
              placeholder="Word *"
              required
            />
            <Input
              value={defEn}
              onChange={e => setDefEn(e.target.value)}
              placeholder="English definition *"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={defJa}
              onChange={e => setDefJa(e.target.value)}
              placeholder="Japanese definition (optional)"
            />
            <Input
              value={example}
              onChange={e => setExample(e.target.value)}
              placeholder="Example sentence (optional)"
            />
          </div>
          <button
            type="submit"
            disabled={saving || !word.trim() || !defEn.trim()}
            className="px-4 py-1.5 bg-brand text-white text-sm rounded-md hover:bg-brand/90 transition-colors disabled:opacity-50"
          >
            {saving ? 'Adding…' : '+ Add Word'}
          </button>
        </form>

        {/* Word list */}
        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : vocab.length === 0 ? (
          <p className="text-sm text-gray-400">No vocabulary added yet.</p>
        ) : (
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {vocab.map(v => (
              <div key={v.id} className="flex items-start gap-2 py-2 border-b border-gray-100 last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-gray-900">{v.word}</span>
                    {v.reading && <span className="text-xs text-gray-400">{v.reading}</span>}
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${MASTERY_COLORS[v.mastery_level]}`}>
                      {MASTERY_LABELS[v.mastery_level]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">{v.definition_en}</p>
                  {v.definition_ja && <p className="text-xs text-gray-400">{v.definition_ja}</p>}
                  {v.example && <p className="text-xs text-gray-400 italic">"{v.example}"</p>}
                </div>
                <button
                  onClick={() => handleDelete(v.id)}
                  disabled={deleting === v.id}
                  className="text-xs text-gray-300 hover:text-red-500 transition-colors shrink-0 disabled:opacity-50 pt-0.5"
                >
                  {deleting === v.id ? '…' : 'Remove'}
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
