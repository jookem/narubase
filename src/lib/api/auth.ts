import { supabase } from '@/lib/supabase'

export async function login(email: string, password: string): Promise<{ error?: string }> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: error.message }
  return {}
}

export async function signup(
  email: string,
  password: string,
  full_name: string,
  role: 'teacher' | 'student',
): Promise<{ error?: string }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { role, full_name },
    },
  })
  if (error) return { error: error.message }
  if (!data.user) return { error: 'Signup failed. Please try again.' }

  // Upsert the profile directly as a fallback in case the DB trigger fails.
  // The trigger is the primary path; this ensures the profile always exists.
  const { error: profileError } = await supabase.from('profiles').upsert({
    id: data.user.id,
    role,
    full_name: full_name.trim(),
    email: email.trim().toLowerCase(),
  }, { onConflict: 'id' })

  if (profileError) {
    // Non-fatal: trigger may have already created it
    console.warn('Profile upsert warning:', profileError.message)
  }

  return {}
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}
