import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonError(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonError('Unauthorized', 401)

    // Decode JWT (gateway already verified signature)
    const jwt = authHeader.replace('Bearer ', '')
    const payload = JSON.parse(atob(jwt.split('.')[1]))
    const teacherId: string = payload.sub
    if (!teacherId) return jsonError('Unauthorized', 401)

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Verify caller is a teacher
    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', teacherId)
      .single()

    if (callerProfile?.role !== 'teacher') return jsonError('Forbidden', 403)

    const { student_id, password } = await req.json()
    if (!student_id || !password || password.length < 6) {
      return jsonError('student_id and password (min 6 chars) are required.', 400)
    }

    // Verify teacher has an active relationship with this student
    const { data: rel } = await adminClient
      .from('teacher_student_relationships')
      .select('id')
      .eq('teacher_id', teacherId)
      .eq('student_id', student_id)
      .eq('status', 'active')
      .single()

    if (!rel) return jsonError('Student not found in your roster.', 404)

    const { error } = await adminClient.auth.admin.updateUserById(student_id, { password })
    if (error) return jsonError(error.message, 500)

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error(err)
    return jsonError(`Internal error: ${String(err)}`, 500)
  }
})
