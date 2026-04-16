import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase' // still needed for auth.getUser
import { CelebrationScreen } from '@/components/shared/CelebrationScreen'
import type { VocabularyBankEntry } from '@/lib/types/database'

type QuizQuestion = {
  word: string
  sentence: string
  choices: string[]
  answer: string
}

interface SavedQuizSession {
  questions: QuizQuestion[]
  index: number
  score: number
}

interface Props {
  words: VocabularyBankEntry[]
  deckName: string
  onClose: () => void
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5)
}

function quizSessionKey(userId: string, deckName: string) {
  return `narubase_session_quiz_${userId}_${deckName.replace(/[^a-z0-9]/gi, '_')}`
}

function SentenceDisplay({ sentence }: { sentence: string }) {
  const parts = sentence.split('_____')
  if (parts.length === 1) return <span>{sentence}</span>
  return (
    <span>
      {parts[0]}
      <span className="inline-block mx-1 px-3 border-b-2 border-gray-400 text-gray-300 select-none">
        {'　　　　'}
      </span>
      {parts[1]}
    </span>
  )
}

export function VocabQuizGame({ words, deckName, onClose }: Props) {
  const [generating, setGenerating] = useState(true)

  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [showResumePrompt, setShowResumePrompt] = useState(false)
  const [resumeData, setResumeData] = useState<SavedQuizSession | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id ?? null
      setUserId(uid)
      if (uid) {
        const saved = localStorage.getItem(quizSessionKey(uid, deckName))
        if (saved) {
          try {
            const parsed: SavedQuizSession = JSON.parse(saved)
            if (parsed.questions?.length > 0 && typeof parsed.index === 'number') {
              setResumeData(parsed)
              setShowResumePrompt(true)
              setGenerating(false)
              return
            }
          } catch {}
        }
      }
      loadQuestions(uid)
    })
  }, [])

  function handleResume() {
    if (!resumeData) return
    setQuestions(resumeData.questions)
    setIndex(resumeData.index)
    setScore(resumeData.score)
    setShowResumePrompt(false)
  }

  function handleStartFresh() {
    if (userId) localStorage.removeItem(quizSessionKey(userId, deckName))
    setShowResumePrompt(false)
    setGenerating(true)
    loadQuestions(userId)
  }

  async function loadQuestions(uid: string | null = userId) {
    setGenerating(true)

    // Content is already merged onto word objects via getStudentVocab — no extra fetch needed.
    const allQuestions: QuizQuestion[] = shuffle(
      words
        .map(w => {
          if (!w.quiz_sentence?.includes('_____') || !w.quiz_distractors?.length) return null
          const answer = w.quiz_answer ?? w.word
          return {
            word: w.word,
            sentence: w.quiz_sentence,
            answer,
            choices: shuffle([answer, ...w.quiz_distractors.slice(0, 3)]),
          }
        })
        .filter(Boolean) as QuizQuestion[]
    )

    setQuestions(allQuestions)
    setIndex(0)
    setScore(0)
    if (uid && allQuestions.length > 0) {
      localStorage.setItem(quizSessionKey(uid, deckName), JSON.stringify({
        questions: allQuestions,
        index: 0,
        score: 0,
      }))
    }
    setGenerating(false)
  }

  function handleSelect(choice: string) {
    if (selected) return
    setSelected(choice)
    if (choice === questions[index].answer) setScore(s => s + 1)
  }

  function handleNext() {
    const nextIndex = index + 1
    if (nextIndex >= questions.length) {
      setDone(true)
      if (userId) localStorage.removeItem(quizSessionKey(userId, deckName))
    } else {
      setIndex(nextIndex)
      setSelected(null)
      // score is already updated by handleSelect (separate click), use it directly
      if (userId) {
        localStorage.setItem(quizSessionKey(userId, deckName), JSON.stringify({
          questions,
          index: nextIndex,
          score,
        }))
      }
    }
  }

  // ── Loading ──────────────────────────────────────────────────────

  if (generating) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center gap-4 p-6">
        <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
        <p className="text-white text-sm">Loading quiz…</p>
        <p className="text-white/50 text-xs">{deckName}</p>
      </div>
    )
  }

  // ── Resume prompt ────────────────────────────────────────────────

  if (showResumePrompt && resumeData) {
    const remaining = resumeData.questions.length - resumeData.index
    return (
      <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full text-center space-y-4">
          <p className="text-white font-semibold text-lg">Resume quiz?</p>
          <p className="text-gray-400 text-sm">
            {remaining} question{remaining !== 1 ? 's' : ''} remaining · {resumeData.score} correct so far
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={handleResume}
              className="w-full py-2.5 bg-brand text-white rounded-xl text-sm font-semibold"
            >
              Resume
            </button>
            <button
              onClick={handleStartFresh}
              className="w-full py-2.5 bg-gray-800 text-gray-300 rounded-xl text-sm"
            >
              Start fresh
            </button>
            <button onClick={onClose} className="text-white/40 text-sm mt-1">Back</button>
          </div>
        </div>
      </div>
    )
  }

  // ── No questions available ───────────────────────────────────────

  if (!generating && questions.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-white font-semibold">No quiz questions yet</p>
        <p className="text-white/50 text-sm">Your teacher hasn't generated questions for these words yet.</p>
        <button onClick={onClose} className="mt-2 px-6 py-2 bg-white text-slate-900 rounded-lg font-medium text-sm">Back</button>
      </div>
    )
  }

  // ── Done ─────────────────────────────────────────────────────────

  if (done) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center p-4">
        <CelebrationScreen
          title={score === questions.length ? '満点！ 🎉' : `${score} / ${questions.length}`}
          subtitle={score === questions.length
            ? 'Perfect score! All answers correct.'
            : `You got ${score} out of ${questions.length} correct.`}
          onClose={onClose}
          closeLabel="Back to Vocabulary"
        />
      </div>
    )
  }

  // ── Question ─────────────────────────────────────────────────────

  const q = questions[index]
  const pct = Math.round((index / questions.length) * 100)

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <button onClick={onClose} className="text-white/60 text-sm">✕</button>
        <span className="text-white/60 text-xs">{index + 1} / {questions.length}</span>
        <span className="text-white/60 text-xs">✓ {score}</span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-white/10 mx-4 rounded-full overflow-hidden">
        <div className="h-full bg-brand rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      {/* Question */}
      <div className="flex-1 flex flex-col justify-center px-6 gap-8">
        <div className="bg-white/10 rounded-2xl p-6 text-center">
          <p className="text-white text-xl font-medium leading-relaxed">
            <SentenceDisplay sentence={q.sentence} />
          </p>
        </div>

        {/* Choices */}
        <div className="grid grid-cols-2 gap-3">
          {q.choices.map((choice, i) => {
            let style = 'bg-white/10 text-white border-white/20'
            if (selected) {
              if (choice === q.answer) style = 'bg-green-500 text-white border-green-400'
              else if (choice === selected) style = 'bg-red-500 text-white border-red-400'
              else style = 'bg-white/5 text-white/40 border-white/10'
            }
            return (
              <button
                key={choice}
                onClick={() => handleSelect(choice)}
                disabled={!!selected}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all active:scale-95 ${style}`}
              >
                <span className="text-sm font-bold opacity-60">{i + 1}</span>
                <span className="text-sm font-medium">{choice}</span>
              </button>
            )
          })}
        </div>

        {/* Next button — shown after selection */}
        {selected && (
          <button
            onClick={handleNext}
            className="w-full py-3 bg-brand text-white text-sm font-semibold rounded-xl"
          >
            {index + 1 >= questions.length ? 'Finish' : 'Next →'}
          </button>
        )}
      </div>
    </div>
  )
}
