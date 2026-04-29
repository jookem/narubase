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

const LEVEL_GUIDE: Record<string, string> = {
  beginner:     'Use very short, simple sentences. Everyday vocabulary only. Be encouraging.',
  intermediate: 'Use natural conversational sentences. Moderate complexity is fine.',
  advanced:     'Use natural, nuanced language with richer vocabulary and grammar.',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { situation, history, student_name } = await req.json()

    const levelGuide = LEVEL_GUIDE[situation.difficulty] ?? 'Use natural conversational language.'

    const system = `You are roleplaying as ${situation.npc_name}, ${situation.npc_role}.
The student (${student_name}) is practising a real-life conversation scenario.

Situation: "${situation.title}"
${situation.description}

Language level: ${situation.difficulty}. ${levelGuide}

Rules:
- Keep your response to 1-2 sentences maximum.
- Generate exactly 3 student reply options that feel natural and meaningfully different (e.g. polite vs direct, asking different follow-ups, or showing varying confidence).
- Choose an expression that fits your mood: neutral | speaking | positive | confused | thinking
- Set is_end to true only when the conversation goal has been naturally achieved (usually after 4-8 exchanges).
- Stay in character at all times.
- Respond with ONLY valid JSON — no preamble, no explanation:

{"npc_text":"…","expression":"neutral","options":[{"text":"…"},{"text":"…"},{"text":"…"}],"is_end":false}`

    // Build message history: opener + alternating assistant/user turns
    const messages: { role: 'user' | 'assistant'; content: string }[] = [
      { role: 'user', content: '[Begin the conversation]' },
    ]
    for (const h of (history as Array<{ speaker: string; text: string }>)) {
      messages.push({
        role: h.speaker === 'student' ? 'user' : 'assistant',
        content: h.text,
      })
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        system,
        messages,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Anthropic error:', err)
      return jsonResponse({ error: `Anthropic API error: ${res.status}` }, 500)
    }

    const data = await res.json()
    const text: string = data.content?.[0]?.text?.trim() ?? ''

    // Extract JSON even if the model adds surrounding text
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) {
      console.error('No JSON in response:', text.slice(0, 300))
      return jsonResponse({ error: 'Invalid AI response format' }, 500)
    }

    return jsonResponse(JSON.parse(match[0]))
  } catch (err) {
    console.error('Unexpected error:', err)
    return jsonResponse({ error: String(err) }, 500)
  }
})
