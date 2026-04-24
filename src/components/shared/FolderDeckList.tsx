import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { SortableDeckList, type DeckRow } from './SortableDeckList'

export interface FolderDeckRow extends DeckRow {
  folder?: string | null
}

interface Props {
  decks: FolderDeckRow[]
  onReorder: (newOrder: FolderDeckRow[]) => void
  renderActions: (row: FolderDeckRow) => React.ReactNode
  onMoveToFolder: (id: string, folder: string | null) => Promise<void>
  storageKey: string
}

function FolderPicker({
  anchorRef,
  currentFolder,
  allFolders,
  onPick,
  onClose,
}: {
  anchorRef: React.RefObject<HTMLButtonElement>
  currentFolder: string | null
  allFolders: string[]
  onPick: (folder: string | null) => void
  onClose: () => void
}) {
  const [newName, setNewName] = useState('')
  const pickerRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)

  // Calculate position from anchor button
  useEffect(() => {
    if (!anchorRef.current) return
    const rect = anchorRef.current.getBoundingClientRect()
    const pickerHeight = 220 // approximate
    const spaceBelow = window.innerHeight - rect.bottom
    const top = spaceBelow >= pickerHeight
      ? rect.bottom + 4
      : rect.top - pickerHeight - 4
    setPos({ top, right: window.innerWidth - rect.right })
  }, [anchorRef])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        pickerRef.current && !pickerRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose, anchorRef])

  if (!pos) return null

  return createPortal(
    <div
      ref={pickerRef}
      style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999 }}
      className="bg-white border border-gray-200 rounded-xl shadow-xl p-2 w-52 space-y-1"
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
    </div>,
    document.body,
  )
}

export function FolderDeckList({ decks, onReorder, renderActions, onMoveToFolder, storageKey }: Props) {
  const lsKey = `folder-collapsed:${storageKey}`
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(lsKey) ?? '{}') } catch { return {} }
  })
  const [pickingId, setPickingId] = useState<string | null>(null)
  const [moving, setMoving] = useState<string | null>(null)
  const buttonRefs = useRef<Record<string, React.RefObject<HTMLButtonElement>>>({})

  function getButtonRef(id: string): React.RefObject<HTMLButtonElement> {
    if (!buttonRefs.current[id]) {
      buttonRefs.current[id] = { current: null } as unknown as React.RefObject<HTMLButtonElement>
    }
    return buttonRefs.current[id]
  }

  const allFolders = Array.from(
    new Set(decks.map(d => d.folder).filter((f): f is string => !!f))
  ).sort()

  const groups: Array<{ label: string | null; key: string; rows: FolderDeckRow[] }> = [
    ...allFolders.map(f => ({
      label: f,
      key: f,
      rows: decks.filter(d => d.folder === f),
    })),
    { label: null, key: '__none__', rows: decks.filter(d => !d.folder) },
  ].filter(g => g.rows.length > 0)

  function handleReorderGroup(groupKey: string, newGroupOrder: FolderDeckRow[]) {
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

  const pickingRow = pickingId
    ? decks.find(d => d.id === pickingId) ?? null
    : null

  return (
    <div className="space-y-3">
      {groups.map(group => {
        const isCollapsed = collapsed[group.key]
        const isUncategorized = group.label === null
        return (
          <div key={group.key}>
            {allFolders.length > 0 && (
              <button
                onClick={() => setCollapsed(prev => {
                  const next = { ...prev, [group.key]: !prev[group.key] }
                  try { localStorage.setItem(lsKey, JSON.stringify(next)) } catch {}
                  return next
                })}
                className="flex items-center gap-1.5 w-full text-left mb-1.5"
              >
                <span className="text-xs text-gray-400">{isCollapsed ? '▶' : '▼'}</span>
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
                    <button
                      ref={getButtonRef(row.id)}
                      onClick={() => setPickingId(pickingId === row.id ? null : row.id)}
                      disabled={moving === row.id}
                      title="Move to folder"
                      className="text-gray-300 hover:text-gray-500 transition-colors disabled:opacity-40 text-sm px-0.5"
                    >
                      {moving === row.id ? '…' : '📁'}
                    </button>
                  </div>
                )}
              />
            )}
          </div>
        )
      })}

      {pickingId && pickingRow && (
        <FolderPicker
          anchorRef={getButtonRef(pickingId)}
          currentFolder={pickingRow.folder ?? null}
          allFolders={allFolders}
          onPick={folder => handleMove(pickingId, folder)}
          onClose={() => setPickingId(null)}
        />
      )}
    </div>
  )
}
