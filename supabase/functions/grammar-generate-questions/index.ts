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

━━━ RULE 1 — MULTI-WORD ANSWERS USE " / " SEPARATOR ━━━
When the grammar point requires more than one word (e.g. "has lived", "was written", "will go"),
use ONE _____ blank per word in the sentence, and separate the answer words with " / " (space-slash-space).

Examples:
- answer "has / lived" → sentence: "She _____ _____ in Tokyo for five years."
- answer "was / written" → sentence: "The letter _____ _____ by Tom."
- answer "will / go" → sentence: "They _____ _____ to the park tomorrow."
- answer "is / running" → sentence: "He _____ _____ in the park."
- answer "heavier" (one word) → sentence: "This bag is _____ than mine."

Distractors for multi-word answers must also use " / " format and have the same number of words:
- correct: "has / lived" → distractors: ["have / lived", "is / living", "was / living"]
- correct: "was / written" → distractors: ["is / written", "were / write", "has / written"]

━━━ RULE 2 — THE BLANK TESTS THE GRAMMAR POINT ━━━
The blank(s) must always replace the target grammar structure for "${topic}".
NEVER blank out a random noun, adjective, or preposition that has nothing to do with the grammar point.

CORRECT:
- Topic "Present Perfect" → "She _____ _____ in Tokyo for five years." (answer: has / lived)
- Topic "Past Simple" → "He _____ the door and walked in." (answer: opened)
- Topic "Passive Voice" → "The letter _____ _____ by Tom." (answer: was / written)
- Topic "Comparatives" → "This bag is _____ than mine." (answer: heavier)
- Topic "Modal Verbs" → "You _____ wear a seatbelt." (answer: must)

WRONG (do NOT do this):
- Topic "Present Perfect" → "She has lived in _____ for five years." (blanking a noun)
- Topic "Modal Verbs" → "You must wear a _____." (blanking a noun)

━━━ RULE 3 — hint_ja IS THE FULL JAPANESE SENTENCE ━━━
hint_ja must be a natural Japanese translation of the ENTIRE sentence (with the blanks filled in).
It is NOT just a translation of the answer words — it is the complete Japanese equivalent sentence.
The Japanese must use the grammatically equivalent form, not word-for-word translation.

Examples:
- sentence: "She _____ _____ in Tokyo for five years." (answer: has / lived)
  → hint_ja: "彼女は5年間東京に住んでいます。"
- sentence: "The letter _____ _____ by Tom." (answer: was / written)
  → hint_ja: "その手紙はトムによって書かれました。"
- sentence: "Will you _____ me _____ to the concert?" (answer: let / go)
  → hint_ja: "コンサートに行かせてくれますか？"
- sentence: "This bag is _____ than mine." (answer: heavier)
  → hint_ja: "このバッグは私のより重いです。"
- sentence: "You _____ wear a seatbelt." (answer: must)
  → hint_ja: "シートベルトを着用しなければなりません。"

━━━ RULE 4 — DISTRACTORS MUST BE CLEARLY WRONG ━━━
Distractors must be GRAMMATICALLY INCORRECT — broken forms that no teacher could ever mark as correct.
They should look tempting to a student but be definitively wrong for the grammar rule being tested.

WRONG approach (these are valid English in other contexts — students could argue they're correct):
- answer "has / lived" → BAD distractors: "have / lived", "had / lived", "will / live"
  (These are all valid English tenses — just wrong here. A student can argue.)

CORRECT approach (these are broken forms — no argument possible):
- answer "has / lived" → GOOD distractors: "has / live", "have / living", "is / lived"
  ("has live" = wrong infinitive; "have living" = wrong participle; "is lived" = wrong auxiliary)
- answer "was / written" → GOOD distractors: "was / write", "is / wrote", "were / writing"
- answer "will / go" → GOOD distractors: "will / went", "will / gone", "would / going"
- answer "opened" → GOOD distractors: "opening", "open", "has open"
- answer "heavier" → GOOD distractors: "more heavy", "heaviest", "heavy"

The goal: a student who doesn't know the rule might pick one, but a student who knows cannot argue it's correct.
Same number of words and " / " format as the answer.

━━━ RULE 5 — OTHER REQUIREMENTS ━━━
- category: broad consistent name, no parenthetical sub-types
- Vary subjects and contexts across questions (affirmative, negative, question forms)

Return ONLY a valid JSON object, no text before or after:
{
  "questions": [
    {
      "sentence_with_blank": "She _____ _____ in Tokyo for five years.",
      "answer": "has / lived",
      "hint_ja": "彼女は5年間東京に住んでいます。",
      "distractors": ["have / lived", "is / living", "was / living"],
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
