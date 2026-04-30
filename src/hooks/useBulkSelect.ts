import { useState } from 'react'

export function useBulkSelect(ids: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setSelected(s => {
      const next = new Set(s)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected(s => s.size === ids.length && ids.length > 0 ? new Set() : new Set(ids))
  }

  function clear() {
    setSelected(new Set())
  }

  return {
    selected,
    toggle,
    toggleAll,
    clear,
    isSelected: (id: string) => selected.has(id),
    selectedIds: [...selected],
    allSelected: selected.size === ids.length && ids.length > 0,
    anySelected: selected.size > 0,
    count: selected.size,
  }
}
