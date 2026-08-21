import { useState, useEffect, useCallback, useRef } from 'react'
import { format, subWeeks, startOfWeek, endOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, RefreshCw, Download, AlertTriangle, FileText,
  Bug, Zap, Compass, TrendingUp, ChevronDown, ChevronUp, User, Trash2, X, CalendarRange,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { CATEGORY_LABELS, CATEGORY_COLORS, ACTIVE_CATEGORIES, type Category } from '../types/domain'
import { DatePicker } from '../components/ui/DatePicker'
import { AnimatedBlobBackground } from '../components/ui/AnimatedBlobBackground'
import { fetchAttendanceRange, exportRangeCSV, exportRangePDF, MAX_RANGE_ROWS } from '../lib/exportUtils'

// ─── Types ────────────────────────────────────────────────────────────────────

type CategoryCount = Record<Category, number>

type WeekRow = {
  week_start: string
  week_end: string
  total: number
  hormiguitas: number
  saltamontes: number
  exploradores: number
}

type LiveRecord = {
  id: string
  category: string
  badge_number: number | null
  checked_in_at: string
  checked_out_at: string | null
  children: { full_name: string; parents: { full_name: string } }
}

type MedicalChild = {
  id: string
  full_name: string
  allergies: string | null
  medical_notes: string | null
  parents: { full_name: string; phone: string }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const todayStr = format(new Date(), 'yyyy-MM-dd')
const COORDINATOR_KEY = 'ministerio_coordinator_session'

function getStoredCoordinatorForDate(dateStr: string): string {
  try {
    const raw = localStorage.getItem(COORDINATOR_KEY)
    if (!raw) return ''
    const { name, date } = JSON.parse(raw) as { name: string; date: string }
    return date === dateStr ? name : ''
  } catch {
    return ''
  }
}

function emptyCount(): CategoryCount {
  return { corderitos: 0, hormiguitas: 0, saltamontes: 0, exploradores: 0 }
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ─── Category config for display ─────────────────────────────────────────────

const CAT_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>, color: string, bg: string, bar: string }> = {
  hormiguitas: { icon: Bug,     color: 'text-emerald-600', bg: 'bg-emerald-50',  bar: 'bg-emerald-500' },
  saltamontes: { icon: Zap,     color: 'text-amber-600',   bg: 'bg-amber-50',    bar: 'bg-amber-500'   },
  exploradores:{ icon: Compass, color: 'text-sky-600',     bg: 'bg-sky-50',      bar: 'bg-sky-500'     },
}

// ─── SVG Weekly Chart ─────────────────────────────────────────────────────────

function WeeklyChart({ weeks }: { weeks: WeekRow[] }) {
  const [active, setActive] = useState<number | null>(null)
  const max = Math.max(...weeks.map((w) => w.total), 1)
  const chartHeight = 120
  const barW = 32

  function toggle(i: number) {
    setActive((prev) => (prev === i ? null : i))
  }

  return (
    <div className="overflow-x-auto -mx-2">
      <div
        className="flex items-end gap-3 pt-6 pb-2 px-4 min-w-max"
        style={{ minHeight: chartHeight + 56 }}
      >
        {[...weeks].reverse().map((week, i) => {
          const pct = week.total / max
          const barH = Math.max(pct * chartHeight, 4)
          const isToday = week.week_start <= todayStr && todayStr <= week.week_end
          const isActive = active === i
          const label = format(new Date(week.week_start + 'T12:00:00'), "d MMM", { locale: es })

          return (
            <div
              key={week.week_start}
              className="flex flex-col items-center gap-1 cursor-pointer select-none"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onClick={() => toggle(i)}
            >
              {/* Value label */}
              <AnimatePresence>
                {(isActive || isToday) && (
                  <motion.span
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={`text-xs font-bold ${isToday ? 'text-indigo-600' : 'text-gray-600'}`}
                  >
                    {week.total}
                  </motion.span>
                )}
              </AnimatePresence>

              {/* Bar */}
              <div
                className="relative flex items-end"
                style={{ height: chartHeight, width: barW }}
              >
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: barH }}
                  transition={{ duration: 0.6, ease: 'easeOut', delay: i * 0.04 }}
                  className={`w-full rounded-t-lg transition-colors ${
                    isToday
                      ? 'bg-indigo-500'
                      : isActive
                      ? 'bg-gray-400'
                      : 'bg-gray-200'
                  }`}
                />
                {/* Category breakdown on active */}
                {isActive && week.total > 0 && (
                  <div className="absolute bottom-0 left-0 right-0 flex flex-col-reverse rounded-t-lg overflow-hidden" style={{ height: barH }}>
                    {ACTIVE_CATEGORIES.map((cat) => {
                      const catH = (week[cat as keyof WeekRow] as number / week.total) * barH
                      return catH > 0 ? (
                        <div
                          key={cat}
                          className={`w-full ${CAT_CONFIG[cat]?.bar ?? 'bg-gray-300'} opacity-80`}
                          style={{ height: catH }}
                        />
                      ) : null
                    })}
                  </div>
                )}
              </div>

              {/* Date label */}
              <span className={`text-[10px] font-medium ${isToday ? 'text-indigo-600 font-bold' : 'text-gray-400'}`}>
                {label}
              </span>
              {isToday && <div className="w-1 h-1 rounded-full bg-indigo-500" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [liveRecords, setLiveRecords]   = useState<LiveRecord[]>([])
  const [weekHistory, setWeekHistory]   = useState<WeekRow[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [lastRefresh, setLastRefresh]   = useState(new Date())
  const [medicalChildren, setMedicalChildren] = useState<MedicalChild[]>([])
  const [showMedical, setShowMedical]   = useState(false)
  const [catFilter, setCatFilter]       = useState<Category | 'all'>('all')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting]         = useState(false)

  const [rangeFrom, setRangeFrom] = useState(format(subWeeks(new Date(), 1), 'yyyy-MM-dd'))
  const [rangeTo, setRangeTo]     = useState(todayStr)
  const [rangeBusy, setRangeBusy] = useState<'csv' | 'pdf' | null>(null)
  const [rangeError, setRangeError] = useState<string | null>(null)

  async function handleRangeExport(kind: 'csv' | 'pdf') {
    if (!rangeFrom || !rangeTo || rangeFrom > rangeTo) { setRangeError('Selecciona un rango de fechas válido.'); return }
    setRangeError(null)
    setRangeBusy(kind)
    const { rows, total } = await fetchAttendanceRange(rangeFrom, rangeTo)
    setRangeBusy(null)
    if (rows.length === 0) { setRangeError('No hay registros en ese rango.'); return }
    if (total > MAX_RANGE_ROWS) {
      setRangeError(`El rango tiene ${total} registros — se exportaron los primeros ${MAX_RANGE_ROWS}. Prueba un rango más corto para un reporte completo.`)
    }
    if (kind === 'csv') exportRangeCSV(rows, rangeFrom, rangeTo)
    else exportRangePDF(rows, rangeFrom, rangeTo)
  }

  const selectedStr    = format(selectedDate, 'yyyy-MM-dd')
  const isToday        = selectedStr === todayStr
  const coordinatorName = getStoredCoordinatorForDate(selectedStr)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchLive = useCallback(async () => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    const { data } = await supabase
      .from('attendance')
      .select('id, category, badge_number, checked_in_at, checked_out_at, children(full_name, parents(full_name))')
      .eq('session_date', dateStr)
      .order('checked_in_at', { ascending: true })
    setLiveRecords((data as LiveRecord[]) ?? [])
    setLastRefresh(new Date())
  }, [selectedDate])

  const fetchMedical = useCallback(async () => {
    const { data } = await supabase
      .from('children')
      .select('id, full_name, allergies, medical_notes, parents(full_name, phone)')
      .order('full_name')
    setMedicalChildren(
      ((data ?? []) as MedicalChild[]).filter((c) => c.allergies || c.medical_notes)
    )
  }, [])

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true)
    const since = format(subWeeks(new Date(), 10), 'yyyy-MM-dd')
    const { data } = await supabase
      .from('attendance')
      .select('session_date, category')
      .gte('session_date', since)
      .order('session_date', { ascending: false })

    const byWeek: Record<string, { start: string; end: string; counts: CategoryCount }> = {}
    for (const row of (data ?? [])) {
      const d = new Date(row.session_date)
      const weekStart = format(startOfWeek(d, { weekStartsOn: 0 }), 'yyyy-MM-dd')
      const weekEnd   = format(endOfWeek(d,   { weekStartsOn: 0 }), 'yyyy-MM-dd')
      if (!byWeek[weekStart]) byWeek[weekStart] = { start: weekStart, end: weekEnd, counts: emptyCount() }
      const cat = row.category as Category
      byWeek[weekStart].counts[cat] = (byWeek[weekStart].counts[cat] ?? 0) + 1
    }

    setWeekHistory(
      Object.values(byWeek)
        .sort((a, b) => b.start.localeCompare(a.start))
        .slice(0, 10)
        .map(({ start, end, counts }) => ({
          week_start: start,
          week_end: end,
          total: Object.values(counts).reduce((s, n) => s + n, 0),
          hormiguitas:  counts.hormiguitas,
          saltamontes:  counts.saltamontes,
          exploradores: counts.exploradores,
        }))
    )
    setLoadingHistory(false)
  }, [])

  useEffect(() => {
    fetchLive(); fetchHistory(); fetchMedical()

    const channel = supabase
      .channel('attendance-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance', filter: `session_date=eq.${selectedStr}` }, fetchLive)
      .subscribe()

    intervalRef.current = setInterval(fetchLive, 30_000)
    return () => {
      supabase.removeChannel(channel)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchLive, fetchHistory, fetchMedical])

  // ── CSV exports ──────────────────────────────────────────────────────────────

  function exportTodayCSV() {
    const meta = [
      ['Fecha', format(selectedDate, "EEEE d 'de' MMMM yyyy", { locale: es })],
      ['Encargado', coordinatorName || 'Sin registrar'],
      ['Total', String(total)],
      [],
    ]
    const headers = ['Nombre niño', 'Padre/Madre', 'Categoría', 'Gafete']
    const rows = liveRecords.map((r) => [
      r.children?.full_name ?? '',
      r.children?.parents?.full_name ?? '',
      CATEGORY_LABELS[r.category as Category] ?? r.category,
      r.badge_number ?? 'Sin gafete',
    ])
    downloadCSV(
      [...meta, headers, ...rows].map((row) => row.map(String).join(',')).join('\n'),
      `asistencia-${selectedStr}.csv`
    )
  }

  async function deleteRecord(id: string) {
    setDeleting(true)
    const { data, error } = await supabase.from('attendance').delete().eq('id', id).select('id')
    setDeleting(false)
    if (error || !data || data.length === 0) return
    setLiveRecords((prev) => prev.filter((r) => r.id !== id))
    setConfirmDeleteId(null)
  }

  function exportHistoryCSV() {
    const headers = ['Semana inicio', 'Semana fin', 'Total', 'Hormiguitas', 'Saltamontes', 'Exploradores']
    const rows = weekHistory.map((r) => [r.week_start, r.week_end, r.total, r.hormiguitas, r.saltamontes, r.exploradores])
    downloadCSV([headers, ...rows].map((row) => row.map(String).join(',')).join('\n'), 'historial-asistencia.csv')
  }

  // ── Counts ────────────────────────────────────────────────────────────────────

  const byCategory = emptyCount()
  for (const r of liveRecords) {
    const cat = r.category as Category
    byCategory[cat] = (byCategory[cat] ?? 0) + 1
  }
  const total = liveRecords.length

  const topCat = ACTIVE_CATEGORIES.reduce((a, b) => byCategory[a] >= byCategory[b] ? a : b)
  const avgWeek = weekHistory.length > 0
    ? Math.round(weekHistory.reduce((s, w) => s + w.total, 0) / weekHistory.length)
    : 0

  const filtered = catFilter === 'all'
    ? liveRecords
    : liveRecords.filter((r) => r.category === catFilter)

  return (
    <>
    <AnimatedBlobBackground />
    <div className="relative z-[2] space-y-6">

      {/* ── Header ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Reportes</h2>
            <p className="text-gray-500 text-sm mt-0.5 capitalize">
              {format(selectedDate, "EEEE d 'de' MMMM yyyy", { locale: es })}
              {isToday && <span className="ml-1.5 text-emerald-600 font-semibold">(hoy)</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { fetchLive(); fetchHistory(); fetchMedical() }}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <RefreshCw size={13} /> Actualizar
            </button>
            <button
              onClick={exportTodayCSV}
              disabled={total === 0}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              <Download size={13} /> Exportar
            </button>
          </div>
        </div>

        {/* Date picker */}
        <DatePicker
          value={selectedDate}
          onChange={(d) => { setSelectedDate(d); setCatFilter('all') }}
          disableFuture
          disableSundays={false}
        />

        {/* Coordinator chip */}
        {coordinatorName && (
          <div className="flex items-center gap-1.5 w-fit px-3 py-1.5 bg-white border border-gray-200 rounded-full shadow-sm">
            <User size={12} className="text-indigo-500" />
            <span className="text-xs font-medium text-gray-700">{coordinatorName}</span>
          </div>
        )}
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-3 gap-3">
        {/* Total hoy */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-1 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Hoy</p>
          <p className="text-4xl font-black text-gray-900">{total}</p>
          <p className="text-xs text-gray-500">niños registrados</p>
          <div className="flex items-center gap-1 mt-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] text-gray-400">{format(lastRefresh, 'HH:mm:ss')}</span>
          </div>
        </div>

        {/* Categoría mayor */}
        <div className={`rounded-2xl border p-4 space-y-1 shadow-sm ${
          total > 0 ? CAT_CONFIG[topCat]?.bg ?? 'bg-white' : 'bg-white border-gray-200'
        }`}>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Mayor grupo</p>
          {total > 0 ? (
            <>
              <p className={`text-4xl font-black ${CAT_CONFIG[topCat]?.color ?? 'text-gray-900'}`}>
                {byCategory[topCat]}
              </p>
              <p className={`text-xs font-medium ${CAT_CONFIG[topCat]?.color ?? 'text-gray-500'}`}>
                {CATEGORY_LABELS[topCat]}
              </p>
            </>
          ) : (
            <>
              <p className="text-4xl font-black text-gray-200">—</p>
              <p className="text-xs text-gray-400">Sin datos</p>
            </>
          )}
        </div>

        {/* Promedio semanal */}
        <div className="bg-indigo-50 rounded-2xl border border-indigo-100 p-4 space-y-1 shadow-sm">
          <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wide">Promedio</p>
          <p className="text-4xl font-black text-indigo-700">{avgWeek || '—'}</p>
          <p className="text-xs text-indigo-500">por semana</p>
        </div>
      </div>

      {/* ── Breakdown por categoría ── */}
      {total > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {ACTIVE_CATEGORIES.map((cat) => {
            const cfg = CAT_CONFIG[cat]!
            const count = byCategory[cat]
            const pct = total > 0 ? Math.round((count / total) * 100) : 0
            const Icon = cfg.icon
            return (
              <div key={cat} className={`${cfg.bg} rounded-2xl p-4 space-y-2 border border-white/80 shadow-sm`}>
                <div className="flex items-center justify-between">
                  <Icon className={`w-4 h-4 ${cfg.color}`} />
                  <span className={`text-xs font-bold ${cfg.color}`}>{pct}%</span>
                </div>
                <p className={`text-2xl font-black ${cfg.color}`}>{count}</p>
                <div className="space-y-1">
                  <p className="text-xs text-gray-600 font-medium">{CATEGORY_LABELS[cat]}</p>
                  <div className="h-1 bg-white/60 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className={`h-full ${cfg.bar} rounded-full`}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Reporte por rango de fechas ── */}
      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3">
        <div className="flex items-center gap-2">
          <CalendarRange size={16} className="text-indigo-500" />
          <h3 className="font-semibold text-gray-800">Reporte por rango de fechas</h3>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" value={rangeFrom} max={rangeTo} onChange={(e) => setRangeFrom(e.target.value)}
            className="px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-indigo-500 focus:outline-none" />
          <span className="text-sm text-gray-400">a</span>
          <input type="date" value={rangeTo} min={rangeFrom} max={todayStr} onChange={(e) => setRangeTo(e.target.value)}
            className="px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-indigo-500 focus:outline-none" />
        </div>
        {rangeError && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{rangeError}</p>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => handleRangeExport('csv')}
            disabled={rangeBusy !== null}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            <Download size={14} /> {rangeBusy === 'csv' ? 'Generando…' : 'CSV'}
          </button>
          <button
            onClick={() => handleRangeExport('pdf')}
            disabled={rangeBusy !== null}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            <FileText size={14} /> {rangeBusy === 'pdf' ? 'Generando…' : 'PDF'}
          </button>
        </div>
      </section>

      {/* ── Historial semanal ── */}
      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-indigo-500" />
            <h3 className="font-semibold text-gray-800">Historial de asistencia</h3>
          </div>
          <button
            onClick={exportHistoryCSV}
            disabled={weekHistory.length === 0}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40 transition-colors"
          >
            <Download size={12} /> CSV
          </button>
        </div>

        {loadingHistory && (
          <p className="text-sm text-gray-400 text-center py-10">Cargando…</p>
        )}
        {!loadingHistory && weekHistory.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-10">Sin historial aún.</p>
        )}
        {!loadingHistory && weekHistory.length > 0 && (
          <div className="px-4 pb-4">
            <WeeklyChart weeks={weekHistory} />
            <p className="text-[10px] text-gray-400 text-center mt-1">
              Toca o pasa el cursor sobre una barra para ver el desglose
            </p>
          </div>
        )}
      </section>

      {/* ── Lista de hoy con filtro ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <Users size={16} className="text-indigo-500" />
            Registros de hoy {total > 0 && <span className="text-gray-400 font-normal">({total})</span>}
          </h3>
        </div>

        {/* Filtro por categoría */}
        {total > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setCatFilter('all')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                catFilter === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Todos ({total})
            </button>
            {ACTIVE_CATEGORIES.filter((c) => byCategory[c] > 0).map((cat) => (
              <button
                key={cat}
                onClick={() => setCatFilter(cat)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  catFilter === cat
                    ? `${CAT_CONFIG[cat]?.bar ?? 'bg-gray-800'} text-white`
                    : `${CAT_CONFIG[cat]?.bg ?? 'bg-gray-100'} ${CAT_CONFIG[cat]?.color ?? 'text-gray-600'} hover:opacity-80`
                }`}
              >
                {CATEGORY_LABELS[cat]} ({byCategory[cat]})
              </button>
            ))}
          </div>
        )}

        {total === 0 && (
          <div className="text-center py-12 text-gray-400 bg-white rounded-2xl border border-gray-200">
            <Users size={36} className="mx-auto opacity-30 mb-2" />
            <p>Sin registros hoy todavía</p>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden shadow-sm">
            {filtered.map((r) => {
              const isConfirming = confirmDeleteId === r.id
              return (
                <div key={r.id} className={`flex items-center justify-between px-4 py-3 gap-3 transition-colors ${isConfirming ? 'bg-red-50' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 text-sm leading-tight">{r.children?.full_name}</p>
                      {r.badge_number !== null && (
                        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md">
                          #{r.badge_number}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{r.children?.parents?.full_name}</p>
                  </div>

                  {isConfirming ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-red-600 font-semibold">¿Borrar registro?</span>
                      <button
                        onClick={() => deleteRecord(r.id)}
                        disabled={deleting}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-white bg-red-500 rounded-lg hover:bg-red-600 active:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        {deleting ? '…' : 'Sí, borrar'}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[r.category as Category]}`}>
                          {CATEGORY_LABELS[r.category as Category]}
                        </span>
                        <button
                          onClick={() => setConfirmDeleteId(r.id)}
                          className="p-1 text-gray-300 hover:text-red-400 rounded-lg hover:bg-red-50 transition-colors"
                          title="Borrar registro"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-gray-400 font-medium">
                          {format(new Date(r.checked_in_at), 'HH:mm')}
                        </span>
                        {r.checked_out_at ? (
                          <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 rounded-full px-1.5 py-0.5">Salió</span>
                        ) : (
                          <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 rounded-full px-1.5 py-0.5">Adentro</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Directorio de alertas médicas ── */}
      <section className="space-y-3">
        <button
          onClick={() => setShowMedical((v) => !v)}
          className="w-full flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-2xl hover:bg-red-100 transition-colors"
        >
          <div className="flex items-center gap-2 text-red-700">
            <AlertTriangle size={15} />
            <span className="font-semibold text-sm">
              Alertas médicas
              {medicalChildren.length > 0 && (
                <span className="ml-2 bg-red-200 text-red-800 text-xs font-bold px-2 py-0.5 rounded-full">
                  {medicalChildren.length}
                </span>
              )}
            </span>
          </div>
          {showMedical ? <ChevronUp size={14} className="text-red-400" /> : <ChevronDown size={14} className="text-red-400" />}
        </button>

        <AnimatePresence>
          {showMedical && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2 overflow-hidden"
            >
              {medicalChildren.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">Ningún niño tiene alertas registradas.</p>
              )}
              {medicalChildren.map((child) => (
                <div key={child.id} className="bg-white rounded-xl border-2 border-red-200 p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{child.full_name}</p>
                      <p className="text-xs text-gray-500">{child.parents?.full_name} · {child.parents?.phone}</p>
                    </div>
                    <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
                  </div>
                  {child.allergies && (
                    <p className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">
                      <span className="font-semibold">Alergias:</span> {child.allergies}
                    </p>
                  )}
                  {child.medical_notes && (
                    <p className="text-sm text-orange-700 bg-orange-50 rounded-lg px-3 py-2">
                      <span className="font-semibold">Notas:</span> {child.medical_notes}
                    </p>
                  )}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
    </>
  )
}
