import type { SituationNpc, AvatarPreset, DialogueNode } from '@/lib/api/situations'

interface Props {
  npc: SituationNpc | null
  avatarPreset: AvatarPreset | null
  studentName: string
  currentNode: DialogueNode
  background: { color: string; imageUrl?: string | null }
  onExit: () => void
  onContinue: () => void
  onSelectOption: (index: number) => void
  isEnd: boolean
  onComplete: () => void
}

function CharacterBubble({
  color,
  imageUrl,
  initial,
  label,
  dim,
}: {
  color: string
  imageUrl?: string | null
  initial: string
  label: string
  dim: boolean
}) {
  return (
    <div className={`flex flex-col items-center gap-1.5 transition-opacity duration-300 ${dim ? 'opacity-40' : 'opacity-100'}`}>
      <div
        className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-white shadow-lg overflow-hidden flex items-center justify-center text-white text-2xl font-bold"
        style={{ backgroundColor: color }}
      >
        {imageUrl
          ? <img src={imageUrl} alt={label} className="w-full h-full object-cover" />
          : initial}
      </div>
      <span className="text-[11px] font-medium text-white bg-black/40 px-2 py-0.5 rounded-full whitespace-nowrap">
        {label}
      </span>
    </div>
  )
}

export function RPGDialogueBox({
  npc,
  avatarPreset,
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

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      {/* Exit button */}
      <button
        onClick={onExit}
        className="absolute top-3 left-3 z-10 px-3 py-1.5 bg-black/50 hover:bg-black/70 text-white text-sm rounded-lg transition-colors"
      >
        ← Exit
      </button>

      {/* Scene area */}
      <div
        className="flex-1 flex items-end justify-between px-6 pb-6 min-h-0"
        style={{
          backgroundColor: background.color,
          backgroundImage: background.imageUrl ? `url(${background.imageUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* NPC — left */}
        <CharacterBubble
          color={npc?.placeholder_color ?? '#6366f1'}
          initial={npc?.name?.[0] ?? 'N'}
          label={npc?.name ?? 'NPC'}
          dim={isStudentTurn}
        />

        <div className="flex-1" />

        {/* Student — right */}
        <CharacterBubble
          color={avatarPreset?.placeholder_color ?? '#f59e0b'}
          imageUrl={avatarPreset?.image_url}
          initial={studentName?.[0] ?? 'S'}
          label={studentName}
          dim={isNpcTurn}
        />
      </div>

      {/* Dialogue panel */}
      <div className="bg-slate-900 text-white flex-shrink-0">
        {isNpcTurn && (
          <div className="px-4 pt-4 pb-4 space-y-3">
            <div>
              <p className="text-xs font-semibold text-indigo-300 mb-1">
                {npc?.name} · {npc?.role}
              </p>
              <p className="text-sm leading-relaxed">{currentNode.text}</p>
            </div>
            {isEnd ? (
              <button
                onClick={onComplete}
                className="w-full py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl transition-colors"
              >
                Scene Complete! ✓
              </button>
            ) : (
              <button
                onClick={onContinue}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors"
              >
                Continue →
              </button>
            )}
          </div>
        )}

        {isStudentTurn && currentNode.options && (
          <div className="px-4 py-4 space-y-2">
            <p className="text-xs text-slate-400 mb-1">Choose what to say:</p>
            {currentNode.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => onSelectOption(i)}
                className="w-full text-left px-4 py-3 bg-slate-700 hover:bg-indigo-600 text-sm text-white rounded-xl transition-colors border border-slate-600 hover:border-indigo-500"
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
