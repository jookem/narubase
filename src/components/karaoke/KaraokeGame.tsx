import { useEffect, useRef, useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────

interface Token {
  display: string
  match: string
}

interface SentenceResult {
  sentence: string
  matched: number
  total: number
}

// ── Helpers ───────────────────────────────────────────────────────

function tokenize(sentence: string): Token[] {
  return sentence
    .split(/\s+/)
    .map(word => ({ display: word, match: word.replace(/[^a-zA-Z0-9']/g, '').toLowerCase() }))
    .filter(t => t.match.length > 0)
}

function normalize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9'\s]/g, '').split(/\s+/).filter(Boolean)
}

function countMatched(tokens: Token[], transcriptWords: string[]): number {
  let tIdx = 0
  let matched = 0
  for (const token of tokens) {
    const found = transcriptWords.slice(tIdx).findIndex(w => w === token.match || w.startsWith(token.match.slice(0, 4)))
    if (found >= 0) {
      matched++
      tIdx += found + 1
    } else break
  }
  return matched
}

function scoreColor(pct: number) {
  if (pct >= 90) return 'text-green-400'
  if (pct >= 60) return 'text-yellow-400'
  return 'text-red-400'
}

// ── Component ─────────────────────────────────────────────────────

interface Props {
  sentences: string[]
  onClose: () => void
  onComplete: () => void
}

export function KaraokeGame({ sentences, onClose, onComplete }: Props) {
  const [idx, setIdx] = useState(0)
  const [tokens, setTokens] = useState<Token[]>([])
  const [matchedCount, setMatchedCount] = useState(0)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [roundDone, setRoundDone] = useState(false)
  const [results, setResults] = useState<SentenceResult[]>([])
  const [sessionDone, setSessionDone] = useState(false)
  const [supported, setSupported] = useState(true)

  const recognitionRef = useRef<any>(null)
  const bestMatchRef = useRef(0)

  const sentence = sentences[idx] ?? ''
  const total = sentences.length

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) setSupported(false)
  }, [])

  useEffect(() => {
    const t = tokenize(sentence)
    setTokens(t)
    setMatchedCount(0)
    setTranscript('')
    setRoundDone(false)
    bestMatchRef.current = 0
  }, [sentence])

  function startListening() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return

    const rec = new SR()
    rec.continuous = false
    rec.interimResults = true
    rec.lang = 'en-US'

    rec.onresult = (event: any) => {
      let interim = ''
      for (let i = 0; i < event.results.length; i++) {
        interim += event.results[i][0].transcript
      }
      setTranscript(interim)
      const words = normalize(interim)
      const t = tokenize(sentence)
      const matched = countMatched(t, words)
      if (matched > bestMatchRef.current) {
        bestMatchRef.current = matched
        setMatchedCount(matched)
      }
    }

    rec.onerror = () => {
      setListening(false)
      finish()
    }

    rec.onend = () => {
      setListening(false)
      finish()
    }

    recognitionRef.current = rec
    rec.start()
    setListening(true)
  }

  function stopListening() {
    recognitionRef.current?.stop()
  }

  function finish() {
    setRoundDone(true)
  }

  function nextSentence() {
    const matched = bestMatchRef.current
    const t = tokenize(sentence)
    setResults(prev => [...prev, { sentence, matched, total: t.length }])

    if (idx + 1 >= total) {
      setSessionDone(true)
    } else {
      setIdx(i => i + 1)
    }
  }

  function skipSentence() {
    const t = tokenize(sentence)
    setResults(prev => [...prev, { sentence, matched: matchedCount, total: t.length }])
    if (idx + 1 >= total) {
      setSessionDone(true)
    } else {
      setIdx(i => i + 1)
    }
  }

  // ── Session done screen ────────────────────────────────────────

  if (sessionDone) {
    const totalMatched = results.reduce((a, r) => a + r.matched, 0)
    const totalWords = results.reduce((a, r) => a + r.total, 0)
    const pct = totalWords > 0 ? Math.round((totalMatched / totalWords) * 100) : 0

    return (
      <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col items-center justify-center p-6 text-white">
        <div className="text-6xl mb-4">🎤</div>
        <h2 className="text-2xl font-bold mb-1">お疲れ様！</h2>
        <p className="text-gray-400 text-sm mb-6">Karaoke Practice Complete</p>

        <div className={`text-7xl font-bold mb-2 ${scoreColor(pct)}`}>{pct}%</div>
        <p className="text-gray-400 text-sm mb-8">{totalMatched} / {totalWords} words</p>

        <div className="w-full max-w-sm space-y-2 mb-8">
          {results.map((r, i) => {
            const p = r.total > 0 ? Math.round((r.matched / r.total) * 100) : 0
            return (
              <div key={i} className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-2">
                <p className="text-sm text-gray-300 truncate flex-1 mr-3">{r.sentence}</p>
                <span className={`text-sm font-bold shrink-0 ${scoreColor(p)}`}>{p}%</span>
              </div>
            )
          })}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onComplete}
            className="px-6 py-3 bg-brand text-white font-semibold rounded-xl hover:bg-brand/90 transition-colors"
          >
            完了 / Done
          </button>
        </div>
      </div>
    )
  }

  // ── Main game screen ───────────────────────────────────────────

  const pct = tokens.length > 0 ? Math.round((matchedCount / tokens.length) * 100) : 0

  return (
    <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <span className="text-xl">🎤</span>
          <span className="font-semibold text-white">カラオケ Karaoke</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">{idx + 1} / {total}</span>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors text-lg">✕</button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-white/10">
        <div
          className="h-full bg-brand transition-all duration-500"
          style={{ width: `${((idx) / total) * 100}%` }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8">

        {!supported && (
          <div className="bg-red-900/40 border border-red-700 rounded-xl p-4 text-center max-w-sm">
            <p className="text-red-300 font-medium">Microphone not supported</p>
            <p className="text-red-400 text-sm mt-1">Please use Chrome or Edge on desktop/Android.</p>
          </div>
        )}

        {/* Sentence display */}
        <div className="text-center max-w-2xl">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-4">Read this sentence aloud</p>
          <div className="flex flex-wrap gap-x-3 gap-y-2 justify-center">
            {tokens.map((token, i) => (
              <span
                key={i}
                className={`text-2xl sm:text-3xl font-bold transition-all duration-200 ${
                  i < matchedCount
                    ? 'text-yellow-300 drop-shadow-[0_0_8px_rgba(253,224,71,0.6)]'
                    : listening && i === matchedCount
                    ? 'text-white/60'
                    : 'text-white/25'
                }`}
              >
                {token.display}
              </span>
            ))}
          </div>
        </div>

        {/* Transcript */}
        <div className="h-8 text-center">
          {transcript && (
            <p className="text-sm text-gray-400 italic">"{transcript}"</p>
          )}
          {!transcript && listening && (
            <p className="text-sm text-gray-500 animate-pulse">Listening…</p>
          )}
        </div>

        {/* Score when round done */}
        {roundDone && (
          <div className="text-center space-y-1">
            <p className={`text-5xl font-bold ${scoreColor(pct)}`}>{pct}%</p>
            <p className="text-gray-400 text-sm">{matchedCount} / {tokens.length} words</p>
          </div>
        )}

        {/* Mic button */}
        <div className="flex flex-col items-center gap-4">
          {!roundDone ? (
            <button
              onClick={listening ? stopListening : startListening}
              disabled={!supported}
              className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl transition-all duration-200 shadow-lg ${
                listening
                  ? 'bg-red-500 hover:bg-red-600 scale-110 shadow-red-500/40 shadow-xl animate-pulse'
                  : 'bg-brand hover:bg-brand/90 hover:scale-105'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {listening ? '⏹' : '🎤'}
            </button>
          ) : (
            <button
              onClick={nextSentence}
              className="px-8 py-3 bg-brand text-white font-semibold rounded-xl hover:bg-brand/90 transition-colors text-lg"
            >
              {idx + 1 >= total ? '結果を見る →' : '次へ →'}
            </button>
          )}

          {!roundDone && !listening && (
            <button onClick={skipSentence} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
              Skip sentence →
            </button>
          )}
          {!roundDone && listening && (
            <p className="text-xs text-gray-500">Tap to stop when done</p>
          )}
        </div>
      </div>
    </div>
  )
}
