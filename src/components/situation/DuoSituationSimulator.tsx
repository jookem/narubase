import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  getSituationScript,
  listVrmAnimations,
  saveSituationSession,
  type Situation,
  type DialogueNode,
  type VrmGender,
} from '@/lib/api/situations'
import { RPGDialogueBox } from './RPGDialogueBox'
import { CelebrationScreen } from '@/components/shared/CelebrationScreen'
import { toast } from 'sonner'

interface PartnerPresence {
  role: string
  vrmUrl: string | null
  animationMap: Record<string, string>
}

interface Props {
  situation: Situation
  duoRoles: [string, string]
  nodes: DialogueNode[]
  onExit: () => void
}

export function DuoSituationSimulator({ situation, duoRoles, nodes, onExit }: Props) {
  const { user, profile } = useAuth()

  const myName = profile?.display_name ?? profile?.full_name ?? ''
  const myRoleIdx = duoRoles.findIndex(r => r.toLowerCase() === myName.toLowerCase())
  const myRole = myRoleIdx >= 0 ? duoRoles[myRoleIdx] : duoRoles[0]
  const partnerRole = myRoleIdx === 0 ? duoRoles[1] : duoRoles[0]

  const [myVrmUrl, setMyVrmUrl] = useState<string | null>(null)
  const [myAnimationMap, setMyAnimationMap] = useState<Record<string, string>>({})
  const [partner, setPartner] = useState<PartnerPresence | null>(null)
  const [partnerJoined, setPartnerJoined] = useState(false)

  const [currentNodeId, setCurrentNodeId] = useState('start')
  const [transcript, setTranscript] = useState<Array<{ speaker: string; text: string }>>([])
  const [phase, setPhase] = useState<'waiting' | 'playing' | 'complete'>('waiting')

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const currentNode = nodes.find(n => n.id === currentNodeId) ?? null

  useEffect(() => {
    if (!user) return
    loadMyAvatar()
  }, [user])

  async function loadMyAvatar() {
    const { data } = await supabase
      .from('student_details')
      .select('vrm_url, vrm_gender')
      .eq('student_id', user!.id)
      .maybeSingle()

    const url = data?.vrm_url ?? null
    const gender: VrmGender = (data?.vrm_gender as VrmGender) ?? 'neutral'
    setMyVrmUrl(url)
    const map = await listVrmAnimations(gender)
    setMyAnimationMap(map)
    setupChannel(url, map)
  }

  function setupChannel(myVrm: string | null, myMap: Record<string, string>) {
    const channelName = `duo-${situation.id}`
    const ch = supabase.channel(channelName, { config: { broadcast: { self: false } } })

    ch.on('broadcast', { event: 'join' }, ({ payload }: { payload: PartnerPresence }) => {
      setPartner(payload)
      setPartnerJoined(true)
      if (phase === 'waiting') setPhase('playing')
      // Respond with our own presence so the partner knows us
      ch.send({ type: 'broadcast', event: 'join', payload: { role: myRole, vrmUrl: myVrm, animationMap: myMap } })
    })

    ch.on('broadcast', { event: 'advance' }, ({ payload }: { payload: { nextNodeId: string | null; speakerText: string; speakerRole: string } }) => {
      setTranscript(prev => [...prev, { speaker: payload.speakerRole, text: payload.speakerText }])
      if (payload.nextNodeId) {
        setCurrentNodeId(payload.nextNodeId)
      } else {
        handleComplete(true)
      }
    })

    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        ch.send({ type: 'broadcast', event: 'join', payload: { role: myRole, vrmUrl: myVrm, animationMap: myMap } })
        setPhase('playing')
      }
    })

    channelRef.current = ch
  }

  useEffect(() => {
    return () => {
      channelRef.current?.unsubscribe()
    }
  }, [])

  function advance(node: DialogueNode) {
    const nextId = node.next ?? null
    const ch = channelRef.current
    if (ch) {
      ch.send({
        type: 'broadcast',
        event: 'advance',
        payload: { nextNodeId: nextId, speakerText: node.text ?? '', speakerRole: node.speaker },
      })
    }
    setTranscript(prev => [...prev, { speaker: node.speaker, text: node.text ?? '' }])
    if (nextId) {
      setCurrentNodeId(nextId)
    } else {
      handleComplete(false)
    }
  }

  async function handleComplete(fromPartner: boolean) {
    setPhase('complete')
    if (!fromPartner && user && activeSituation) {
      await saveSituationSession(user.id, activeSituation.id, null, transcript)
    }
  }

  const activeSituation = situation

  // ── Waiting screen ──────────────────────────────────────────────

  if (phase === 'waiting') {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center p-6 text-white gap-6">
        <button
          onClick={onExit}
          className="absolute top-3 left-3 px-3 py-1.5 bg-black/60 hover:bg-black/80 text-white text-sm rounded-lg transition-colors"
        >
          ← Exit
        </button>
        <div className="text-4xl">🎭</div>
        <div className="text-center space-y-1">
          <p className="font-semibold text-lg">{situation.title}</p>
          <p className="text-gray-400 text-sm">You are: <span className="text-white font-medium">{myRole}</span></p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          Waiting for {partnerRole} to join…
        </div>
        <p className="text-xs text-gray-600 max-w-xs text-center">
          Both students need to open this page to begin the scene.
        </p>
      </div>
    )
  }

  // ── Complete screen ─────────────────────────────────────────────

  if (phase === 'complete') {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center p-4">
        <CelebrationScreen
          title="Scene Complete!"
          subtitle={`Great job in "${situation.title}"!`}
          onClose={onExit}
          closeLabel="Back to Situations"
        />
      </div>
    )
  }

  if (!currentNode) return null

  const isEnd = !currentNode.next

  return (
    <RPGDialogueBox
      npc={null}
      studentVrmUrl={myVrmUrl}
      studentName={myRole}
      currentNode={currentNode}
      background={{ color: situation.background_color, imageUrl: situation.background_image_url }}
      studentAnimationMap={myAnimationMap}
      onExit={onExit}
      onContinue={() => advance(currentNode)}
      onSelectOption={() => {}}
      isEnd={isEnd}
      onComplete={() => advance(currentNode)}
      duo={{
        myRole,
        partnerRole,
        partnerVrmUrl: partner?.vrmUrl ?? null,
        partnerAnimationMap: partner?.animationMap,
        onKaraokeAdvance: () => advance(currentNode),
      }}
    />
  )
}
