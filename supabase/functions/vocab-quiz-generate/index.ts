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
function extractQuestions(text: string): { word: string; sentence: string; distractors: string[] }[] {
  // First try clean parse
  const arrayMatch = text.match(/\[[\s\S]*\]/)
  if (arrayMatch) {
    try {
      return JSON.parse(arrayMatch[0])
    } catch {
      // fall through to object-by-object extraction
    }
  }

  // Extract individual {...} objects and parse each separately
  const results: { word: string; sentence: string; distractors: string[] }[] = []
  const objectRegex = /\{[^{}]*\}/g
  let match
  while ((match = objectRegex.exec(text)) !== null) {
    try {
      const obj = JSON.parse(match[0])
      if (obj.word && obj.sentence && Array.isArray(obj.distractors)) {
        results.push(obj)
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
    const { words, level } = await req.json()

    if (!words?.length) return jsonResponse({ error: 'No words provided' }, 400)

    const wordList = words
      .map((w: { word: string; definition_en?: string }) =>
        `- ${w.word}${w.definition_en ? ` (${w.definition_en})` : ''}`
      )
      .join('\n')

    const prompt = `You are creating ${level ?? 'Eiken 5'} level fill-in-the-blank vocabulary questions for Japanese ESL students (A1 level).

For each word below, create:
1. A natural English sentence at A1 level where the target word fills the blank (_____).

CRITICAL RULES for the sentence:
- The blank must use the EXACT inflected form that fits the sentence grammar.
  If subject is she/he/it and tense is present simple, use the -s form (e.g. "makes" not "make").
  The "word" key in your JSON must also use this exact form.
- The sentence must contain a SPECIFIC context clue that makes ONLY ONE word logically correct.
  After writing the sentence, mentally test EVERY distractor in the blank. If any distractor also makes sense, rewrite the sentence with a stronger clue.
  BAD: "My grandfather stayed at the _____ for three days." (hospital AND hotel both work)
  GOOD: "My grandfather stayed at the _____ for three days after his operation." (only hospital)
- Keep grammar simple (present simple, present continuous, basic past).
- Use everyday topics (family, school, weather, food, hobbies).
- Sentence length: 8-14 words.
- IMPORTANT: Do NOT use apostrophes (write "does not" not "doesn't", "I am" not "I'm"). This ensures valid JSON.

2. Exactly 3 distractor words that are:
   - The same part of speech and grammatical form as the answer
   - Clearly wrong given the specific context clue in the sentence
   - Similar difficulty level

Words:
${wordList}

Respond ONLY with a valid JSON array, no markdown, no extra text:
[{"word":"makes","sentence":"My mother _____ delicious food for dinner every night.","distractors":["buys","orders","sells"]}]`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
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

    if (!questions.length) {
      console.error('No questions extracted from:', text.slice(0, 500))
      return jsonResponse({ error: `Could not parse questions from AI response` }, 500)
    }

    return jsonResponse({ questions })
  } catch (err) {
    console.error(err)
    return jsonResponse({ error: `Internal error: ${String(err)}` }, 500)
  }
})
