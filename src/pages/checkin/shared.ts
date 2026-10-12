// Tipos, constantes y utilidades compartidas por las piezas de Registro.
import { format } from 'date-fns'
import { Bug, Zap, Compass, Baby, PersonStanding, type LucideIcon } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { getPendingItems, readCache } from '../../lib/offline'
import { normalizeName } from '../../lib/fuzzySearch'
import type { Category, TeamColor, GuardianRelationship } from '../../types/domain'

export type TodayRecord = {
  id: string
  child_id: string
  category: Category
  badge_number: number | null
  pager_number: number | null
  checked_in_at: string
  checked_out_at: string | null
  children: {
    full_name: string
    allergies: string | null
    medical_notes: string | null
    toilet_trained: boolean | null
    comments: string | null
  }
  assigned_teacher_id: string | null
  assigned_teacher: { full_name: string } | null
  /** Guardado solo en este dispositivo, esperando internet (lib/offline.ts). */
  pending?: boolean
}

export type ChildResult = {
  id: string
  full_name: string
  birth_date: string | null
  category: Category | null
  allergies: string | null
  medical_notes: string | null
  toilet_trained: boolean | null
  comments: string | null
  guardian_relationship: GuardianRelationship | null
  photo_url: string | null
  assigned_maestro_id: string | null
  assigned_maestro_name: string | null
  parent_id: string | null
  parents: { full_name: string; phone: string } | null
  attendance: { session_date: string; badge_number?: number | null }[]
}

export type RosterChild = Omit<ChildResult, 'attendance'>
export type TodayAtt = { child_id: string; badge_number: number | null }

export const CHILD_SELECT = 'id, full_name, birth_date, category, allergies, medical_notes, toilet_trained, comments, guardian_relationship, photo_url, assigned_maestro_id, assigned_maestro_name, parent_id, parents(full_name, phone)'

// `today` se calcula una sola vez al cargar — CheckInPage recarga la página
// si cambia el día con la app abierta.
export const today = format(new Date(), 'yyyy-MM-dd')

const TEAM_KEY = 'ministerio_team_session'

export function getStoredTeamForToday(): TeamColor | null {
  try {
    const raw = localStorage.getItem(TEAM_KEY)
    if (!raw) return null
    const { color, date } = JSON.parse(raw)
    return date === today ? (color as TeamColor) : null
  } catch { return null }
}

export function persistTeam(color: TeamColor) {
  try { localStorage.setItem(TEAM_KEY, JSON.stringify({ color, date: today })) } catch { /* sin localStorage */ }
}

export const TEAM_META: Record<TeamColor, { label: string; bg: string; soft: string; text: string; ring: string }> = {
  rojo:     { label: 'Rojo',     bg: 'bg-red-500',    soft: 'bg-red-50 text-red-700',       text: 'text-white',    ring: 'ring-red-200' },
  amarillo: { label: 'Amarillo', bg: 'bg-yellow-400', soft: 'bg-yellow-50 text-yellow-800', text: 'text-gray-900', ring: 'ring-yellow-200' },
  azul:     { label: 'Azul',     bg: 'bg-blue-500',   soft: 'bg-blue-50 text-blue-700',     text: 'text-white',    ring: 'ring-blue-200' },
}

export interface GroupMeta {
  category: Category
  icon: LucideIcon
  ages: string
  /** Fondo de la tarjeta del grupo */
  tile: string
  iconBg: string
  iconColor: string
  text: string
  bar: string
  barBg: string
  /** Círculo con iniciales del niño */
  avatar: string
  /** Degradado suave detrás de la vista del grupo */
  wash: string
}

// Misma paleta que CATEGORY_COLORS (types/domain.ts) y CAT_CONFIG
// (ReportsPage.tsx). Mismo orden de siempre para no confundir a nadie.
export const GROUPS: GroupMeta[] = [
  { category: 'hormiguitas', icon: Bug, ages: '4–6 años', tile: 'bg-red-100', iconBg: 'bg-red-500/15', iconColor: 'text-red-600', text: 'text-red-900', bar: 'bg-red-500', barBg: 'bg-red-200/70', avatar: 'bg-red-100 text-red-700', wash: 'from-red-100/90' },
  { category: 'saltamontes', icon: Zap, ages: '7–9 años', tile: 'bg-green-100', iconBg: 'bg-green-500/15', iconColor: 'text-green-700', text: 'text-green-900', bar: 'bg-green-500', barBg: 'bg-green-200/70', avatar: 'bg-green-100 text-green-800', wash: 'from-green-100/90' },
  { category: 'exploradores', icon: Compass, ages: '10–12 años', tile: 'bg-orange-100', iconBg: 'bg-orange-500/15', iconColor: 'text-orange-600', text: 'text-orange-900', bar: 'bg-orange-500', barBg: 'bg-orange-200/70', avatar: 'bg-orange-100 text-orange-800', wash: 'from-orange-100/90' },
  { category: 'corderitos_0_2', icon: Baby, ages: '1–2 años', tile: 'bg-sky-100', iconBg: 'bg-sky-500/15', iconColor: 'text-sky-700', text: 'text-sky-900', bar: 'bg-sky-500', barBg: 'bg-sky-200/70', avatar: 'bg-sky-100 text-sky-800', wash: 'from-sky-100/90' },
  { category: 'corderitos_2_4', icon: PersonStanding, ages: '3–4 años', tile: 'bg-blue-100', iconBg: 'bg-blue-500/15', iconColor: 'text-blue-700', text: 'text-blue-900', bar: 'bg-blue-500', barBg: 'bg-blue-200/70', avatar: 'bg-blue-100 text-blue-800', wash: 'from-blue-100/90' },
]

const NO_GROUP: GroupMeta = { category: 'hormiguitas', icon: Bug, ages: '', tile: 'bg-gray-100', iconBg: 'bg-gray-200', iconColor: 'text-gray-500', text: 'text-gray-800', bar: 'bg-gray-400', barBg: 'bg-gray-200', avatar: 'bg-gray-100 text-gray-600', wash: 'from-gray-100' }

export function groupOf(category: Category | null): GroupMeta {
  return GROUPS.find((g) => g.category === category) ?? NO_GROUP
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'
}

export function isInToday(c: ChildResult) {
  return c.attendance.some((a) => a.session_date === today)
}

export function todayBadgeOf(c: ChildResult) {
  return c.attendance.find((a) => a.session_date === today)?.badge_number ?? null
}

/** Today's check-ins that were saved on this device without internet and
 * haven't uploaded yet, shown in "Registrados hoy" with a "Sin subir" tag. */
export async function withPendingRecords(rows: TodayRecord[]): Promise<TodayRecord[]> {
  const { attendance, families } = await getPendingItems()
  if (attendance.length === 0) return rows
  const roster = readCache<RosterChild[]>('roster') ?? []
  const pendingKids = families.flatMap((f) => f.children)
  const known = new Set(rows.map((r) => r.id))
  const pendingRecords: TodayRecord[] = attendance
    .filter((a) => a.session_date === today && !known.has(a.id))
    .map((a) => {
      const c = roster.find((r) => r.id === a.child_id) ?? pendingKids.find((k) => k.id === a.child_id)
      return {
        id: a.id, child_id: a.child_id, category: a.category, badge_number: a.badge_number, pager_number: a.pager_number,
        checked_in_at: a.checked_in_at, checked_out_at: null, assigned_teacher_id: null, assigned_teacher: null, pending: true,
        children: {
          full_name: c?.full_name ?? 'Niño nuevo', allergies: c?.allergies ?? null, medical_notes: c?.medical_notes ?? null,
          toilet_trained: c?.toilet_trained ?? null, comments: c?.comments ?? null,
        },
      }
    })
  return [...pendingRecords, ...rows]
}

/** Roster (server rows or the cached copy) plus whatever was registered on
 * this device without internet and hasn't uploaded yet (lib/offline.ts). */
export async function buildRoster(rows: RosterChild[], todayAtt: TodayAtt[]): Promise<ChildResult[]> {
  const pending = await getPendingItems()
  const knownIds = new Set(rows.map((c) => c.id))
  const pendingChildren: RosterChild[] = pending.families.flatMap((f) =>
    f.children.filter((c) => !knownIds.has(c.id)).map((c) => ({
      ...c,
      guardian_relationship: c.guardian_relationship as GuardianRelationship | null,
      photo_url: null,
      parents: { full_name: f.parent.full_name, phone: f.parent.phone ?? '' },
    }))
  )
  const all = pendingChildren.length
    ? [...rows, ...pendingChildren].sort((a, b) => a.full_name.localeCompare(b.full_name))
    : rows
  const attMap = new Map([
    ...todayAtt.map((a) => [a.child_id, a.badge_number] as const),
    ...pending.attendance.filter((a) => a.session_date === today).map((a) => [a.child_id, a.badge_number] as const),
  ])
  return all.map((c) => ({
    ...c,
    attendance: attMap.has(c.id) ? [{ session_date: today, badge_number: attMap.get(c.id) }] : [],
  }))
}

// Carries the persistent "maestro responsable" (children.assigned_maestro_id,
// picked from the `maestros` roster) forward into today's per-day claim
// (attendance.assigned_teacher_id, which points at `profiles` — app logins,
// a different table) so a coordinator doesn't have to re-pick the same
// person right after check-in. The two tables aren't linked by an FK, so
// this only fires on an exact, unambiguous name match — anything less
// certain and it just leaves the "Asignar maestro" button for a manual
// pick. Fire-and-forget: never blocks or fails the check-in itself.
export async function autoAssignTodayTeacher(attendanceId: string, maestroId: string) {
  const { data: maestro } = await supabase.from('maestros').select('nombre, apellido').eq('id', maestroId).single()
  if (!maestro) return
  const target = normalizeName(`${maestro.nombre} ${maestro.apellido}`)
  const { data: profiles } = await supabase.from('profiles').select('id, full_name').eq('active', true)
  if (!profiles) return
  const matches = profiles.filter((p) => normalizeName(p.full_name) === target)
  if (matches.length !== 1) return
  await supabase.rpc('assign_attendance_teacher', { p_attendance_id: attendanceId, p_teacher_id: matches[0].id })
}
