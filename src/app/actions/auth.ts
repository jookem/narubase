'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().min(1),
  role: z.enum(['teacher', 'student']),
})

export async function login(formData: FormData): Promise<void> {
  const result = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!result.success) {
    redirect('/login?error=invalid_credentials')
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(result.data)

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  redirect('/dashboard')
}

export async function signup(formData: FormData): Promise<void> {
  const result = signupSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    full_name: formData.get('full_name'),
    role: formData.get('role'),
  })

  if (!result.success) {
    redirect(`/signup?error=${encodeURIComponent('Please fill in all fields correctly.')}`)
  }

  const supabase = await createClient()
  const admin = createAdminClient()

  // Sign up without trigger — we create the profile manually
  const { data, error } = await supabase.auth.signUp({
    email: result.data.email,
    password: result.data.password,
  })

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`)
  }

  if (!data.user) {
    redirect(`/signup?error=${encodeURIComponent('Signup failed. Please try again.')}`)
  }

  // Create profile using admin client (bypasses RLS)
  const { error: profileError } = await admin.from('profiles').insert({
    id: data.user.id,
    role: result.data.role,
    full_name: result.data.full_name,
    email: result.data.email,
  })

  if (profileError) {
    // Clean up the auth user if profile creation failed
    await admin.auth.admin.deleteUser(data.user.id)
    redirect(`/signup?error=${encodeURIComponent(profileError.message)}`)
  }

  redirect('/dashboard')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
