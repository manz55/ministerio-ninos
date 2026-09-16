import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { updateOwnPassword, signOut } from '../../lib/auth'
import { ChurchLogo } from './ChurchLogo'

/** Se muestra en vez de la app normal mientras hay una sesión de recuperación
 * activa (llegó del enlace de "olvidé mi contraseña" en el correo) — obliga
 * a elegir una contraseña nueva antes de dejar entrar, y cierra sesión al
 * terminar para forzar un login limpio con la contraseña recién puesta. */
export function ResetPasswordScreen() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setError('Mínimo 8 caracteres.'); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return }
    setSaving(true)
    setError(null)
    const { error: err } = await updateOwnPassword(password)
    setSaving(false)
    if (err) { setError('No se pudo cambiar la contraseña. Pide un nuevo enlace e intenta de nuevo.'); return }
    setDone(true)
    setTimeout(() => signOut(), 1800)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-8 gap-8">
      <div className="text-center space-y-3">
        <div className="w-20 h-20 bg-indigo-100 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
          <ChurchLogo size={44} />
        </div>
        <h1 className="text-2xl font-black text-gray-900">Nueva contraseña</h1>
        <p className="text-sm text-gray-500">Elige una contraseña nueva para tu cuenta</p>
      </div>

      {done ? (
        <p className="w-full max-w-xs text-sm font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-center">
          ✓ Contraseña actualizada. Inicia sesión de nuevo…
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Nueva contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              autoFocus
              required
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none text-base bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Confirmar contraseña</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none text-base bg-white"
            />
          </div>

          {error && (
            <p className="text-sm font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-center">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving || !password || !confirm}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            <ShieldCheck size={16} />
            {saving ? 'Guardando…' : 'Guardar contraseña'}
          </button>
        </form>
      )}
    </div>
  )
}
