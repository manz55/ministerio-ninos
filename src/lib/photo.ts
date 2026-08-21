import { supabase } from './supabase'

const BUCKET = 'fotos-ninos'
const MAX_DIM = 400
const JPEG_QUALITY = 0.72

/** Resizes to fit within MAX_DIM×MAX_DIM and re-encodes as JPEG client-side, to stay within Supabase's free storage tier. */
export function resizeAndCompressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('No se pudo procesar la imagen')); return }
      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo procesar la imagen'))),
        'image/jpeg',
        JPEG_QUALITY
      )
    }
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Imagen inválida')) }
    img.src = objectUrl
  })
}

/** path e.g. `children/{id}.jpg` or `parents/{id}.jpg`. Returns the stored path (not a URL — the bucket is private). */
export async function uploadPhoto(path: string, blob: Blob): Promise<string | null> {
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: true,
  })
  return error ? null : path
}

const signedUrlCache = new Map<string, { url: string; expires: number }>()

/** Signed URLs are cached in-memory for slightly less than their TTL, since the bucket is private. */
export async function getSignedPhotoUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null
  const cached = signedUrlCache.get(path)
  if (cached && cached.expires > Date.now()) return cached.url

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
  if (error || !data) return null
  signedUrlCache.set(path, { url: data.signedUrl, expires: Date.now() + 55 * 60 * 1000 })
  return data.signedUrl
}
