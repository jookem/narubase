import { Font } from '@react-pdf/renderer'

let registered = false

export function registerFonts() {
  if (registered) return
  registered = true

  Font.register({
    family: 'NotoSansJP',
    fonts: [
      {
        src: 'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-jp/files/noto-sans-jp-all-400-normal.woff2',
        fontWeight: 400,
      },
      {
        src: 'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-jp/files/noto-sans-jp-all-700-normal.woff2',
        fontWeight: 700,
      },
    ],
  })

  // Disable hyphenation — Japanese text must not be broken mid-word
  Font.registerHyphenationCallback(word => [word])
}
