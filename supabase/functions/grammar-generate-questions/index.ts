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
    const { topic, level, count }: { topic: string; level: string; count: number } = await req.json()
    if (!topic) return jsonResponse({ error: 'topic is required' }, 400)

    const targetCount = Math.min(Math.max(count ?? 10, 5), 20)

    const levelDescriptions: Record<string, string> = {
      '5': 'Eiken Level 5 (absolute beginner — simple sentences, to be, basic present simple, numbers, colours)',
      '4': 'Eiken Level 4 (beginner — present/past simple, can, there is/are, basic questions)',
      '3': 'Eiken Level 3 (pre-intermediate — present perfect, comparatives, modal verbs, passive, basic conditionals)',
      '2': 'Eiken Level 2 (intermediate — all tenses, conditionals, relative clauses, reported speech)',
      '1': 'Eiken Level 1 (advanced — complex grammar, academic structures)',
    }
    const levelDesc = levelDescriptions[level] ?? levelDescriptions['3']

    const prompt = `You are creating fill-in-the-blank grammar quiz questions for Japanese students studying English (ages 12–18).

Grammar topic: "${topic}"
Difficulty: ${levelDesc}
Number of questions to generate: ${targetCount}

REQUIREMENTS:
1. Each sentence must contain exactly _____ (five underscores) to mark the blank.
2. The answer is a single word or short phrase (1–3 words) that fills the blank correctly.
3. Sentences should be natural, age-appropriate, and varied in subject/context.
4. Provide 3 distractors — wrong answer choices that are plausible but incorrect. They should be the same part of speech as the answer but wrong for this sentence.
5. hint_ja: A SHORT Japanese grammar hint (8–15 characters) showing the grammatical concept. e.g. "現在進行形", "過去形", "助動詞 can", "比較級"
6. category: The grammar sub-category this question belongs to. Use a broad, consistent name matching the topic (e.g. "Present Continuous", "Comparatives", "Past Simple"). Never add parenthetical sub-types like "(whose)" or "(Type 1)".
7. All ${targetCount} questions must cover the topic "${topic}" — vary the sub-patterns (affirmative, negative, question forms, different contexts).

Return ONLY a valid JSON object, no text before or after:
{
  "questions": [
    {
      "sentence_with_blank": "She _____ to school every day.",
      "answer": "walks",
      "hint_ja": "三単現の -s",
      "distractors": ["walk", "walked", "walking"],
      "category": "Present Simple"
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
