import { supabase } from '@/lib/supabase'

export async function updateProfileName(fullName: string): Promise<{ error?: string }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('profiles')
    .update({ full_name: fullName.trim() })
    .eq('id', user.id)

  if (error) return { error: 'Failed to update name.' }
  return {}
}

export async function updatePassword(newPassword: string): Promise<{ error?: string }> {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return { error: error.message }
  return {}
}

export async function updatePreferences(prefs: {
  notifications_email?: boolean
  default_lesson_mins?: number
}): Promise<{ error?: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('profiles')
    .update(prefs)
    .eq('id', session.user.id)

  if (error) return { error: error.message }
  return {}
}
