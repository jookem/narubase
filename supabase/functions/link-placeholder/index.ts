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
    // Verify calling user is an authenticated teacher
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    const { placeholder_id, real_student_email } = await req.json()
    if (!placeholder_id || !real_student_email) {
      return new Response('placeholder_id and real_student_email are required', { status: 400, headers: corsHeaders })
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Verify the placeholder belongs to this teacher
    const { data: rel } = await adminClient
      .from('teacher_student_relationships')
      .select('id')
      .eq('teacher_id', user.id)
      .eq('student_id', placeholder_id)
      .eq('status', 'active')
      .single()

    if (!rel) {
      return new Response(JSON.stringify({ error: 'Placeholder not found in your roster.' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify placeholder is actually a placeholder
    const { data: placeholder } = await adminClient
      .from('profiles')
      .select('id, full_name, is_placeholder')
      .eq('id', placeholder_id)
      .single()

    if (!placeholder?.is_placeholder) {
      return new Response(JSON.stringify({ error: 'This student is not a placeholder.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Find the real student by email
    const { data: realStudent } = await adminClient
      .from('profiles')
      .select('id, full_name, is_placeholder')
      .eq('email', real_student_email.trim().toLowerCase())
      .single()

    if (!realStudent) {
      return new Response(JSON.stringify({ error: 'No account found with that email. Ask the student to sign up first.' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (realStudent.is_placeholder) {
      return new Response(JSON.stringify({ error: 'That account is also a placeholder.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (realStudent.id === placeholder_id) {
      return new Response(JSON.stringify({ error: 'Cannot link a student to themselves.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const pid = placeholder_id
    const rid = realStudent.id

    // Migrate all data from placeholder → real student
    await Promise.all([
      adminClient.from('lessons')
        .update({ student_id: rid })
        .eq('student_id', pid),

      adminClient.from('vocabulary_bank')
        .update({ student_id: rid })
        .eq('student_id', pid),

      adminClient.from('student_goals')
        .update({ student_id: rid })
        .eq('student_id', pid),

      adminClient.from('progress_snapshots')
        .update({ student_id: rid })
        .eq('student_id', pid),

      adminClient.from('booking_requests')
        .update({ student_id: rid })
        .eq('student_id', pid),
    ])

    // Replace placeholder relationship with real student relationship
    const { data: existingRel } = await adminClient
      .from('teacher_student_relationships')
      .select('id, status')
      .eq('teacher_id', user.id)
      .eq('student_id', rid)
      .single()

    if (existingRel) {
      // Real student already joined — just activate
      await adminClient
        .from('teacher_student_relationships')
        .update({ status: 'active', ended_at: null })
        .eq('id', existingRel.id)
    } else {
      await adminClient
        .from('teacher_student_relationships')
        .insert({ teacher_id: user.id, student_id: rid })
    }

    // Remove placeholder relationship
    await adminClient
      .from('teacher_student_relationships')
      .delete()
      .eq('teacher_id', user.id)
      .eq('student_id', pid)

    // Delete the placeholder auth user (cascades to profile)
    await adminClient.auth.admin.deleteUser(pid)

    return new Response(
      JSON.stringify({ success: true, real_student_name: realStudent.full_name }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error(err)
    return new Response('Internal error', { status: 500, headers: corsHeaders })
  }
})
