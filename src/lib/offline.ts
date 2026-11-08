import { supabase, isNetworkError } from './supabase'
import { CATEGORY_LABELS, type Category, type TeamColor } from '../types/domain'
import { requiresBadge } from './categoryUtils'

// ─── Modo sin conexión ────────────────────────────────────────────────────────
//
// El internet de la iglesia falla justo los domingos. En vez de que el
// registro se detenga, lo que no se pudo subir (familias nuevas y check-ins)
// se guarda en IndexedDB en este dispositivo y se sube solo en cuanto vuelve
// la conexión. Todo usa ids generados aquí (crypto.randomUUID) para que
// reintentar sea seguro: si el servidor ya lo tenía, el choque de llave
// primaria (23505 en *_pkey) se toma como "ya estaba subido".

export interface ParentInsert { id: string; full_name: string; phone: string | null }
export interface ChildInsert {
  id: string
  parent_id: string
  full_name: string
  birth_date: string | null
  category: Category | null
  allergies: string | null
  medical_notes: string | null
  guardian_relationship: string | null
  comments: string | null
  toilet_trained: boolean | null
}
export interface AttendanceInsert {
  id: string
  child_id: string
  session_date: string
  team_color: TeamColor
  category: Category
  badge_number: number | null
  pager_number: number | null
  checked_in_at: string
}

export interface FamilyPayload {
  parent: ParentInsert
  children: ChildInsert[]
}

type OutboxItem =
  | { id: string; kind: 'family'; createdAt: number; payload: FamilyPayload; lastError?: string }
  | { id: string; kind: 'attendance'; createdAt: number; payload: AttendanceInsert; childName?: string; lastError?: string }

type PgError = { code?: string; message: string; name?: string } | null

function isPkeyConflict(err: PgError) {
  return err?.code === '23505' && !!err.message?.includes('_pkey')
}

// ─── IndexedDB (sin dependencias) ─────────────────────────────────────────────

const DB_NAME = 'ministerio-offline'
const STORE = 'outbox'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE, { keyPath: 'id' }) }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const req = fn(t.objectStore(STORE))
    t.oncomplete = () => { db.close(); resolve(req.result) }
    t.onerror = () => { db.close(); reject(t.error) }
  })
}

let memoryItems: OutboxItem[] = []

async function readAll(): Promise<OutboxItem[]> {
  try {
    const items = await tx<OutboxItem[]>('readonly', (s) => s.getAll() as IDBRequest<OutboxItem[]>)
    memoryItems = items.sort((a, b) => a.createdAt - b.createdAt)
  } catch {
    // Sin IndexedDB (modo privado en algunos navegadores) la cola vive solo
    // en memoria — se pierde si recargan, pero al menos no truena.
  }
  return memoryItems
}

async function put(item: OutboxItem) {
  memoryItems = [...memoryItems.filter((i) => i.id !== item.id), item]
  try { await tx('readwrite', (s) => s.put(item)) } catch { /* ver readAll */ }
}

async function remove(id: string) {
  memoryItems = memoryItems.filter((i) => i.id !== id)
  try { await tx('readwrite', (s) => s.delete(id)) } catch { /* ver readAll */ }
}

// ─── Estado observable (para el aviso en el encabezado) ───────────────────────

export interface OfflineState {
  online: boolean
  syncing: boolean
  pending: number
  /** Avisos de la última sincronización que alguien debe revisar a mano. */
  notices: string[]
}

let state: OfflineState = {
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  syncing: false,
  pending: 0,
  notices: [],
}
const listeners = new Set<() => void>()
const syncedListeners = new Set<() => void>()

function setState(patch: Partial<OfflineState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

export function getOfflineState() { return state }
export function subscribeOffline(fn: () => void) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}
/** Fires after a sync uploaded at least one item — pages refetch so the
 * temporary local copies get replaced by the real server rows. */
export function onSynced(fn: () => void) {
  syncedListeners.add(fn)
  return () => { syncedListeners.delete(fn) }
}
export function dismissNotices() { setState({ notices: [] }) }
export function markOnline(online: boolean) { if (state.online !== online) setState({ online }) }

// ─── Guardado real (mismo código en línea y al sincronizar) ───────────────────

/** Sube una familia completa. Seguro de repetir. Lanza el error si falla.
 * (Familias que quedaron en cola con una versión vieja pueden traer campos de
 * fotos: se ignoran.) */
export async function uploadFamily(p: FamilyPayload): Promise<void> {
  const { error: parentErr } = await supabase.from('parents').insert(p.parent)
  if (parentErr && !isPkeyConflict(parentErr)) throw parentErr

  for (const child of p.children) {
    const { error } = await supabase.from('children').insert(child)
    if (error && !isPkeyConflict(error)) throw error
  }
}

type AttendanceResult = { ok: true; notice?: string } | { ok: false; error: PgError }

/** Inserta un check-in. Seguro de repetir. */
export async function uploadAttendance(row: AttendanceInsert, opts: { resolveConflicts: boolean; childName?: string; tries?: number }): Promise<AttendanceResult> {
  const { error } = await supabase.from('attendance').insert(row)
  if (!error || isPkeyConflict(error)) return { ok: true }
  if (!opts.resolveConflicts || error.code !== '23505') return { ok: false, error }

  // Solo al sincronizar: otro dispositivo pudo haber hecho algo mientras
  // este estaba sin internet. No hay a quién preguntarle en ese momento,
  // así que se resuelve solo y se deja un aviso para revisarlo.
  const who = opts.childName ?? 'Un niño'
  if (error.message?.includes('attendance_unique_checkin')) {
    return { ok: true, notice: `${who} ya había sido registrado hoy desde otro dispositivo.` }
  }
  const badgeTaken = error.message?.includes('attendance_badge_category_unique')
  const pagerTaken = error.message?.includes('attendance_pager_category_unique')
  const tries = opts.tries ?? 0
  if ((badgeTaken || pagerTaken) && tries < 3) {
    const retry = { ...row }
    if (pagerTaken) retry.pager_number = null
    if (badgeTaken) {
      // Fuera de Corderitos el gafete es obligatorio (la base de datos no
      // acepta registrarlo sin gafete): se le da el siguiente libre de su
      // grupo ese día. Antes se intentaba sin gafete, la base lo rechazaba
      // y el registro se quedaba atorado como "sin subir" para siempre.
      if (requiresBadge(row.category)) {
        const { data, error: e2 } = await supabase.from('attendance').select('badge_number')
          .eq('session_date', row.session_date).eq('category', row.category).is('deleted_at', null)
          .not('badge_number', 'is', null).order('badge_number', { ascending: false }).limit(1)
        if (e2) return { ok: false, error: e2 }
        retry.badge_number = (data?.[0]?.badge_number ?? 0) + 1
      } else {
        retry.badge_number = null
      }
    }
    const second = await uploadAttendance(retry, { ...opts, tries: tries + 1 })
    if (!second.ok) return second
    const group = CATEGORY_LABELS[row.category]
    const parts = [
      badgeTaken && (retry.badge_number !== null
        ? `quedó con el gafete #${retry.badge_number} porque el #${row.badge_number} ya lo tenía otro niño`
        : `el gafete #${row.badge_number} ya lo tenía otro niño`),
      pagerTaken && `el bíper #${row.pager_number} ya lo tenía otro niño (quedó sin bíper)`,
    ].filter(Boolean)
    return {
      ok: true,
      notice: `${who} quedó registrado en ${group}, pero ${parts.join(' y ')}. Revísalo en "Registrados hoy".`,
    }
  }
  return { ok: false, error }
}

// ─── API para las pantallas ───────────────────────────────────────────────────

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  // Navegadores viejos / http sin TLS
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

/**
 * Intenta guardar la familia en línea; si no hay internet la deja en cola.
 * `queued: true` significa que quedó guardada solo en este dispositivo.
 * Errores del servidor (no de red) se lanzan para que la pantalla los muestre.
 */
export async function saveFamily(p: FamilyPayload): Promise<{ queued: boolean }> {
  if (navigator.onLine) {
    try {
      await uploadFamily({ parent: p.parent, children: p.children })
      return { queued: false }
    } catch (err) {
      if (!isNetworkError(err as PgError)) throw err
    }
  }
  await put({ id: p.parent.id, kind: 'family', createdAt: Date.now(), payload: p })
  await refreshPending()
  return { queued: true }
}

/** Igual que saveFamily pero para un check-in. Devuelve el error del
 * servidor tal cual (gafete repetido, etc.) para que la pantalla lo explique. */
export async function saveAttendance(row: AttendanceInsert, childName?: string): Promise<{ queued: boolean; error: PgError }> {
  if (navigator.onLine) {
    const res = await uploadAttendance(row, { resolveConflicts: false })
    if (res.ok) return { queued: false, error: null }
    if (!isNetworkError(res.error)) return { queued: false, error: res.error }
  }
  await put({ id: row.id, kind: 'attendance', createdAt: Date.now(), payload: row, childName })
  await refreshPending()
  return { queued: true, error: null }
}

/** Lo que todavía no sube, para mezclarlo en las listas de la pantalla. */
export async function getPendingItems() {
  const items = await readAll()
  return {
    families: items.filter((i): i is Extract<OutboxItem, { kind: 'family' }> => i.kind === 'family').map((i) => i.payload),
    attendance: items.filter((i): i is Extract<OutboxItem, { kind: 'attendance' }> => i.kind === 'attendance').map((i) => i.payload),
  }
}

async function refreshPending() {
  const items = await readAll()
  setState({ pending: items.length })
}

let flushing: Promise<void> | null = null

/** Sube todo lo pendiente, en orden (una familia antes que el check-in de sus niños). */
export function flushOutbox(): Promise<void> {
  if (flushing) return flushing
  flushing = (async () => {
    const items = await readAll()
    if (items.length === 0 || !navigator.onLine) { setState({ pending: items.length }); return }
    // Sin sesión (alguien cerró sesión con cosas pendientes) RLS lo
    // rechazaría todo; se espera a que alguien vuelva a entrar.
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setState({ pending: items.length }); return }
    setState({ syncing: true })
    const notices: string[] = []
    let uploaded = 0
    for (const item of items) {
      try {
        if (item.kind === 'family') {
          await uploadFamily(item.payload)
        } else {
          const res = await uploadAttendance(item.payload, { resolveConflicts: true, childName: item.childName })
          if (!res.ok) throw res.error
          if (res.notice) notices.push(res.notice)
        }
        await remove(item.id)
        uploaded++
      } catch (err) {
        if (isNetworkError(err as PgError)) break // se cayó otra vez; se reintenta luego
        // Error del servidor que no se arregla reintentando. Se deja en la
        // cola (no se pierde) con el motivo, y se avisa.
        const msg = (err as PgError)?.message ?? String(err)
        if (item.lastError === msg) continue // ya se avisó la primera vez
        await put({ ...item, lastError: msg })
        notices.push(
          item.kind === 'family'
            ? `No se pudo subir la familia de ${item.payload.parent.full_name}: ${msg}`
            : `No se pudo subir el registro de ${item.childName ?? 'un niño'}: ${msg}`
        )
      }
    }
    const remaining = await readAll()
    setState({ syncing: false, pending: remaining.length, notices: [...state.notices, ...notices] })
    if (uploaded > 0) syncedListeners.forEach((l) => l())
  })().finally(() => { flushing = null })
  return flushing
}

// ─── Caché de lectura (para abrir la app sin internet) ────────────────────────

export function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(`offline_cache:${key}`)
    return raw ? (JSON.parse(raw) as T) : null
  } catch { return null }
}

export function writeCache(key: string, value: unknown) {
  try { localStorage.setItem(`offline_cache:${key}`, JSON.stringify(value)) } catch { /* lleno: no pasa nada */ }
}

/** Borra las copias de días anteriores (`<algo>:yyyy-MM-dd`) para que no se
 * vayan acumulando domingo tras domingo hasta llenar el localStorage. */
export function pruneDatedCache(today: string) {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('offline_cache:') && /:\d{4}-\d{2}-\d{2}$/.test(k) && !k.endsWith(`:${today}`))
      .forEach((k) => localStorage.removeItem(k))
  } catch { /* sin localStorage */ }
}

// ─── Arranque ─────────────────────────────────────────────────────────────────

let started = false
export function startOfflineSync() {
  if (started || typeof window === 'undefined') return
  started = true
  window.addEventListener('online', () => { markOnline(true); flushOutbox() })
  window.addEventListener('offline', () => markOnline(false))
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') flushOutbox() })
  // navigator.onLine dice "true" con wifi conectado pero sin salida a
  // internet (lo más común en la iglesia), así que además se reintenta
  // cada rato mientras haya algo pendiente.
  setInterval(() => { if (state.pending > 0) flushOutbox() }, 30_000)
  flushOutbox()
}
