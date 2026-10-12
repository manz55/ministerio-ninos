import { useState } from 'react'
import { ShieldCheck, Mail } from 'lucide-react'
import { signIn, requestPasswordReset } from '../../lib/auth'
import { AuthShell } from './AuthShell'

export function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // "Olvidé mi contraseña" — un mini-formulario aparte en vez de navegar a
  // otra pantalla, ya que la app no tiene rutas antes de iniciar sesión.
  const [showReset, setShowReset] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [resetSending, setResetSending] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error: err } = await signIn(email.trim(), password)
    setSubmitting(false)
    if (err) setError('Correo o contraseña incorrectos.')
  }

  async function handleResetSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!resetEmail.trim()) return
    setResetSending(true)
    setResetError(null)
    const { error: err } = await requestPasswordReset(resetEmail.trim())
    setResetSending(false)
    // No se distingue "correo no existe" de "sí existe" en el mensaje — evita
    // filtrar qué correos están registrados en el sistema.
    if (err) { setResetError('No se pudo enviar el enlace. Intenta de nuevo.'); return }
    setResetSent(true)
  }

  if (showReset) {
    return (
      <AuthShell title="Recuperar contraseña" subtitle="Te enviamos un enlace a tu correo para elegir una nueva">

        {resetSent ? (
          <div className="w-full space-y-3.5 text-center">
            <p className="text-sm font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              ✓ Si ese correo está registrado, te llegará un enlace en unos minutos.
            </p>
            <button
              type="button"
              onClick={() => { setShowReset(false); setResetSent(false); setResetEmail('') }}
              className="text-sm font-semibold text-indigo-600 hover:text-indigo-800"
            >
              Volver a iniciar sesión
            </button>
          </div>
        ) : (
          <form onSubmit={handleResetSubmit} className="w-full space-y-3.5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Correo</label>
              <input
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                autoComplete="username"
                autoFocus
                required
                className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-2xl focus:border-indigo-500 focus:outline-none text-base bg-white transition-colors"
              />
            </div>
            {resetError && (
              <p className="text-sm font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-center">
                {resetError}
              </p>
            )}
            <button
              type="submit"
              disabled={resetSending || !resetEmail}
              className="w-full flex items-center justify-center gap-2 py-3.5 font-display text-lg font-semibold text-white bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-900/15 hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50 transition"
            >
              <Mail size={16} />
              {resetSending ? 'Enviando…' : 'Enviar enlace'}
            </button>
            <button
              type="button"
              onClick={() => setShowReset(false)}
              className="w-full text-sm font-medium text-gray-500 hover:text-gray-700 py-1"
            >
              Cancelar
            </button>
          </form>
        )}
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Maestros de Niños" subtitle="Inicia sesión para continuar">

      <form onSubmit={handleSubmit} className="w-full space-y-3.5">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Correo</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            autoFocus
            required
            className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-2xl focus:border-indigo-500 focus:outline-none text-base bg-white transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
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
          disabled={submitting || !email || !password}
          className="w-full flex items-center justify-center gap-2 py-3.5 font-display text-lg font-semibold text-white bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-900/15 hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50 transition"
        >
          <ShieldCheck size={16} />
          {submitting ? 'Entrando…' : 'Entrar'}
        </button>
        <button
          type="button"
          onClick={() => setShowReset(true)}
          className="w-full text-sm font-medium text-indigo-600 hover:text-indigo-800 py-1"
        >
          ¿Olvidaste tu contraseña?
        </button>
      </form>
    </AuthShell>
  )
}
