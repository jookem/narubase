import { useEffect, useState } from 'react'
import { X, Share } from 'lucide-react'

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isInStandaloneMode() {
  return ('standalone' in window.navigator && (window.navigator as any).standalone === true)
    || window.matchMedia('(display-mode: standalone)').matches
}

export function IOSInstallBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!isIOS() || isInStandaloneMode()) return
    if (localStorage.getItem('ios_install_dismissed')) return
    // Small delay so it doesn't pop instantly on load
    const t = setTimeout(() => setVisible(true), 3000)
    return () => clearTimeout(t)
  }, [])

  function dismiss() {
    setVisible(false)
    localStorage.setItem('ios_install_dismissed', '1')
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 flex items-start gap-3">
      <img src="/narubase_logo.svg" alt="NaruBase" className="w-10 h-10 rounded-xl shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">NaruBase をインストール</p>
        <p className="text-xs text-gray-500 mt-0.5 leading-snug">
          <Share size={11} className="inline mb-0.5 mr-0.5" />
          「共有」をタップして「ホーム画面に追加」を選択するとアプリとして使えます。
        </p>
      </div>
      <button onClick={dismiss} className="shrink-0 text-gray-400 hover:text-gray-600 mt-0.5">
        <X size={16} />
      </button>
    </div>
  )
}
