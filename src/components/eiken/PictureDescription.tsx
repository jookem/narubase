import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'

// ── Speech detection ───────────────────────────────────────────────

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
const SR: any = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
const canUseSpeech = !isIOS && !!SR

// ── Level config ───────────────────────────────────────────────────

type Format = 'passage-qa' | 'dual' | 'comic' | 'comic-timer'

type Level = {
  id: string
  label: string
  cefr: string
  format: Format
  hint: string
  placeholder: string
}

const LEVELS: Level[] = [
  { id: '5', label: 'Eiken 5', cefr: 'A1', format: 'passage-qa',
    hint: 'Read the passage and look at the picture, then answer each question.',
    placeholder: 'Answer the question here.' },
  { id: '4', label: 'Eiken 4', cefr: 'A1-A2', format: 'passage-qa',
    hint: 'Read the passage and look at the picture, then answer each question.',
    placeholder: 'Answer the question here.' },
  { id: '3', label: 'Eiken 3', cefr: 'A2', format: 'passage-qa',
    hint: 'Read the passage and look at the picture, then answer each question.',
    placeholder: 'Answer the question here.' },
  { id: 'pre2', label: 'Eiken Pre-2', cefr: 'A2-B1', format: 'dual',
    hint: 'Describe what the people in Picture A are doing, then describe the situation in Picture B.',
    placeholder: 'e.g. A man is putting boxes on a truck. A woman is planting flowers... In Picture B, a girl cannot buy a drink because...' },
  { id: 'pre2plus', label: 'Eiken Pre-2 Plus', cefr: 'B1', format: 'comic',
    hint: 'Start with the given sentence and narrate the full story (5-6 sentences).',
    placeholder: 'Begin with the starter sentence and describe each panel in order.' },
  { id: '2', label: 'Eiken 2', cefr: 'B1-B2', format: 'comic-timer',
    hint: 'You have 20 seconds to prepare. Then start with the given sentence and narrate the story.',
    placeholder: 'Begin with the starter sentence and describe each panel in order.' },
]

type PictureData = {
  image_url: string
  image_b_url: string | null
  description: string | null
  image_b_description: string | null
  passage_title: string | null
  passage_text: string | null
  starter_sentence: string | null
  questions: string[]
}

type QuestionResult = {
  question: string
  answer: string
  corrected: string | null
  feedback: string
}

type Feedback = { corrected: string | null; feedback: string }

// ── Passage box ────────────────────────────────────────────────────

function PassageBox({ title, text }: { title: string | null; text: string }) {
  return (
    <div className="border-2 border-gray-300 rounded-lg p-4">
      {title && <p className="font-bold text-center text-lg mb-2">{title}</p>}
      <p className="text-base leading-relaxed text-gray-700">{text}</p>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────

export function PictureDescription() {
  const [level, setLevel] = useState<Level | null>(null)
  const [pictureData, setPictureData] = useState<PictureData | null>(null)
  const [inputMode, setInputMode] = useState<'speech' | 'text'>(canUseSpeech ? 'speech' : 'text')
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  // Q-by-Q state
  const [questionIndex, setQuestionIndex] = useState(-1) // -1 = viewing passage/image
  const [questionResults, setQuestionResults] = useState<QuestionResult[]>([])
  const [allDone, setAllDone] = useState(false)
  // Comic timer
  const [prepSeconds, setPrepSeconds] = useState(20)
  const [prepActive, setPrepActive] = useState(false)
  const [prepDone, setPrepDone] = useState(false)
  const recogRef = useRef<any>(null)

  // Fetch picture when level selected
  useEffect(() => {
    if (!level) return
    setPictureData(null)
    fullReset()
    supabase
      .from('eiken_pictures')
      .select('image_url, image_b_url, description, image_b_description, passage_title, passage_text, starter_sentence, questions')
      .eq('level', level.label)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const row = data[Math.floor(Math.random() * data.length)]
          setPictureData({
            image_url: row.image_url,
            image_b_url: row.image_b_url ?? null,
            description: row.description ?? null,
            image_b_description: row.image_b_description ?? null,
            passage_title: row.passage_title ?? null,
            passage_text: row.passage_text ?? null,
            starter_sentence: row.starter_sentence ?? null,
            questions: Array.isArray(row.questions) ? row.questions : [],
          })
        }
      })
  }, [level])

  // Prep timer
  useEffect(() => {
    if (!prepActive) return
    if (prepSeconds <= 0) { setPrepDone(true); setPrepActive(false); return }
    const t = setTimeout(() => setPrepSeconds(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [prepActive, prepSeconds])

  function fullReset() {
    setTranscript('')
    setFeedback(null)
    setQuestionIndex(-1)
    setQuestionResults([])
    setAllDone(false)
    setPrepSeconds(20)
    setPrepActive(false)
    setPrepDone(false)
    recogRef.current?.stop()
    setIsRecording(false)
  }

  function resetForNextQuestion() {
    setTranscript('')
    setFeedback(null)
    recogRef.current?.stop()
    setIsRecording(false)
  }

  // ── Recording ──────────────────────────────────────────────────

  function startRecording() {
    const recognition = new SR()
    recognition.lang = 'en-US'
    recognition.continuous = false
    recognition.interimResults = true
    recognition.onresult = (e: any) => {
      setTranscript(Array.from(e.results as any[]).map((r: any) => r[0].transcript).join(''))
    }
    recognition.onend = () => setIsRecording(false)
    recognition.onerror = () => setIsRecording(false)
    recognition.start()
    recogRef.current = recognition
    setIsRecording(true)
  }

  function stopRecording() { recogRef.current?.stop(); setIsRecording(false) }

  // ── Submit ─────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!transcript.trim() || !level || !pictureData) return
    setIsLoading(true)
    const isQA = level.format === 'passage-qa'
    const currentQuestion = isQA && questionIndex >= 0 ? pictureData.questions[questionIndex] : undefined

    try {
      const { data, error } = await supabase.functions.invoke('eiken-correct', {
        body: {
          student_input: transcript.trim(),
          level: level.label,
          format: level.format,
          picture_description: pictureData.description ?? undefined,
          picture_b_description: pictureData.image_b_description ?? undefined,
          passage_title: pictureData.passage_title ?? undefined,
          passage_text: pictureData.passage_text ?? undefined,
          starter_sentence: pictureData.starter_sentence ?? undefined,
          questions: currentQuestion ? [currentQuestion] : undefined,
        },
      })
      if (error) throw error
      const fb = data as Feedback
      if (isQA && questionIndex >= 0) {
        setQuestionResults(prev => [...prev, {
          question: currentQuestion!,
          answer: transcript.trim(),
          corrected: fb.corrected,
          feedback: fb.feedback,
        }])
      }
      setFeedback(fb)
    } catch (err) {
      console.error('eiken-correct error:', err)
      setFeedback({ corrected: null, feedback: 'Could not check your answer. Please try again.' })
    } finally {
      setIsLoading(false)
    }
  }

  // ── Level selector ─────────────────────────────────────────────

  if (!level) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">🖼️ Picture Description</h2>
          <p className="text-sm text-gray-500 mt-0.5">英検レベルを選んでください</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {LEVELS.map(l => (
            <button key={l.id} onClick={() => setLevel(l)}
              className="p-4 rounded-xl border-2 border-gray-200 text-left transition-all hover:border-brand hover:shadow-md active:scale-95 bg-white">
              <p className="font-bold text-gray-800">{l.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{l.cefr}</p>
            </button>
          ))}
        </div>
      </div>
    )
  }

  const fmt = level.format
  const isQA = fmt === 'passage-qa'
  const questions = pictureData?.questions ?? []
  const totalQuestions = questions.length
  const isLastQuestion = questionIndex === totalQuestions - 1
  const noPicture = !pictureData

  // ── All questions done ─────────────────────────────────────────

  if (allDone) {
    return (
      <div className="space-y-4">
        <button onClick={() => setLevel(null)} className="text-sm text-gray-400">← Change Level</button>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <p className="text-2xl mb-1">✅</p>
          <p className="text-sm font-semibold text-green-800">All questions complete!</p>
        </div>
        {questionResults.map((r, i) => (
          <Card key={i}>
            <CardContent className="py-3 space-y-2">
              <p className="text-xs font-semibold text-gray-500">No. {i + 1} — {r.question}</p>
              <p className={`text-sm ${r.corrected && r.corrected.toLowerCase() !== r.answer.toLowerCase() ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                {r.answer}
              </p>
              {r.corrected && r.corrected.toLowerCase() !== r.answer.toLowerCase() && (
                <p className="text-sm text-green-700 font-medium">{r.corrected}</p>
              )}
              <p className="text-xs text-blue-700 bg-blue-50 rounded p-2">{r.feedback}</p>
            </CardContent>
          </Card>
        ))}
        <div className="flex gap-2">
          <button onClick={fullReset} className="flex-1 py-2.5 bg-brand text-white text-sm font-medium rounded-lg">Try Again</button>
          <button onClick={() => { fullReset(); setLevel(null) }} className="flex-1 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg">Change Level</button>
        </div>
      </div>
    )
  }

  // ── Per-question feedback ──────────────────────────────────────

  if (isQA && feedback && questionIndex >= 0) {
    const hasCorrection = feedback.corrected &&
      feedback.corrected.trim().toLowerCase() !== transcript.trim().toLowerCase()
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setLevel(null)} className="text-sm text-gray-400">← Change Level</button>
          <span className="text-xs text-gray-400">Question {questionIndex + 1} / {totalQuestions}</span>
        </div>
        <Card>
          <CardContent className="py-4 space-y-3">
            <p className="text-sm font-semibold text-gray-600">No. {questionIndex + 1} {questions[questionIndex]}</p>
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
        {isLastQuestion ? (
          <button onClick={() => setAllDone(true)}
            className="w-full py-2.5 bg-green-500 text-white text-sm font-semibold rounded-xl">
            Finish ✓
          </button>
        ) : (
          <button onClick={() => { resetForNextQuestion(); setQuestionIndex(i => i + 1) }}
            className="w-full py-2.5 bg-brand text-white text-sm font-semibold rounded-xl">
            Next Question →
          </button>
        )}
      </div>
    )
  }

  // ── Generic feedback (non-QA) ──────────────────────────────────

  if (feedback && !isQA) {
    const hasCorrection = feedback.corrected &&
      feedback.corrected.trim().toLowerCase() !== transcript.trim().toLowerCase()
    return (
      <div className="space-y-4">
        <button onClick={() => setLevel(null)} className="text-sm text-gray-400">← Change Level</button>
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
          <button onClick={fullReset} className="flex-1 py-2.5 bg-brand text-white text-sm font-medium rounded-lg">Try Again</button>
          <button onClick={() => { fullReset(); setLevel(null) }} className="flex-1 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg">Change Level</button>
        </div>
      </div>
    )
  }

  // ── Input area ─────────────────────────────────────────────────

  const isComicTimer = fmt === 'comic-timer'
  const inputDisabled = isComicTimer && !prepDone

  const inputArea = (
    <>
      {canUseSpeech && (
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button onClick={() => setInputMode('speech')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${inputMode === 'speech' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
            🎤 Speak
          </button>
          <button onClick={() => { stopRecording(); setInputMode('text') }}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${inputMode === 'text' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
            ✏️ Type
          </button>
        </div>
      )}
      {inputMode === 'speech' && (
        <div className="space-y-3">
          <div className="flex justify-center">
            <button onClick={isRecording ? stopRecording : startRecording} disabled={inputDisabled}
              className={`w-20 h-20 rounded-full text-3xl transition-all active:scale-95 disabled:opacity-30 ${
                isRecording ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-200' : 'bg-gray-100 hover:bg-gray-200'
              }`}>
              {isRecording ? '⏹' : '🎤'}
            </button>
          </div>
          <p className="text-center text-xs text-gray-400">
            {inputDisabled ? 'Wait for preparation time to end' : isRecording ? 'Recording… tap to stop' : 'Tap to start speaking'}
          </p>
          {transcript && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 min-h-[60px] leading-relaxed">{transcript}</div>
          )}
        </div>
      )}
      {inputMode === 'text' && (
        <Textarea value={transcript} onChange={e => setTranscript(e.target.value)}
          placeholder={level?.placeholder} rows={3} className="resize-none" disabled={inputDisabled} />
      )}
      <button onClick={handleSubmit} disabled={!transcript.trim() || isLoading || inputDisabled}
        className="w-full py-3 bg-brand text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-opacity">
        {isLoading ? 'Checking…' : 'Submit'}
      </button>
    </>
  )

  // ── Passage-QA: viewing passage + image ────────────────────────

  if (isQA && questionIndex === -1) {
    return (
      <div className="space-y-4">
        <button onClick={() => { fullReset(); setLevel(null) }} className="text-sm text-gray-400">← Change Level</button>
        <span className="text-xs px-2.5 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-gray-700">{level.label}</span>
        {noPicture ? (
          <div className="aspect-video rounded-xl bg-gray-100 border border-gray-200 flex flex-col items-center justify-center gap-1 text-gray-300">
            <span className="text-4xl">🖼️</span>
            <span className="text-xs">No picture uploaded for this level yet</span>
          </div>
        ) : (
          <>
            {pictureData.passage_text && (
              <PassageBox title={pictureData.passage_title} text={pictureData.passage_text} />
            )}
            <img src={pictureData.image_url} alt="Describe this" className="w-full rounded-xl border border-gray-200 object-cover" />
            <p className="text-xs text-gray-400 italic">{level.hint}</p>
            <button onClick={() => setQuestionIndex(0)}
              className="w-full py-3 bg-brand text-white text-sm font-semibold rounded-xl">
              Start Questions →
            </button>
          </>
        )}
      </div>
    )
  }

  // ── Passage-QA: answering a question ──────────────────────────

  if (isQA && questionIndex >= 0) {
    const currentQ = questions[questionIndex]
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setLevel(null)} className="text-sm text-gray-400">← Change Level</button>
          <span className="text-xs text-gray-400">Question {questionIndex + 1} / {totalQuestions}</span>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-brand rounded-full transition-all duration-500"
            style={{ width: `${(questionIndex / totalQuestions) * 100}%` }} />
        </div>
        {/* Passage collapsed */}
        {pictureData?.passage_text && (
          <details className="text-xs text-gray-500 cursor-pointer">
            <summary className="font-medium">{pictureData.passage_title ?? 'Passage'} (tap to review)</summary>
            <p className="mt-2 leading-relaxed text-gray-600">{pictureData.passage_text}</p>
          </details>
        )}
        {/* Image small */}
        {pictureData && (
          <img src={pictureData.image_url} alt="Picture" className="w-full max-h-40 rounded-xl border border-gray-200 object-cover" />
        )}
        {/* Current question */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-400 mb-1">No. {questionIndex + 1}</p>
          <p className="text-sm font-medium text-gray-800">{currentQ}</p>
        </div>
        {inputArea}
      </div>
    )
  }

  // ── Non-QA practice screen ─────────────────────────────────────

  return (
    <div className="space-y-4">
      <button onClick={() => { fullReset(); setLevel(null) }} className="text-sm text-gray-400">← Change Level</button>
      <span className="text-xs px-2.5 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-gray-700">{level.label}</span>

      {noPicture ? (
        <div className="aspect-video rounded-xl bg-gray-100 border border-gray-200 flex flex-col items-center justify-center gap-1 text-gray-300">
          <span className="text-4xl">🖼️</span>
          <span className="text-xs">No picture uploaded for this level yet</span>
        </div>
      ) : (
        <>
          {/* Dual images (Pre-2) */}
          {fmt === 'dual' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1 text-center">Picture A</p>
                <img src={pictureData.image_url} alt="Picture A" className="w-full rounded-lg border border-gray-200 object-cover" />
              </div>
              {pictureData.image_b_url && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1 text-center">Picture B</p>
                  <img src={pictureData.image_b_url} alt="Picture B" className="w-full rounded-lg border border-gray-200 object-cover" />
                </div>
              )}
            </div>
          )}

          {/* Comic strip (Pre-2 Plus, Eiken 2) */}
          {(fmt === 'comic' || fmt === 'comic-timer') && (
            <>
              {pictureData.starter_sentence && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
                  <p className="text-xs text-yellow-700 font-medium mb-1">Your story should begin with this sentence:</p>
                  <p className="text-sm font-bold text-gray-800">{pictureData.starter_sentence}</p>
                </div>
              )}
              <img src={pictureData.image_url} alt="Comic strip" className="w-full rounded-xl border border-gray-200 object-cover" />
              {isComicTimer && !prepDone && (
                <div className="text-center space-y-2">
                  {!prepActive ? (
                    <button onClick={() => setPrepActive(true)}
                      className="px-6 py-2.5 bg-yellow-500 text-white text-sm font-semibold rounded-xl">
                      Start 20s Preparation
                    </button>
                  ) : (
                    <div>
                      <p className="text-3xl font-bold text-yellow-600">{prepSeconds}</p>
                      <p className="text-xs text-gray-400">seconds remaining</p>
                    </div>
                  )}
                </div>
              )}
              {isComicTimer && prepDone && (
                <p className="text-center text-sm text-green-600 font-medium">Ready — please begin!</p>
              )}
            </>
          )}
        </>
      )}

      <p className="text-xs text-gray-400 italic">{level.hint}</p>
      {!noPicture && inputArea}
    </div>
  )
}
