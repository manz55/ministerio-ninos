import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { UserPlus, Shield, Trash2, Power, Users as UsersIcon, Baby, LogIn, RotateCcw, Crown, Pencil, ChevronRight, KeyRound } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { createUser, updateUserRole, setUserActive, deleteUser } from '../lib/adminUsers'
import { useAuth } from '../lib/auth'
import type { Profile, UserRole, TrashedRecord, ActivityLogEntry } from '../types/domain'
import { Sheet, SkeletonRow } from '../components/motion'
import { itemVariants } from '../components/motion/presets'
import { PageHeader, BTN_PRIMARY } from '../components/ui/PageHeader'
import { Segmented } from '../components/ui/Segmented'
import { ConfirmSheet } from '../components/ui/ConfirmSheet'
import { EmptyState } from '../components/ui/EmptyState'
import { Field, ChoiceChips, FormError, INPUT } from '../components/ui/form'
import { initials } from './checkin/shared'

type Tab = 'cuentas' | 'papelera' | 'bitacora'

export default function UsersPage() {
  const { profile: currentProfile, isOwner } = useAuth()
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('cuentas')
  const [showNew, setShowNew] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').order('full_name')
    setUsers((data as Profile[]) ?? [])
    setLoading(false)
  }, [])
  useEffect(() => { fetchUsers() }, [fetchUsers])

  const admins = users.filter((u) => u.role === 'admin')
  const teachers = users.filter((u) => u.role !== 'admin')
  const open = users.find((u) => u.id === openId) ?? null

  return (
    <div className="space-y-5">
      <PageHeader
        title="Usuarios"
        subtitle={loading ? 'Cargando…' : `${users.length} cuenta${users.length !== 1 ? 's' : ''} con acceso a la app`}
        actions={
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowNew(true)} className={BTN_PRIMARY}>
            <UserPlus size={17} /> Nuevo usuario
          </motion.button>
        }
      />

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'cuentas', label: 'Cuentas', count: users.length },
          { value: 'papelera', label: 'Papelera' },
          ...(isOwner ? [{ value: 'bitacora' as const, label: 'Bitácora' }] : []),
        ]}
      />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          {tab === 'cuentas' && (
            loading ? <div className="space-y-2">{[0, 1, 2].map((i) => <SkeletonRow key={i} />)}</div> : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <UserGroup title="Coordinadores" hint="Pueden ver todo y editar familias, reportes y usuarios" users={admins} selfId={currentProfile?.id} onOpen={setOpenId} />
                <UserGroup title="Maestros" hint="Registran niños y escriben notas" users={teachers} selfId={currentProfile?.id} onOpen={setOpenId} />
              </div>
            )
          )}
          {tab === 'papelera' && <Trash isOwner={isOwner} />}
          {tab === 'bitacora' && isOwner && <ActivityLog />}
        </motion.div>
      </AnimatePresence>

      <Sheet open={showNew} onClose={() => setShowNew(false)} title="Nuevo usuario">
        {showNew && <NewUserForm onCreated={() => { setShowNew(false); fetchUsers() }} onCancel={() => setShowNew(false)} />}
      </Sheet>

      <Sheet open={!!open} onClose={() => setOpenId(null)} title="Cuenta">
        {open && <UserDetail key={open.id} user={open} onChanged={fetchUsers} onClose={() => setOpenId(null)} />}
      </Sheet>
    </div>
  )
}

function UserGroup({ title, hint, users, selfId, onOpen }: { title: string; hint: string; users: Profile[]; selfId?: string; onOpen: (id: string) => void }) {
  return (
    <section className="space-y-2.5">
      <div className="px-1">
        <h2 className="text-xl font-bold text-gray-900">{title} <span className="text-gray-400 font-semibold tabular-nums">{users.length}</span></h2>
        <p className="text-sm text-gray-500">{hint}</p>
      </div>
      <motion.div initial="hidden" animate="show" className="space-y-2">
        {users.map((u, i) => {
          const isSelf = u.id === selfId
          return (
            <motion.button
              key={u.id}
              variants={itemVariants}
              custom={i}
              whileTap={isSelf ? undefined : { scale: 0.985 }}
              onClick={() => !isSelf && onOpen(u.id)}
              disabled={isSelf}
              className={`group w-full text-left flex items-center gap-3 rounded-2xl px-3.5 py-3 bg-white shadow-sm shadow-gray-900/5 border border-transparent transition-[border-color,box-shadow] ${isSelf ? 'cursor-default' : 'hover:border-indigo-200 hover:shadow-md'} ${u.active ? '' : 'opacity-55'}`}
            >
              <span className={`relative w-11 h-11 rounded-full font-display font-bold flex items-center justify-center shrink-0 ${u.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>
                {initials(u.full_name)}
                {u.role === 'admin' && <Shield size={14} className="absolute -bottom-0.5 -right-0.5 text-indigo-600 bg-white rounded-full p-0.5" />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-1.5">
                  <span className="font-display font-bold text-lg leading-tight text-gray-900 truncate">{u.full_name}</span>
                  {isSelf && <span className="text-xs font-semibold text-gray-400">(tú)</span>}
                </span>
                <span className="block text-sm text-gray-500 truncate">{u.email}</span>
              </span>
              {!u.active && <span className="text-xs font-semibold text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">Desactivado</span>}
              {!isSelf && <ChevronRight size={18} className="text-gray-300 group-hover:text-indigo-500 transition-colors shrink-0" />}
            </motion.button>
          )
        })}
      </motion.div>
    </section>
  )
}

// Rol, activar y eliminar viven en este panel (no como botones en cada
// renglón): un toque perdido en el celular durante el culto ya no puede
// desactivar a nadie. La función del servidor (admin-users) además rechaza
// cualquier cambio a la cuenta dueña, la llame quien la llame.
function UserDetail({ user, onChanged, onClose }: { user: Profile; onChanged: () => void; onClose: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function run(fn: () => Promise<{ error?: string }>) {
    setBusy(true)
    setError(null)
    const res = await fn()
    setBusy(false)
    if (res.error) { setError(res.error); return false }
    onChanged()
    return true
  }

  return (
    <div className="px-5 sm:px-7 pt-3 sm:pt-7 pb-6 space-y-5">
      <div className="flex items-center gap-4 pr-10">
        <span className={`w-16 h-16 rounded-full font-display font-bold text-2xl flex items-center justify-center shrink-0 ${user.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>{initials(user.full_name)}</span>
        <div className="min-w-0">
          <h2 className="text-[26px] font-bold text-gray-900 leading-tight">{user.full_name}</h2>
          <p className="text-gray-500 truncate">{user.email}</p>
        </div>
      </div>

      <Field label="Rol">
        <ChoiceChips<UserRole>
          value={user.role}
          onChange={(r) => { if (r !== user.role) run(() => updateUserRole(user.id, r)) }}
          options={[{ value: 'maestro', label: 'Maestro' }, { value: 'admin', label: 'Coordinador' }]}
        />
      </Field>

      <div className="rounded-2xl bg-gray-50 p-4 flex items-center gap-3">
        <Power size={18} className={user.active ? 'text-emerald-600' : 'text-gray-400'} />
        <div className="flex-1">
          <p className="font-semibold text-gray-800">{user.active ? 'Cuenta activa' : 'Cuenta desactivada'}</p>
          <p className="text-sm text-gray-500">{user.active ? 'Puede entrar a la app.' : 'No puede entrar hasta que la actives.'}</p>
        </div>
        <button disabled={busy} onClick={() => run(() => setUserActive(user.id, !user.active))}
          className="px-4 py-2 rounded-xl bg-white border border-gray-200 font-semibold text-sm text-gray-700 hover:border-indigo-300 disabled:opacity-50">
          {user.active ? 'Desactivar' : 'Activar'}
        </button>
      </div>

      <FormError error={error} />

      <button onClick={() => setConfirmDelete(true)} disabled={busy}
        className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-2xl text-red-600 font-semibold hover:bg-red-50 disabled:opacity-50 transition-colors">
        <Trash2 size={16} /> Eliminar cuenta
      </button>

      <ConfirmSheet
        open={confirmDelete}
        title={`¿Eliminar la cuenta de ${user.full_name}?`}
        message="Ya no podrá entrar a la app. Esta acción no se puede deshacer."
        confirmLabel="Sí, eliminar"
        destructive
        busy={busy}
        onConfirm={async () => { const ok = await run(() => deleteUser(user.id)); setConfirmDelete(false); if (ok) onClose() }}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  )
}

function NewUserForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('maestro')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName.trim() || !email.trim() || password.length < 8) {
      setError('Nombre, correo y una contraseña de al menos 8 caracteres.')
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
    <form onSubmit={submit} className="px-5 sm:px-7 pt-3 sm:pt-7 pb-6 space-y-5">
      <h2 className="text-2xl font-bold text-gray-900 pr-10">Nuevo usuario</h2>
      <Field label="Nombre completo" required><input value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus className={INPUT} /></Field>
      <Field label="Correo" required><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} /></Field>
      <Field label="Contraseña temporal" hint="(mínimo 8 caracteres; que la cambie al entrar)" required>
        <div className="relative">
          <KeyRound size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} className={`${INPUT} pl-11`} />
        </div>
      </Field>
      <Field label="Rol">
        <ChoiceChips value={role} onChange={setRole} options={[{ value: 'maestro' as UserRole, label: 'Maestro' }, { value: 'admin' as UserRole, label: 'Coordinador' }]} />
      </Field>
      <FormError error={error} />
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 py-3.5 rounded-2xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200">Cancelar</button>
        <motion.button type="submit" disabled={saving} whileTap={{ scale: 0.97 }} className="flex-[2] py-3.5 rounded-2xl bg-indigo-600 text-white font-display font-bold text-lg hover:bg-indigo-700 disabled:opacity-60">
          {saving ? 'Creando…' : 'Crear usuario'}
        </motion.button>
      </div>
    </form>
  )
}

// Lo "eliminado" queda marcado (deleted_at) y oculto en el resto de la app;
// aquí se puede restaurar. Borrar para siempre es irreversible, así que solo
// la cuenta dueña puede hacerlo.
function Trash({ isOwner }: { isOwner: boolean }) {
  const [entries, setEntries] = useState<TrashedRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmPurge, setConfirmPurge] = useState<TrashedRecord | null>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const load = useCallback(async () => {
    const [childRes, parentRes, attendanceRes] = await Promise.all([
      supabase.from('children').select('id, full_name, deleted_at, deleter:profiles!deleted_by(full_name)').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }).limit(100),
      supabase.from('parents').select('id, full_name, deleted_at, deleter:profiles!deleted_by(full_name)').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }).limit(100),
      supabase.from('attendance').select('id, deleted_at, deleter:profiles!deleted_by(full_name), children(full_name)').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }).limit(100),
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
  useEffect(() => { load() }, [load])

  async function restore(item: TrashedRecord) {
    setBusyId(item.id)
    setMessage(null)
    const { error } = await supabase.from(item.table_name).update({ deleted_at: null, deleted_by: null }).eq('id', item.id)
    setBusyId(null)
    // Una asistencia borrada ya no aparta su gafete ni al niño: si ya se
    // registró de nuevo (o alguien más tomó ese gafete), restaurarla choca.
    if (error?.code === '23505') setMessage({ kind: 'error', text: 'No se puede restaurar: ese niño ya se registró de nuevo ese día, o su gafete/bíper ya lo tiene otro niño.' })
    else if (error) setMessage({ kind: 'error', text: 'No se pudo restaurar. Intenta de nuevo.' })
    else setMessage({ kind: 'ok', text: `Se restauró ${item.full_name ?? 'el registro'}.` })
    load()
  }

  async function purge(item: TrashedRecord) {
    setBusyId(item.id)
    await supabase.from(item.table_name).delete().eq('id', item.id)
    setBusyId(null)
    setConfirmPurge(null)
    load()
  }

  const label = (t: TrashedRecord['table_name']) => (t === 'parents' ? 'Familia' : t === 'attendance' ? 'Asistencia' : 'Niño')
  const Icon = (t: TrashedRecord['table_name']) => (t === 'parents' ? UsersIcon : t === 'attendance' ? LogIn : Baby)

  if (loading) return <div className="space-y-2">{[0, 1, 2].map((i) => <SkeletonRow key={i} />)}</div>

  return (
    <div className="space-y-3">
      <AnimatePresence>
        {message && (
          <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`rounded-2xl px-4 py-3 text-sm font-medium ${message.kind === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>
            {message.text}
          </motion.p>
        )}
      </AnimatePresence>
      {entries.length === 0 ? <EmptyState icon={Trash2} text="La papelera está vacía." /> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          <AnimatePresence initial={false}>
            {entries.map((e) => {
              const I = Icon(e.table_name)
              return (
                <motion.div key={`${e.table_name}-${e.id}`} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: 40 }}
                  className="rounded-2xl bg-white shadow-sm shadow-gray-900/5 px-4 py-3 flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center shrink-0"><I size={17} /></span>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-800"><span className="font-semibold">{e.full_name ?? 'Sin nombre'}</span> <span className="text-sm text-gray-400">· {label(e.table_name)}</span></p>
                    <p className="text-xs text-gray-500">
                      Por {e.deleter?.full_name ?? 'alguien fuera de la app'} · {formatDistanceToNow(new Date(e.deleted_at), { addSuffix: true, locale: es })}
                    </p>
                  </div>
                  <button onClick={() => restore(e)} disabled={busyId === e.id}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50">
                    <RotateCcw size={14} /> Restaurar
                  </button>
                  {isOwner && (
                    <button onClick={() => setConfirmPurge(e)} disabled={busyId === e.id} className="p-2 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50" aria-label="Borrar para siempre">
                      <Trash2 size={16} />
                    </button>
                  )}
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
      <ConfirmSheet
        open={!!confirmPurge}
        title="¿Borrar para siempre?"
        message={`"${confirmPurge?.full_name ?? 'Este registro'}" se eliminará definitivamente. No se puede deshacer.`}
        confirmLabel="Borrar para siempre"
        destructive
        busy={!!busyId}
        onConfirm={() => confirmPurge && purge(confirmPurge)}
        onClose={() => setConfirmPurge(null)}
      />
    </div>
  )
}

// Solo la cuenta dueña: quién entró y quién agregó o editó qué, a partir de
// los triggers de la base de datos. Nunca se monta para nadie más.
function ActivityLog() {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.from('activity_log').select('*, actor:profiles(full_name)').order('created_at', { ascending: false }).limit(150)
      const rows = (data as ActivityLogEntry[]) ?? []
      const ids = (t: string) => [...new Set(rows.filter((r) => r.table_name === t && r.record_id).map((r) => r.record_id!))]
      const [kids, parents, attendance] = await Promise.all([
        ids('children').length ? supabase.from('children').select('id, full_name').in('id', ids('children')) : Promise.resolve({ data: [] }),
        ids('parents').length ? supabase.from('parents').select('id, full_name').in('id', ids('parents')) : Promise.resolve({ data: [] }),
        ids('attendance').length ? supabase.from('attendance').select('id, children(full_name)').in('id', ids('attendance')) : Promise.resolve({ data: [] }),
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
  }, [])

  function describe(e: ActivityLogEntry): string {
    const who = e.actor?.full_name ?? 'Alguien fuera de la app'
    if (e.event_type === 'login') return `${who} inició sesión`
    const what = e.event_type === 'insert' ? 'agregó' : 'editó'
    const table = e.table_name === 'parents' ? 'una familia' : e.table_name === 'attendance' ? 'una asistencia' : 'un niño'
    return `${who} ${what} ${table}${e.record_full_name ? ` (${e.record_full_name})` : ''}`
  }

  if (loading) return <div className="space-y-2">{[0, 1, 2].map((i) => <SkeletonRow key={i} />)}</div>
  if (entries.length === 0) return <EmptyState icon={Crown} text="Todavía no hay actividad registrada." />

  return (
    <div className="space-y-3">
      <p className="text-sm text-amber-800 bg-amber-50 rounded-2xl px-4 py-2.5 inline-flex items-center gap-2"><Crown size={15} /> Solo tú ves esta bitácora.</p>
      <ol className="relative border-l-2 border-gray-200 ml-4 space-y-3">
        {entries.map((e, i) => (
          <motion.li key={e.id} variants={itemVariants} initial="hidden" animate="show" custom={i} className="ml-5">
            <span className={`absolute -left-[13px] w-6 h-6 rounded-full flex items-center justify-center ring-4 ring-canvas ${e.event_type === 'login' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
              {e.event_type === 'login' ? <LogIn size={12} /> : <Pencil size={12} />}
            </span>
            <div className="rounded-2xl bg-white shadow-sm shadow-gray-900/5 px-4 py-2.5">
              <p className="text-gray-800">{describe(e)}</p>
              <p className="text-xs text-gray-500 mt-0.5">{formatDistanceToNow(new Date(e.created_at), { addSuffix: true, locale: es })}</p>
            </div>
          </motion.li>
        ))}
      </ol>
    </div>
  )
}
