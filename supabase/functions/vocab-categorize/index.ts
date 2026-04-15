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

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function callAnthropic(prompt: string, retries = 1): Promise<string> {
  for (let attempt = 0; attempt <= retries; attempt++) {
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

    if (res.status === 429) {
      const err = await res.text()
      console.warn(`Rate limited (attempt ${attempt + 1}/${retries + 1}), waiting 10s…`, err.slice(0, 100))
      if (attempt < retries) { await sleep(10000); continue }
      throw new Error(`Anthropic rate limit after ${retries + 1} attempts`)
    }

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Anthropic API error ${res.status}: ${err.slice(0, 200)}`)
    }

    const data = await res.json()
    return data.content?.[0]?.text?.trim() ?? ''
  }
  throw new Error('callAnthropic: exhausted retries')
}

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

  const text = await callAnthropic(prompt)
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

    // Split into batches and process sequentially with a small delay to stay
    // within Anthropic's 10k output-tokens/minute rate limit
    const allCategories: { id: string; category: string }[] = []
    for (let i = 0; i < words.length; i += BATCH_SIZE) {
      const batch = words.slice(i, i + BATCH_SIZE)
      console.log(`vocab-categorize: batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(words.length / BATCH_SIZE)}`)
      try {
        const result = await categorizeBatch(batch)
        allCategories.push(...result)
      } catch (e) {
        console.error(`Batch ${i}–${i + batch.length} failed:`, e)
        return jsonResponse({ error: String(e) }, 500)
      }
      // 3.5s gap — keeps output tokens under 10k/min (500 tokens/batch × 60/3.5 ≈ 8,600/min)
      if (i + BATCH_SIZE < words.length) {
        await sleep(3500)
      }
    }

    console.log(`vocab-categorize: returning ${allCategories.length} categories`)
    return jsonResponse({ categories: allCategories })
  } catch (err) {
    console.error('Unexpected error:', err)
    return jsonResponse({ error: `Unexpected error: ${String(err)}` }, 500)
  }
})
