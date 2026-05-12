import { Font } from '@react-pdf/renderer'

let registered = false

const BASE = 'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-jp/files'

export function registerFonts() {
  if (registered) return
  registered = true

  // Noto Sans JP has no true italic — register regular as the italic fallback for both weights
  const latinR = `${BASE}/noto-sans-jp-latin-400-normal.woff2`
  const latinB = `${BASE}/noto-sans-jp-latin-700-normal.woff2`
  const jpR    = `${BASE}/noto-sans-jp-japanese-400-normal.woff2`
  const jpB    = `${BASE}/noto-sans-jp-japanese-700-normal.woff2`

  Font.register({
    family: 'NotoJP-Latin',
    fonts: [
      { src: latinR, fontWeight: 400 },
      { src: latinB, fontWeight: 700 },
      { src: latinR, fontWeight: 400, fontStyle: 'italic' },
      { src: latinB, fontWeight: 700, fontStyle: 'italic' },
    ],
  })

  Font.register({
    family: 'NotoJP',
    fonts: [
      { src: jpR, fontWeight: 400 },
      { src: jpB, fontWeight: 700 },
      { src: jpR, fontWeight: 400, fontStyle: 'italic' },
      { src: jpB, fontWeight: 700, fontStyle: 'italic' },
    ],
  })

  Font.registerHyphenationCallback(word => [word])
}
