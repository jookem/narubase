import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify the calling user is an authenticated teacher
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    const { data: profile } = await userClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'teacher') {
      return new Response('Forbidden — teachers only', { status: 403, headers: corsHeaders })
    }

    const { name, initial_password } = await req.json()
    if (!name?.trim()) return new Response('Name is required', { status: 400, headers: corsHeaders })
    if (!initial_password || initial_password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'initial_password (min 6 chars) is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Use service role to create a student auth user
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

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
      return new Response(JSON.stringify({ error: createError?.message ?? 'Failed to create user' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Mark profile as placeholder
    await adminClient
      .from('profiles')
      .update({ is_placeholder: true })
      .eq('id', newUser.user.id)

    // Create teacher-student relationship
    await adminClient
      .from('teacher_student_relationships')
      .insert({ teacher_id: user.id, student_id: newUser.user.id })

    return new Response(
      JSON.stringify({ id: newUser.user.id, name: name.trim() }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error(err)
    return new Response('Internal error', { status: 500, headers: corsHeaders })
  }
})
