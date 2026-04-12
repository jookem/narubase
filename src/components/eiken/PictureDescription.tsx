import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'

// ── Speech detection ───────────────────────────────────────────────

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
const SR: any = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
const canUseSpeech = !isIOS && !!SR

// ── Level config ───────────────────────────────────────────────────

type Level = {
  id: string
  label: string
  cefr: string
  bg: string
  border: string
  panels: 1 | 4
  description: string
  hint: string
  placeholder: string
}

const LEVELS: Level[] = [
  {
    id: '5',
    label: 'Eiken 5',
    cefr: 'A1',
    bg: 'bg-green-50',
    border: 'border-green-300',
    panels: 1,
    description: '1〜2文で説明してください',
    hint: 'What do you see? Use simple words.',
    placeholder: 'e.g. I see a cat. It is sleeping.',
  },
  {
    id: '4',
    label: 'Eiken 4',
    cefr: 'A1-A2',
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    panels: 1,
    description: '2〜3文で説明してください',
    hint: 'Describe the people and places you see.',
    placeholder: 'e.g. There is a park. A boy is playing.',
  },
  {
    id: '3',
    label: 'Eiken 3',
    cefr: 'A2',
    bg: 'bg-yellow-50',
    border: 'border-yellow-300',
    panels: 1,
    description: '3〜4文で説明してください',
    hint: 'Use "is/are -ing" to describe what people are doing.',
    placeholder: 'e.g. A woman is cooking. Her son is watching TV.',
  },
  {
    id: 'pre2',
    label: 'Eiken Pre-2',
    cefr: 'A2-B1',
    bg: 'bg-purple-50',
    border: 'border-purple-300',
    panels: 4,
    description: '5〜6文でストーリーを説明してください',
    hint: 'Describe each panel in order using different tenses.',
    placeholder: 'e.g. In the first picture, a man is looking at a map...',
  },
]

type Feedback = { corrected: string | null; feedback: string }

// ── Image display ──────────────────────────────────────────────────

function ImageDisplay({ imageUrl, panels }: { imageUrl: string | null; panels: 1 | 4 }) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt="Describe this picture"
        className="w-full rounded-xl border border-gray-200 object-cover"
      />
    )
  }
  if (panels === 4) {
    return (
      <div className="grid grid-cols-2 gap-1 rounded-xl overflow-hidden border border-gray-200">
        {[1, 2, 3, 4].map(n => (
          <div key={n} className="aspect-square bg-gray-100 flex items-center justify-center text-gray-300 text-xs font-medium">
            Panel {n}
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="aspect-video rounded-xl bg-gray-100 border border-gray-200 flex flex-col items-center justify-center gap-1 text-gray-300">
      <span className="text-5xl">🖼️</span>
      <span className="text-xs">No picture uploaded yet</span>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────

export function PictureDescription() {
  const [level, setLevel] = useState<Level | null>(null)
  const [inputMode, setInputMode] = useState<'speech' | 'text'>(canUseSpeech ? 'speech' : 'text')
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [currentImage, setCurrentImage] = useState<string | null>(null)
  const recogRef = useRef<any>(null)

  useEffect(() => {
    if (!level) return
    supabase
      .from('eiken_pictures')
      .select('image_url')
      .eq('level', level.label)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const random = data[Math.floor(Math.random() * data.length)]
          setCurrentImage(random.image_url)
        } else {
          setCurrentImage(null)
        }
      })
  }, [level])

  // ── Recording ────────────────────────────────────────────────────

  function startRecording() {
    const recognition = new SR()
    recognition.lang = 'en-US'
    recognition.continuous = false
    recognition.interimResults = true

    recognition.onresult = (e: any) => {
      const text = Array.from(e.results as any[])
        .map((r: any) => r[0].transcript)
        .join('')
      setTranscript(text)
    }
    recognition.onend = () => setIsRecording(false)
    recognition.onerror = () => setIsRecording(false)

    recognition.start()
    recogRef.current = recognition
    setIsRecording(true)
  }

  function stopRecording() {
    recogRef.current?.stop()
    setIsRecording(false)
  }

  // ── Submit ───────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!transcript.trim() || !level) return
    setIsLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('eiken-correct', {
        body: { student_input: transcript.trim(), level: level.label },
      })
      if (error) throw error
      setFeedback(data as Feedback)
    } catch {
      setFeedback({ corrected: null, feedback: 'Could not check your answer. Please try again.' })
    } finally {
      setIsLoading(false)
    }
  }

  function reset() {
    setTranscript('')
    setFeedback(null)
    recogRef.current?.stop()
    setIsRecording(false)
  }

  // ── Level selector ───────────────────────────────────────────────

  if (!level) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">🖼️ Picture Description</h2>
          <p className="text-sm text-gray-500 mt-0.5">英検レベルを選んでください</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {LEVELS.map(l => (
            <button
              key={l.id}
              onClick={() => setLevel(l)}
              className={`p-4 rounded-xl border-2 text-left transition-all hover:shadow-md active:scale-95 ${l.bg} ${l.border}`}
            >
              <p className="font-bold text-gray-800">{l.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{l.cefr}</p>
              <p className="text-xs text-gray-600 mt-2 leading-relaxed">{l.description}</p>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── Feedback screen ──────────────────────────────────────────────

  if (feedback) {
    const hasCorrection =
      feedback.corrected &&
      feedback.corrected.trim().toLowerCase() !== transcript.trim().toLowerCase()

    return (
      <div className="space-y-4">
        <button onClick={() => setLevel(null)} className="text-sm text-gray-400 flex items-center gap-1">
          ← {level.label}
        </button>

        <Card>
          <CardContent className="py-4 space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Your answer</p>
              <p className={`text-sm leading-relaxed ${hasCorrection ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                {transcript.trim()}
              </p>
            </div>

            {hasCorrection && feedback.corrected && (
              <div>
                <p className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-1">Corrected</p>
                <p className="text-sm text-green-700 font-medium leading-relaxed">{feedback.corrected}</p>
              </div>
            )}

            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-sm text-blue-800 leading-relaxed">{feedback.feedback}</p>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <button
            onClick={reset}
            className="flex-1 py-2.5 bg-brand text-white text-sm font-medium rounded-lg"
          >
            Try Again
          </button>
          <button
            onClick={() => { reset(); setLevel(null) }}
            className="flex-1 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg"
          >
            Change Level
          </button>
        </div>
      </div>
    )
  }

  // ── Practice screen ──────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <button onClick={() => { reset(); setLevel(null) }} className="text-sm text-gray-400 flex items-center gap-1">
        ← Change Level
      </button>

      <div className="flex items-center gap-2">
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${level.bg} ${level.border} text-gray-700`}>
          {level.label}
        </span>
        <p className="text-sm text-gray-500">{level.description}</p>
      </div>

      <ImageDisplay imageUrl={currentImage} panels={level.panels} />

      <p className="text-xs text-gray-400 italic">{level.hint}</p>

      {/* Mode toggle — hidden on iOS since speech isn't available */}
      {canUseSpeech && (
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setInputMode('speech')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              inputMode === 'speech' ? 'bg-white shadow text-gray-900' : 'text-gray-500'
            }`}
          >
            🎤 Speak
          </button>
          <button
            onClick={() => { stopRecording(); setInputMode('text') }}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              inputMode === 'text' ? 'bg-white shadow text-gray-900' : 'text-gray-500'
            }`}
          >
            ✏️ Type
          </button>
        </div>
      )}

      {/* Speech input */}
      {inputMode === 'speech' && (
        <div className="space-y-3">
          <div className="flex justify-center">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`w-20 h-20 rounded-full text-3xl transition-all active:scale-95 ${
                isRecording
                  ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-200'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              {isRecording ? '⏹' : '🎤'}
            </button>
          </div>
          <p className="text-center text-xs text-gray-400">
            {isRecording ? 'Recording… tap to stop' : 'Tap to start speaking'}
          </p>
          {transcript && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 min-h-[60px] leading-relaxed">
              {transcript}
            </div>
          )}
        </div>
      )}

      {/* Text input */}
      {inputMode === 'text' && (
        <Textarea
          value={transcript}
          onChange={e => setTranscript(e.target.value)}
          placeholder={level.placeholder}
          rows={4}
          className="resize-none"
        />
      )}

      <button
        onClick={handleSubmit}
        disabled={!transcript.trim() || isLoading}
        className="w-full py-3 bg-brand text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-opacity"
      >
        {isLoading ? 'Checking…' : 'Submit'}
      </button>
    </div>
  )
}
