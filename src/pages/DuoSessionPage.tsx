import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { getSituationScript, type Situation, type DialogueNode } from '@/lib/api/situations'
import { DuoSituationSimulator } from '@/components/situation/DuoSituationSimulator'
import { useNavigate } from 'react-router-dom'

export function DuoSessionPage() {
  const { situationId } = useParams<{ situationId: string }>()
  const navigate = useNavigate()

  const [situation, setSituation] = useState<Situation | null>(null)
  const [nodes, setNodes] = useState<DialogueNode[]>([])
  const [duoRoles, setDuoRoles] = useState<[string, string] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!situationId) return
    load()
  }, [situationId])

  async function load() {
    const [{ data: sit }, { script, error: scriptErr }] = await Promise.all([
      supabase.from('situations').select('*, npc:situation_npcs(*)').eq('id', situationId!).single(),
      getSituationScript(situationId!),
    ])

    if (!sit || scriptErr || !script) {
      setError('Could not load this session.')
      setLoading(false)
      return
    }

    if (sit.mode !== 'duo' || !script.script.duo_roles) {
      setError('This situation is not set up as a duo session.')
      setLoading(false)
      return
    }

    setSituation(sit as Situation)
    setNodes(script.script.nodes)
    setDuoRoles(script.script.duo_roles)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !situation || !duoRoles) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex flex-col items-center justify-center gap-4 text-white p-6">
        <p className="text-red-400 text-sm">{error ?? 'Something went wrong.'}</p>
        <button onClick={() => navigate(-1)} className="px-4 py-2 bg-white/10 rounded-lg text-sm hover:bg-white/20 transition-colors">
          Go back
        </button>
      </div>
    )
  }

  return (
    <DuoSituationSimulator
      situation={situation}
      duoRoles={duoRoles}
      nodes={nodes}
      onExit={() => navigate(-1)}
    />
  )
}
