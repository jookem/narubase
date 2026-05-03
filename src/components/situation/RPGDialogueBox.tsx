import type { SituationNpc, DialogueNode } from '@/lib/api/situations'
import { VRMViewer, type VRMExpression } from '@/components/vrm/VRMViewer'

const EXPR_MAP: Record<string, VRMExpression> = {
  neutral:  'neutral',
  speaking: 'neutral',
  positive: 'happy',
  confused: 'surprised',
  thinking: 'relaxed',
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
}

function VRMPortrait({
  url,
  label,
  dim,
  expression,
  facingDirection,
  animationMap,
}: {
  url: string
  label: string
  dim: boolean
  expression: VRMExpression
  facingDirection: 'left' | 'right'
  animationMap?: Record<string, string>
}) {
  return (
    <div className={`flex flex-col items-center gap-1.5 pointer-events-none transition-all duration-300 ${dim ? 'opacity-35' : 'opacity-100'}`}>
      <div className={`w-28 h-28 sm:w-36 sm:h-36 rounded-full overflow-hidden ring-2 bg-slate-900 transition-all duration-300 ${dim ? 'ring-white/20' : 'ring-white/60'}`}>
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

function FallbackPortrait({
  color,
  initial,
  label,
  dim,
}: {
  color: string
  initial: string
  label: string
  dim: boolean
}) {
  return (
    <div className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${dim ? 'opacity-35 scale-95' : 'opacity-100 scale-100'}`}>
      <div
        className="w-28 h-28 sm:w-36 sm:h-36 rounded-full ring-2 ring-white/40 shadow-2xl flex items-center justify-center text-white text-4xl sm:text-5xl font-bold"
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
}: Props) {
  const isNpcTurn    = currentNode.speaker === 'npc'
  const isStudentTurn = currentNode.speaker === 'student'

  const npcExpression: VRMExpression     = EXPR_MAP[currentNode.expression ?? 'neutral'] ?? 'neutral'
  const studentExpression: VRMExpression = isStudentTurn ? 'surprised' : 'neutral'

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
        className="flex-1 relative overflow-hidden flex items-end justify-between px-6 pb-5"
        style={{
          backgroundColor: background.color,
          backgroundImage: background.imageUrl ? `url(${background.imageUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-900/70 to-transparent pointer-events-none" />

        {/* NPC — left, faces right toward student */}
        <div className="relative z-10">
          {npc?.vrm_url ? (
            <VRMPortrait
              url={npc.vrm_url}
              label={npc.name ?? 'NPC'}
              dim={isStudentTurn}
              expression={npcExpression}
              facingDirection="right"
              animationMap={npcAnimationMap}
            />
          ) : (
            <FallbackPortrait
              color={npc?.placeholder_color ?? '#6366f1'}
              initial={npc?.name?.[0] ?? 'N'}
              label={npc?.name ?? 'NPC'}
              dim={isStudentTurn}
            />
          )}
        </div>

        {/* Student — right, faces left toward NPC */}
        <div className="relative z-10">
          {studentVrmUrl ? (
            <VRMPortrait
              url={studentVrmUrl}
              label={studentName}
              dim={isNpcTurn}
              expression={studentExpression}
              facingDirection="left"
              animationMap={studentAnimationMap}
            />
          ) : (
            <FallbackPortrait
              color="#f59e0b"
              initial={studentName?.[0] ?? 'S'}
              label={studentName}
              dim={isNpcTurn}
            />
          )}
        </div>
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
      </div>
    </div>
  )
}
