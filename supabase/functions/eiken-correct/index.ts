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
    const { student_input, level, picture_description } = await req.json()

    if (!student_input || student_input.trim().length < 3) {
      return jsonResponse({
        corrected: null,
        feedback: 'Please try to describe what you see — any attempt is great!',
      })
    }

    const pictureContext = picture_description
      ? `The picture shows: ${picture_description}`
      : 'No picture description was provided.'

    const prompt = `You are a helpful English teacher assisting Japanese ESL students practicing for the ${level} exam.

${pictureContext}

The student was shown this picture and asked to describe it in English. Here is their response:

"${student_input}"

Your task:
1. Fix any grammar or spelling mistakes in their response
2. Keep their meaning and vocabulary as close to the original as possible — only change what is wrong
3. Write a short, encouraging feedback message (1-2 sentences in English)
4. Be lenient — if the student described something visible in the picture, that is acceptable even if they missed other details

Respond ONLY with valid JSON in this exact format with no extra text:
{"corrected":"the corrected version here","feedback":"encouraging message here"}`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) return jsonResponse({ error: 'AI service error' }, 502)

    const ai = await res.json()
    const text: string = ai.content?.[0]?.text ?? ''

    // Strip markdown code fences if Claude wrapped the JSON
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const result = JSON.parse(cleaned)

    return jsonResponse(result)
  } catch (err) {
    console.error(err)
    return jsonResponse({ error: `Internal error: ${String(err)}` }, 500)
  }
})
