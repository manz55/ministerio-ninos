// Tipos y operaciones de datos de Familias. Las pantallas solo llaman a
// estas funciones; cada una devuelve un mensaje de error, o null si salió bien.
import { supabase } from '../../lib/supabase'
import { getCategoryFromBirthDate } from '../../lib/categoryUtils'
import type { Category, GuardianRelationship } from '../../types/domain'

export type ChildDetail = {
  id: string
  parent_id: string | null
  full_name: string
  birth_date: string | null
  category: Category | null
  allergies: string | null
  medical_notes: string | null
  guardian_relationship: GuardianRelationship | null
  comments: string | null
  toilet_trained: boolean | null
  created_at?: string
  attendance: { count: number }[]
}

export type FamilyDetail = {
  id: string
  full_name: string
  phone: string
  children: ChildDetail[]
}

export type RosterChild = ChildDetail & { parents: { id: string; full_name: string; phone: string } | null }

/** Lo que el formulario de niño entrega para guardar. */
export type ChildFormData = {
  full_name: string
  birth_date: string | null
  category: Category | null
  allergies: string | null
  medical_notes: string | null
  guardian_relationship: GuardianRelationship | null
  comments: string | null
  toilet_trained: boolean | null
}

const FAMILY_SELECT = '*, children(*, attendance(count))'

export async function fetchAllFamilies(): Promise<FamilyDetail[]> {
  // Sin .limit() a propósito: un tope dejaría familias invisibles en la
  // búsqueda en cuanto la iglesia lo rebase.
  const { data } = await supabase.from('parents').select(FAMILY_SELECT).is('deleted_at', null).is('children.deleted_at', null).order('full_name')
  return (data as FamilyDetail[]) ?? []
}

export async function fetchFamily(id: string): Promise<FamilyDetail | null> {
  const { data } = await supabase.from('parents').select(FAMILY_SELECT).is('children.deleted_at', null).eq('id', id).single()
  return data as FamilyDetail | null
}

export async function fetchRoster(): Promise<RosterChild[]> {
  const { data } = await supabase
    .from('children')
    .select('*, parents(id, full_name, phone), attendance(count)')
    .is('deleted_at', null)
    .order('full_name')
  return (data as RosterChild[]) ?? []
}

export async function saveParent(id: string, fields: { full_name: string; phone: string }): Promise<string | null> {
  // .select('id') hace que PostgREST diga qué filas cambió: un update
  // bloqueado por RLS no da error y parecería guardado sin estarlo.
  const { data, error } = await supabase.from('parents').update(fields).eq('id', id).select('id')
  return error || !data?.length ? 'No se pudo guardar. Intenta de nuevo.' : null
}

export async function updateChild(id: string, d: ChildFormData): Promise<string | null> {
  const { data, error } = await supabase.from('children').update(d).eq('id', id).select('id')
  return error || !data?.length ? 'No se pudo guardar. Intenta de nuevo.' : null
}

export async function createChild(parentId: string, d: ChildFormData): Promise<{ id: string } | { error: string }> {
  const { data, error } = await supabase.from('children').insert({
    parent_id: parentId,
    ...d,
    category: d.category ?? getCategoryFromBirthDate(d.birth_date),
  }).select('id').single()
  if (error || !data) return { error: 'No se pudo guardar. Intenta de nuevo.' }
  return { id: data.id }
}

/** Borrado lógico (papelera): el niño y todos sus registros de asistencia. */
export async function deleteChild(id: string): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  const now = new Date().toISOString()
  await supabase.from('attendance').update({ deleted_at: now, deleted_by: session?.user.id }).eq('child_id', id)
  const { data, error } = await supabase.from('children').update({ deleted_at: now, deleted_by: session?.user.id }).eq('id', id).select('id')
  return error || !data?.length ? 'No se pudo eliminar. Intenta de nuevo.' : null
}

/** Borrado lógico de la familia completa (padre/madre, niños y asistencia). */
export async function deleteFamily(family: FamilyDetail): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  const now = new Date().toISOString()
  for (const child of family.children) {
    await supabase.from('attendance').update({ deleted_at: now, deleted_by: session?.user.id }).eq('child_id', child.id)
  }
  await supabase.from('children').update({ deleted_at: now, deleted_by: session?.user.id }).eq('parent_id', family.id)
  const { data, error } = await supabase.from('parents').update({ deleted_at: now, deleted_by: session?.user.id }).eq('id', family.id).select('id')
  return error || !data?.length ? 'No se pudo eliminar la familia. Intenta de nuevo.' : null
}

export async function assignParent(childId: string, parentId: string): Promise<string | null> {
  const { data, error } = await supabase.from('children').update({ parent_id: parentId }).eq('id', childId).select('id')
  return error || !data?.length ? 'No se pudo asignar. Intenta de nuevo.' : null
}

export function visitsOf(c: ChildDetail) {
  return c.attendance?.[0]?.count ?? 0
}
