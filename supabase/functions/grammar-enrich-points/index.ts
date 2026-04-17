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

interface Point {
  id: string
  sentence_with_blank: string
  answer: string
  category?: string | null
}

const BATCH_SIZE = 20

async function enrichBatch(batch: Point[]): Promise<{ id: string; explanation: string; examples: string[] }[]> {
  const list = batch
    .map(p => {
      const filled = p.sentence_with_blank.replace('_____', `[${p.answer}]`)
      const pattern = p.category ? `  |  Pattern: ${p.category}` : ''
      return `ID: ${p.id}\nSentence: "${filled}"  |  Answer: "${p.answer}"${pattern}`
    })
    .join('\n\n')

  const prompt = `You write grammar notes for an ESL app for Japanese high school students.

For each item below, write:
- "explanation": one concise sentence about ONLY this specific grammar structure
- "examples": exactly 2 short, natural English sentences using the same structure

${list}

Return ONLY a valid JSON array in any order. Each element must include the original ID:
[{"id":"<id>","explanation":"...","examples":["...","..."]}]
No prose, no markdown fences.`

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
    throw new Error(`Anthropic API error: ${res.status}`)
  }

  const data = await res.json()
  const text: string = data.content?.[0]?.text?.trim() ?? ''

  const match = text.match(/\[[\s\S]*\]/)
  if (!match) throw new Error(`No JSON array in response. Raw: ${text.slice(0, 300)}`)
  return JSON.parse(match[0])
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { points }: { points: Point[] } = await req.json()
    if (!points?.length) return jsonResponse({ results: [] })

    const allResults: { id: string; explanation: string; examples: string[] }[] = []

    for (let i = 0; i < points.length; i += BATCH_SIZE) {
      const batch = points.slice(i, i + BATCH_SIZE)
      try {
        const result = await enrichBatch(batch)
        allResults.push(...result)
      } catch (e) {
        console.error(`Batch ${i}–${i + batch.length} failed:`, e)
        return jsonResponse({ error: String(e) }, 500)
      }
    }

    return jsonResponse({ results: allResults })
  } catch (err) {
    console.error('Unexpected error:', err)
    return jsonResponse({ error: String(err) }, 500)
  }
})
