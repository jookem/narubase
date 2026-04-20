import { useEffect, useState } from 'react'

declare const __APP_VERSION__: string

const CURRENT = __APP_VERSION__

export function useVersionCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>

    async function check() {
      try {
        const res = await fetch('/app-version.json', { cache: 'no-store' })
        if (!res.ok) return
        const { v } = await res.json()
        if (v && v !== CURRENT) {
          setUpdateAvailable(true)
          clearInterval(interval)
        }
      } catch {}
    }

    // First check after 60s (let page settle), then every 5 minutes
    const initial = setTimeout(() => {
      check()
      interval = setInterval(check, 5 * 60 * 1000)
    }, 60_000)

    return () => { clearTimeout(initial); clearInterval(interval) }
  }, [])

  return updateAvailable
}
