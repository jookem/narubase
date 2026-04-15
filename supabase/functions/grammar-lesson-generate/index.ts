const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')

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

  if (!ANTHROPIC_API_KEY) {
    return jsonResponse({ error: 'ANTHROPIC_API_KEY secret is not set on this function.' }, 500)
  }

  try {
    const { category, samples }: { category: string; samples: SampleQuestion[] } = await req.json()
    if (!category) return jsonResponse({ error: 'category is required' }, 400)

    const sampleList = (samples ?? [])
      .slice(0, 5)
      .map(q => `- ${q.sentence_with_blank.replace('_____', `[${q.answer}]`)}`)
      .join('\n')

    const prompt = `You are writing a detailed grammar lesson slide for Japanese students studying for the Eiken exam (levels 5–3). Students are aged 12–18. Write all English simply and clearly. Use Japanese where it helps understanding.

Grammar point: "${category}"

Sample quiz sentences from this category:
${sampleList || '(none provided)'}

---

OUTPUT: Return ONLY a valid JSON object. No text before or after. No markdown fences.

FIELDS:

"title": Exactly "${category}"

"explanation": A rich, step-by-step explanation using markdown formatting. Structure it like this:

  **Formula:** Show the grammar pattern clearly.
  e.g. **Formula:** Subject + *can* + base verb (動詞の原形)

  **意味 / Meaning:** One sentence in English and Japanese explaining what it means.

  **いつ使う？ / When to use:**
  Write a numbered list of the main uses/situations.
  1. Use 1 — short English explanation (Japanese in parentheses)
  2. Use 2 — etc.

  **⚠ 注意 / Watch out:**
  A bullet list of 2–3 common mistakes or important rules to remember.
  - Rule 1
  - Rule 2

  Use **bold** for key terms, *italics* for emphasis or example words.
  Keep each point short — one clear sentence each. No long paragraphs.
  If the grammar has multiple forms (e.g. my/your/his/her), address each form in the numbered list.

"examples": An array of strings. Each string is TWO lines separated by \\n:
  Line 1: A natural English example sentence.
  Line 2: Japanese translation.
  e.g. "She can speak three languages.\\n彼女は3カ国語を話すことができます。"

  Cover every major form or use case — minimum 4 examples, maximum 8.
  Vary the subject, context, and sentence type (positive, negative, question).
  Do NOT repeat the same form twice.

"hint_ja": 2–3 sentences in Japanese only. Summarise the grammar point, its formula, and a key tip for Japanese learners. Include the formula notation, e.g.「主語 + can + 動詞の原形」の形で能力や可能性を表します。

Return this exact structure:
{
  "title": "${category}",
  "explanation": "...",
  "examples": ["English 1.\\n日本語1。", "English 2.\\n日本語2。"],
  "hint_ja": "..."
}`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
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

    let slide: SlideResult
    try {
      const match = text.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('No JSON found')
      slide = JSON.parse(match[0])
    } catch (e) {
      console.error('Parse error:', e, 'Raw:', text)
      return jsonResponse({ error: 'Failed to parse slide response' }, 500)
    }

    if (!Array.isArray(slide.examples)) slide.examples = []

    return jsonResponse({ slide })
  } catch (err) {
    console.error('Unexpected error:', err)
    return jsonResponse({ error: String(err) }, 500)
  }
})
