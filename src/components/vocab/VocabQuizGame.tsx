import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { CelebrationScreen } from '@/components/shared/CelebrationScreen'
import type { VocabularyBankEntry } from '@/lib/types/database'
import { toast } from 'sonner'

type QuizQuestion = {
  word: string
  sentence: string
  choices: string[]
  answer: string
}

interface Props {
  words: VocabularyBankEntry[]
  deckName: string
  onClose: () => void
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5)
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
  const [error, setError] = useState<string | null>(null)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    generate()
  }, [])

  async function generate() {
    setGenerating(true)
    setError(null)
    try {
      // Use cached questions where available
      const cached = words.filter(w => w.quiz_sentence && w.quiz_distractors?.length >= 1)
      const uncached = words.filter(w => !w.quiz_sentence || !w.quiz_distractors?.length)

      const cachedQuestions: QuizQuestion[] = cached.map(w => ({
        word: w.word,
        sentence: w.quiz_sentence!,
        answer: w.word,
        choices: shuffle([w.word, ...(w.quiz_distractors ?? []).slice(0, 3)]),
      }))

      let newQuestions: QuizQuestion[] = []
      if (uncached.length > 0) {
        const { data, error: fnError } = await supabase.functions.invoke('vocab-quiz-generate', {
          body: {
            words: uncached.map(w => ({ word: w.word, definition_en: w.definition_en })),
            level: deckName,
          },
        })
        if (fnError) {
          let msg = fnError.message
          try { const b = await (fnError as any).context?.json?.(); if (b?.error) msg = b.error } catch {}
          throw new Error(msg)
        }
        const raw: { word: string; sentence: string; distractors: string[] }[] = data.questions ?? []

        // Save generated questions to DB for next time
        await Promise.all(raw.map(q => {
          const entry = uncached.find(w => w.word === q.word)
          if (!entry) return
          return supabase.from('vocabulary_bank').update({
            quiz_sentence: q.sentence,
            quiz_distractors: q.distractors,
          }).eq('id', entry.id)
        }))

        newQuestions = raw.map(q => ({
          word: q.word,
          sentence: q.sentence,
          answer: q.word,
          choices: shuffle([q.word, ...q.distractors.slice(0, 3)]),
        }))

        if (cached.length > 0) {
          toast.success(`${cached.length} cached · ${raw.length} newly generated`)
        }
      }

      setQuestions(shuffle([...cachedQuestions, ...newQuestions]))
    } catch (e: any) {
      const msg = e?.message ?? e?.context?.message ?? String(e)
      setError(`Could not generate questions: ${msg}`)
      console.error(e)
    } finally {
      setGenerating(false)
    }
  }

  function handleSelect(choice: string) {
    if (selected) return
    setSelected(choice)
    if (choice === questions[index].answer) setScore(s => s + 1)
  }

  function handleNext() {
    if (index + 1 >= questions.length) {
      setDone(true)
    } else {
      setIndex(i => i + 1)
      setSelected(null)
    }
  }

  // ── Loading ──────────────────────────────────────────────────────

  if (generating) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center gap-4 p-6">
        <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
        <p className="text-white text-sm">Generating questions…</p>
        <p className="text-white/50 text-xs">{deckName}</p>
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-white">{error}</p>
        <button onClick={generate} className="px-6 py-2 bg-white text-slate-900 rounded-lg font-medium text-sm">Try Again</button>
        <button onClick={onClose} className="text-white/50 text-sm">Back</button>
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
