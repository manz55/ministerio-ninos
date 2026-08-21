import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { KeyRound, X, Check } from 'lucide-react'
import { updateOwnPassword } from '../../lib/auth'

export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSave() {
    if (password.length < 6) { setError('Mínimo 6 caracteres.'); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return }
    setSaving(true)
    setError(null)
    const { error: err } = await updateOwnPassword(password)
    setSaving(false)
    if (err) { setError('No se pudo cambiar la contraseña. Intenta de nuevo.'); return }
    setDone(true)
    setTimeout(onClose, 1400)
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
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
              <KeyRound size={16} className="text-indigo-500" /> Cambiar contraseña
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>

          {done ? (
            <p className="text-sm font-semibold text-emerald-600 bg-emerald-50 rounded-xl px-4 py-3 text-center">
              ✓ Contraseña actualizada
            </p>
          ) : (
            <>
              {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Nueva contraseña</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus
                  className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Confirmar contraseña</label>
                <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                  className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm" />
              </div>
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
