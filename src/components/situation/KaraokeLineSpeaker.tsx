import { useEffect } from 'react'
import { useSpeechKaraoke, PASS_THRESHOLD } from '@/hooks/useSpeechKaraoke'

interface Props {
  text: string
  speakerName: string
  onPassed: () => void
  onListeningChange?: (listening: boolean) => void
}

export function KaraokeLineSpeaker({ text, speakerName, onPassed, onListeningChange }: Props) {
  const { tokens, matchedCount, listening, transcript, passed, isSupported, startListening, stopListening, reset } =
    useSpeechKaraoke(text, onPassed)

  useEffect(() => { onListeningChange?.(listening) }, [listening])

  const pct = tokens.length > 0 ? matchedCount / tokens.length : 0
  const failed = !listening && transcript.length > 0 && !passed

  return (
    <div className="px-5 pt-4 pb-5 space-y-4">
      <p className="text-xs font-bold text-amber-300 tracking-wide">
        {speakerName} · your turn — speak this line
      </p>

      {/* Karaoke text */}
      <div className="flex flex-wrap gap-x-2 gap-y-1.5">
        {tokens.map((token, i) => (
          <span
            key={i}
            className={`text-lg sm:text-2xl font-bold transition-all duration-150 ${
              i < matchedCount
                ? 'text-yellow-300 drop-shadow-[0_0_6px_rgba(253,224,71,0.5)]'
                : listening && i === matchedCount
                ? 'text-white/60'
                : 'text-white/30'
            }`}
          >
            {token.display}
          </span>
        ))}
      </div>

      {/* Live transcript */}
      <div className="h-5 text-center">
        {transcript && !passed && (
          <p className="text-xs text-gray-400 italic truncate">"{transcript}"</p>
        )}
        {!transcript && listening && (
          <p className="text-xs text-gray-500 animate-pulse">Listening…</p>
        )}
      </div>

      {/* Progress bar */}
      {(listening || matchedCount > 0) && !passed && (
        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-yellow-400 transition-all duration-200"
            style={{ width: `${Math.round(pct * 100)}%` }}
          />
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        {!passed && (
          <>
            <button
              onClick={listening ? stopListening : startListening}
              disabled={!isSupported}
              className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl transition-all duration-200 shadow-lg ${
                listening
                  ? 'bg-red-500 hover:bg-red-600 scale-110 shadow-red-500/40 animate-pulse'
                  : 'bg-indigo-600 hover:bg-indigo-700 hover:scale-105'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {listening ? '⏹' : '🎤'}
            </button>

            {failed && (
              <button
                onClick={reset}
                className="text-xs text-gray-400 hover:text-white transition-colors"
              >
                Try again
              </button>
            )}
          </>
        )}

        {passed && (
          <div className="flex items-center gap-2 text-green-400 font-semibold">
            <span className="text-xl">✓</span>
            <span className="text-sm">
              {Math.round(pct * 100)}% — advancing…
            </span>
          </div>
        )}
      </div>

      {!isSupported && (
        <p className="text-center text-xs text-red-400">
          Speech recognition not supported — use Chrome or Edge
        </p>
      )}

      {failed && (
        <p className="text-center text-xs text-gray-500">
          Need {Math.round(PASS_THRESHOLD * 100)}% of words — try again
        </p>
      )}
    </div>
  )
}
