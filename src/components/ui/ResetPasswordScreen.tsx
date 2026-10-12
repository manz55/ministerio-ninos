import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { updateOwnPassword, signOut } from '../../lib/auth'
import { AuthShell } from './AuthShell'

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
    <AuthShell title="Nueva contraseña" subtitle="Elige una contraseña nueva para tu cuenta">

      {done ? (
        <p className="w-full text-sm font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-center">
          ✓ Contraseña actualizada. Inicia sesión de nuevo…
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="w-full space-y-3">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nueva contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              autoFocus
              required
              className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-2xl focus:border-indigo-500 focus:outline-none text-base bg-white transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Confirmar contraseña</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
              className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-2xl focus:border-indigo-500 focus:outline-none text-base bg-white transition-colors"
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
            className="w-full flex items-center justify-center gap-2 py-3.5 font-display text-lg font-semibold text-white bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-900/15 hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            <ShieldCheck size={16} />
            {saving ? 'Guardando…' : 'Guardar contraseña'}
          </button>
        </form>
      )}
    </AuthShell>
  )
}
