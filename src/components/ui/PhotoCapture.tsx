import { useEffect, useRef, useState } from 'react'
import { Camera, User } from 'lucide-react'
import { resizeAndCompressImage, getSignedPhotoUrl } from '../../lib/photo'

interface Props {
  existingPath?: string | null
  onFileReady: (blob: Blob | null) => void
  size?: number
}

/** Captures/picks a photo, resizes+compresses it client-side, and hands the blob to the caller (upload happens after the parent/child row exists). */
export function PhotoCapture({ existingPath, onFileReady, size = 84 }: Props) {
  const [preview, setPreview] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const objectUrlRef = useRef<string | null>(null)

  useEffect(() => {
    if (!existingPath) return
    getSignedPhotoUrl(existingPath).then((url) => { if (url) setPreview(url) })
  }, [existingPath])

  useEffect(() => () => { if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current) }, [])

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setProcessing(true)
    try {
      const blob = await resizeAndCompressImage(file)
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
      const url = URL.createObjectURL(blob)
      objectUrlRef.current = url
      setPreview(url)
      onFileReady(blob)
    } catch {
      setError('No se pudo procesar la foto.')
    } finally {
      setProcessing(false)
      e.target.value = ''
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="relative shrink-0 rounded-full overflow-hidden border-2 border-gray-200 bg-gray-50 flex items-center justify-center hover:border-indigo-400 transition-colors"
        style={{ width: size, height: size }}
      >
        {preview ? (
          <img src={preview} alt="" className="w-full h-full object-cover" />
        ) : (
          <User size={size * 0.45} className="text-gray-300" />
        )}
        <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center">
          <Camera size={size * 0.28} className="text-white opacity-0 hover:opacity-100 transition-opacity" />
        </div>
      </button>
      <div className="text-sm">
        <button type="button" onClick={() => inputRef.current?.click()} className="font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
          {processing ? 'Procesando…' : preview ? 'Cambiar foto' : 'Agregar foto'}
        </button>
        {error && <p className="text-xs text-red-600 mt-0.5">{error}</p>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        className="hidden"
      />
    </div>
  )
}

/** Read-only avatar for a stored photo path (private bucket → resolves a signed URL). */
export function PhotoAvatar({ path, size = 40 }: { path: string | null | undefined; size?: number }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (path) getSignedPhotoUrl(path).then((u) => { if (!cancelled) setUrl(u) })
    else setUrl(null)
    return () => { cancelled = true }
  }, [path])

  return (
    <div
      className="shrink-0 rounded-full overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {url ? <img src={url} alt="" className="w-full h-full object-cover" /> : <User size={size * 0.5} className="text-gray-300" />}
    </div>
  )
}
