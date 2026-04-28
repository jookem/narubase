const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** Extract individual JSON objects from a potentially malformed array string. */
function extractQuestions(text: string): { word: string; sentence: string; quiz_answer: string | null; distractors: string[]; inflections: string[] | null }[] {
  const arrayMatch = text.match(/\[[\s\S]*\]/)
  if (arrayMatch) {
    try {
      return JSON.parse(arrayMatch[0])
    } catch {
      // fall through to object-by-object extraction
    }
  }

  const results: { word: string; sentence: string; distractors: string[] }[] = []
  const objectRegex = /\{[^{}]*\}/g
  let match
  while ((match = objectRegex.exec(text)) !== null) {
    try {
      const obj = JSON.parse(match[0])
      if (obj.word && obj.sentence && Array.isArray(obj.distractors)) {
        results.push({
          ...obj,
          quiz_answer: obj.quiz_answer ?? null,
          inflections: Array.isArray(obj.inflections) ? obj.inflections : null,
        })
      }
    } catch {
      // skip malformed object
    }
  }
  return results
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { words, level, wordPool } = await req.json()

    if (!words?.length) return jsonResponse({ error: 'No words provided' }, 400)

    const wordList = words
      .map((w: { word: string; definition_en?: string }) =>
        `- ${w.word}${w.definition_en ? ` (${w.definition_en})` : ''}`
      )
      .join('\n')

    // Other words in the deck that can serve as distractors
    const poolWords: string[] = (wordPool ?? [])
      .map((w: { word: string }) => w.word)
      .filter((w: string) => !words.find((t: { word: string }) => t.word === w))

    const poolSection = poolWords.length > 0
      ? `\nVocabulary pool (prefer picking distractors from this list):\n${poolWords.join(', ')}\n`
      : ''

    // Level-specific guidance
    const levelName = level ?? 'Eiken 5'
    const levelGuide = (() => {
      const l = levelName.toLowerCase()
      if (l.includes('5') || l.includes('five')) return {
        label: 'Eiken Grade 5 (CEFR A1)',
        sentenceRule: 'Sentences must be 5-8 words. Use only: be verb, have, like, go, eat, drink, play + simple nouns. Present simple only. Subject is always I, You, He, She, We, They, or a simple noun.',
        grammarBan: 'NO past tense. NO modal verbs. NO questions. NO negatives.',
      }
      if (l.includes('4') || l.includes('four')) return {
        label: 'Eiken Grade 4 (CEFR A2)',
        sentenceRule: 'Sentences must be 6-10 words. Present and past simple. Modal verbs: can, want to, like to. Common vocabulary only.',
        grammarBan: 'NO present perfect. NO passive voice. NO complex clauses.',
      }
      if (l.includes('pre-2 plus') || l.includes('pre2plus') || l.includes('pre 2 plus')) return {
        label: 'Eiken Pre-2 Plus (CEFR B1+)',
        sentenceRule: 'Sentences 10-14 words. Present/past simple, present perfect, passive voice, modal verbs (should, must, might, could). Topics: social issues, technology, environment, opinions.',
        grammarBan: 'NO overly complex relative clauses. Keep sentence structure clear and unambiguous.',
      }
      if (l.includes('3') || l.includes('three') || l.includes('pre-2') || l.includes('pre2')) return {
        label: 'Eiken Grade 3 / Pre-2 (CEFR B1)',
        sentenceRule: 'Sentences 8-12 words. Present/past simple, present perfect, modal verbs (should, must, can). Common everyday topics.',
        grammarBan: 'NO passive voice. NO complex subordinate clauses.',
      }
      if (l.includes('2') || l.includes('two')) return {
        label: 'Eiken Grade 2 (CEFR B2)',
        sentenceRule: 'Sentences 8-14 words. Full grammar range including passive, conditionals, relative clauses. Academic and professional topics.',
        grammarBan: 'Avoid overly obscure vocabulary in the sentence context words.',
      }
      return {
        label: levelName,
        sentenceRule: 'Sentences 6-10 words. Use simple clear grammar matching the level.',
        grammarBan: '',
      }
    })()

    const prompt = `You are creating fill-in-the-blank vocabulary quiz questions for Japanese ESL students.
Level: ${levelGuide.label}

For each target word, output:
1. One English sentence with exactly "_____" (five underscores) as the blank.
2. quiz_answer — the EXACT inflected form that fills the blank (may differ from base form).
3. distractors — exactly 3 wrong answers inflected to the SAME grammatical form as quiz_answer.
4. inflections — an array of ALL notable word forms beyond the base form (stored for future use).
${poolSection}
CRITICAL — THE BLANK:
- The sentence field MUST contain "_____" (five underscores). No exceptions.
- The target word must NOT appear anywhere in the sentence.
- WRONG: {"word":"run","sentence":"She runs to school.",...} — word visible in sentence
- CORRECT: {"word":"run","sentence":"She _____ to school every day.",...}

SENTENCE RULES:
- ${levelGuide.sentenceRule}
- ${levelGuide.grammarBan}
- The sentence MUST include enough context (a specific object, complement, adverb, or subject type) so that synonyms and semantically related words would also be unnatural — not just the exact answer word.
  WEAK: "She _____ to school." (walk/run/bike all plausibly fit)
  STRONG: "She _____ the violin for two hours every evening." (only music-related verbs fit — distractors can now be unrelated verbs like "eat", "forget", "build")
- Do NOT use apostrophes — write "does not" not "doesn't", "I am" not "I'm".
- The blank must be grammatically and semantically unambiguous.

GRAMMAR FORM RULES:
- quiz_answer must be the exact inflected form the sentence requires.
  Examples: base "work" → "works" (3rd person present), "worked" (past), "working" (progressive)
- All 3 distractors must use the SAME grammatical form as quiz_answer so all choices look equivalent.
- For irregular verbs always use the correct irregular form: go→went, run→ran, have→had.

INFLECTIONS RULES:
- inflections is an array of all notable forms of the word beyond the base form.
- Include only forms that differ meaningfully from the base.
- Verbs: [3rd-person-s, past, past-participle, gerund] — e.g. ["works","worked","worked","working"]
- If past = past-participle, list it once: ["works","worked","working"]
- Irregular verbs: ["goes","went","gone","going"] — include the irregular forms explicitly.
- Nouns: just the plural if it differs — ["dogs"] or ["children"] for irregular plurals.
- Adjectives: comparative and superlative — ["happier","happiest"].
- If the word is invariable (e.g. "very", "the"), inflections = [].

DISTRACTOR RULES:
- All 3 distractors must be the same part of speech as the target word.
- Prefer distractors from the vocabulary pool — same category makes better wrong answers.
- Distractors MUST come from a completely different semantic domain than the answer word. Never pick words from the same semantic field (e.g., do not use other movement verbs as distractors for a movement verb answer).
  BAD: answer="run", distractors=["walk","skip","jog"] — all movement verbs, many fit the sentence
  GOOD: answer="run", distractors=["eat","forget","build"] — unrelated domains, clearly wrong
  BAD: answer="happy", distractors=["joyful","pleased","glad"] — near-synonyms, could fit
  GOOD: answer="happy", distractors=["tall","cloudy","narrow"] — unrelated adjectives, clearly wrong
- SELF-CHECK: Before finalising each distractor, mentally substitute it into the sentence. If the resulting sentence makes any sense at all, discard it and choose from an unrelated semantic domain instead.

Target words:
${wordList}

Respond ONLY with a JSON array, no markdown, no extra text:
[{"word":"run","sentence":"She _____ to school every day.","quiz_answer":"runs","distractors":["walks","swims","reads"],"inflections":["runs","ran","run","running"]}]`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      const errBody = await res.text()
      console.error('Anthropic error', res.status, errBody)
      return jsonResponse({ error: `AI error ${res.status}: ${errBody}` }, 502)
    }

    const ai = await res.json()
    const text: string = ai.content?.[0]?.text ?? ''
    const questions = extractQuestions(text)

    // Validate that every sentence contains _____ — reject any that don't
    const validQuestions = questions.filter(q => {
      if (!q.sentence.includes('_____')) {
        console.error(`Question for "${q.word}" missing blank: ${q.sentence}`)
        return false
      }
      return true
    })

    if (!validQuestions.length) {
      console.error('No valid questions extracted from:', text.slice(0, 500))
      return jsonResponse({ error: 'Could not parse questions from AI response' }, 500)
    }

    return jsonResponse({ questions: validQuestions })
  } catch (err) {
    console.error(err)
    return jsonResponse({ error: `Internal error: ${String(err)}` }, 500)
  }
})
