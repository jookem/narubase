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
import { toast } from 'sonner'
import { Emoji } from '@/components/shared/Emoji'

interface PartnerPresence {
  role: string
  vrmUrl: string | null
  animationMap: Record<string, string>
  currentNodeId?: string
  ack?: boolean
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
  const myRole    = myRoleIdx >= 0 ? duoRoles[myRoleIdx] : duoRoles[0]
  const partnerRole = myRoleIdx === 1 ? duoRoles[0] : duoRoles[1]

  // role A (index 0) always on LEFT, role B (index 1) always on RIGHT — consistent across both screens
  const iAmRoleB = myRoleIdx === 1

  const [myVrmUrl, setMyVrmUrl] = useState<string | null>(null)
  const [myAnimationMap, setMyAnimationMap] = useState<Record<string, string>>({})
  const [partner, setPartner] = useState<PartnerPresence | null>(null)
  const [partnerJoined, setPartnerJoined] = useState(false)

  const [currentNodeId, setCurrentNodeId] = useState('start')
  const [transcript, setTranscript] = useState<Array<{ speaker: string; text: string }>>([])
  const [phase, setPhase] = useState<'waiting' | 'playing'>('waiting')

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const currentNode = nodes.find(n => n.id === currentNodeId) ?? null

  // Broadcast handlers below are set up once (inside setupChannel) and would
  // otherwise close over the currentNodeId from that render forever — a ref
  // keeps them reading the live value.
  const currentNodeIdRef = useRef(currentNodeId)
  useEffect(() => { currentNodeIdRef.current = currentNodeId }, [currentNodeId])

  useEffect(() => {
    if (!user) return
    loadMyAvatar()
    // Depend on the stable id, not the `user` object — AuthContext hands
    // back a new object on every SIGNED_IN/USER_UPDATED event, which would
    // otherwise open a second channel subscription on top of the first
    // (the cleanup effect below only unsubscribes on unmount).
  }, [user?.id])

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

  // Realtime broadcasts aren't replayed for late subscribers — if one
  // student's page connects and races through the opening line(s) before
  // the other's channel finishes subscribing, that "advance" broadcast is
  // simply lost. Both sides then sit on different nodes forever, each
  // showing "waiting for the other to speak". `join` (sent on connect and
  // whenever a partner is (re)discovered) now carries the sender's current
  // node, so whichever side is behind catches up to the other automatically.
  function syncToFurthestNode(theirNodeId: string | undefined) {
    if (!theirNodeId || theirNodeId === currentNodeIdRef.current) return
    const myIdx = nodes.findIndex(n => n.id === currentNodeIdRef.current)
    const theirIdx = nodes.findIndex(n => n.id === theirNodeId)
    if (theirIdx > myIdx) setCurrentNodeId(theirNodeId)
  }

  function setupChannel(myVrm: string | null, myMap: Record<string, string>) {
    const channelName = `duo-${situation.id}`
    const ch = supabase.channel(channelName, { config: { broadcast: { self: false } } })

    ch.on('broadcast', { event: 'join' }, ({ payload }: { payload: PartnerPresence }) => {
      setPartner(payload)
      setPartnerJoined(true)
      setPhase('playing')
      syncToFurthestNode(payload.currentNodeId)
      // Reply once so the partner learns about us too — guarded by `ack` so
      // the two sides don't bounce `join` back and forth forever.
      if (!payload.ack) {
        ch.send({
          type: 'broadcast', event: 'join',
          payload: { role: myRole, vrmUrl: myVrm, animationMap: myMap, currentNodeId: currentNodeIdRef.current, ack: true },
        })
      }
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
        ch.send({
          type: 'broadcast', event: 'join',
          payload: { role: myRole, vrmUrl: myVrm, animationMap: myMap, currentNodeId: currentNodeIdRef.current },
        })
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
    if (!fromPartner && user) {
      await saveSituationSession(user.id, situation.id, null, transcript)
    }
    onExit()
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
        <div className="text-4xl"><Emoji>🎭</Emoji></div>
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

  if (!currentNode) return null

  const isEnd = !currentNode.next

  // left slot = role A (duoRoles[0]), right slot = role B (duoRoles[1])
  const leftVrmUrl  = iAmRoleB ? (partner?.vrmUrl ?? null)    : myVrmUrl
  const leftAnim    = iAmRoleB ? (partner?.animationMap ?? {}) : myAnimationMap
  const rightVrmUrl = iAmRoleB ? myVrmUrl                     : (partner?.vrmUrl ?? null)
  const rightAnim   = iAmRoleB ? myAnimationMap               : (partner?.animationMap ?? {})

  return (
    <RPGDialogueBox
      npc={null}
      studentVrmUrl={rightVrmUrl}
      studentName={duoRoles[1]}
      currentNode={currentNode}
      background={{ color: situation.background_color, imageUrl: situation.background_image_url }}
      studentAnimationMap={rightAnim}
      onExit={onExit}
      onContinue={() => advance(currentNode)}
      onSelectOption={() => {}}
      isEnd={isEnd}
      onComplete={() => advance(currentNode)}
      duo={{
        myRole,
        partnerRole,
        leftRole: duoRoles[0],
        partnerVrmUrl: leftVrmUrl,
        partnerAnimationMap: leftAnim,
        onKaraokeAdvance: () => advance(currentNode),
      }}
    />
  )
}
