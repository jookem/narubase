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

interface GeneratedQuestion {
  sentence_with_blank: string
  answer: string
  hint_ja: string
  distractors: string[]
  category: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { topic, examples, count }: { topic: string; examples?: string[]; count?: number } = await req.json()
    if (!topic) return jsonResponse({ error: 'topic is required' }, 400)

    const targetCount = Math.min(Math.max(count ?? 10, 5), 20)

    const exampleBlock = examples && examples.length > 0
      ? `\nHere are example sentences from the lesson slides showing the grammar pattern (the grammar point is inside [brackets]):\n${examples.slice(0, 6).map(e => `- ${e}`).join('\n')}\nMatch the vocabulary difficulty and sentence style of these examples.\n`
      : ''

    const prompt = `You are creating fill-in-the-blank grammar quiz questions for Japanese students studying English.

Grammar topic: "${topic}"
${exampleBlock}
Generate exactly ${targetCount} questions. Follow ALL rules below precisely.

━━━ RULE 1 — THE BLANK TESTS THE GRAMMAR POINT ━━━
The blank _____ must always replace the target grammar structure for "${topic}".
NEVER blank out a random noun, adjective, or preposition that has nothing to do with the grammar point.

Examples of CORRECT blank placement:
- Topic "Present Perfect" → "She _____ in Tokyo for five years." (answer: has lived)
- Topic "Past Simple" → "He _____ the door and walked in." (answer: opened)
- Topic "Passive Voice" → "The letter _____ by Tom." (answer: was written)
- Topic "Comparatives" → "This bag is _____ than mine." (answer: heavier)
- Topic "Modal Verbs" → "You _____ wear a seatbelt." (answer: must)

Examples of WRONG blank placement (do NOT do this):
- Topic "Present Perfect" → "She has lived in _____ for five years." (blanking a noun = wrong)
- Topic "Modal Verbs" → "You must wear a _____." (blanking a noun = wrong)

━━━ RULE 2 — hint_ja IS A CONJUGATED TRANSLATION ━━━
hint_ja must be the Japanese translation of the ANSWER, conjugated into the SAME grammatical form as the answer.
The Japanese form must match the English tense/aspect/mood exactly.

Examples:
- answer: "has eaten" → hint_ja: "食べました" (NOT 食べる)
- answer: "was written" → hint_ja: "書かれました" (passive, NOT 書く)
- answer: "will go" → hint_ja: "行くでしょう" (future, NOT 行く)
- answer: "is running" → hint_ja: "走っています" (continuous, NOT 走る)
- answer: "had finished" → hint_ja: "終わっていた" (past perfect, NOT 終わる)
- answer: "must study" → hint_ja: "勉強しなければなりません"
- answer: "heavier" → hint_ja: "より重い"

━━━ RULE 3 — OTHER REQUIREMENTS ━━━
- 3 distractors: same part of speech, grammatically plausible but wrong (wrong tense, wrong form, etc.)
- category: broad consistent name for the grammar sub-type, no parenthetical sub-types
- Vary subjects and contexts across questions (affirmative, negative, questions)

Return ONLY a valid JSON object, no text before or after:
{
  "questions": [
    {
      "sentence_with_blank": "She _____ in Tokyo for five years.",
      "answer": "has lived",
      "hint_ja": "住んでいます",
      "distractors": ["lived", "is living", "lives"],
      "category": "Present Perfect"
    }
  ]
}`

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
      const err = await res.text()
      console.error('Anthropic error:', err)
      return jsonResponse({ error: `Anthropic API error: ${res.status}` }, 500)
    }

    const data = await res.json()
    const text: string = data.content?.[0]?.text?.trim() ?? ''

    let parsed: { questions?: GeneratedQuestion[] }
    try {
      const match = text.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('No JSON found')
      parsed = JSON.parse(match[0])
    } catch (e) {
      console.error('Parse error:', e, 'Raw:', text)
      return jsonResponse({ error: 'Failed to parse questions response' }, 500)
    }

    const questions: GeneratedQuestion[] = Array.isArray(parsed.questions)
      ? parsed.questions.filter(q =>
          q.sentence_with_blank?.includes('_____') && q.answer && q.category
        )
      : []

    if (questions.length === 0) {
      return jsonResponse({ error: 'No valid questions returned by model' }, 500)
    }

    return jsonResponse({ questions })
  } catch (err) {
    console.error('Unexpected error:', err)
    return jsonResponse({ error: String(err) }, 500)
  }
})
