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

function buildPrompt(body: Record<string, any>): string {
  const { student_input, level, format, picture_description, picture_b_description,
    passage_title, passage_text, starter_sentence, questions } = body

  const base = `You are a helpful English teacher assisting Japanese ESL students practicing for the ${level} exam.`
  const correction = `\nYour task:\n1. Fix any grammar or spelling mistakes in the student's response, keeping their meaning and vocabulary close to the original\n2. Write a short, encouraging feedback message (1-2 sentences)\n3. Be lenient — partial correct answers are acceptable\n\nRespond ONLY with valid JSON: {"corrected":"corrected version","feedback":"encouraging message"}`

  if (format === 'passage' || format === 'passage-qa') {
    const passageContext = passage_text
      ? `Passage title: ${passage_title ?? ''}\nPassage: ${passage_text}`
      : ''
    const pictureContext = picture_description ? `Picture shows: ${picture_description}` : ''
    const questionsContext = questions?.length
      ? `Questions the student should answer:\n${questions.map((q: string, i: number) => `No.${i + 1}: ${q}`).join('\n')}`
      : ''
    return `${base}\n\n${passageContext}\n${pictureContext}\n${questionsContext}\n\nStudent's response:\n"${student_input}"${correction}`
  }

  if (format === 'dual') {
    const aContext = picture_description ? `Picture A shows: ${picture_description}` : ''
    const bContext = picture_b_description ? `Picture B shows: ${picture_b_description}` : ''
    return `${base}\n\nThe student was shown two pictures and asked to describe them.\n${aContext}\n${bContext}\n\nStudent's response:\n"${student_input}"${correction}`
  }

  if (format === 'comic' || format === 'comic-timer') {
    const starterContext = starter_sentence ? `The story must begin with: "${starter_sentence}"` : ''
    const comicContext = picture_description ? `Comic strip shows: ${picture_description}` : ''
    return `${base}\n\nThe student was shown a comic strip and asked to narrate the story.\n${starterContext}\n${comicContext}\n\nStudent's response:\n"${student_input}"${correction}`
  }

  // Fallback
  return `${base}\n\nPicture shows: ${picture_description ?? 'unknown'}\n\nStudent's response:\n"${student_input}"${correction}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    const { student_input } = body

    if (!student_input || student_input.trim().length < 3) {
      return jsonResponse({
        corrected: null,
        feedback: 'Please try to describe what you see — any attempt is great!',
      })
    }

    const prompt = buildPrompt(body)

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
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) return jsonResponse({ error: 'AI service error' }, 502)

    const ai = await res.json()
    const text: string = ai.content?.[0]?.text ?? ''
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const result = JSON.parse(cleaned)

    return jsonResponse(result)
  } catch (err) {
    console.error(err)
    return jsonResponse({ error: `Internal error: ${String(err)}` }, 500)
  }
})
