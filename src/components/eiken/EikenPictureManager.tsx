import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

const LEVELS = ['Eiken 5', 'Eiken 4', 'Eiken 3', 'Eiken Pre-2'] as const
type Level = typeof LEVELS[number]

type EikenPicture = {
  id: string
  level: Level
  image_url: string
  storage_path: string
  description: string | null
}

export function EikenPictureManager() {
  const { user } = useAuth()
  const [pictures, setPictures] = useState<EikenPicture[]>([])
  const [selectedLevel, setSelectedLevel] = useState<Level>('Eiken 5')
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [pendingDescription, setPendingDescription] = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [showForm, setShowForm] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

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
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }
    setPendingFile(file)
    setShowForm(true)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleUpload() {
    if (!pendingFile || !user) return
    if (!pendingDescription.trim()) {
      toast.error('Please add a description of what is in the picture')
      return
    }

    setUploading(true)
    const path = `${selectedLevel.replace(/\s/g, '-')}/${Date.now()}-${pendingFile.name}`

    const { error: uploadError } = await supabase.storage
      .from('eiken-pictures')
      .upload(path, pendingFile)

    if (uploadError) {
      toast.error('Upload failed')
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('eiken-pictures')
      .getPublicUrl(path)

    const { error: insertError } = await supabase
      .from('eiken_pictures')
      .insert({
        level: selectedLevel,
        image_url: publicUrl,
        storage_path: path,
        teacher_id: user.id,
        description: pendingDescription.trim(),
      })

    if (insertError) {
      toast.error('Failed to save picture')
    } else {
      toast.success('Picture uploaded')
      setPendingFile(null)
      setPendingDescription('')
      setShowForm(false)
      load()
    }

    setUploading(false)
  }

  function cancelUpload() {
    setPendingFile(null)
    setPendingDescription('')
    setShowForm(false)
  }

  async function handleDelete(pic: EikenPicture) {
    setDeleting(pic.id)
    await supabase.storage.from('eiken-pictures').remove([pic.storage_path])
    const { error } = await supabase.from('eiken_pictures').delete().eq('id', pic.id)
    if (error) {
      toast.error('Failed to delete picture')
    } else {
      toast.success('Picture deleted')
      setPictures(prev => prev.filter(p => p.id !== pic.id))
    }
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
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Level tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {LEVELS.map(level => (
            <button
              key={level}
              onClick={() => setSelectedLevel(level)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                selectedLevel === level
                  ? 'bg-white shadow text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {level}
            </button>
          ))}
        </div>

        {/* Upload form — shown after file is selected */}
        {showForm && pendingFile && (
          <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
            <p className="text-sm font-medium text-gray-700">New picture for {selectedLevel}</p>
            <img
              src={URL.createObjectURL(pendingFile)}
              alt="Preview"
              className="w-full max-h-48 object-cover rounded-lg border border-gray-200"
            />
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">
                What is happening in this picture? <span className="text-red-500">*</span>
              </label>
              <Textarea
                value={pendingDescription}
                onChange={e => setPendingDescription(e.target.value)}
                placeholder="e.g. A woman is cooking in the kitchen. Her daughter is sitting at the table doing homework. There is a cat sleeping on the floor."
                rows={3}
                className="resize-none text-sm"
              />
              <p className="text-xs text-gray-400">This description is used to evaluate the student's answer — be specific.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="flex-1 py-2 bg-brand text-white text-sm font-medium rounded-lg disabled:opacity-50"
              >
                {uploading ? 'Uploading…' : 'Save Picture'}
              </button>
              <button
                onClick={cancelUpload}
                className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Picture grid */}
        {levelPictures.length === 0 && !showForm ? (
          <p className="text-sm text-gray-400 text-center py-6">
            No pictures for {selectedLevel} yet. Upload one above.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {levelPictures.map(pic => (
              <div key={pic.id} className="relative group rounded-lg overflow-hidden border border-gray-200">
                <img
                  src={pic.image_url}
                  alt={pic.level}
                  className="w-full aspect-video object-cover"
                />
                {pic.description && (
                  <div className="absolute inset-0 bg-black/70 text-white text-xs p-2 opacity-0 group-hover:opacity-100 transition-opacity overflow-auto leading-relaxed">
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
          {pictures.length} picture{pictures.length !== 1 ? 's' : ''} total · shared across all students · hover to see description
        </p>
      </CardContent>
    </Card>
  )
}
