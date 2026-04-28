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
}: {
  url: string
  label: string
  dim: boolean
  expression: VRMExpression
  facingDirection: 'left' | 'right'
}) {
  return (
    <div className={`flex flex-col items-center transition-all duration-300 ${dim ? 'opacity-30 scale-95' : 'opacity-100 scale-100'}`}>
      <span className="text-[11px] font-medium text-white/80 bg-black/60 px-2.5 py-0.5 rounded-full mb-1.5 whitespace-nowrap backdrop-blur-sm">
        {label}
      </span>
      <VRMViewer
        url={url}
        expression={expression}
        autoBlink
        orbitControls={false}
        showGrid={false}
        facingDirection={facingDirection}
        className="h-[52vh] sm:h-[64vh] w-[30vw] sm:w-[28vw] max-w-xs"
      />
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
    <div className={`flex flex-col items-center transition-all duration-300 ${dim ? 'opacity-30 scale-95' : 'opacity-100 scale-100'}`}>
      <span className="text-[11px] font-medium text-white/80 bg-black/60 px-2.5 py-0.5 rounded-full mb-1.5 whitespace-nowrap backdrop-blur-sm">
        {label}
      </span>
      <div
        className="w-24 h-24 sm:w-36 sm:h-36 rounded-full border-4 border-white/20 shadow-2xl flex items-center justify-center text-white text-4xl sm:text-5xl font-bold"
        style={{ backgroundColor: color }}
      >
        {initial}
      </div>
    </div>
  )
}

export function RPGDialogueBox({
  npc,
  studentVrmUrl,
  studentName,
  currentNode,
  background,
  onExit,
  onContinue,
  onSelectOption,
  isEnd,
  onComplete,
}: Props) {
  const isNpcTurn = currentNode.speaker === 'npc'
  const isStudentTurn = currentNode.speaker === 'student'

  const npcExpression: VRMExpression = EXPR_MAP[currentNode.expression ?? 'neutral'] ?? 'neutral'
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
        className="flex-1 relative overflow-hidden"
        style={{
          backgroundColor: background.color,
          backgroundImage: background.imageUrl ? `url(${background.imageUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-slate-900/60 to-transparent pointer-events-none" />

        {/* NPC — bottom left, faces right toward student */}
        <div className="absolute bottom-0 left-2 sm:left-10 flex flex-col items-center justify-end">
          {npc?.vrm_url ? (
            <VRMPortrait
              url={npc.vrm_url}
              label={npc.name ?? 'NPC'}
              dim={isStudentTurn}
              expression={npcExpression}
              facingDirection="right"
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

        {/* Student — bottom right, faces left toward NPC */}
        <div className="absolute bottom-0 right-2 sm:right-10 flex flex-col items-center justify-end">
          {studentVrmUrl ? (
            <VRMPortrait
              url={studentVrmUrl}
              label={studentName}
              dim={isNpcTurn}
              expression={studentExpression}
              facingDirection="left"
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
      <div className="bg-slate-900/95 backdrop-blur-sm border-t border-white/10 flex-shrink-0">
        {isNpcTurn && (
          <div className="px-5 pt-4 pb-5 space-y-3">
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
