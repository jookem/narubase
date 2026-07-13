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

function wordMatches(word: string, target: string): boolean {
  if (word === target) return true
  if (target.length <= 3) return false
  const prefixLen = Math.min(4, target.length)
  return word.startsWith(target.slice(0, prefixLen)) || target.startsWith(word.slice(0, prefixLen))
}

const MATCH_WINDOW = 3

// Aligns recognized words against the target tokens one-for-one, in order.
// A missed word no longer aborts the match for the rest of the sentence —
// it's marked unmatched and alignment continues at the next token. Proper
// nouns (names) are graded leniently since browser speech recognition
// garbles them unpredictably regardless of how clearly they're spoken.
function matchTokens(tokens: KaraokeToken[], words: string[]): boolean[] {
  const results = new Array(tokens.length).fill(false)
  let wIdx = 0
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    const isName = i > 0 && /^[A-Z]/.test(token.display)
    const window = words.slice(wIdx, wIdx + MATCH_WINDOW)
    if (window.length === 0) break // nothing more said yet

    let offset = window.findIndex(w => wordMatches(w, token.match))
    if (offset < 0 && isName) offset = 0 // credit any attempt at a name

    if (offset >= 0) {
      results[i] = true
      wIdx += offset + 1
    } else {
      wIdx += 1 // the next spoken word was this token's (failed) attempt
    }
  }
  return results
}

export const PASS_THRESHOLD = 0.85

export function useSpeechKaraoke(sentence: string, onPassed?: () => void) {
  const [tokens, setTokens] = useState<KaraokeToken[]>(() => tokenize(sentence))
  const [results, setResults] = useState<boolean[]>([])
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [passed, setPassed] = useState(false)
  const [isSupported] = useState(
    () => !!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition,
  )

  const recRef = useRef<any>(null)
  const bestResultsRef = useRef<boolean[]>([])
  const onPassedRef = useRef(onPassed)
  onPassedRef.current = onPassed

  useEffect(() => {
    const t = tokenize(sentence)
    setTokens(t)
    setResults([])
    setTranscript('')
    setPassed(false)
    bestResultsRef.current = []
    recRef.current?.stop()
  }, [sentence])

  const matchedCount = results.filter(Boolean).length
  const pct = tokens.length > 0 ? matchedCount / tokens.length : 0

  function startListening() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR || listening) return

    const rec = new SR()
    rec.continuous = false
    rec.interimResults = true
    rec.lang = 'en-US'

    rec.onresult = (event: any) => {
      let interim = ''
      for (let i = 0; i < event.results.length; i++) interim += event.results[i][0].transcript + ' '
      setTranscript(interim.trim())

      const t = tokenize(sentence)
      const fresh = matchTokens(t, normalize(interim))
      // Ratchet: once a token matches, keep it matched even if a later
      // revision of the interim transcript would no longer find it —
      // avoids highlighted words flickering off mid-utterance.
      const merged = t.map((_, i) => bestResultsRef.current[i] || fresh[i] || false)
      bestResultsRef.current = merged
      setResults(merged)

      const matched = merged.filter(Boolean).length
      if (t.length > 0 && matched / t.length >= PASS_THRESHOLD) {
        setPassed(true)
        rec.stop()
        onPassedRef.current?.()
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
    setResults([])
    setTranscript('')
    setPassed(false)
    bestResultsRef.current = []
  }

  function forcePass() {
    recRef.current?.stop()
    setPassed(true)
    onPassedRef.current?.()
  }

  return {
    tokens, results, matchedCount, pct, listening, transcript, passed, isSupported,
    startListening, stopListening, reset, forcePass,
  }
}
