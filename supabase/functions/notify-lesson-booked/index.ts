import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FROM_EMAIL = 'TLC English <onboarding@resend.dev>'

interface LessonRecord {
  id: string
  teacher_id: string
  student_id: string
  scheduled_start: string
  scheduled_end: string
  lesson_type: string
  status: string
}

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
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json()

    // Only handle INSERT of scheduled lessons
    if (payload.type !== 'INSERT' || payload.record?.status !== 'scheduled') {
      return new Response('skipped', { status: 200 })
    }

    const lesson = payload.record as LessonRecord

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const [{ data: teacher }, { data: student }] = await Promise.all([
      supabase.from('profiles').select('full_name, email, notifications_email').eq('id', lesson.teacher_id).single(),
      supabase.from('profiles').select('full_name, email, notifications_email').eq('id', lesson.student_id).single(),
    ])

    if (!teacher || !student) {
      return new Response('profiles not found', { status: 500 })
    }

    const lessonTime = formatJST(lesson.scheduled_start)
    const lessonEnd = new Date(lesson.scheduled_end).toLocaleString('en-US', {
      timeZone: 'Asia/Tokyo',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })

    // Email to teacher (if enabled)
    if (teacher.notifications_email !== false) {
      await sendEmail(
        teacher.email,
        `Lesson confirmed — ${student.full_name}`,
        `
          <p>Hi ${teacher.full_name},</p>
          <p>A lesson has been scheduled with <strong>${student.full_name}</strong>.</p>
          <p>
            <strong>When:</strong> ${lessonTime} – ${lessonEnd} JST<br/>
            <strong>Type:</strong> ${lesson.lesson_type}
          </p>
          <p>See you then!</p>
          <p style="color:#888;font-size:12px;">TLC English</p>
        `,
      )
    }

    // Email to student (if enabled)
    if (student.notifications_email !== false) {
      await sendEmail(
        student.email,
        `Lesson confirmed — ${teacher.full_name}`,
        `
          <p>Hi ${student.full_name},</p>
          <p>Your lesson with <strong>${teacher.full_name}</strong> has been confirmed.</p>
          <p>
            <strong>When:</strong> ${lessonTime} – ${lessonEnd} JST<br/>
            <strong>Type:</strong> ${lesson.lesson_type}
          </p>
          <p>See you then!</p>
          <p style="color:#888;font-size:12px;">TLC English</p>
        `,
      )
    }

    return new Response('emails sent', { status: 200 })
  } catch (err) {
    console.error(err)
    return new Response('error', { status: 500 })
  }
})
