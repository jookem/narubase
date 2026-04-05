import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { uploadAttachment, listAttachments, deleteAttachment } from '@/lib/api/attachments'
import type { LessonAttachment } from '@/lib/types/database'

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB

function fileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return '🖼️'
  if (mimeType === 'application/pdf') return '📄'
  if (mimeType.startsWith('video/')) return '🎬'
  if (mimeType.startsWith('audio/')) return '🎵'
  return '📎'
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface Props {
  lessonId: string
  canUpload: boolean
}

export function LessonAttachments({ lessonId, canUpload }: Props) {
  const [attachments, setAttachments] = useState<(LessonAttachment & { url: string | null })[]>([])
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function load() {
    const { data } = await listAttachments(lessonId)
    setAttachments(data)
  }

  useEffect(() => { load() }, [lessonId])

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return
    const file = files[0]
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File too large (max 20 MB)')
      return
    }
    setUploading(true)
    const { error } = await uploadAttachment(lessonId, file)
    setUploading(false)
    if (error) {
      toast.error(error)
    } else {
      toast.success('Attachment uploaded')
      load()
    }
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleDelete(attachment: LessonAttachment) {
    setDeleting(attachment.id)
    const { error } = await deleteAttachment(attachment.id, attachment.storage_path)
    setDeleting(null)
    if (error) {
      toast.error(error)
    } else {
      setAttachments(prev => prev.filter(a => a.id !== attachment.id))
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">
          Attachments {attachments.length > 0 && <span className="text-gray-400">({attachments.length})</span>}
        </h3>
        {canUpload && (
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="text-xs px-3 py-1 rounded border border-gray-200 text-gray-600 hover:border-brand/50 hover:text-brand transition-colors disabled:opacity-50"
          >
            {uploading ? 'Uploading…' : '+ Attach file'}
          </button>
        )}
      </div>

      {canUpload && (
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept="image/*,application/pdf,video/*,audio/*,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
          onChange={e => handleFiles(e.target.files)}
        />
      )}

      {canUpload && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors text-xs ${
            dragging
              ? 'border-brand bg-brand-light text-brand-dark'
              : 'border-gray-200 text-gray-400 hover:border-gray-300'
          }`}
        >
          {uploading ? 'Uploading…' : 'Drop files here or click to browse · Max 20 MB'}
        </div>
      )}

      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map(a => (
            <div key={a.id} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg border border-gray-100">
              <span className="text-xl shrink-0">{fileIcon(a.mime_type)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{a.file_name}</p>
                <p className="text-xs text-gray-400">{formatSize(a.file_size)}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {a.url && (
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-brand hover:underline"
                  >
                    Download
                  </a>
                )}
                {canUpload && (
                  <button
                    onClick={() => handleDelete(a)}
                    disabled={deleting === a.id}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                  >
                    {deleting === a.id ? '…' : 'Remove'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {attachments.length === 0 && !canUpload && (
        <p className="text-xs text-gray-400">No attachments.</p>
      )}
    </div>
  )
}
