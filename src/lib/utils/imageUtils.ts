/**
 * Converts an image File to WebP format using the browser Canvas API.
 * Non-image files are returned as-is.
 */
export async function convertToWebP(file: File, quality = 0.85): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  // Some browsers don't support WebP encoding — fall back to original
  if (!document.createElement('canvas').toDataURL('image/webp').startsWith('data:image/webp')) {
    return file
  }

  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) { URL.revokeObjectURL(url); return resolve(file) }
      ctx.drawImage(img, 0, 0)
      canvas.toBlob(
        blob => {
          URL.revokeObjectURL(url)
          if (!blob) return resolve(file)
          const name = file.name.replace(/\.[^.]+$/, '.webp')
          resolve(new File([blob], name, { type: 'image/webp' }))
        },
        'image/webp',
        quality,
      )
    }

    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')) }
    img.src = url
  })
}
