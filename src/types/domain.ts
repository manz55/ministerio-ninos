export type TeamColor = 'rojo' | 'amarillo' | 'azul'

export const TEAM_COLOR_LABELS: Record<TeamColor, string> = {
  rojo: 'Rojo',
  amarillo: 'Amarillo',
  azul: 'Azul',
}

export type Category = 'corderitos_0_2' | 'corderitos_2_4' | 'hormiguitas' | 'saltamontes' | 'exploradores'

// All categories that get checked in (corderitos_* included — parent stays with the child, no badge/pager)
export const ACTIVE_CATEGORIES: Category[] = ['corderitos_0_2', 'corderitos_2_4', 'hormiguitas', 'saltamontes', 'exploradores']

// The two "parent stays with the child" groups — no badge, no checkout, pager optional.
export const CORDERITOS_CATEGORIES: Category[] = ['corderitos_0_2', 'corderitos_2_4']
export function isCorderitos(category: Category | null): boolean {
  return category !== null && CORDERITOS_CATEGORIES.includes(category)
}

export const CATEGORY_LABELS: Record<Category, string> = {
  corderitos_0_2: 'Corderitos 0-2 años',
  corderitos_2_4: 'Corderitos 2-4 años',
  hormiguitas: 'Hormiguitas',
  saltamontes: 'Saltamontes',
  exploradores: 'Exploradores',
}

export const CATEGORY_AGE_RANGES: Record<Category, { min: number; max: number }> = {
  corderitos_0_2: { min: 0, max: 1 },
  corderitos_2_4: { min: 2, max: 3 },
  hormiguitas: { min: 4, max: 6 },
  saltamontes: { min: 7, max: 9 },
  exploradores: { min: 10, max: 12 },
}

export const NEXT_CATEGORY: Record<Category, Category | null> = {
  corderitos_0_2: 'corderitos_2_4',
  corderitos_2_4: 'hormiguitas',
  hormiguitas: 'saltamontes',
  saltamontes: 'exploradores',
  exploradores: null,
}

export type GuardianRelationship = 'mama' | 'papa' | 'tio_tia' | 'abuelo_abuela' | 'encargado' | 'otro'

export const GUARDIAN_RELATIONSHIP_LABELS: Record<GuardianRelationship, string> = {
  mama: 'Mamá',
  papa: 'Papá',
  tio_tia: 'Tío/Tía',
  abuelo_abuela: 'Abuelo/a',
  encargado: 'Encargado/a',
  otro: 'Otro',
}

export type UserRole = 'admin' | 'maestro' | 'maestro_corderitos'

export interface Profile {
  id: string
  full_name: string
  email: string | null
  role: UserRole
  active: boolean
  created_at: string
}

export const CATEGORY_COLORS: Record<Category, string> = {
  corderitos_0_2: 'bg-pink-100 text-pink-800 border-pink-200',
  corderitos_2_4: 'bg-rose-100 text-rose-800 border-rose-200',
  hormiguitas: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  saltamontes: 'bg-green-100 text-green-800 border-green-200',
  exploradores: 'bg-blue-100 text-blue-800 border-blue-200',
}

export interface Parent {
  id: string
  full_name: string
  phone: string | null
  photo_url: string | null
  created_at: string
}

export interface ChildContact {
  id: string
  child_id: string
  full_name: string
  phone: string | null
  relationship: GuardianRelationship | null
  photo_url: string | null
  created_at: string
}

export interface Child {
  id: string
  parent_id: string | null
  full_name: string
  birth_date: string | null
  allergies: string | null
  medical_notes: string | null
  category: Category | null
  guardian_relationship: GuardianRelationship | null
  comments: string | null
  toilet_trained: boolean | null
  photo_url: string | null
  created_at: string
  parent?: Parent
}

export interface AttendanceRecord {
  id: string
  child_id: string
  session_date: string
  team_color: TeamColor
  category: Category
  badge_number: number | null
  pager_number: number | null
  checked_in_at: string
  checked_out_at: string | null
  child?: Child
}

// ─── Tipos de respuesta Supabase con relaciones ────────────────────────────────

export interface AttendanceToday {
  id: string
  session_date: string
  category: string
  badge_number: number | null
  checked_out_at: string | null
}

export interface ChildRow {
  id: string
  parent_id: string | null
  full_name: string
  birth_date: string | null
  allergies: string | null
  medical_notes: string | null
  category: Category | null
  guardian_relationship: GuardianRelationship | null
  comments: string | null
  toilet_trained: boolean | null
  photo_url: string | null
  created_at: string
  attendance: AttendanceToday[]
}

export interface ParentRow {
  id: string
  full_name: string
  phone: string | null
  photo_url: string | null
  created_at: string
  children: ChildRow[]
}

// A maestro can't self-serve family registration or category changes — this
// is the free-text request they send a coordinator instead.
export interface CoordinatorRequest {
  id: string
  message: string
  status: 'pendiente' | 'resuelta'
  author_id: string | null
  resolved_by: string | null
  resolved_at: string | null
  seen_by_author: boolean
  created_at: string
  profiles?: { full_name: string } | null
  resolver?: { full_name: string } | null
}
