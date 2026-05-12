import { Font } from '@react-pdf/renderer'

let registered = false

const BASE = 'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-jp/files'

export function registerFonts() {
  if (registered) return
  registered = true

  // Latin subset — English labels, dates, headings
  Font.register({
    family: 'NotoJP-Latin',
    fonts: [
      { src: `${BASE}/noto-sans-jp-latin-400-normal.woff2`, fontWeight: 400 },
      { src: `${BASE}/noto-sans-jp-latin-700-normal.woff2`, fontWeight: 700 },
    ],
  })

  // Japanese subset — lesson notes, vocabulary, grammar (may contain kanji/kana)
  Font.register({
    family: 'NotoJP',
    fonts: [
      { src: `${BASE}/noto-sans-jp-japanese-400-normal.woff2`, fontWeight: 400 },
      { src: `${BASE}/noto-sans-jp-japanese-700-normal.woff2`, fontWeight: 700 },
    ],
  })

  Font.registerHyphenationCallback(word => [word])
}
