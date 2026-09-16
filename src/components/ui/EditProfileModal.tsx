import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { UserRound, X, Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Profile } from '../../types/domain'

/** Deja a un coordinador corregir su propio nombre (typo al registrarlo, cambio de apellido, etc.) sin pedirle a otro admin que lo haga por Usuarios. */
export function EditProfileModal({ profile, onClose, onSaved }: { profile: Profile; onClose: () => void; onSaved: (fullName: string) => void }) {
  const [fullName, setFullName] = useState(profile.full_name)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSave() {
    if (!fullName.trim()) { setError('El nombre es requerido.'); return }
    setSaving(true)
    setError(null)
    const { error: err } = await supabase.from('profiles').update({ full_name: fullName.trim() }).eq('id', profile.id)
    setSaving(false)
    if (err) { setError('No se pudo guardar. Intenta de nuevo.'); return }
    setDone(true)
    onSaved(fullName.trim())
    setTimeout(onClose, 1000)
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <UserRound size={16} className="text-indigo-500" /> Mis datos
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>

          {done ? (
            <p className="text-sm font-semibold text-emerald-600 bg-emerald-50 rounded-xl px-4 py-3 text-center">
              ✓ Datos actualizados
            </p>
          ) : (
            <>
              {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Nombre completo</label>
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus
                  className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm" />
              </div>
              {profile.email && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Correo</label>
                  <p className="text-sm text-gray-400 px-3 py-2.5 bg-gray-50 rounded-lg">{profile.email}</p>
                </div>
              )}
              <button onClick={handleSave} disabled={saving}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                <Check size={14} />
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
