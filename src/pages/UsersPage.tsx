import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { UserPlus, Shield, User, Trash2, Power, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { createUser, updateUserRole, setUserActive, deleteUser } from '../lib/adminUsers'
import { useAuth } from '../lib/auth'
import type { Profile, UserRole } from '../types/domain'

function ConfirmDialog({
  message, onConfirm, onCancel,
}: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
    >
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4">
        <p className="font-bold text-gray-900">{message}</p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
            Cancelar
          </button>
          <button onClick={onConfirm} className="flex-1 py-2.5 text-sm font-semibold text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors">
            Confirmar
          </button>
        </div>
      </div>
    </motion.div>
  )
}

function NewUserForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('maestro')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!fullName.trim() || !email.trim() || password.length < 6) {
      setError('Nombre, correo y contraseña (mín. 6 caracteres) son requeridos.')
      return
    }
    setSaving(true)
    setError(null)
    const res = await createUser(email.trim(), password, fullName.trim(), role)
    setSaving(false)
    if (res.error) { setError(res.error); return }
    onCreated()
  }

  return (
    <div className="border-2 border-dashed border-indigo-200 rounded-xl p-4 space-y-3 bg-indigo-50">
      <p className="text-sm font-semibold text-indigo-700">Nuevo usuario</p>
      {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Nombre completo</label>
        <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus
          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm bg-white" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Correo</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm bg-white" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Contraseña temporal</label>
        <input type="text" value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="Mínimo 6 caracteres"
          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm bg-white" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Rol</label>
        <div className="flex gap-2">
          {(['maestro', 'admin'] as UserRole[]).map((r) => (
            <button key={r} type="button" onClick={() => setRole(r)}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg border-2 transition-colors ${
                role === r ? 'border-indigo-500 bg-indigo-100 text-indigo-700' : 'border-gray-200 bg-white text-gray-500'
              }`}>
              {r === 'admin' ? 'Coordinador' : 'Maestro'}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
          Cancelar
        </button>
        <button onClick={handleSave} disabled={saving}
          className="flex-[2] py-2 flex items-center justify-center gap-1.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
          <Check size={14} />
          {saving ? 'Creando…' : 'Crear usuario'}
        </button>
      </div>
    </div>
  )
}

function UserRow({ user, isSelf, onChanged }: { user: Profile; isSelf: boolean; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function toggleRole() {
    setBusy(true)
    const res = await updateUserRole(user.id, user.role === 'admin' ? 'maestro' : 'admin')
    setBusy(false)
    if (res.error) { setError(res.error); return }
    onChanged()
  }

  async function toggleActive() {
    setBusy(true)
    const res = await setUserActive(user.id, !user.active)
    setBusy(false)
    if (res.error) { setError(res.error); return }
    onChanged()
  }

  async function handleDelete() {
    setBusy(true)
    const res = await deleteUser(user.id)
    setBusy(false)
    setConfirmDelete(false)
    if (res.error) { setError(res.error); return }
    onChanged()
  }

  return (
    <>
      <AnimatePresence>
        {confirmDelete && (
          <ConfirmDialog
            message={`¿Eliminar a ${user.full_name}? Esta acción no se puede deshacer.`}
            onConfirm={handleDelete}
            onCancel={() => setConfirmDelete(false)}
          />
        )}
      </AnimatePresence>
      <div className={`bg-white rounded-xl border-2 p-4 space-y-2 ${user.active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              {user.role === 'admin' ? <Shield size={13} className="text-indigo-500 shrink-0" /> : <User size={13} className="text-gray-400 shrink-0" />}
              <p className="font-bold text-gray-900 truncate">{user.full_name}</p>
              {isSelf && <span className="text-[10px] text-gray-400">(tú)</span>}
            </div>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
          </div>
          <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
            user.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
          }`}>
            {user.role === 'admin' ? 'Coordinador' : 'Maestro'}
          </span>
        </div>

        {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        {!isSelf && (
          <div className="flex items-center gap-1.5 pt-1">
            <button onClick={toggleRole} disabled={busy}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 disabled:opacity-50 transition-colors">
              Hacer {user.role === 'admin' ? 'maestro' : 'coordinador'}
            </button>
            <button onClick={toggleActive} disabled={busy}
              className="flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors">
              <Power size={12} /> {user.active ? 'Desactivar' : 'Activar'}
            </button>
            <button onClick={() => setConfirmDelete(true)} disabled={busy}
              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
    </>
  )
}

export default function UsersPage() {
  const { profile: currentProfile } = useAuth()
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)

  const fetchUsers = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').order('full_name')
    setUsers((data as Profile[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Usuarios</h2>
          <p className="text-gray-500 text-sm mt-0.5">{users.length} cuenta{users.length !== 1 ? 's' : ''}</p>
        </div>
        {!showNew && (
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors shrink-0">
            <UserPlus size={15} /> Nuevo usuario
          </button>
        )}
      </div>

      {showNew && (
        <NewUserForm
          onCreated={() => { setShowNew(false); fetchUsers() }}
          onCancel={() => setShowNew(false)}
        />
      )}

      {loading && <p className="text-center text-gray-400 py-10">Cargando…</p>}

      {!loading && (
        <div className="space-y-2">
          {users.map((u) => (
            <UserRow key={u.id} user={u} isSelf={u.id === currentProfile?.id} onChanged={fetchUsers} />
          ))}
        </div>
      )}
    </div>
  )
}
