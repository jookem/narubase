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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Decode JWT to get caller's user ID (gateway already verified the signature)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonError('Unauthorized', 401)

    const jwt = authHeader.replace('Bearer ', '')
    const payload = JSON.parse(atob(jwt.split('.')[1]))
    const teacherId: string = payload.sub
    if (!teacherId) return jsonError('Unauthorized', 401)

    // Service role client — bypass RLS for all subsequent operations
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Verify the caller is a teacher
    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', teacherId)
      .single()

    if (callerProfile?.role !== 'teacher') return jsonError('Forbidden — teachers only', 403)

    const { name, initial_password } = await req.json()
    if (!name?.trim()) return jsonError('Name is required', 400)
    if (!initial_password || initial_password.length < 6) {
      return jsonError('initial_password (min 6 chars) is required.', 400)
    }

    // Create auth user for the placeholder student
    const placeholderEmail = `student_${crypto.randomUUID()}@tlc-student.internal`

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: placeholderEmail,
      password: initial_password,
      email_confirm: true,
      user_metadata: {
        role: 'student',
        full_name: name.trim(),
      },
    })

    if (createError || !newUser.user) {
      return jsonError(createError?.message ?? 'Failed to create auth user', 500)
    }

    // Upsert profile — handles both trigger-created and missing profiles
    const { error: profileError } = await adminClient
      .from('profiles')
      .upsert({
        id: newUser.user.id,
        email: placeholderEmail,
        full_name: name.trim(),
        role: 'student',
        is_placeholder: true,
      })

    if (profileError) return jsonError(`Profile error: ${profileError.message}`, 500)

    // Link student to this teacher
    const { error: relError } = await adminClient
      .from('teacher_student_relationships')
      .insert({ teacher_id: teacherId, student_id: newUser.user.id })

    if (relError) return jsonError(`Relationship error: ${relError.message}`, 500)

    return new Response(
      JSON.stringify({ id: newUser.user.id, name: name.trim() }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error(err)
    return jsonError(`Internal error: ${String(err)}`, 500)
  }
})
