import { useState, useRef, useEffect } from 'react'
import { SortableDeckList, type DeckRow } from './SortableDeckList'

export interface FolderDeckRow extends DeckRow {
  folder?: string | null
}

interface Props {
  decks: FolderDeckRow[]
  onReorder: (newOrder: FolderDeckRow[]) => void
  renderActions: (row: FolderDeckRow) => React.ReactNode
  onMoveToFolder: (id: string, folder: string | null) => Promise<void>
}

function FolderPicker({
  currentFolder,
  allFolders,
  onPick,
  onClose,
}: {
  currentFolder: string | null
  allFolders: string[]
  onPick: (folder: string | null) => void
  onClose: () => void
}) {
  const [newName, setNewName] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const [openUpward, setOpenUpward] = useState(false)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  useEffect(() => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    if (rect.bottom > window.innerHeight - 16) setOpenUpward(true)
  }, [])

  return (
    <div
      ref={ref}
      className={`absolute right-0 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-2 w-52 space-y-1 ${openUpward ? 'bottom-full mb-1' : 'top-full mt-1'}`}
    >
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-1 pb-1">Move to folder</p>

      {allFolders.filter(f => f !== currentFolder).map(f => (
        <button
          key={f}
          onClick={() => onPick(f)}
          className="w-full text-left text-sm px-3 py-1.5 rounded-lg hover:bg-brand-light text-gray-700 hover:text-brand-dark transition-colors"
        >
          📁 {f}
        </button>
      ))}

      {currentFolder && (
        <button
          onClick={() => onPick(null)}
          className="w-full text-left text-sm px-3 py-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
        >
          Remove from folder
        </button>
      )}

      <div className="border-t border-gray-100 pt-1">
        <form
          onSubmit={e => {
            e.preventDefault()
            const name = newName.trim()
            if (name) { onPick(name); setNewName('') }
          }}
          className="flex gap-1"
        >
          <input
            autoFocus={allFolders.length === 0}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="New folder…"
            className="flex-1 h-7 text-xs border border-gray-200 rounded-lg px-2 outline-none focus:border-brand"
          />
          <button
            type="submit"
            disabled={!newName.trim()}
            className="px-2 py-1 text-xs bg-brand text-white rounded-lg disabled:opacity-40"
          >
            +
          </button>
        </form>
      </div>
    </div>
  )
}

export function FolderDeckList({ decks, onReorder, renderActions, onMoveToFolder }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [pickingId, setPickingId] = useState<string | null>(null)
  const [moving, setMoving] = useState<string | null>(null)

  const allFolders = Array.from(
    new Set(decks.map(d => d.folder).filter((f): f is string => !!f))
  ).sort()

  // Group: named folders in alpha order, then uncategorized
  const groups: Array<{ label: string | null; key: string; rows: FolderDeckRow[] }> = [
    ...allFolders.map(f => ({
      label: f,
      key: f,
      rows: decks.filter(d => d.folder === f),
    })),
    { label: null, key: '__none__', rows: decks.filter(d => !d.folder) },
  ].filter(g => g.rows.length > 0)

  function handleReorderGroup(groupKey: string, newGroupOrder: FolderDeckRow[]) {
    // Rebuild the full deck list: replace this group's entries in-place
    const result: FolderDeckRow[] = []
    const replaced = new Set(newGroupOrder.map(r => r.id))
    let inserted = false
    for (const d of decks) {
      if (replaced.has(d.id)) {
        if (!inserted) { result.push(...newGroupOrder); inserted = true }
      } else {
        result.push(d)
      }
    }
    onReorder(result)
  }

  async function handleMove(id: string, folder: string | null) {
    setMoving(id)
    setPickingId(null)
    await onMoveToFolder(id, folder)
    setMoving(null)
  }

  return (
    <div className="space-y-3">
      {groups.map(group => {
        const isCollapsed = collapsed[group.key]
        const isUncategorized = group.label === null
        return (
          <div key={group.key}>
            {/* Folder header — only show if there are named folders or multiple groups */}
            {(allFolders.length > 0) && (
              <button
                onClick={() => setCollapsed(prev => ({ ...prev, [group.key]: !prev[group.key] }))}
                className="flex items-center gap-1.5 w-full text-left mb-1.5 group"
              >
                <span className="text-xs text-gray-400">
                  {isCollapsed ? '▶' : '▼'}
                </span>
                <span className={`text-xs font-semibold uppercase tracking-wide ${isUncategorized ? 'text-gray-400' : 'text-gray-600'}`}>
                  {isUncategorized ? 'Uncategorized' : `📁 ${group.label}`}
                </span>
                <span className="text-[10px] text-gray-300 ml-1">({group.rows.length})</span>
              </button>
            )}

            {!isCollapsed && (
              <SortableDeckList
                decks={group.rows}
                onReorder={rows => handleReorderGroup(group.key, rows as FolderDeckRow[])}
                renderActions={row => (
                  <div className="flex items-center gap-2 shrink-0">
                    {renderActions(row as FolderDeckRow)}
                    <div className="relative">
                      <button
                        onClick={() => setPickingId(pickingId === row.id ? null : row.id)}
                        disabled={moving === row.id}
                        title="Move to folder"
                        className="text-gray-300 hover:text-gray-500 transition-colors disabled:opacity-40 text-sm px-0.5"
                      >
                        {moving === row.id ? '…' : '📁'}
                      </button>
                      {pickingId === row.id && (
                        <FolderPicker
                          currentFolder={(row as FolderDeckRow).folder ?? null}
                          allFolders={allFolders}
                          onPick={folder => handleMove(row.id, folder)}
                          onClose={() => setPickingId(null)}
                        />
                      )}
                    </div>
                  </div>
                )}
              />
            )}
          </div>
        )
      })}

      {decks.length === 0 && null}
    </div>
  )
}
