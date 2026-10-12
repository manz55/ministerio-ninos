import { useState } from 'react'
import { UserRound } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Profile } from '../../types/domain'
import { Sheet, DrawnCheck } from '../motion'
import { Field, FormError, INPUT } from './form'

/** Para corregir el propio nombre (un error al registrarlo, cambio de
 * apellido…) sin pedirle a otro coordinador que lo haga por Usuarios. */
export function EditProfileModal({ profile, onClose, onSaved }: { profile: Profile; onClose: () => void; onSaved: (fullName: string) => void }) {
  const [fullName, setFullName] = useState(profile.full_name)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName.trim()) { setError('Escribe tu nombre.'); return }
    setSaving(true)
    setError(null)
    const { error: err } = await supabase.from('profiles').update({ full_name: fullName.trim() }).eq('id', profile.id)
    setSaving(false)
    if (err) { setError('No se pudo guardar. Intenta de nuevo.'); return }
    setDone(true)
    onSaved(fullName.trim())
    setTimeout(onClose, 1100)
  }

  return (
    <Sheet open onClose={onClose} title="Mis datos">
      {done ? (
        <div className="px-6 py-12 flex flex-col items-center gap-3 text-center">
          <DrawnCheck size={72} className="text-emerald-500" />
          <p className="font-display text-xl font-bold text-gray-900">Datos actualizados</p>
        </div>
      ) : (
        <form onSubmit={submit} className="px-6 pt-3 sm:pt-7 pb-6 space-y-5">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2 pr-10"><UserRound size={22} className="text-indigo-600" /> Mis datos</h2>
          <Field label="Nombre completo"><input value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus className={INPUT} /></Field>
          {profile.email && <Field label="Correo"><p className="px-4 py-3 rounded-2xl bg-gray-50 text-gray-500">{profile.email}</p></Field>}
          <FormError error={error} />
          <button type="submit" disabled={saving} className="w-full py-3.5 rounded-2xl bg-indigo-600 text-white font-display font-bold text-lg hover:bg-indigo-700 disabled:opacity-60">
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </form>
      )}
    </Sheet>
  )
}
