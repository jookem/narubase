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

interface Question {
  id: string
  sentence_with_blank: string
  answer: string
  hint_ja?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { questions }: { questions: Question[] } = await req.json()
    if (!questions?.length) return jsonResponse({ categories: [] })

    const list = questions
      .map(q => `ID: ${q.id}\nSentence: ${q.sentence_with_blank}\nAnswer: "${q.answer}"${q.hint_ja ? `\nHint: ${q.hint_ja}` : ''}`)
      .join('\n\n')

    const prompt = `You are categorizing ESL grammar questions for Japanese students studying for the Eiken exam.

For each question, identify the specific English grammar category. Use clear, concise names like:
"Present Simple", "Present Continuous", "Past Simple", "Past Continuous",
"Present Perfect", "Past Perfect", "Future with will", "be going to",
"Modal Verbs", "Passive Voice", "Conditionals", "Comparatives", "Superlatives",
"Articles", "Prepositions", "Gerunds and Infinitives", "Question Tags",
"Relative Clauses", "Reported Speech", "Conjunctions", etc.

Return ONLY a JSON array, no extra text:
[{"id":"<id>","category":"<grammar category>"},...]

Questions:
${list}`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
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

    let categories: { id: string; category: string }[] = []
    try {
      const match = text.match(/\[[\s\S]*\]/)
      if (match) categories = JSON.parse(match[0])
    } catch (e) {
      console.error('Parse error:', e, 'Raw:', text)
      return jsonResponse({ error: 'Failed to parse category response' }, 500)
    }

    return jsonResponse({ categories })
  } catch (err) {
    console.error('Unexpected error:', err)
    return jsonResponse({ error: String(err) }, 500)
  }
})
