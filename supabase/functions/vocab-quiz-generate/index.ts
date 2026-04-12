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
1. A natural English sentence at A1 level where the target word is replaced with _____
   - Keep grammar simple (present simple, present continuous, basic past)
   - Use everyday topics (family, school, weather, food, hobbies)
   - Sometimes use short dialogue format like "A: ... B: It is _____ today."
   - The sentence should make the correct answer obvious from context
2. Exactly 3 distractor words that are the same part of speech but wrong in this context

Words:
${wordList}

Respond ONLY with a valid JSON array, no extra text:
[{"word":"example","sentence":"She likes to _____ books every evening.","distractors":["cook","swim","sing"]}]`

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

    if (!res.ok) return jsonResponse({ error: 'AI service error' }, 502)

    const ai = await res.json()
    const text: string = ai.content?.[0]?.text ?? ''
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const questions = JSON.parse(cleaned)

    return jsonResponse({ questions })
  } catch (err) {
    console.error(err)
    return jsonResponse({ error: `Internal error: ${String(err)}` }, 500)
  }
})
