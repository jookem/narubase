import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

const LEVELS = ['Eiken 5', 'Eiken 4', 'Eiken 3', 'Eiken Pre-2', 'Eiken Pre-2 Plus', 'Eiken 2'] as const
type Level = typeof LEVELS[number]

type EikenPicture = {
  id: string
  level: Level
  image_url: string
  storage_path: string
  description: string | null
  image_b_url: string | null
  image_b_storage_path: string | null
  image_b_description: string | null
  passage_title: string | null
  passage_text: string | null
  starter_sentence: string | null
  questions: string[]
}

function levelFormat(level: Level) {
  if (level === 'Eiken Pre-2') return 'dual'
  if (level === 'Eiken Pre-2 Plus' || level === 'Eiken 2') return 'comic'
  return 'passage' // 5, 4, 3
}

const EMPTY_FORM = {
  description: '',
  passageTitle: '',
  passageText: '',
  starterSentence: '',
  imageBDescription: '',
  questions: ['', '', '', '', ''],
}

export function EikenPictureManager() {
  const { user } = useAuth()
  const [pictures, setPictures] = useState<EikenPicture[]>([])
  const [selectedLevel, setSelectedLevel] = useState<Level>('Eiken 5')
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingFileB, setPendingFileB] = useState<File | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const fileRef = useRef<HTMLInputElement>(null)
  const fileBRef = useRef<HTMLInputElement>(null)

  const fmt = levelFormat(selectedLevel)
  const hasPassage = fmt === 'passage'
  const questionCount = selectedLevel === 'Eiken 5' ? 3 : selectedLevel === 'Eiken 4' ? 4 : selectedLevel === 'Eiken 3' ? 5 : 0
  const hasQuestions = questionCount > 0
  const hasImageB = selectedLevel === 'Eiken Pre-2'
  const hasStarter = fmt === 'comic'

  async function load() {
    const { data } = await supabase
      .from('eiken_pictures')
      .select('*')
      .order('created_at', { ascending: false })
    setPictures((data ?? []) as EikenPicture[])
  }

  useEffect(() => { load() }, [])

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return }
    setPendingFile(file)
    setShowForm(true)
    if (fileRef.current) fileRef.current.value = ''
  }

  function handleFileBSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return }
    setPendingFileB(file)
    if (fileBRef.current) fileBRef.current.value = ''
  }

  function setQ(i: number, val: string) {
    setForm(f => { const q = [...f.questions]; q[i] = val; return { ...f, questions: q } })
  }

  async function uploadFile(file: File, prefix: string): Promise<{ path: string; url: string } | null> {
    const path = `${prefix}/${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('eiken-pictures').upload(path, file)
    if (error) return null
    const { data: { publicUrl } } = supabase.storage.from('eiken-pictures').getPublicUrl(path)
    return { path, url: publicUrl }
  }

  async function handleUpload() {
    if (!pendingFile || !user) return
    if (!form.description.trim()) { toast.error('Please describe what is in the picture'); return }
    if (hasPassage && !form.passageText.trim()) { toast.error('Please add the passage text'); return }
    if (hasStarter && !form.starterSentence.trim()) { toast.error('Please add the starter sentence'); return }
    if (hasImageB && !pendingFileB) { toast.error('Please upload Picture B'); return }

    setUploading(true)
    const prefix = selectedLevel.replace(/\s/g, '-')

    const main = await uploadFile(pendingFile, prefix)
    if (!main) { toast.error('Upload failed'); setUploading(false); return }

    let imageBUrl: string | null = null
    let imageBPath: string | null = null
    if (hasImageB && pendingFileB) {
      const b = await uploadFile(pendingFileB, `${prefix}-B`)
      if (!b) { toast.error('Picture B upload failed'); setUploading(false); return }
      imageBUrl = b.url
      imageBPath = b.path
    }

    const questions = hasQuestions ? form.questions.filter(q => q.trim()) : []

    const { error } = await supabase.from('eiken_pictures').insert({
      level: selectedLevel,
      image_url: main.url,
      storage_path: main.path,
      teacher_id: user.id,
      description: form.description.trim(),
      passage_title: hasPassage ? form.passageTitle.trim() || null : null,
      passage_text: hasPassage ? form.passageText.trim() || null : null,
      starter_sentence: hasStarter ? form.starterSentence.trim() || null : null,
      image_b_url: imageBUrl,
      image_b_storage_path: imageBPath,
      image_b_description: hasImageB ? form.imageBDescription.trim() || null : null,
      questions: questions.length ? questions : [],
    })

    if (error) {
      toast.error('Failed to save')
    } else {
      toast.success('Picture saved')
      setPendingFile(null)
      setPendingFileB(null)
      setForm({ ...EMPTY_FORM })
      setShowForm(false)
      load()
    }
    setUploading(false)
  }

  function cancelUpload() {
    setPendingFile(null)
    setPendingFileB(null)
    setForm({ ...EMPTY_FORM })
    setShowForm(false)
  }

  async function handleDelete(pic: EikenPicture) {
    setDeleting(pic.id)
    const paths = [pic.storage_path]
    if (pic.image_b_storage_path) paths.push(pic.image_b_storage_path)
    await supabase.storage.from('eiken-pictures').remove(paths)
    const { error } = await supabase.from('eiken_pictures').delete().eq('id', pic.id)
    if (error) toast.error('Failed to delete')
    else { toast.success('Deleted'); setPictures(prev => prev.filter(p => p.id !== pic.id)) }
    setDeleting(null)
  }

  const levelPictures = pictures.filter(p => p.level === selectedLevel)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">🖼️ Eiken Picture Bank</CardTitle>
          {!showForm && (
            <button
              onClick={() => fileRef.current?.click()}
              className="px-3 py-1.5 bg-brand text-white text-xs font-medium rounded-lg hover:bg-brand/90 transition-colors"
            >
              + Upload Picture
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
          <input ref={fileBRef} type="file" accept="image/*" className="hidden" onChange={handleFileBSelect} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Level tabs */}
        <div className="grid grid-cols-3 gap-1 bg-gray-100 rounded-lg p-1">
          {LEVELS.map(level => (
            <button
              key={level}
              onClick={() => setSelectedLevel(level)}
              className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                selectedLevel === level ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {level}
            </button>
          ))}
        </div>

        {/* Upload form */}
        {showForm && pendingFile && (
          <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
            <p className="text-sm font-medium text-gray-700">New picture — {selectedLevel}</p>

            {/* Main image preview */}
            <div>
              <p className="text-xs text-gray-500 mb-1">{hasImageB ? 'Picture A' : 'Picture'}</p>
              <img
                src={URL.createObjectURL(pendingFile)}
                alt="Preview"
                className="w-full max-h-48 object-cover rounded-lg border border-gray-200"
              />
            </div>

            {/* Picture B upload for Pre-2 */}
            {hasImageB && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Picture B <span className="text-red-500">*</span></p>
                {pendingFileB ? (
                  <img
                    src={URL.createObjectURL(pendingFileB)}
                    alt="Picture B"
                    className="w-full max-h-48 object-cover rounded-lg border border-gray-200"
                  />
                ) : (
                  <button
                    onClick={() => fileBRef.current?.click()}
                    className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-xs text-gray-400 hover:border-brand hover:text-brand transition-colors"
                  >
                    + Upload Picture B
                  </button>
                )}
              </div>
            )}

            {/* Passage fields for 5, 4, 3 */}
            {hasPassage && (
              <>
                <div>
                  <label className="text-xs font-medium text-gray-600">Passage title</label>
                  <input
                    value={form.passageTitle}
                    onChange={e => setForm(f => ({ ...f, passageTitle: e.target.value }))}
                    placeholder="e.g. Sam's Pet"
                    className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/30"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Passage text <span className="text-red-500">*</span></label>
                  <Textarea
                    value={form.passageText}
                    onChange={e => setForm(f => ({ ...f, passageText: e.target.value }))}
                    placeholder="e.g. Sam is 10 years old, and he has a dog..."
                    rows={3}
                    className="mt-1 resize-none text-sm"
                  />
                </div>
              </>
            )}

            {/* Questions for Eiken 3 */}
            {hasQuestions && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600">Questions (No. 1–{questionCount})</label>
                {form.questions.slice(0, questionCount).map((q, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-xs text-gray-400 mt-2 w-10 shrink-0">No. {i + 1}</span>
                    <input
                      value={q}
                      onChange={e => setQ(i, e.target.value)}
                      placeholder={`Question ${i + 1}`}
                      className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/30"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Starter sentence for Pre-2 Plus, Eiken 2 */}
            {hasStarter && (
              <div>
                <label className="text-xs font-medium text-gray-600">Starter sentence <span className="text-red-500">*</span></label>
                <input
                  value={form.starterSentence}
                  onChange={e => setForm(f => ({ ...f, starterSentence: e.target.value }))}
                  placeholder="e.g. One day, Mr. and Mrs. Sato were eating lunch with their daughter, Yuki."
                  className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              </div>
            )}

            {/* Description (what's in the picture — for AI) */}
            <div>
              <label className="text-xs font-medium text-gray-600">
                {hasImageB ? 'Picture A description (for AI)' : 'Picture description (for AI)'} <span className="text-red-500">*</span>
              </label>
              <Textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Describe what is happening in detail so the AI can evaluate student answers."
                rows={2}
                className="mt-1 resize-none text-sm"
              />
            </div>

            {hasImageB && (
              <div>
                <label className="text-xs font-medium text-gray-600">Picture B description (for AI)</label>
                <Textarea
                  value={form.imageBDescription}
                  onChange={e => setForm(f => ({ ...f, imageBDescription: e.target.value }))}
                  placeholder="Describe the situation in Picture B."
                  rows={2}
                  className="mt-1 resize-none text-sm"
                />
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="flex-1 py-2 bg-brand text-white text-sm font-medium rounded-lg disabled:opacity-50"
              >
                {uploading ? 'Saving…' : 'Save Picture'}
              </button>
              <button onClick={cancelUpload} className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Picture grid */}
        {levelPictures.length === 0 && !showForm ? (
          <p className="text-sm text-gray-400 text-center py-6">
            No pictures for {selectedLevel} yet.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {levelPictures.map(pic => (
              <div key={pic.id} className="relative group rounded-lg overflow-hidden border border-gray-200">
                <img src={pic.image_url} alt={pic.level} className="w-full aspect-video object-cover" />
                {pic.description && (
                  <div className="absolute inset-0 bg-black/70 text-white text-xs p-2 opacity-0 group-hover:opacity-100 transition-opacity overflow-auto leading-relaxed">
                    {pic.passage_title && <p className="font-bold mb-1">{pic.passage_title}</p>}
                    {pic.description}
                  </div>
                )}
                <button
                  onClick={() => handleDelete(pic)}
                  disabled={deleting === pic.id}
                  className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white text-xs rounded-full flex items-center justify-center disabled:opacity-50"
                >
                  {deleting === pic.id ? '…' : '×'}
                </button>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-400">
          {pictures.length} picture{pictures.length !== 1 ? 's' : ''} total · shared across all students
        </p>
      </CardContent>
    </Card>
  )
}
