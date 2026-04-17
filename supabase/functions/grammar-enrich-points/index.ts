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

type Point = { id: string; sentence_with_blank: string; answer: string; category?: string | null }

async function enrichBatch(batch: Point[]): Promise<Array<{ explanation: string; examples: string[] }>> {
  const list = batch.map((p, i) => {
    const filled = p.sentence_with_blank.replace('_____', `[${p.answer}]`)
    const pattern = p.category ? `  |  Pattern: ${p.category}` : ''
    return `${i + 1}. "${filled}"  |  Answer: "${p.answer}"${pattern}`
  }).join('\n')

  const prompt = `You write grammar notes for an ESL app for Japanese high school students.

For each item, produce:
- "explanation": one concise sentence about ONLY this specific grammar structure (not a general overview of multiple structures)
- "examples": exactly 2 short, natural English sentences using the same structure

Items:
${list}

Return ONLY a JSON array in the same order. Each element: {"explanation":"...","examples":["...","..."]}
No prose, no markdown fences.`

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

  if (!res.ok) throw new Error(`Anthropic API error: ${res.status}`)

  const data = await res.json()
  const text: string = data.content?.[0]?.text?.trim() ?? ''
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('No JSON array in response')
  return JSON.parse(match[0])
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (!ANTHROPIC_API_KEY) return jsonResponse({ error: 'ANTHROPIC_API_KEY not set' }, 500)

  try {
    const { points }: { points: Point[] } = await req.json()
    if (!Array.isArray(points) || points.length === 0) {
      return jsonResponse({ error: 'points array is required' }, 400)
    }

    const BATCH = 20
    const results: Array<{ id: string; explanation: string; examples: string[] }> = []

    for (let i = 0; i < points.length; i += BATCH) {
      const batch = points.slice(i, i + BATCH)
      const enriched = await enrichBatch(batch)
      if (enriched.length !== batch.length) {
        throw new Error(`Batch size mismatch: got ${enriched.length} for ${batch.length} points`)
      }
      for (let j = 0; j < batch.length; j++) {
        results.push({
          id: batch[j].id,
          explanation: enriched[j].explanation ?? '',
          examples: enriched[j].examples ?? [],
        })
      }
    }

    return jsonResponse({ results })
  } catch (err) {
    console.error('Unexpected error:', err)
    return jsonResponse({ error: String(err) }, 500)
  }
})
