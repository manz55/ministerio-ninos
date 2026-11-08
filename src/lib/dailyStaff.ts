// Los encargados de cada domingo: el encargado general, quien está en la
// compu y quien está con Corderitos. Cada uno vive en su propia tabla (y se
// guarda con su propia función en la base de datos), pero se manejan igual,
// así que las pantallas solo usan estas funciones.
import { supabase } from './supabase'

export type StaffRole = 'coordinator' | 'computer' | 'corderitos'
export type Staff = Record<StaffRole, string>

export const STAFF_ROLES: StaffRole[] = ['coordinator', 'computer', 'corderitos']
export const EMPTY_STAFF: Staff = { coordinator: '', computer: '', corderitos: '' }

// Las tres tablas tienen las mismas columnas (session_date, name, set_by,
// updated_at); el cast le dice eso al tipado de supabase-js.
type StaffTable = 'daily_coordinator'
type StaffRpc = 'set_daily_coordinator'
const SOURCE: Record<StaffRole, { table: StaffTable; rpc: StaffRpc }> = {
  coordinator: { table: 'daily_coordinator', rpc: 'set_daily_coordinator' },
  computer: { table: 'daily_computer_operator' as StaffTable, rpc: 'set_daily_computer_operator' as StaffRpc },
  corderitos: { table: 'daily_corderitos_lead' as StaffTable, rpc: 'set_daily_corderitos_lead' as StaffRpc },
}

export async function fetchStaff(date: string): Promise<Staff> {
  const names = await Promise.all(STAFF_ROLES.map((role) =>
    supabase.from(SOURCE[role].table).select('name').eq('session_date', date).maybeSingle().then(({ data }) => data?.name ?? '')))
  return { coordinator: names[0], computer: names[1], corderitos: names[2] }
}

/** Encargados de cada día de un rango (para los reportes por fechas). */
export async function fetchStaffRange(from: string, to: string): Promise<Record<string, Staff>> {
  const results = await Promise.all(STAFF_ROLES.map((role) =>
    supabase.from(SOURCE[role].table).select('session_date, name').gte('session_date', from).lte('session_date', to)))
  const byDate: Record<string, Staff> = {}
  STAFF_ROLES.forEach((role, i) => {
    for (const row of results[i].data ?? []) {
      byDate[row.session_date] = { ...(byDate[row.session_date] ?? EMPTY_STAFF), [role]: row.name }
    }
  })
  return byDate
}

/** Guarda un encargado (vacío = quitarlo). Devuelve el mensaje de error, o null si salió bien. */
export async function saveStaff(role: StaffRole, date: string, name: string): Promise<string | null> {
  const { error } = await supabase.rpc(SOURCE[role].rpc, { p_session_date: date, p_name: name })
  return error ? 'No se pudo guardar. Revisa la conexión.' : null
}

/** Avisa cuando otro dispositivo cambia un encargado de ese día. */
export function subscribeStaff(date: string, onChange: (role: StaffRole, name: string) => void): () => void {
  const channels = STAFF_ROLES.map((role) => supabase
    .channel(`staff-${role}-${date}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: SOURCE[role].table, filter: `session_date=eq.${date}` }, (payload) => {
      onChange(role, (payload.new as { name: string }).name)
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: SOURCE[role].table, filter: `session_date=eq.${date}` }, (payload) => {
      onChange(role, (payload.new as { name: string }).name)
    })
    // Los DELETE no se pueden filtrar en tiempo real; session_date es la
    // llave, así que sí viene en `old` para revisar el día.
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: SOURCE[role].table }, (payload) => {
      if ((payload.old as { session_date?: string }).session_date === date) onChange(role, '')
    })
    .subscribe())
  return () => channels.forEach((ch) => supabase.removeChannel(ch))
}
