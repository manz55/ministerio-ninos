import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from './supabase'
import { CATEGORY_LABELS, TEAM_COLOR_LABELS, type Category, type TeamColor } from '../types/domain'

export type RangeAttendanceRow = {
  session_date: string
  category: Category
  team_color: TeamColor
  badge_number: number | null
  checked_in_at: string
  children: { full_name: string; parents: { full_name: string } | null } | null
}

// Keeps a single date-range query from generating an unreasonably large file/browser hang.
export const MAX_RANGE_ROWS = 3000

export async function fetchAttendanceRange(from: string, to: string) {
  const { data, count } = await supabase
    .from('attendance')
    .select('session_date, category, team_color, badge_number, checked_in_at, children(full_name, parents(full_name))', { count: 'exact' })
    .gte('session_date', from)
    .lte('session_date', to)
    .is('deleted_at', null)
    .order('session_date', { ascending: true })
    .order('checked_in_at', { ascending: true })
    .limit(MAX_RANGE_ROWS)

  return { rows: (data as unknown as RangeAttendanceRow[]) ?? [], total: count ?? 0 }
}

// Who was "encargado" / "encargado de computadora" on each day of the range
// — both can change day to day, so a single header meta-row (like the
// single-day export uses) wouldn't be accurate across a multi-day range.
export type DailyStaffing = Record<string, { coordinator: string; computerOperator: string }>

export async function fetchDailyStaffing(from: string, to: string): Promise<DailyStaffing> {
  const [coordinators, operators] = await Promise.all([
    supabase.from('daily_coordinator').select('session_date, name').gte('session_date', from).lte('session_date', to),
    supabase.from('daily_computer_operator').select('session_date, name').gte('session_date', from).lte('session_date', to),
  ])
  const staffing: DailyStaffing = {}
  for (const row of coordinators.data ?? []) {
    staffing[row.session_date] = { ...(staffing[row.session_date] ?? { coordinator: '', computerOperator: '' }), coordinator: row.name }
  }
  for (const row of operators.data ?? []) {
    staffing[row.session_date] = { ...(staffing[row.session_date] ?? { coordinator: '', computerOperator: '' }), computerOperator: row.name }
  }
  return staffing
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// A name or comment containing a comma or quote (rare, but real — an
// allergy note like "maní, huevo" is exactly the kind of text that ends up
// here) would otherwise shift every column after it.
export function csvEscape(value: unknown): string {
  const s = String(value ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCSV(rows: unknown[][]): string {
  return rows.map((row) => row.map(csvEscape).join(',')).join('\n')
}

// Returns the Blob instead of saving directly (mirrors exportRangePDF) so
// callers can also hand it to the receipt-printer share/download animation.
export function exportRangeCSV(rows: RangeAttendanceRow[], staffing: DailyStaffing = {}): Blob {
  const headers = ['Fecha', 'Nombre niño', 'Padre/Madre', 'Categoría', 'Equipo', 'Gafete', 'Hora de entrada', 'Encargado', 'Encargado de computadora']
  const body = rows.map((r) => [
    r.session_date,
    r.children?.full_name ?? '',
    r.children?.parents?.full_name ?? '',
    CATEGORY_LABELS[r.category] ?? r.category,
    TEAM_COLOR_LABELS[r.team_color] ?? r.team_color,
    r.badge_number ?? '',
    format(new Date(r.checked_in_at), 'HH:mm'),
    staffing[r.session_date]?.coordinator ?? '',
    staffing[r.session_date]?.computerOperator ?? '',
  ])
  return new Blob(['﻿' + toCSV([headers, ...body])], { type: 'text/csv;charset=utf-8;' })
}

// jspdf/jspdf-autotable (and the html2canvas they pull in) are only needed
// once someone actually clicks "PDF" — loading them dynamically here keeps
// them out of ReportsPage's initial bundle instead of always paying for
// ~200KB nobody may ever use. Returns the Blob instead of saving directly so
// callers can also hand it to something other than the browser's save
// dialog (e.g. the receipt-printer download animation).
export async function exportRangePDF(rows: RangeAttendanceRow[], from: string, to: string, staffing: DailyStaffing = {}): Promise<Blob> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const doc = new jsPDF()
  doc.setFontSize(14)
  doc.text('Reporte de asistencia — Ministerio de Niños', 14, 16)
  doc.setFontSize(10)
  doc.setTextColor(120)
  doc.text(
    `${format(new Date(from + 'T12:00:00'), "d MMM yyyy", { locale: es })} — ${format(new Date(to + 'T12:00:00'), "d MMM yyyy", { locale: es })} · ${rows.length} registro${rows.length !== 1 ? 's' : ''}`,
    14, 22
  )

  autoTable(doc, {
    startY: 28,
    head: [['Fecha', 'Niño', 'Padre/Madre', 'Categoría', 'Equipo', 'Gafete', 'Encargado', 'Encargado de compu']],
    body: rows.map((r) => [
      r.session_date,
      r.children?.full_name ?? '',
      r.children?.parents?.full_name ?? '',
      CATEGORY_LABELS[r.category] ?? r.category,
      TEAM_COLOR_LABELS[r.team_color] ?? r.team_color,
      r.badge_number ? String(r.badge_number) : '—',
      staffing[r.session_date]?.coordinator || '—',
      staffing[r.session_date]?.computerOperator || '—',
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [79, 70, 229] },
  })

  return doc.output('blob')
}
