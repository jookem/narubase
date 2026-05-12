import { useState } from 'react'
import { pdf } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { StudentReportPDF } from './StudentReportPDF'

type Props = {
  student: any
  details: any
  goals: any[]
  latestSnapshot: any
  teacherName: string
  teacherId: string
}

export function StudentReportButton({ student, details, goals, latestSnapshot, teacherName, teacherId }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    setLoading(true)
    try {
      const { data: lessons } = await supabase
        .from('lessons')
        .select('*, lesson_notes(*), lesson_participants(student:profiles!lesson_participants_student_id_fkey(full_name))')
        .eq('teacher_id', teacherId)
        .eq('student_id', student.id)
        .eq('status', 'completed')
        .order('scheduled_start', { ascending: false })

      // Fetch image attachments for all lessons and generate signed URLs
      const lessonIds = (lessons ?? []).map((l: any) => l.id)
      const attachmentsByLesson: Record<string, { url: string; file_name: string }[]> = {}

      if (lessonIds.length > 0) {
        const { data: attachmentRows } = await supabase
          .from('lesson_attachments')
          .select('*')
          .in('lesson_id', lessonIds)
          .ilike('mime_type', 'image/%')
          .order('created_at')

        if (attachmentRows?.length) {
          await Promise.all(
            attachmentRows.map(async (a: any) => {
              const { data: urlData } = await supabase.storage
                .from('lesson-attachments')
                .createSignedUrl(a.storage_path, 3600)
              const url = urlData?.signedUrl
              if (!url) return
              if (!attachmentsByLesson[a.lesson_id]) attachmentsByLesson[a.lesson_id] = []
              attachmentsByLesson[a.lesson_id].push({ url, file_name: a.file_name })
            })
          )
        }
      }

      const blob = await pdf(
        <StudentReportPDF
          student={student}
          details={details}
          goals={goals}
          latestSnapshot={latestSnapshot}
          lessons={lessons ?? []}
          attachmentsByLesson={attachmentsByLesson}
          teacherName={teacherName}
        />
      ).toBlob()

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${student.full_name.replace(/\s+/g, '-').toLowerCase()}-full-report.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      console.error('PDF generation failed:', err)
      toast.error(`PDF generation failed: ${err?.message ?? 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        <>
          <span className="w-3.5 h-3.5 border-2 border-gray-300 border-t-brand rounded-full animate-spin" />
          Generating…
        </>
      ) : (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          Full Report
        </>
      )}
    </button>
  )
}
