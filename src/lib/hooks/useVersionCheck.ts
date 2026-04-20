import { useEffect, useState } from 'react'

declare const __APP_VERSION__: string

const CURRENT = __APP_VERSION__

export function useVersionCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>
    let cancelled = false

    function trigger() {
      if (!cancelled) setUpdateAvailable(true)
    }

    async function check() {
      try {
        const res = await fetch('/app-version.json', { cache: 'no-store' })
        if (!res.ok) return
        const { v } = await res.json()
        if (v && v !== CURRENT) { trigger(); clearInterval(interval) }
      } catch {}
    }

    // Check immediately, then every 5 minutes
    check()
    interval = setInterval(check, 5 * 60 * 1000)

    // Also trigger instantly when a new service worker takes over
    if ('serviceWorker' in navigator) {
      const hadController = !!navigator.serviceWorker.controller
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (hadController) trigger()
      })
    }

    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  return updateAvailable
}
