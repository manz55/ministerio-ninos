import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { UserPlus, Shield, User, Trash2, Power, Check, Users as UsersIcon, Baby, LogIn, RotateCcw, Crown, Pencil } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { createUser, updateUserRole, setUserActive, deleteUser } from '../lib/adminUsers'
import { useAuth } from '../lib/auth'
import type { Profile, UserRole, TrashedRecord, ActivityLogEntry } from '../types/domain'

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

        {/* Shown on every non-self row, including the owner's — nothing here
            should visually mark that account as different. The edge function
            (admin-users) unconditionally rejects any change to is_owner=true
            accounts regardless of who calls it, so the real protection lives
            server-side; someone who deliberately tries anyway just gets a
            rejection message, same as any other blocked action. */}
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

// Coordinators "delete" by flagging (deleted_at set, row hidden everywhere
// else) — this is where flagged records live until someone restores them or
// the owner purges them for good. Restoring is safe for any coordinator;
// purging is not (it's irreversible and fires the deletion_log trigger), so
// that button only renders for the owner.
function TrashSection({ isOwner }: { isOwner: boolean }) {
  const [entries, setEntries] = useState<TrashedRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmPurge, setConfirmPurge] = useState<TrashedRecord | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [childRes, parentRes, attendanceRes] = await Promise.all([
      supabase.from('children').select('id, full_name, deleted_at, deleter:profiles!deleted_by(full_name)')
        .not('deleted_at', 'is', null).order('deleted_at', { ascending: false }).limit(100),
      supabase.from('parents').select('id, full_name, deleted_at, deleter:profiles!deleted_by(full_name)')
        .not('deleted_at', 'is', null).order('deleted_at', { ascending: false }).limit(100),
      supabase.from('attendance').select('id, deleted_at, deleter:profiles!deleted_by(full_name), children(full_name)')
        .not('deleted_at', 'is', null).order('deleted_at', { ascending: false }).limit(100),
    ])
    type Row = { id: string; full_name?: string | null; deleted_at: string; deleter: { full_name: string } | null; children?: { full_name: string } | null }
    const rows: TrashedRecord[] = [
      ...((childRes.data as unknown as Row[]) ?? []).map((r) => ({ id: r.id, table_name: 'children' as const, full_name: r.full_name ?? null, deleted_at: r.deleted_at, deleter: r.deleter })),
      ...((parentRes.data as unknown as Row[]) ?? []).map((r) => ({ id: r.id, table_name: 'parents' as const, full_name: r.full_name ?? null, deleted_at: r.deleted_at, deleter: r.deleter })),
      ...((attendanceRes.data as unknown as Row[]) ?? []).map((r) => ({ id: r.id, table_name: 'attendance' as const, full_name: r.children?.full_name ?? null, deleted_at: r.deleted_at, deleter: r.deleter })),
    ].sort((a, b) => b.deleted_at.localeCompare(a.deleted_at))
    setEntries(rows)
    setLoading(false)
  }, [])

  useEffect(() => { if (open) load() }, [open, load])

  async function restore(item: TrashedRecord) {
    setBusyId(item.id)
    await supabase.from(item.table_name).update({ deleted_at: null, deleted_by: null }).eq('id', item.id)
    setBusyId(null)
    load()
  }

  async function purge(item: TrashedRecord) {
    setBusyId(item.id)
    await supabase.from(item.table_name).delete().eq('id', item.id)
    setBusyId(null)
    setConfirmPurge(null)
    load()
  }

  const tableLabel = (t: TrashedRecord['table_name']) => t === 'parents' ? 'familia' : t === 'attendance' ? 'asistencia' : 'niño'

  return (
    <div className="pt-2">
      <AnimatePresence>
        {confirmPurge && (
          <ConfirmDialog
            message={`¿Eliminar permanentemente "${confirmPurge.full_name ?? tableLabel(confirmPurge.table_name)}"? Esta acción no se puede deshacer.`}
            onConfirm={() => purge(confirmPurge)}
            onCancel={() => setConfirmPurge(null)}
          />
        )}
      </AnimatePresence>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors"
      >
        <Trash2 size={15} />
        {open ? 'Ocultar papelera' : 'Ver papelera'}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {loading && <p className="text-center text-gray-400 py-6 text-sm">Cargando…</p>}
          {!loading && entries.length === 0 && (
            <p className="text-center text-gray-400 py-6 text-sm bg-white rounded-2xl border border-gray-200">
              La papelera está vacía.
            </p>
          )}
          {!loading && entries.map((e) => (
            <div key={`${e.table_name}-${e.id}`} className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-start gap-2.5">
              {e.table_name === 'parents' ? (
                <UsersIcon size={14} className="text-rose-400 shrink-0 mt-0.5" />
              ) : e.table_name === 'attendance' ? (
                <LogIn size={14} className="text-rose-400 shrink-0 mt-0.5" />
              ) : (
                <Baby size={14} className="text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">{e.full_name ?? 'Sin nombre'}</span>
                  {' '}
                  <span className="text-gray-400">({tableLabel(e.table_name)})</span>
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Marcado por {e.deleter?.full_name ?? 'alguien fuera de la app'} ·{' '}
                  {formatDistanceToNow(new Date(e.deleted_at), { addSuffix: true, locale: es })}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => restore(e)} disabled={busyId === e.id}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 disabled:opacity-50 transition-colors">
                  <RotateCcw size={12} /> Restaurar
                </button>
                {isOwner && (
                  <button onClick={() => setConfirmPurge(e)} disabled={busyId === e.id}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Owner-only: who logged in and who created/edited what, entirely from DB
// triggers (log_activity/log_login) — never shown to other coordinators.
// This component should only ever be mounted when isOwner is true; callers
// must not just hide it with CSS.
function ActivityLogSection() {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('activity_log')
        .select('*, actor:profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(150)
      const rows = (data as ActivityLogEntry[]) ?? []

      const childIds = rows.filter((r) => r.table_name === 'children' && r.record_id).map((r) => r.record_id!)
      const parentIds = rows.filter((r) => r.table_name === 'parents' && r.record_id).map((r) => r.record_id!)
      const attendanceIds = rows.filter((r) => r.table_name === 'attendance' && r.record_id).map((r) => r.record_id!)

      const [kids, parents, attendance] = await Promise.all([
        childIds.length ? supabase.from('children').select('id, full_name').in('id', [...new Set(childIds)]) : Promise.resolve({ data: [] }),
        parentIds.length ? supabase.from('parents').select('id, full_name').in('id', [...new Set(parentIds)]) : Promise.resolve({ data: [] }),
        attendanceIds.length ? supabase.from('attendance').select('id, children(full_name)').in('id', [...new Set(attendanceIds)]) : Promise.resolve({ data: [] }),
      ])
      const childNames = Object.fromEntries(((kids.data ?? []) as { id: string; full_name: string }[]).map((k) => [k.id, k.full_name]))
      const parentNames = Object.fromEntries(((parents.data ?? []) as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name]))
      const attendanceNames = Object.fromEntries(((attendance.data ?? []) as { id: string; children: { full_name: string } | null }[]).map((a) => [a.id, a.children?.full_name ?? null]))

      if (cancelled) return
      setEntries(rows.map((r) => ({
        ...r,
        record_full_name: r.table_name === 'children' ? childNames[r.record_id ?? ''] ?? null
          : r.table_name === 'parents' ? parentNames[r.record_id ?? ''] ?? null
          : r.table_name === 'attendance' ? attendanceNames[r.record_id ?? ''] ?? null
          : null,
      })))
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [open])

  function describe(e: ActivityLogEntry): string {
    const who = e.actor?.full_name ?? 'Alguien fuera de la app'
    if (e.event_type === 'login') return `${who} inició sesión`
    const what = e.event_type === 'insert' ? 'agregó' : 'editó'
    const table = e.table_name === 'parents' ? 'una familia' : e.table_name === 'attendance' ? 'una asistencia' : 'un niño'
    const name = e.record_full_name ? ` (${e.record_full_name})` : ''
    return `${who} ${what} ${table}${name}`
  }

  return (
    <div className="pt-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-sm font-semibold text-amber-600 hover:text-amber-700 transition-colors"
      >
        <Crown size={15} />
        {open ? 'Ocultar bitácora de actividad' : 'Ver bitácora de actividad (solo tú la ves)'}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {loading && <p className="text-center text-gray-400 py-6 text-sm">Cargando…</p>}
          {!loading && entries.length === 0 && (
            <p className="text-center text-gray-400 py-6 text-sm bg-white rounded-2xl border border-gray-200">
              Todavía no hay actividad registrada.
            </p>
          )}
          {!loading && entries.map((e) => (
            <div key={e.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-start gap-2.5">
              {e.event_type === 'login' ? (
                <LogIn size={14} className="text-amber-400 shrink-0 mt-0.5" />
              ) : (
                <Pencil size={14} className="text-amber-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700">{describe(e)}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {formatDistanceToNow(new Date(e.created_at), { addSuffix: true, locale: es })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function UsersPage() {
  const { profile: currentProfile, isOwner } = useAuth()
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

      <TrashSection isOwner={isOwner} />
      {isOwner && <ActivityLogSection />}
    </div>
  )
}
