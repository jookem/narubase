import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FROM_EMAIL = 'TLC English <onboarding@resend.dev>'

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  })
  return res.ok
}

function formatJST(isoString: string) {
  return new Date(isoString).toLocaleString('en-US', {
    timeZone: 'Asia/Tokyo',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

Deno.serve(async () => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Find lessons starting between 55 and 65 minutes from now
    const now = new Date()
    const windowStart = new Date(now.getTime() + 55 * 60 * 1000)
    const windowEnd = new Date(now.getTime() + 65 * 60 * 1000)

    const { data: lessons, error } = await supabase
      .from('lessons')
      .select(`
        id,
        scheduled_start,
        scheduled_end,
        lesson_type,
        teacher:profiles!lessons_teacher_id_fkey(full_name, email),
        student:profiles!lessons_student_id_fkey(full_name, email)
      `)
      .eq('status', 'scheduled')
      .gte('scheduled_start', windowStart.toISOString())
      .lte('scheduled_start', windowEnd.toISOString())

    if (error) {
      console.error('Query error:', error)
      return new Response('query error', { status: 500 })
    }

    if (!lessons?.length) {
      return new Response('no lessons due', { status: 200 })
    }

    let sent = 0

    for (const lesson of lessons) {
      const teacher = (lesson as any).teacher
      const student = (lesson as any).student
      if (!teacher || !student) continue

      const lessonTime = formatJST(lesson.scheduled_start)
      const lessonEnd = new Date(lesson.scheduled_end).toLocaleString('en-US', {
        timeZone: 'Asia/Tokyo',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })

      await sendEmail(
        teacher.email,
        `Reminder: lesson with ${student.full_name} in 1 hour`,
        `
          <p>Hi ${teacher.full_name},</p>
          <p>Your lesson with <strong>${student.full_name}</strong> starts in about 1 hour.</p>
          <p>
            <strong>When:</strong> ${lessonTime} – ${lessonEnd} JST<br/>
            <strong>Type:</strong> ${lesson.lesson_type}
          </p>
          <p style="color:#888;font-size:12px;">TLC English</p>
        `,
      )

      await sendEmail(
        student.email,
        `Reminder: lesson with ${teacher.full_name} in 1 hour`,
        `
          <p>Hi ${student.full_name},</p>
          <p>Your lesson with <strong>${teacher.full_name}</strong> starts in about 1 hour.</p>
          <p>
            <strong>When:</strong> ${lessonTime} – ${lessonEnd} JST<br/>
            <strong>Type:</strong> ${lesson.lesson_type}
          </p>
          <p style="color:#888;font-size:12px;">TLC English</p>
        `,
      )

      sent += 2
    }

    return new Response(`sent ${sent} emails for ${lessons.length} lessons`, { status: 200 })
  } catch (err) {
    console.error(err)
    return new Response('error', { status: 500 })
  }
})
