import type { AvatarPreset } from '@/lib/api/situations'

interface Props {
  presets: AvatarPreset[]
  selected: AvatarPreset | null
  onSelect: (preset: AvatarPreset) => void
}

export function AvatarSelector({ presets, selected, onSelect }: Props) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-gray-700">Choose your character</p>
      <div className="grid grid-cols-3 gap-3">
        {presets.map(preset => (
          <button
            key={preset.id}
            onClick={() => onSelect(preset)}
            className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
              selected?.id === preset.id
                ? 'border-brand bg-brand-light'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-sm overflow-hidden"
              style={{ backgroundColor: preset.placeholder_color }}
            >
              {preset.image_url
                ? <img src={preset.image_url} alt={preset.name} className="w-full h-full object-cover" />
                : preset.name[0]}
            </div>
            <span className="text-xs font-medium text-gray-700">{preset.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
