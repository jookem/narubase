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

interface Word {
  id: string
  word: string
  definition_en?: string | null
  definition_ja?: string | null
  example?: string | null
}

const BATCH_SIZE = 20

async function categorizeBatch(batch: Word[]): Promise<{ id: string; category: string }[]> {
  const list = batch
    .map(w => {
      const parts = [`ID: ${w.id}`, `Word: ${w.word}`]
      if (w.definition_en) parts.push(`EN: ${w.definition_en}`)
      if (w.definition_ja) parts.push(`JA: ${w.definition_ja}`)
      if (w.example) parts.push(`Example: ${w.example}`)
      return parts.join(' | ')
    })
    .join('\n')

  const prompt = `You are categorizing English vocabulary words for Japanese ESL students studying for the Eiken exam.

For each word, assign it to the BEST matching semantic/thematic category from this list:
- People & Family
- Places
- Food & Drink
- Animals & Nature
- Actions
- Feelings & Emotions
- Daily Life
- School & Study
- Sports & Activities
- Time & Frequency
- Weather & Seasons
- Describing Things
- Health & Body
- Technology
- Business & Work
- Society & Environment
- Expressions & Phrases

RULES:
- Use the definition and example to judge the best fit.
- "Expressions & Phrases" is for multi-word expressions, idioms, or fixed phrases (e.g. "be afraid of", "look forward to").
- "Time & Frequency" is for adverbs and expressions of time/frequency (e.g. "always", "sometimes", "every day").
- "Describing Things" is for adjectives and adverbs that describe qualities (e.g. "beautiful", "quickly", "expensive").
- "Actions" is for standalone verbs (e.g. "run", "study", "eat").
- If a word fits multiple categories, choose the most specific one.
- You may use a category not in this list if clearly more appropriate (e.g. "Numbers & Math", "Colors & Shapes").

Return ONLY a JSON array with exactly ${batch.length} entries — no extra text:
[{"id":"<id>","category":"<category>"},...]

Words:
${list}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY!,
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
    console.error('Anthropic error:', res.status, err)
    throw new Error(`Anthropic API error ${res.status}: ${err.slice(0, 200)}`)
  }

  const data = await res.json()
  const text: string = data.content?.[0]?.text?.trim() ?? ''
  console.log('AI response preview:', text.slice(0, 100))

  const match = text.match(/\[[\s\S]*\]/)
  if (!match) throw new Error(`No JSON array in response. Raw: ${text.slice(0, 200)}`)

  try {
    return JSON.parse(match[0])
  } catch (e) {
    throw new Error(`JSON parse failed: ${String(e)}. Raw: ${match[0].slice(0, 200)}`)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    if (!ANTHROPIC_API_KEY) {
      return jsonResponse({ error: 'ANTHROPIC_API_KEY secret is not set on this project' }, 500)
    }

    const body = await req.json()
    const words: Word[] = body?.words ?? []

    console.log(`vocab-categorize: received ${words.length} words`)

    if (!words.length) return jsonResponse({ categories: [] })

    // Split into batches
    const batches: Word[][] = []
    for (let i = 0; i < words.length; i += BATCH_SIZE) {
      batches.push(words.slice(i, i + BATCH_SIZE))
    }
    console.log(`vocab-categorize: ${batches.length} batches, processing 3 at a time`)

    // Process in parallel groups of 3 to avoid timeout on large decks
    const CONCURRENCY = 3
    const allCategories: { id: string; category: string }[] = []
    for (let i = 0; i < batches.length; i += CONCURRENCY) {
      const group = batches.slice(i, i + CONCURRENCY)
      const results = await Promise.allSettled(group.map(batch => categorizeBatch(batch)))
      for (const r of results) {
        if (r.status === 'rejected') {
          console.error('Batch failed:', r.reason)
          return jsonResponse({ error: String(r.reason) }, 500)
        }
        allCategories.push(...r.value)
      }
    }

    console.log(`vocab-categorize: returning ${allCategories.length} categories`)
    return jsonResponse({ categories: allCategories })
  } catch (err) {
    console.error('Unexpected error:', err)
    return jsonResponse({ error: `Unexpected error: ${String(err)}` }, 500)
  }
})
