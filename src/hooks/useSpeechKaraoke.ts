import { useEffect, useRef, useState } from 'react'

export interface KaraokeToken { display: string; match: string }

export function tokenize(sentence: string): KaraokeToken[] {
  return sentence
    .split(/\s+/)
    .map(w => ({ display: w, match: w.replace(/[^a-zA-Z0-9']/g, '').toLowerCase() }))
    .filter(t => t.match.length > 0)
}

function normalize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9'\s]/g, '').split(/\s+/).filter(Boolean)
}

function countMatched(tokens: KaraokeToken[], words: string[]): number {
  let tIdx = 0, matched = 0
  for (const token of tokens) {
    const found = words.slice(tIdx).findIndex(w => w === token.match || w.startsWith(token.match.slice(0, 4)))
    if (found >= 0) { matched++; tIdx += found + 1 } else break
  }
  return matched
}

export const PASS_THRESHOLD = 0.85

export function useSpeechKaraoke(sentence: string, onPassed?: () => void) {
  const [tokens, setTokens] = useState<KaraokeToken[]>(() => tokenize(sentence))
  const [matchedCount, setMatchedCount] = useState(0)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [passed, setPassed] = useState(false)
  const [isSupported] = useState(
    () => !!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition,
  )

  const recRef = useRef<any>(null)
  const bestRef = useRef(0)
  const onPassedRef = useRef(onPassed)
  onPassedRef.current = onPassed

  useEffect(() => {
    const t = tokenize(sentence)
    setTokens(t)
    setMatchedCount(0)
    setTranscript('')
    setPassed(false)
    bestRef.current = 0
    recRef.current?.stop()
  }, [sentence])

  function startListening() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR || listening) return

    const rec = new SR()
    rec.continuous = false
    rec.interimResults = true
    rec.lang = 'en-US'

    rec.onresult = (event: any) => {
      let interim = ''
      for (let i = 0; i < event.results.length; i++) interim += event.results[i][0].transcript
      setTranscript(interim)
      const t = tokenize(sentence)
      const matched = countMatched(t, normalize(interim))
      if (matched > bestRef.current) {
        bestRef.current = matched
        setMatchedCount(matched)
        if (matched / t.length >= PASS_THRESHOLD) {
          setPassed(true)
          rec.stop()
          onPassedRef.current?.()
        }
      }
    }

    rec.onerror = () => setListening(false)
    rec.onend = () => setListening(false)

    recRef.current = rec
    rec.start()
    setListening(true)
  }

  function stopListening() {
    recRef.current?.stop()
  }

  function reset() {
    recRef.current?.stop()
    setMatchedCount(0)
    setTranscript('')
    setPassed(false)
    bestRef.current = 0
  }

  return { tokens, matchedCount, listening, transcript, passed, isSupported, startListening, stopListening, reset }
}
