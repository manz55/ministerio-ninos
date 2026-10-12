import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { updateOwnPassword } from '../../lib/auth'
import { Sheet, DrawnCheck } from '../motion'
import { Field, FormError, INPUT } from './form'

export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setError('Usa al menos 8 caracteres.'); return }
    if (password !== confirm) { setError('Las dos contraseñas no coinciden.'); return }
    setSaving(true)
    setError(null)
    const { error: err } = await updateOwnPassword(password)
    setSaving(false)
    if (err) { setError('No se pudo cambiar la contraseña. Intenta de nuevo.'); return }
    setDone(true)
    setTimeout(onClose, 1300)
  }

  return (
    <Sheet open onClose={onClose} title="Cambiar contraseña">
      {done ? (
        <div className="px-6 py-12 flex flex-col items-center gap-3 text-center">
          <DrawnCheck size={72} className="text-emerald-500" />
          <p className="font-display text-xl font-bold text-gray-900">Contraseña actualizada</p>
        </div>
      ) : (
        <form onSubmit={submit} className="px-6 pt-3 sm:pt-7 pb-6 space-y-5">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2 pr-10"><KeyRound size={22} className="text-indigo-600" /> Cambiar contraseña</h2>
          <Field label="Nueva contraseña" hint="(mínimo 8 caracteres)"><input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus className={INPUT} /></Field>
          <Field label="Repítela"><input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={INPUT} /></Field>
          <FormError error={error} />
          <button type="submit" disabled={saving} className="w-full py-3.5 rounded-2xl bg-indigo-600 text-white font-display font-bold text-lg hover:bg-indigo-700 disabled:opacity-60">
            {saving ? 'Guardando…' : 'Guardar contraseña'}
          </button>
        </form>
      )}
    </Sheet>
  )
}
