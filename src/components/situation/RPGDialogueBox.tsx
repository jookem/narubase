import { useState, useEffect } from 'react'
import type { SituationNpc, DialogueNode } from '@/lib/api/situations'
import { VRMViewer, type VRMExpression } from '@/components/vrm/VRMViewer'
import { KaraokeLineSpeaker } from './KaraokeLineSpeaker'

const EXPR_MAP: Record<string, VRMExpression> = {
  neutral:  'neutral',
  speaking: 'neutral',
  positive: 'happy',
  confused: 'surprised',
  thinking: 'relaxed',
}

export interface DuoConfig {
  myRole: string
  partnerRole: string
  partnerVrmUrl?: string | null
  partnerAnimationMap?: Record<string, string>
  onKaraokeAdvance: () => void
}

interface Props {
  npc: SituationNpc | null
  studentVrmUrl?: string | null
  studentName: string
  currentNode: DialogueNode
  background: { color: string; imageUrl?: string | null }
  npcAnimationMap?: Record<string, string>
  studentAnimationMap?: Record<string, string>
  onExit: () => void
  onContinue: () => void
  onSelectOption: (index: number) => void
  isEnd: boolean
  onComplete: () => void
  duo?: DuoConfig
}

// ── Responsive hook ───────────────────────────────────────────────────
// Desktop = sm breakpoint (640px), matching Tailwind's default sm.

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' ? window.matchMedia('(min-width: 640px)').matches : false,
  )
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)')
    const h = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])
  return isDesktop
}

// ── Desktop constants ─────────────────────────────────────────────────
// cameraOffsetX shifts camera & target so each character renders on the
// correct half of the shared full-screen canvas.

const NPC_OFFSET     =  0.28
const STUDENT_OFFSET = -0.28

// ── VRM portrait ──────────────────────────────────────────────────────

function VRMPortrait({
  url, label, dim, expression, facingDirection, animationMap, side, isDesktop,
}: {
  url: string
  label: string
  dim: boolean
  expression: VRMExpression
  facingDirection: 'left' | 'right'
  animationMap?: Record<string, string>
  side: 'left' | 'right'
  isDesktop: boolean
}) {
  if (isDesktop) {
    const offset = side === 'left' ? NPC_OFFSET : STUDENT_OFFSET
    return (
      <div className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${dim ? 'opacity-30' : 'opacity-100'}`}>
        <span className={`absolute top-3 ${side === 'left' ? 'left-3' : 'right-3'} z-10 text-[11px] font-medium text-white/80 bg-black/60 px-2.5 py-0.5 rounded-full whitespace-nowrap backdrop-blur-sm`}>
          {label}
        </span>
        <VRMViewer
          url={url}
          expression={expression}
          animationMap={animationMap}
          autoBlink
          orbitControls={false}
          showGrid={false}
          facingDirection={facingDirection}
          framing="bust"
          cameraOffsetX={offset}
          transparent
          className="w-full h-full"
        />
      </div>
    )
  }

  // Mobile — circular head portrait
  return (
    <div className={`flex flex-col items-center gap-1.5 pointer-events-none transition-all duration-300 ${dim ? 'opacity-35' : 'opacity-100'}`}>
      <div className={`w-full aspect-square rounded-full overflow-hidden ring-2 transition-all duration-300 ${dim ? 'ring-white/20' : 'ring-white/60'}`}>
        <VRMViewer
          url={url}
          expression={expression}
          animationMap={animationMap}
          autoBlink
          orbitControls={false}
          showGrid={false}
          facingDirection={facingDirection}
          framing="head"
          transparent
          className="w-full h-full"
        />
      </div>
      <span className="text-[11px] font-medium text-white/80 bg-black/60 px-2.5 py-0.5 rounded-full whitespace-nowrap backdrop-blur-sm">
        {label}
      </span>
    </div>
  )
}

// ── Fallback portrait (no VRM) ────────────────────────────────────────

function FallbackPortrait({
  color, initial, label, dim, side, isDesktop,
}: {
  color: string
  initial: string
  label: string
  dim: boolean
  side: 'left' | 'right'
  isDesktop: boolean
}) {
  if (isDesktop) {
    return (
      <div className={`absolute bottom-6 ${side === 'left' ? 'left-6' : 'right-6'} flex flex-col items-center gap-1.5 transition-all duration-300 ${dim ? 'opacity-30 scale-95' : 'opacity-100 scale-100'}`}>
        <span className="text-[11px] font-medium text-white/80 bg-black/60 px-2.5 py-0.5 rounded-full whitespace-nowrap backdrop-blur-sm">
          {label}
        </span>
        <div
          className="w-24 h-24 rounded-full border-4 border-white/20 shadow-2xl flex items-center justify-center text-white text-4xl font-bold"
          style={{ backgroundColor: color }}
        >
          {initial}
        </div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${dim ? 'opacity-35 scale-95' : 'opacity-100 scale-100'}`}>
      <div
        className="w-full aspect-square rounded-full ring-2 ring-white/40 shadow-2xl flex items-center justify-center text-white text-4xl font-bold"
        style={{ backgroundColor: color }}
      >
        {initial}
      </div>
      <span className="text-[11px] font-medium text-white/80 bg-black/60 px-2.5 py-0.5 rounded-full whitespace-nowrap backdrop-blur-sm">
        {label}
      </span>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────

export function RPGDialogueBox({
  npc,
  studentVrmUrl,
  studentName,
  currentNode,
  background,
  npcAnimationMap,
  studentAnimationMap,
  onExit,
  onContinue,
  onSelectOption,
  isEnd,
  onComplete,
  duo,
}: Props) {
  const isDesktop = useIsDesktop()
  const isNpcTurn     = currentNode.speaker === 'npc'
  const isStudentTurn = !duo && currentNode.speaker === 'student'
  const isMyDuoTurn   = !!duo && currentNode.speaker === duo.myRole
  const isPartnerTurn = !!duo && currentNode.speaker === duo.partnerRole

  const npcExpression: VRMExpression     = EXPR_MAP[currentNode.expression ?? 'neutral'] ?? 'neutral'
  const studentExpression: VRMExpression = (isStudentTurn || isMyDuoTurn) ? 'surprised' : 'neutral'
  const partnerExpression: VRMExpression = isPartnerTurn ? 'surprised' : 'neutral'

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      {/* Exit */}
      <button
        onClick={onExit}
        className="absolute top-3 left-3 z-30 px-3 py-1.5 bg-black/60 hover:bg-black/80 text-white text-sm rounded-lg transition-colors backdrop-blur-sm"
      >
        ← Exit
      </button>

      {/* Scene */}
      <div
        className={`flex-1 relative overflow-hidden ${isDesktop ? '' : 'flex items-center'}`}
        style={{
          backgroundColor: background.color,
          backgroundImage: background.imageUrl ? `url(${background.imageUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-900/70 to-transparent pointer-events-none z-10" />

        {/* Left character: NPC (standard) or partner (duo) */}
        {duo ? (
          isDesktop ? (
            duo.partnerVrmUrl ? (
              <VRMPortrait
                url={duo.partnerVrmUrl}
                label={duo.partnerRole}
                dim={isMyDuoTurn || isNpcTurn}
                expression={partnerExpression}
                facingDirection="right"
                animationMap={duo.partnerAnimationMap}
                side="left"
                isDesktop
              />
            ) : (
              <FallbackPortrait
                color="#6366f1"
                initial={duo.partnerRole[0] ?? 'P'}
                label={duo.partnerRole}
                dim={isMyDuoTurn || isNpcTurn}
                side="left"
                isDesktop
              />
            )
          ) : (
            <div className="w-1/2 flex justify-center items-center relative z-10 px-4">
              {duo.partnerVrmUrl ? (
                <VRMPortrait
                  url={duo.partnerVrmUrl}
                  label={duo.partnerRole}
                  dim={isMyDuoTurn || isNpcTurn}
                  expression={partnerExpression}
                  facingDirection="right"
                  animationMap={duo.partnerAnimationMap}
                  side="left"
                  isDesktop={false}
                />
              ) : (
                <FallbackPortrait
                  color="#6366f1"
                  initial={duo.partnerRole[0] ?? 'P'}
                  label={duo.partnerRole}
                  dim={isMyDuoTurn || isNpcTurn}
                  side="left"
                  isDesktop={false}
                />
              )}
            </div>
          )
        ) : (
          isDesktop ? (
            npc?.vrm_url ? (
              <VRMPortrait
                url={npc.vrm_url}
                label={npc.name ?? 'NPC'}
                dim={isStudentTurn}
                expression={npcExpression}
                facingDirection="right"
                animationMap={npcAnimationMap}
                side="left"
                isDesktop
              />
            ) : (
              <FallbackPortrait
                color={npc?.placeholder_color ?? '#6366f1'}
                initial={npc?.name?.[0] ?? 'N'}
                label={npc?.name ?? 'NPC'}
                dim={isStudentTurn}
                side="left"
                isDesktop
              />
            )
          ) : (
            <div className="w-1/2 flex justify-center items-center relative z-10 px-4">
              {npc?.vrm_url ? (
                <VRMPortrait
                  url={npc.vrm_url}
                  label={npc.name ?? 'NPC'}
                  dim={isStudentTurn}
                  expression={npcExpression}
                  facingDirection="right"
                  animationMap={npcAnimationMap}
                  side="left"
                  isDesktop={false}
                />
              ) : (
                <FallbackPortrait
                  color={npc?.placeholder_color ?? '#6366f1'}
                  initial={npc?.name?.[0] ?? 'N'}
                  label={npc?.name ?? 'NPC'}
                  dim={isStudentTurn}
                  side="left"
                  isDesktop={false}
                />
              )}
            </div>
          )
        )}

        {/* Right character: me (always) */}
        {isDesktop ? (
          studentVrmUrl ? (
            <VRMPortrait
              url={studentVrmUrl}
              label={studentName}
              dim={isNpcTurn || isPartnerTurn}
              expression={studentExpression}
              facingDirection="left"
              animationMap={studentAnimationMap}
              side="right"
              isDesktop
            />
          ) : (
            <FallbackPortrait
              color="#f59e0b"
              initial={studentName?.[0] ?? 'S'}
              label={studentName}
              dim={isNpcTurn || isPartnerTurn}
              side="right"
              isDesktop
            />
          )
        ) : (
          <div className="w-1/2 flex justify-center items-center relative z-10 px-4">
            {studentVrmUrl ? (
              <VRMPortrait
                url={studentVrmUrl}
                label={studentName}
                dim={isNpcTurn || isPartnerTurn}
                expression={studentExpression}
                facingDirection="left"
                animationMap={studentAnimationMap}
                side="right"
                isDesktop={false}
              />
            ) : (
              <FallbackPortrait
                color="#f59e0b"
                initial={studentName?.[0] ?? 'S'}
                label={studentName}
                dim={isNpcTurn || isPartnerTurn}
                side="right"
                isDesktop={false}
              />
            )}
          </div>
        )}
      </div>

      {/* Dialogue box */}
      <div className="bg-slate-900/95 backdrop-blur-sm border-t border-white/10 flex-shrink-0 relative z-20">
        {isNpcTurn && (
          <div className="px-5 pt-4 pb-5 space-y-3">
            {currentNode.text ? (
              <>
                <div>
                  <p className="text-xs font-bold text-indigo-300 tracking-wide mb-1.5">
                    {npc?.name} · {npc?.role}
                  </p>
                  <p className="text-white text-sm sm:text-base leading-relaxed">{currentNode.text}</p>
                </div>
                {isEnd ? (
                  <button
                    onClick={onComplete}
                    className="w-full py-3 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-bold rounded-xl transition-colors text-sm sm:text-base"
                  >
                    Scene Complete! ✓
                  </button>
                ) : (
                  <button
                    onClick={onContinue}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold rounded-xl transition-colors text-sm sm:text-base"
                  >
                    Continue →
                  </button>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 py-1">
                <p className="text-xs font-bold text-indigo-300 tracking-wide">{npc?.name}</p>
                <div className="flex gap-1 ml-1">
                  {[0, 1, 2].map(i => (
                    <span
                      key={i}
                      className="w-2 h-2 bg-white/50 rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {isStudentTurn && currentNode.options && (
          <div className="px-5 pt-3 pb-5 space-y-2">
            <p className="text-xs text-slate-400 font-medium mb-2">Choose what to say:</p>
            {currentNode.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => onSelectOption(i)}
                className="w-full text-left px-4 py-3 bg-slate-700/80 hover:bg-indigo-600 active:bg-indigo-700 text-white text-sm rounded-xl transition-colors border border-white/10 hover:border-indigo-400"
              >
                {opt.text}
              </button>
            ))}
          </div>
        )}

        {/* Duo: my karaoke turn */}
        {isMyDuoTurn && currentNode.text && duo && (
          <KaraokeLineSpeaker
            text={currentNode.text}
            speakerName={duo.myRole}
            onPassed={duo.onKaraokeAdvance}
          />
        )}

        {/* Duo: waiting for partner */}
        {isPartnerTurn && duo && (
          <div className="px-5 pt-4 pb-5 flex items-center gap-3">
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  className="w-2 h-2 bg-indigo-400/60 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
            <p className="text-sm text-slate-400">
              Waiting for <span className="text-white font-medium">{duo.partnerRole}</span> to speak…
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
