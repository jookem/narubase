import { supabase } from '@/lib/supabase'
import { convertToWebP } from '@/lib/utils/imageUtils'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

export async function uploadAvatar(file: File): Promise<{ url?: string; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return { error: 'Not authenticated' }

  const webpFile = await convertToWebP(file)
  const path = `${session.user.id}/avatar.webp`

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, webpFile, { upsert: true, contentType: webpFile.type })

  if (uploadError) return { error: uploadError.message }

  const url = `${SUPABASE_URL}/storage/v1/object/public/avatars/${path}?t=${Date.now()}`

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url: url })
    .eq('id', session.user.id)

  if (updateError) return { error: updateError.message }
  return { url }
}

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
