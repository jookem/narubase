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

interface SampleQuestion {
  sentence_with_blank: string
  answer: string
  hint_ja?: string
}

interface SlideResult {
  title: string
  explanation: string
  examples: string[]
  hint_ja: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { category, samples }: { category: string; samples: SampleQuestion[] } = await req.json()
    if (!category) return jsonResponse({ error: 'category is required' }, 400)

    const sampleList = (samples ?? [])
      .slice(0, 5)
      .map(q => `- ${q.sentence_with_blank.replace('_____', `[${q.answer}]`)}`)
      .join('\n')

    const prompt = `You are writing an English grammar lesson slide for Japanese students preparing for the Eiken exam.

Grammar point: "${category}"

Sample sentences from this grammar category:
${sampleList || '(none provided)'}

OUTPUT: Return ONLY a JSON object. No explanation before or after. No markdown. Just the raw JSON.

{
  "title": "${category}",
  "explanation": "ENGLISH ONLY. 2-3 sentences explaining: (1) the grammar formula/structure written out (e.g. Subject + verb + object), (2) when and why to use this form, (3) any key rules to remember. Write entirely in English. Do NOT write Japanese here.",
  "examples": [
    "A natural English sentence showing this grammar.",
    "Another natural English sentence showing this grammar.",
    "A third natural English sentence showing this grammar.",
    "A fourth natural English sentence showing this grammar."
  ],
  "hint_ja": "JAPANESE ONLY. 2-3 sentences in Japanese explaining the grammar structure and usage. Include the formula written in Japanese style (e.g.「主語 ＋ 動詞の原形」の形で使います). Do NOT write English here."
}

IMPORTANT:
- "explanation" must be written entirely in ENGLISH — this is the English grammar rule explanation
- "examples" must be exactly 4 English sentences — simple vocabulary suitable for Eiken 5 to 3 level students
- "hint_ja" must be written entirely in JAPANESE — this is the Japanese translation/explanation for students
- Do not swap these fields`

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

    let slide: SlideResult
    try {
      const match = text.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('No JSON found')
      slide = JSON.parse(match[0])
    } catch (e) {
      console.error('Parse error:', e, 'Raw:', text)
      return jsonResponse({ error: 'Failed to parse slide response' }, 500)
    }

    // Ensure examples is always an array of at least 4
    if (!Array.isArray(slide.examples)) slide.examples = []

    return jsonResponse({ slide })
  } catch (err) {
    console.error('Unexpected error:', err)
    return jsonResponse({ error: String(err) }, 500)
  }
})
