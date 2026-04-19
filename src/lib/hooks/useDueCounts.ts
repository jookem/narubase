import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export interface DueCounts {
  grammar: number
  vocab: number
  total: number
}

const today = () => new Date().toISOString().split('T')[0]

export function useDueCounts() {
  const { user } = useAuth()
  const [counts, setCounts] = useState<DueCounts>({ grammar: 0, vocab: 0, total: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }

    async function fetch() {
      const [grammarRes, vocabRes] = await Promise.all([
        supabase
          .from('grammar_bank')
          .select('id', { count: 'exact', head: true })
          .eq('student_id', user!.id)
          .lte('next_review', today())
          .lt('mastery_level', 3),

        supabase
          .from('vocabulary_bank')
          .select('id', { count: 'exact', head: true })
          .eq('student_id', user!.id)
          .eq('is_active', true)
          .lte('next_review', today())
          .lt('mastery_level', 3),
      ])

      const grammar = grammarRes.count ?? 0
      const vocab = vocabRes.count ?? 0
      setCounts({ grammar, vocab, total: grammar + vocab })
      setLoading(false)
    }

    fetch()
  }, [user])

  return { counts, loading }
}
