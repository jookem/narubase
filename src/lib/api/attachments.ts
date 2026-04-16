import { supabase } from '@/lib/supabase'
import { convertToWebP } from '@/lib/utils/imageUtils'
import type { LessonAttachment } from '@/lib/types/database'

export async function uploadAttachment(
  lessonId: string,
  file: File,
): Promise<{ data?: LessonAttachment; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const uploadFile = await convertToWebP(file)
  const sanitized = uploadFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${lessonId}/${Date.now()}_${sanitized}`

  const { error: uploadError } = await supabase.storage
    .from('lesson-attachments')
    .upload(path, uploadFile, { contentType: uploadFile.type })

  if (uploadError) return { error: uploadError.message }

  const { data, error: dbError } = await supabase
    .from('lesson_attachments')
    .insert({
      lesson_id: lessonId,
      uploader_id: user.id,
      file_name: uploadFile.name,
      file_size: uploadFile.size,
      mime_type: uploadFile.type,
      storage_path: path,
    })
    .select('*')
    .single()

  if (dbError) {
    await supabase.storage.from('lesson-attachments').remove([path])
    return { error: dbError.message }
  }

  return { data }
}

export async function listAttachments(
  lessonId: string,
): Promise<{ data: (LessonAttachment & { url: string | null })[]; error?: string }> {
  const { data, error } = await supabase
    .from('lesson_attachments')
    .select('*')
    .eq('lesson_id', lessonId)
    .order('created_at')

  if (error) return { data: [], error: error.message }
  if (!data?.length) return { data: [] }

  const withUrls = await Promise.all(
    data.map(async (attachment) => {
      const { data: urlData } = await supabase.storage
        .from('lesson-attachments')
        .createSignedUrl(attachment.storage_path, 3600)
      return { ...attachment, url: urlData?.signedUrl ?? null }
    }),
  )

  return { data: withUrls }
}

export async function deleteAttachment(
  attachmentId: string,
  storagePath: string,
): Promise<{ error?: string }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { error: storageError } = await supabase.storage
    .from('lesson-attachments')
    .remove([storagePath])

  if (storageError) return { error: storageError.message }

  const { error: dbError } = await supabase
    .from('lesson_attachments')
    .delete()
    .eq('id', attachmentId)
    .eq('uploader_id', user.id)

  if (dbError) return { error: dbError.message }
  return {}
}
