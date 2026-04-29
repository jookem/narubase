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

    const prompt = `You are a Japanese English teacher creating lesson slides for Japanese students (ages 12–18) studying for the Eiken exam (levels 5–3). Your goal is clear, friendly, and bilingual teaching.

Grammar point: "${category}"

Sample quiz sentences:
${sampleList || '(none provided)'}

---

Generate 2–4 SHORT, FOCUSED lesson slides that break this grammar point into digestible steps.

SLIDE STRUCTURE RULES:
- Slide 1: Always the formula/form slide — introduce the pattern and its core meaning
- Slide 2+: One use case or sub-pattern per slide (e.g. negative form, question form, a specific meaning)
- Final slide (if needed): Common mistakes / 注意ポイント
- Each slide should be SHORT — students read one focused idea, not a wall of text

TITLE FORMAT: "${category} — Japanese subtitle"
e.g. "Present Perfect — 基本の形", "Can — 疑問文・否定文", "Present Perfect — 注意ポイント"

EXPLANATION FORMAT (use markdown, keep it SHORT per slide):
Each explanation should have 2–4 of these building blocks as appropriate:

**フォーム / Formula:**
Show the grammar pattern using both English labels and Japanese in parentheses.
e.g. Subject（主語）+ [have/has] + past participle（過去分詞）

**意味 / Meaning:**
One sentence in English + one sentence in Japanese.
e.g. 「完了・経験・継続」を表す現在完了形です。

**使い方 / How to use:**
A short numbered list — each item has English + Japanese in parentheses.
1. Talking about experience （経験を表す）— e.g. "Have you ever...?"
2. Talking about duration （継続を表す）— e.g. "I have lived here for 3 years."

**⚠ 注意 / Watch out:** (only if this slide needs it)
1–2 bullet points on common mistakes Japanese learners make.
e.g. - ✗ I have went → ✓ I have gone （過去分詞を使います）

Keep every bullet/numbered point to ONE clear sentence. No long paragraphs.

EXAMPLES FORMAT:
- Array of strings, each string is TWO lines joined by \\n:
  Line 1: English sentence with the grammar point wrapped in [square brackets]
  Line 2: Natural Japanese translation
  e.g. "She [has lived] in Tokyo for five years.\\n彼女は5年間東京に住んでいます。"
- 3–5 examples per slide, matching the specific focus of that slide
- Vary subjects, contexts, positive/negative/question as fits the slide topic

HINT_JA:
2–3 sentences in Japanese ONLY. Summarise this slide's concept with the formula notation.
e.g.「主語 + have/has + 過去分詞」の形で経験を表します。"Have you ever ~?" は「〜したことがありますか？」という意味です。

---

OUTPUT: Return ONLY a valid JSON object. No text before or after. No markdown fences.

{
  "slides": [
    {
      "title": "...",
      "explanation": "...",
      "examples": ["English 1\\n日本語1", "English 2\\n日本語2"],
      "hint_ja": "..."
    }
  ]
}`

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
      return jsonResponse({ error: `Anthropic API error: ${res.status}` }, 500)
    }

    const data = await res.json()
    const text: string = data.content?.[0]?.text?.trim() ?? ''

    let parsed: { slides?: SlideResult[]; slide?: SlideResult }
    try {
      const match = text.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('No JSON found')
      parsed = JSON.parse(match[0])
    } catch (e) {
      console.error('Parse error:', e, 'Raw:', text)
      return jsonResponse({ error: 'Failed to parse slide response' }, 500)
    }

    // Normalise: support both { slides: [...] } and legacy { slide: {...} }
    const slides: SlideResult[] = Array.isArray(parsed.slides)
      ? parsed.slides
      : parsed.slide
        ? [parsed.slide]
        : []

    slides.forEach(s => {
      if (!Array.isArray(s.examples)) s.examples = []
    })

    if (slides.length === 0) {
      return jsonResponse({ error: 'No slides returned by model' }, 500)
    }

    return jsonResponse({ slides })
  } catch (err) {
    console.error('Unexpected error:', err)
    return jsonResponse({ error: String(err) }, 500)
  }
})
