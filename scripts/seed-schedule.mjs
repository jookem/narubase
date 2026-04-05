import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY
const TEACHER_EMAIL = process.env.TEACHER_EMAIL

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !TEACHER_EMAIL) {
  console.error('Set SUPABASE_URL, SERVICE_ROLE_KEY, and TEACHER_EMAIL env vars first.')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// --- helpers ---

async function getTeacherId() {
  const { data, error } = await admin
    .from('profiles')
    .select('id')
    .eq('email', TEACHER_EMAIL)
    .single()
  if (error || !data) { console.error('Teacher not found:', error?.message); process.exit(1) }
  return data.id
}

async function createPlaceholder(teacherId, name) {
  const email = `placeholder_${crypto.randomUUID()}@tlc-placeholder.internal`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: crypto.randomUUID(),
    email_confirm: true,
    user_metadata: { role: 'student', full_name: name },
  })
  if (error || !data.user) { console.error(`Failed to create ${name}:`, error?.message); return null }
  const uid = data.user.id

  // Ensure profile exists (trigger may not have fired yet)
  await admin.from('profiles').upsert({
    id: uid,
    full_name: name,
    email,
    role: 'student',
    is_placeholder: true,
  }, { onConflict: 'id' })

  await admin.from('teacher_student_relationships').insert({ teacher_id: teacherId, student_id: uid })

  console.log(`Created placeholder: ${name} (${uid})`)
  return uid
}

async function scheduleLesson(teacherId, studentId, start, end, type, coStudentIds = []) {
  const allStudents = [studentId, ...coStudentIds]
  const isGroup = allStudents.length > 1
  const now = new Date()

  const { data: lesson, error } = await admin.from('lessons').insert({
    teacher_id: teacherId,
    student_id: studentId,
    scheduled_start: start,
    scheduled_end: end,
    lesson_type: type,
    status: new Date(start) > now ? 'scheduled' : 'completed',
    is_group: isGroup,
  }).select('id').single()

  if (error || !lesson) { console.error('Lesson insert failed:', error?.message); return }

  if (isGroup) {
    await admin.from('lesson_participants').insert(
      allStudents.map(sid => ({ lesson_id: lesson.id, student_id: sid }))
    )
  }
}

// jst(dayOfWeek, hour, minute, weeksAhead)
// dayOfWeek: 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
function jst(dow, h, m, weeksAhead) {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
  const todayDow = now.getDay()
  let diff = dow - todayDow
  if (diff < 0 || (diff === 0 && now.getHours() >= h)) diff += 7
  diff += weeksAhead * 7
  const d = new Date(now)
  d.setDate(d.getDate() + diff)
  d.setHours(h, m, 0, 0)
  // Build ISO string in JST
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(h)}:${pad(m)}:00+09:00`
}

// --- main ---

const teacherId = await getTeacherId()
console.log('Teacher ID:', teacherId)

const riina   = await createPlaceholder(teacherId, 'Riina Fujiwara')
const kanna   = await createPlaceholder(teacherId, 'Kanna Wada')
const rurina  = await createPlaceholder(teacherId, 'Rurina Yoshida')
const rio     = await createPlaceholder(teacherId, 'Rio Kakiguchi')
const aru     = await createPlaceholder(teacherId, 'Aru Taniguchi')
const ema     = await createPlaceholder(teacherId, 'Ema Miyazaki')
const ryujin  = await createPlaceholder(teacherId, 'Ryujin Toyoda')

if ([riina, kanna, rurina, rio, aru, ema, ryujin].some(id => id === null)) {
  console.error('Some students failed. Stopping.')
  process.exit(1)
}

console.log('\nScheduling lessons...')

for (let w = 0; w < 4; w++) {
  // Riina + Kanna: Mon 18:30-19:30 (group, regular)
  await scheduleLesson(teacherId, riina, jst(1,18,30,w), jst(1,19,30,w), 'regular', [kanna])
  // Rurina: Mon 19:30-20:30
  await scheduleLesson(teacherId, rurina, jst(1,19,30,w), jst(1,20,30,w), 'regular')
  // Rio: Wed 19:30-20:30
  await scheduleLesson(teacherId, rio, jst(3,19,30,w), jst(3,20,30,w), 'regular')
  // Aru: Thu 18:30-19:30 (trial)
  await scheduleLesson(teacherId, aru, jst(4,18,30,w), jst(4,19,30,w), 'trial')
  // Ema: Sat 10:00-11:00 (trial)
  await scheduleLesson(teacherId, ema, jst(6,10,0,w), jst(6,11,0,w), 'trial')
  // Ryujin: Sat 11:00-12:00
  await scheduleLesson(teacherId, ryujin, jst(6,11,0,w), jst(6,12,0,w), 'regular')
  console.log(`Week ${w + 1} scheduled`)
}

console.log('\nDone! Refresh the app to see your students and lessons.')
