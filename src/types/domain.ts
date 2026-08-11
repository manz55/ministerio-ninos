export type TeamColor = 'rojo' | 'amarillo' | 'azul'

export type Category = 'corderitos' | 'hormiguitas' | 'saltamontes' | 'exploradores'

// Categories actively managed (corderitos excluded — they stay with parents)
export const ACTIVE_CATEGORIES: Category[] = ['hormiguitas', 'saltamontes', 'exploradores']

export const CATEGORY_LABELS: Record<Category, string> = {
  corderitos: 'Corderitos',
  hormiguitas: 'Hormiguitas',
  saltamontes: 'Saltamontes',
  exploradores: 'Exploradores',
}

export const CATEGORY_AGE_RANGES: Record<Category, { min: number; max: number }> = {
  corderitos: { min: 0, max: 2 },
  hormiguitas: { min: 3, max: 4 },
  saltamontes: { min: 5, max: 7 },
  exploradores: { min: 8, max: 11 },
}

export const CATEGORY_COLORS: Record<Category, string> = {
  corderitos: 'bg-pink-100 text-pink-800 border-pink-200',
  hormiguitas: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  saltamontes: 'bg-green-100 text-green-800 border-green-200',
  exploradores: 'bg-blue-100 text-blue-800 border-blue-200',
}

export interface Parent {
  id: string
  full_name: string
  phone: string
  created_at: string
}

export interface Child {
  id: string
  parent_id: string
  full_name: string
  birth_date: string
  allergies: string | null
  medical_notes: string | null
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
  parent_id: string
  full_name: string
  birth_date: string
  allergies: string | null
  medical_notes: string | null
  created_at: string
  attendance: AttendanceToday[]
}

export interface ParentRow {
  id: string
  full_name: string
  phone: string
  created_at: string
  children: ChildRow[]
}
