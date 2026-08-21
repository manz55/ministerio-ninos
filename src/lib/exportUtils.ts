import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
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
    .order('session_date', { ascending: true })
    .order('checked_in_at', { ascending: true })
    .limit(MAX_RANGE_ROWS)

  return { rows: (data as unknown as RangeAttendanceRow[]) ?? [], total: count ?? 0 }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export function exportRangeCSV(rows: RangeAttendanceRow[], from: string, to: string) {
  const headers = ['Fecha', 'Nombre niño', 'Padre/Madre', 'Categoría', 'Equipo', 'Gafete', 'Hora de entrada']
  const body = rows.map((r) => [
    r.session_date,
    r.children?.full_name ?? '',
    r.children?.parents?.full_name ?? '',
    CATEGORY_LABELS[r.category] ?? r.category,
    TEAM_COLOR_LABELS[r.team_color] ?? r.team_color,
    r.badge_number ?? '',
    format(new Date(r.checked_in_at), 'HH:mm'),
  ])
  const csv = [headers, ...body].map((row) => row.map(String).join(',')).join('\n')
  downloadBlob(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }), `asistencia-${from}-a-${to}.csv`)
}

export function exportRangePDF(rows: RangeAttendanceRow[], from: string, to: string) {
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
    head: [['Fecha', 'Niño', 'Padre/Madre', 'Categoría', 'Equipo', 'Gafete']],
    body: rows.map((r) => [
      r.session_date,
      r.children?.full_name ?? '',
      r.children?.parents?.full_name ?? '',
      CATEGORY_LABELS[r.category] ?? r.category,
      TEAM_COLOR_LABELS[r.team_color] ?? r.team_color,
      r.badge_number ? String(r.badge_number) : '—',
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [79, 70, 229] },
  })

  doc.save(`asistencia-${from}-a-${to}.pdf`)
}
