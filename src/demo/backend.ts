// ─── Backend de demostración ──────────────────────────────────────────────────
//
// Solo para el build de demo (demo.html / `npm run build:demo`): imita las
// partes de Supabase (PostgREST, Auth, Storage, Edge Functions) que usa la
// app, con datos inventados guardados en el navegador. Nada sale a internet
// ni toca la base de datos real. El build normal nunca importa este archivo.

import { createSeed, type Row, type Db } from './seed'

const STORE_KEY = 'ministerio_demo_db_v1'

function load(): Db {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) return JSON.parse(raw) as Db
  } catch { /* sin localStorage */ }
  return createSeed()
}
let db: Db = load()
function persist() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(db)) } catch { /* sin localStorage */ }
}
export function resetDemo() {
  db = createSeed()
  persist()
}

// FK reales del esquema (src/types/database.ts → Relationships)
const FKS: { from: string; col: string; to: string; name: string }[] = [
  { from: 'activity_log', col: 'user_id', to: 'profiles', name: 'activity_log_user_id_fkey' },
  { from: 'attendance', col: 'assigned_teacher_id', to: 'profiles', name: 'attendance_assigned_teacher_id_fkey' },
  { from: 'attendance', col: 'child_id', to: 'children', name: 'attendance_child_id_fkey' },
  { from: 'attendance', col: 'deleted_by', to: 'profiles', name: 'attendance_deleted_by_fkey' },
  { from: 'child_contacts', col: 'child_id', to: 'children', name: 'child_contacts_child_id_fkey' },
  { from: 'children', col: 'assigned_maestro_id', to: 'maestros', name: 'children_assigned_maestro_id_fkey' },
  { from: 'children', col: 'deleted_by', to: 'profiles', name: 'children_deleted_by_fkey' },
  { from: 'children', col: 'parent_id', to: 'parents', name: 'children_parent_id_fkey' },
  { from: 'coordinator_requests', col: 'author_id', to: 'profiles', name: 'coordinator_requests_author_id_fkey' },
  { from: 'coordinator_requests', col: 'resolved_by', to: 'profiles', name: 'coordinator_requests_resolved_by_fkey' },
  { from: 'parents', col: 'deleted_by', to: 'profiles', name: 'parents_deleted_by_fkey' },
  { from: 'shift_notes', col: 'author_id', to: 'profiles', name: 'shift_notes_author_id_fkey' },
  { from: 'shift_notes', col: 'child_id', to: 'children', name: 'shift_notes_child_id_fkey' },
]

// ─── select=… parser ──────────────────────────────────────────────────────────

type Sel = { alias: string | null; name: string; hint: string | null; inner: Sel[] | null; star?: boolean }

function splitTop(s: string): string[] {
  const out: string[] = []
  let depth = 0, cur = ''
  for (const ch of s) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) { out.push(cur); cur = '' } else cur += ch
  }
  if (cur.trim()) out.push(cur)
  return out.map((x) => x.trim()).filter(Boolean)
}

function parseSelect(s: string): Sel[] {
  return splitTop(s).map((part) => {
    if (part === '*') return { alias: null, name: '*', hint: null, inner: null, star: true }
    const m = part.match(/^(?:([\w]+):)?([\w]+)(?:!([\w]+))?(?:\((.*)\))?$/s)
    if (!m) return { alias: null, name: part, hint: null, inner: null }
    const [, alias, name, hint, inner] = m
    return { alias: alias ?? null, name, hint: hint ?? null, inner: inner !== undefined ? parseSelect(inner) : null }
  })
}

function project(table: string, row: Row, sel: Sel[]): Row {
  const out: Row = {}
  for (const f of sel) {
    if (f.star) { Object.assign(out, row); continue }
    if (!f.inner) {
      if (f.name === 'count') continue
      out[f.alias ?? f.name] = row[f.name] ?? null
      continue
    }
    // Embedded resource
    const target = f.name
    const key = f.alias ?? f.name
    const many2one = FKS.filter((k) => k.from === table && k.to === target)
      .find((k) => !f.hint ? (many2oneDefault(k, f.alias)) : (k.col === f.hint || k.name === f.hint))
    if (many2one) {
      const ref = (db[target] ?? []).find((r) => r.id === row[many2one.col])
      out[key] = ref ? project(target, ref, f.inner) : null
      continue
    }
    const one2many = FKS.find((k) => k.from === target && k.to === table && (!f.hint || k.col === f.hint || k.name === f.hint))
    if (one2many) {
      const rows = (db[target] ?? []).filter((r) => r[one2many.col] === row.id)
      if (f.inner.length === 1 && f.inner[0].name === 'count') out[key] = [{ count: rows.length }]
      else out[key] = rows.map((r) => project(target, r, f.inner!))
      continue
    }
    out[key] = null
  }
  return out
}

function many2oneDefault(k: { col: string }, alias: string | null) {
  if (alias && k.col === `${alias}_id`) return true
  return k.col !== 'deleted_by' && k.col !== 'resolved_by'
}

// ─── filtros ──────────────────────────────────────────────────────────────────

function cmp(a: unknown, b: string): number {
  const av = a as string | number | null
  if (av === null || av === undefined) return -1
  if (typeof av === 'number') return av - Number(b)
  return String(av) < b ? -1 : String(av) > b ? 1 : 0
}

function matchOne(val: unknown, expr: string): boolean {
  let negate = false
  if (expr.startsWith('not.')) { negate = true; expr = expr.slice(4) }
  const dot = expr.indexOf('.')
  const op = expr.slice(0, dot)
  const arg = decodeURIComponent(expr.slice(dot + 1))
  let r: boolean
  switch (op) {
    case 'eq': r = String(val) === arg; break
    case 'neq': r = String(val) !== arg; break
    case 'is': r = arg === 'null' ? val === null || val === undefined : String(val) === arg; break
    case 'gte': r = cmp(val, arg) >= 0; break
    case 'lte': r = cmp(val, arg) <= 0; break
    case 'gt': r = cmp(val, arg) > 0; break
    case 'lt': r = cmp(val, arg) < 0; break
    case 'in': r = arg.replace(/^\(|\)$/g, '').split(',').map((x) => x.replace(/^"|"$/g, '')).includes(String(val)); break
    case 'ilike':
    case 'like': {
      const re = new RegExp('^' + arg.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[%*]/g, '.*') + '$', op === 'ilike' ? 'i' : '')
      r = re.test(String(val ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')) || re.test(String(val ?? ''))
      break
    }
    default: r = true
  }
  return negate ? !r : r
}

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'])

function applyFilters(rows: Row[], params: URLSearchParams): Row[] {
  let out = rows
  for (const [k, v] of params) {
    if (RESERVED.has(k) || k.includes('.')) continue
    out = out.filter((r) => matchOne(r[k], v))
  }
  return out
}

function applyOrder(rows: Row[], order: string | null): Row[] {
  if (!order) return rows
  const keys = order.split(',').map((o) => { const [col, dir] = o.split('.'); return { col, desc: dir === 'desc' } })
  return [...rows].sort((a, b) => {
    for (const { col, desc } of keys) {
      const x = a[col] as string | number | null, y = b[col] as string | number | null
      if (x === y) continue
      if (x === null || x === undefined) return 1
      if (y === null || y === undefined) return -1
      const c = typeof x === 'string' ? x.localeCompare(String(y)) : (x as number) - (y as number)
      if (c !== 0) return desc ? -c : c
    }
    return 0
  })
}

// ─── reglas mínimas para que la demo se sienta real ───────────────────────────

function uniqueViolation(table: string, row: Row, ignoreId?: unknown): string | null {
  if (table !== 'attendance' || row.deleted_at) return null
  const live = (db.attendance ?? []).filter((a) => !a.deleted_at && a.id !== ignoreId && a.session_date === row.session_date)
  if (live.some((a) => a.child_id === row.child_id)) return 'attendance_unique_checkin'
  if (row.badge_number != null && live.some((a) => a.category === row.category && a.badge_number === row.badge_number)) return 'attendance_badge_category_unique'
  if (row.pager_number != null && live.some((a) => a.category === row.category && a.pager_number === row.pager_number)) return 'attendance_pager_category_unique'
  return null
}

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

function localDate() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function withDefaults(table: string, row: Row): Row {
  const now = new Date().toISOString()
  const base: Row = { id: uuid(), created_at: now, deleted_at: null, deleted_by: null }
  if (table === 'attendance') Object.assign(base, { checked_in_at: now, checked_out_at: null, assigned_teacher_id: null, session_date: localDate() })
  if (table === 'children') Object.assign(base, { photo_url: null, assigned_maestro_id: null, assigned_maestro_name: null })
  if (table === 'parents') Object.assign(base, { photo_url: null })
  if (table === 'coordinator_requests') Object.assign(base, { status: 'pendiente', resolved_at: null, resolved_by: null, seen_by_author: false, author_id: DEMO_USER_ID })
  if (table === 'shift_notes') Object.assign(base, { author_id: DEMO_USER_ID, session_date: localDate() })
  return { ...base, ...row }
}

export const DEMO_USER_ID = '00000000-0000-4000-8000-000000000001'

// ─── HTTP ─────────────────────────────────────────────────────────────────────

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

function pgError(code: string, message: string, status: number) {
  return json({ code, message, details: null, hint: null }, status)
}

function demoSession() {
  return {
    access_token: 'demo-token',
    refresh_token: 'demo-refresh',
    token_type: 'bearer',
    expires_in: 60 * 60 * 24 * 365,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
    user: { id: DEMO_USER_ID, email: 'demo@ministerio.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
  }
}

export function demoSessionForStorage() {
  return demoSession()
}

async function handleRest(url: URL, method: string, headers: Headers, body: string | null): Promise<Response> {
  const path = url.pathname.replace(/^\/rest\/v1\//, '')
  const params = url.searchParams

  if (path.startsWith('rpc/')) {
    const fn = path.slice(4)
    const args = body ? JSON.parse(body) : {}
    const staffTables: Record<string, string> = {
      set_daily_coordinator: 'daily_coordinator',
      set_daily_computer_operator: 'daily_computer_operator',
      set_daily_corderitos_lead: 'daily_corderitos_lead',
    }
    if (fn in staffTables) {
      const table = staffTables[fn]
      db[table] = (db[table] ?? []).filter((r) => r.session_date !== args.p_session_date)
      db[table].push({ session_date: args.p_session_date, name: args.p_name, set_by: DEMO_USER_ID })
    } else if (fn === 'assign_attendance_teacher') {
      const a = (db.attendance ?? []).find((r) => r.id === args.p_attendance_id)
      if (a) a.assigned_teacher_id = args.p_teacher_id
    } else if (fn === 'sync_child_category') {
      const c = (db.children ?? []).find((r) => r.id === args.p_child_id)
      if (c) c.category = args.p_category
    } else if (fn === 'is_admin' || fn === 'is_owner') {
      return json(true)
    }
    persist()
    return json(null)
  }

  const table = path
  db[table] ??= []
  const prefer = headers.get('Prefer') ?? ''
  const wantsObject = (headers.get('Accept') ?? '').includes('vnd.pgrst.object')
  const sel = parseSelect(params.get('select') ?? '*')
  const returnRows = (rows: Row[], status = 200) => {
    const projected = rows.map((r) => project(table, r, sel))
    const extra: Record<string, string> = {}
    if (prefer.includes('count=')) extra['Content-Range'] = `0-${Math.max(0, projected.length - 1)}/${projected.length}`
    if (wantsObject) {
      if (projected.length !== 1) return pgError('PGRST116', 'JSON object requested, multiple (or no) rows returned', 406)
      return json(projected[0], status, extra)
    }
    if (method === 'HEAD') return new Response(null, { status, headers: extra })
    return json(projected, status, extra)
  }

  if (method === 'GET' || method === 'HEAD') {
    let rows = applyOrder(applyFilters(db[table], params), params.get('order'))
    const offset = Number(params.get('offset') ?? 0)
    const limit = params.get('limit') ? Number(params.get('limit')) : undefined
    rows = rows.slice(offset, limit !== undefined ? offset + limit : undefined)
    return returnRows(rows)
  }

  if (method === 'POST') {
    const input = JSON.parse(body ?? '[]')
    const list: Row[] = Array.isArray(input) ? input : [input]
    const inserted: Row[] = []
    for (const raw of list) {
      const row = withDefaults(table, raw)
      if (db[table].some((r) => r.id === row.id)) return pgError('23505', `duplicate key value violates unique constraint "${table}_pkey"`, 409)
      const v = uniqueViolation(table, row)
      if (v) return pgError('23505', `duplicate key value violates unique constraint "${v}"`, 409)
      inserted.push(row)
    }
    db[table].push(...inserted)
    persist()
    if (prefer.includes('return=representation')) return returnRows(inserted, 201)
    return new Response(null, { status: 201 })
  }

  if (method === 'PATCH') {
    const patch = JSON.parse(body ?? '{}') as Row
    const targets = applyFilters(db[table], params)
    for (const t of targets) {
      const v = uniqueViolation(table, { ...t, ...patch }, t.id)
      if (v) return pgError('23505', `duplicate key value violates unique constraint "${v}"`, 409)
    }
    targets.forEach((t) => Object.assign(t, patch))
    persist()
    if (prefer.includes('return=representation')) return returnRows(targets)
    return new Response(null, { status: 204 })
  }

  if (method === 'DELETE') {
    const targets = new Set(applyFilters(db[table], params))
    db[table] = db[table].filter((r) => !targets.has(r))
    persist()
    if (prefer.includes('return=representation')) return returnRows([...targets])
    return new Response(null, { status: 204 })
  }

  return pgError('PGRST000', 'método no soportado en la demo', 400)
}

export async function demoFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const req = new Request(input, init)
  const url = new URL(req.url)
  const body = req.method === 'GET' || req.method === 'HEAD' ? null : await req.text()
  // Un poco de latencia para que los estados de "Guardando…" se vean.
  await new Promise((r) => setTimeout(r, 120))

  if (url.pathname.startsWith('/rest/v1/')) return handleRest(url, req.method, req.headers, body)
  if (url.pathname.startsWith('/auth/v1/')) {
    if (url.pathname.endsWith('/logout')) return new Response(null, { status: 204 })
    if (url.pathname.endsWith('/user')) return json(demoSession().user)
    if (url.pathname.endsWith('/token') || url.pathname.endsWith('/recover')) return json(demoSession())
    return json({})
  }
  if (url.pathname.startsWith('/storage/v1/')) {
    if (url.pathname.includes('/object/sign/')) return json({ signedURL: null })
    return json({ Key: 'demo' })
  }
  if (url.pathname.startsWith('/functions/v1/')) return json({ ok: true })
  return json({})
}
