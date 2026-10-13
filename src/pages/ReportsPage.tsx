import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { format, subWeeks, startOfWeek, endOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RefreshCw, Download, AlertTriangle, FileText, FileSpreadsheet, PartyPopper, Check, User, Monitor,
  FileWarning, ArrowRight, Copy, Phone, Trash2, CalendarX, Trophy, Clock, Baby, Flame,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { CATEGORY_LABELS, ACTIVE_CATEGORIES, NEXT_CATEGORY, type Category } from '../types/domain'
import { hasCategoryChanged } from '../lib/categoryUtils'
import { computeAbsence, absenceMessage, type AbsenceTier } from '../lib/absenceUtils'
import { graduationMessage } from '../lib/graduationMessages'
import { DatePicker } from '../components/ui/DatePicker'
import { fetchAttendanceRange, fetchDailyStaffing, exportRangeCSV, exportRangePDF, toCSV } from '../lib/exportUtils'
import { ReporteAsistenciaDescarga } from '../components/receipt-printer/ReporteAsistenciaDescarga'
import { AnimatedNumber, Sheet, SkeletonRow } from '../components/motion'
import { itemVariants } from '../components/motion/presets'
import { PageHeader, BTN_SECONDARY } from '../components/ui/PageHeader'
import { Segmented, FilterChips } from '../components/ui/Segmented'
import { EmptyState } from '../components/ui/EmptyState'
import { ConfirmSheet } from '../components/ui/ConfirmSheet'
import { Field, FormError, INPUT } from '../components/ui/form'
import { GROUPS, groupOf, initials } from './checkin/shared'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type CategoryCount = Record<Category, number>
type WeekRow = { week_start: string; week_end: string; total: number } & CategoryCount
type LiveRecord = {
  id: string
  category: string
  badge_number: number | null
  checked_in_at: string
  checked_out_at: string | null
  children: { full_name: string; parents: { full_name: string } }
}
type MedicalChild = { id: string; full_name: string; allergies: string | null; medical_notes: string | null; parents: { full_name: string; phone: string } }
type RosterChild = { id: string; full_name: string; birth_date: string | null; category: Category | null; allergies: string | null; medical_notes: string | null; parents: { full_name: string; phone: string } | null }
type AbsentChild = { id: string; full_name: string; parentName: string; parentPhone: string | null; missed: number; tier: AbsenceTier }
type Tab = 'dia' | 'tendencias' | 'seguimiento' | 'exportar'

const todayStr = format(new Date(), 'yyyy-MM-dd')
const emptyCount = (): CategoryCount => ({ corderitos_0_2: 0, corderitos_2_4: 0, hormiguitas: 0, saltamontes: 0, exploradores: 0 })

function downloadCSV(content: string, filename: string) {
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('dia')
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [liveRecords, setLiveRecords] = useState<LiveRecord[]>([])
  const [loadingLive, setLoadingLive] = useState(true)
  const [weekHistory, setWeekHistory] = useState<WeekRow[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [medicalChildren, setMedicalChildren] = useState<MedicalChild[]>([])
  const [graduatingChildren, setGraduatingChildren] = useState<RosterChild[]>([])
  const [absentChildren, setAbsentChildren] = useState<AbsentChild[]>([])
  const [missingBirthDateCount, setMissingBirthDateCount] = useState(0)
  const [rangeFrom, setRangeFrom] = useState(format(subWeeks(new Date(), 1), 'yyyy-MM-dd'))
  const [rangeTo, setRangeTo] = useState(todayStr)
  const [coordinatorName, setCoordinatorName] = useState('')
  const [computerOperatorName, setComputerOperatorName] = useState('')
  const [corderitosLeadName, setCorderitosLeadName] = useState('')

  const selectedStr = format(selectedDate, 'yyyy-MM-dd')
  const isToday = selectedStr === todayStr

  // Encargados del día elegido (ver CheckInPage).
  useEffect(() => {
    let cancelled = false
    supabase.from('daily_coordinator').select('name').eq('session_date', selectedStr).maybeSingle()
      .then(({ data }) => { if (!cancelled) setCoordinatorName(data?.name ?? '') })
    supabase.from('daily_computer_operator').select('name').eq('session_date', selectedStr).maybeSingle()
      .then(({ data }) => { if (!cancelled) setComputerOperatorName(data?.name ?? '') })
    supabase.from('daily_corderitos_lead').select('name').eq('session_date', selectedStr).maybeSingle()
      .then(({ data }) => { if (!cancelled) setCorderitosLeadName(data?.name ?? '') })
    return () => { cancelled = true }
  }, [selectedStr])

  const fetchLive = useCallback(async () => {
    const { data } = await supabase
      .from('attendance')
      .select('id, category, badge_number, checked_in_at, checked_out_at, children(full_name, parents(full_name))')
      .eq('session_date', format(selectedDate, 'yyyy-MM-dd'))
      .is('deleted_at', null)
      .order('checked_in_at', { ascending: true })
    setLiveRecords((data as LiveRecord[]) ?? [])
    setLastRefresh(new Date())
    setLoadingLive(false)
  }, [selectedDate])

  const fetchRosterAlerts = useCallback(async () => {
    const { data } = await supabase
      .from('children')
      .select('id, full_name, birth_date, category, allergies, medical_notes, parents(full_name, phone)')
      .is('deleted_at', null)
      .order('full_name')
    const roster = (data ?? []) as unknown as RosterChild[]
    setMedicalChildren((roster as unknown as MedicalChild[]).filter((c) => c.allergies || c.medical_notes))
    setGraduatingChildren(roster.filter((c) => hasCategoryChanged(c)))
  }, [])

  // Inasistencias: cuenta domingos con servicio (fechas que existen en
  // `attendance`, no el calendario) desde el último check-in de cada niño —
  // ver absenceUtils.ts.
  const fetchAbsences = useCallback(async () => {
    const [{ data: children }, { data: attendance }] = await Promise.all([
      supabase.from('children').select('id, full_name, created_at, parents(full_name, phone)').is('deleted_at', null),
      supabase.from('attendance').select('child_id, session_date').is('deleted_at', null),
    ])
    if (!children || !attendance) return
    const lastSeen = new Map<string, string>()
    const dates = new Set<string>()
    for (const row of attendance as { child_id: string; session_date: string }[]) {
      dates.add(row.session_date)
      const cur = lastSeen.get(row.child_id)
      if (!cur || row.session_date > cur) lastSeen.set(row.child_id, row.session_date)
    }
    const results: AbsentChild[] = []
    for (const c of children as unknown as (RosterChild & { created_at: string })[]) {
      const info = computeAbsence(c.created_at, lastSeen.get(c.id) ?? null, [...dates])
      if (!info.tier) continue
      results.push({ id: c.id, full_name: c.full_name, parentName: c.parents?.full_name ?? 'Sin responsable', parentPhone: c.parents?.phone ?? null, missed: info.missed, tier: info.tier })
    }
    setAbsentChildren(results.sort((a, b) => b.missed - a.missed))
  }, [])

  const fetchMissingBirthDate = useCallback(async () => {
    const { count } = await supabase.from('children').select('id', { count: 'exact', head: true }).is('deleted_at', null).is('birth_date', null)
    setMissingBirthDateCount(count ?? 0)
  }, [])

  const fetchHistory = useCallback(async () => {
    const since = format(subWeeks(new Date(), 10), 'yyyy-MM-dd')
    const { data } = await supabase.from('attendance').select('session_date, category').gte('session_date', since).is('deleted_at', null).order('session_date', { ascending: false })
    const byWeek: Record<string, { start: string; end: string; counts: CategoryCount }> = {}
    for (const row of data ?? []) {
      const d = new Date(row.session_date + 'T12:00:00')
      const start = format(startOfWeek(d, { weekStartsOn: 0 }), 'yyyy-MM-dd')
      const end = format(endOfWeek(d, { weekStartsOn: 0 }), 'yyyy-MM-dd')
      byWeek[start] ??= { start, end, counts: emptyCount() }
      const cat = row.category as Category
      byWeek[start].counts[cat] = (byWeek[start].counts[cat] ?? 0) + 1
    }
    setWeekHistory(Object.values(byWeek).sort((a, b) => b.start.localeCompare(a.start)).slice(0, 10).map(({ start, end, counts }) => ({
      week_start: start, week_end: end, total: Object.values(counts).reduce((s, n) => s + n, 0), ...counts,
    })))
    setLoadingHistory(false)
  }, [])

  const refreshAll = useCallback(() => {
    fetchLive(); fetchHistory(); fetchRosterAlerts(); fetchAbsences(); fetchMissingBirthDate()
  }, [fetchLive, fetchHistory, fetchRosterAlerts, fetchAbsences, fetchMissingBirthDate])

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    refreshAll()
    const channel = supabase
      .channel('attendance-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance', filter: `session_date=eq.${selectedStr}` }, fetchLive)
      .subscribe()
    intervalRef.current = setInterval(fetchLive, 30_000)
    return () => {
      supabase.removeChannel(channel)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [refreshAll, fetchLive, selectedStr])

  // ── Derivados ──
  const byCategory = useMemo(() => {
    const c = emptyCount()
    for (const r of liveRecords) c[r.category as Category] = (c[r.category as Category] ?? 0) + 1
    return c
  }, [liveRecords])
  const total = liveRecords.length
  const avgWeek = weekHistory.length ? Math.round(weekHistory.reduce((s, w) => s + w.total, 0) / weekHistory.length) : 0
  const followUps = absentChildren.length + graduatingChildren.length + medicalChildren.length

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reportes"
        subtitle={<span className="inline-block first-letter:uppercase">{format(selectedDate, "EEEE d 'de' MMMM yyyy", { locale: es })}{isToday && <span className="ml-1.5 text-emerald-600 font-semibold normal-case">· hoy</span>}</span>}
        actions={
          <motion.button whileTap={{ scale: 0.95 }} onClick={refreshAll} className={BTN_SECONDARY}>
            <RefreshCw size={16} /> Actualizar
          </motion.button>
        }
      />

      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'dia', label: 'Del día', count: total },
            { value: 'tendencias', label: 'Números' },
            { value: 'seguimiento', label: 'Seguimiento', count: followUps },
            { value: 'exportar', label: 'Exportar' },
          ]}
        />
        {(tab === 'dia' || tab === 'exportar') && (
          <div className="lg:ml-auto">
            <DatePicker value={selectedDate} onChange={setSelectedDate} disableFuture disableSundays={false} />
          </div>
        )}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
          {tab === 'dia' && (
            <DayTab
              records={liveRecords}
              loading={loadingLive}
              byCategory={byCategory}
              total={total}
              avgWeek={avgWeek}
              lastRefresh={lastRefresh}
              coordinatorName={coordinatorName}
              operatorName={computerOperatorName}
              corderitosLeadName={corderitosLeadName}
              onChanged={fetchLive}
            />
          )}
          {tab === 'tendencias' && (
            <TrendsTab weeks={weekHistory} loading={loadingHistory} rangeFrom={rangeFrom} rangeTo={rangeTo} setRangeFrom={setRangeFrom} setRangeTo={setRangeTo} />
          )}
          {tab === 'seguimiento' && (
            <FollowUpTab absent={absentChildren} graduating={graduatingChildren} medical={medicalChildren} missingBirthDate={missingBirthDateCount} />
          )}
          {tab === 'exportar' && (
            <ExportTab
              selectedDate={selectedDate}
              byCategory={byCategory}
              total={total}
              coordinatorName={coordinatorName}
              operatorName={computerOperatorName}
              corderitosLeadName={corderitosLeadName}
              weeks={weekHistory}
              rangeFrom={rangeFrom}
              rangeTo={rangeTo}
              setRangeFrom={setRangeFrom}
              setRangeTo={setRangeTo}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// ─── Del día ──────────────────────────────────────────────────────────────────

function DayTab({ records, loading, byCategory, total, avgWeek, lastRefresh, coordinatorName, operatorName, corderitosLeadName, onChanged }: {
  records: LiveRecord[]
  loading: boolean
  byCategory: CategoryCount
  total: number
  avgWeek: number
  lastRefresh: Date
  coordinatorName: string
  operatorName: string
  corderitosLeadName: string
  onChanged: () => void
}) {
  const [filter, setFilter] = useState<Category | 'all'>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const top = ACTIVE_CATEGORIES.reduce((a, b) => (byCategory[a] >= byCategory[b] ? a : b))
  const shown = filter === 'all' ? records : records.filter((r) => r.category === filter)
  const open = records.find((r) => r.id === openId) ?? null
  const vsAvg = avgWeek ? total - avgWeek : 0

  return (
    <div className="space-y-5">
      {/* ── Números grandes ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="En el área de niños" accent>
          <span className="font-display text-5xl font-bold leading-none"><AnimatedNumber value={total} /></span>
          <span className="text-xs text-gray-500 mt-2">Actualizado {format(lastRefresh, 'HH:mm')}</span>
        </Kpi>
        <Kpi label="Grupo con más niños">
          {total > 0 ? (
            <>
              <span className={`font-display text-4xl font-bold leading-none ${groupOf(top).iconColor}`}><AnimatedNumber value={byCategory[top]} /></span>
              <span className={`text-sm font-semibold mt-1 ${groupOf(top).iconColor}`}>{CATEGORY_LABELS[top]}</span>
            </>
          ) : <span className="font-display text-4xl font-bold text-gray-300 leading-none">—</span>}
        </Kpi>
        <Kpi label="Promedio por semana">
          <span className="font-display text-4xl font-bold leading-none text-gray-900">{avgWeek || '—'}</span>
          <span className="text-sm text-gray-500 mt-1">últimas 10 semanas</span>
        </Kpi>
        <Kpi label="Comparado con el promedio">
          <span className={`font-display text-4xl font-bold leading-none ${vsAvg > 0 ? 'text-emerald-600' : vsAvg < 0 ? 'text-amber-600' : 'text-gray-400'}`}>
            {avgWeek ? `${vsAvg > 0 ? '+' : ''}${vsAvg}` : '—'}
          </span>
          <span className="text-sm text-gray-500 mt-1">{vsAvg > 0 ? 'más que de costumbre' : vsAvg < 0 ? 'menos que de costumbre' : 'igual que siempre'}</span>
        </Kpi>
      </div>

      {(coordinatorName || operatorName || corderitosLeadName) && (
        <div className="flex flex-wrap gap-2">
          {coordinatorName && <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-gray-200 text-sm font-medium text-gray-700"><User size={14} className="text-indigo-500" /> {coordinatorName}</span>}
          {operatorName && <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-gray-200 text-sm font-medium text-gray-700"><Monitor size={14} className="text-indigo-500" /> {operatorName}</span>}
          {corderitosLeadName && <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-gray-200 text-sm font-medium text-gray-700"><Baby size={14} className="text-indigo-500" /> Corderitos: {corderitosLeadName}</span>}
        </div>
      )}

      {/* ── Reparto por grupo: una barra apilada + leyenda con números ── */}
      {total > 0 && (
        <section className="rounded-3xl bg-white border border-gray-200/70 shadow-sm p-5 space-y-4">
          <h2 className="text-xl font-bold text-gray-900">Por grupo</h2>
          <div className="flex h-4 rounded-full overflow-hidden bg-gray-100">
            {GROUPS.map((g, i) => {
              const pct = (byCategory[g.category] / total) * 100
              return pct > 0 ? (
                <motion.div key={g.category} className={`${g.bar} h-full`} initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.7, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }} title={`${CATEGORY_LABELS[g.category]}: ${byCategory[g.category]}`} />
              ) : null
            })}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {GROUPS.map((g) => {
              const Icon = g.icon
              const count = byCategory[g.category]
              return (
                <button key={g.category} onClick={() => setFilter(filter === g.category ? 'all' : g.category)}
                  className={`flex items-center gap-2 sm:gap-2.5 rounded-2xl px-2.5 sm:px-3 py-2.5 text-left transition-colors ${filter === g.category ? `${g.tile} ring-2 ring-offset-1 ring-gray-300` : 'bg-gray-50 hover:bg-gray-100'}`}>
                  <span className={`w-8 h-8 rounded-xl ${g.iconBg} flex items-center justify-center shrink-0`}><Icon size={15} className={g.iconColor} /></span>
                  <span className="min-w-0">
                    <span className="flex items-baseline gap-1.5">
                      <span className={`font-display font-bold text-xl leading-none ${g.text}`}><AnimatedNumber value={count} /></span>
                      <span className="text-xs font-semibold text-gray-400 tabular-nums">{Math.round((count / total) * 100)}%</span>
                    </span>
                    <span className="block text-xs text-gray-600 leading-tight mt-0.5">{CATEGORY_LABELS[g.category]}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Lista del día ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-xl font-bold text-gray-900">Registros {filter !== 'all' && <span className="text-gray-400">· {CATEGORY_LABELS[filter]}</span>}</h2>
          {filter !== 'all' && <button onClick={() => setFilter('all')} className="text-sm font-semibold text-indigo-700">Ver todos</button>}
        </div>
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2">{[0, 1, 2].map((i) => <SkeletonRow key={i} />)}</div>
        ) : shown.length === 0 ? (
          <EmptyState icon={CalendarX} text="No hay registros este día." />
        ) : (
          <motion.div key={filter} initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2">
            {shown.map((r, i) => {
              const g = groupOf(r.category as Category)
              return (
                <motion.button key={r.id} variants={itemVariants} custom={i} whileTap={{ scale: 0.985 }} onClick={() => setOpenId(r.id)}
                  className="w-full text-left flex items-center gap-3 rounded-2xl bg-white px-3.5 py-3 shadow-sm shadow-gray-900/5 border border-transparent hover:border-indigo-200 hover:shadow-md transition-[border-color,box-shadow]">
                  <span className={`w-12 shrink-0 text-center rounded-xl py-1.5 font-display font-bold tabular-nums ${r.badge_number ? 'bg-emerald-600 text-white text-lg' : `${g.avatar} text-sm`}`}>
                    {r.badge_number ? `#${r.badge_number}` : initials(r.children?.full_name ?? '?')}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-display font-bold text-[17px] leading-tight text-gray-900 truncate">{r.children?.full_name}</span>
                    <span className="block text-sm text-gray-500 truncate"><span className={`font-semibold ${g.iconColor}`}>{CATEGORY_LABELS[r.category as Category]}</span> · {r.children?.parents?.full_name || 'Sin responsable'}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-xs text-gray-500 tabular-nums">{format(new Date(r.checked_in_at), 'HH:mm')}</span>
                    <span className={`inline-block mt-0.5 text-[11px] font-semibold rounded-full px-2 py-0.5 ${r.checked_out_at ? 'bg-gray-100 text-gray-500' : 'bg-emerald-50 text-emerald-700'}`}>{r.checked_out_at ? 'Salió' : 'Registrado'}</span>
                  </span>
                </motion.button>
              )
            })}
          </motion.div>
        )}
      </section>

      <Sheet open={!!open} onClose={() => setOpenId(null)} title="Registro">
        {open && <RecordEditor key={open.id} record={open} onDone={() => { setOpenId(null); onChanged() }} />}
      </Sheet>
    </div>
  )
}

function Kpi({ label, children, accent = false }: { label: string; children: React.ReactNode; accent?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className={`rounded-3xl p-4 sm:p-5 flex flex-col shadow-sm ${accent ? 'bg-white border-2 border-emerald-200' : 'bg-white border border-gray-200/70'}`}>
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{label}</span>
      {children}
    </motion.div>
  )
}

function RecordEditor({ record, onDone }: { record: LiveRecord; onDone: () => void }) {
  const [badge, setBadge] = useState(record.badge_number != null ? String(record.badge_number) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const g = groupOf(record.category as Category)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const num = parseInt(badge, 10)
    if (!badge || isNaN(num) || num <= 0) { setError('Escribe un número de gafete válido.'); return }
    setSaving(true)
    const { data, error: err } = await supabase.from('attendance').update({ badge_number: num }).eq('id', record.id).select('id')
    setSaving(false)
    if (err || !data?.length) {
      setError(err?.code === '23505' && err.message.includes('attendance_badge_category_unique') ? `El gafete #${num} ya lo tiene otro niño de ese grupo ese día.` : 'No se pudo guardar. Intenta de nuevo.')
      return
    }
    onDone()
  }

  async function remove() {
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    // Marcar, no borrar: queda en la papelera (Usuarios).
    const { data, error: err } = await supabase.from('attendance').update({ deleted_at: new Date().toISOString(), deleted_by: session?.user.id }).eq('id', record.id).select('id')
    setSaving(false)
    setConfirmDelete(false)
    if (err || !data?.length) { setError('No se pudo quitar el registro.'); return }
    onDone()
  }

  return (
    <form onSubmit={save} className="px-5 sm:px-7 pt-3 sm:pt-7 pb-6 space-y-5">
      <div className="pr-10">
        <h2 className="text-[26px] font-bold text-gray-900 leading-tight">{record.children?.full_name}</h2>
        <p className="text-gray-500"><span className={`font-semibold ${g.iconColor}`}>{CATEGORY_LABELS[record.category as Category]}</span> · llegó a las {format(new Date(record.checked_in_at), 'HH:mm')}</p>
      </div>
      {record.badge_number !== null && (
        <Field label="Gafete">
          <input type="number" inputMode="numeric" min={1} value={badge} onChange={(e) => { setBadge(e.target.value); setError(null) }} autoFocus
            className={`${INPUT} text-center font-display text-3xl font-bold tabular-nums`} />
        </Field>
      )}
      <FormError error={error} />
      {record.badge_number !== null && (
        <button type="submit" disabled={saving} className="w-full py-3.5 rounded-2xl bg-indigo-600 text-white font-display font-bold text-lg hover:bg-indigo-700 disabled:opacity-60">
          {saving ? 'Guardando…' : 'Guardar gafete'}
        </button>
      )}
      <button type="button" onClick={() => setConfirmDelete(true)} className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-2xl text-red-600 font-semibold hover:bg-red-50">
        <Trash2 size={16} /> Quitar este registro
      </button>
      <ConfirmSheet open={confirmDelete} title="¿Quitar este registro?" message="Queda en la papelera por si fue un error." confirmLabel="Sí, quitar" destructive busy={saving} onConfirm={remove} onClose={() => setConfirmDelete(false)} />
    </form>
  )
}

// ─── Números ──────────────────────────────────────────────────────────────────

function TrendsTab({ weeks, loading, rangeFrom, rangeTo, setRangeFrom, setRangeTo }: {
  weeks: WeekRow[]
  loading: boolean
  rangeFrom: string
  rangeTo: string
  setRangeFrom: (v: string) => void
  setRangeTo: (v: string) => void
}) {
  return (
    <div className="space-y-5">
      <section className="rounded-3xl bg-white border border-gray-200/70 shadow-sm p-5 space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-xl font-bold text-gray-900">Asistencia por semana</h2>
          <span className="text-sm text-gray-500">últimas 10 semanas</span>
        </div>
        {loading ? <SkeletonRow /> : weeks.length === 0 ? <p className="text-gray-500 py-8 text-center">Todavía no hay historial.</p> : <WeeklyChart weeks={weeks} />}
      </section>
      <Ranking rangeFrom={rangeFrom} rangeTo={rangeTo} setRangeFrom={setRangeFrom} setRangeTo={setRangeTo} />
    </div>
  )
}

/** Barras apiladas por grupo; tocar una semana muestra el desglose abajo. */
function WeeklyChart({ weeks }: { weeks: WeekRow[] }) {
  const ordered = useMemo(() => [...weeks].reverse(), [weeks])
  const [active, setActive] = useState(ordered.length - 1)
  const max = Math.max(...ordered.map((w) => w.total), 1)
  const H = 160
  const sel = ordered[active] ?? ordered[ordered.length - 1]

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto -mx-1">
        <div className="flex items-end gap-2 sm:gap-3 px-1 min-w-max sm:min-w-0" style={{ height: H + 44 }}>
          {ordered.map((w, i) => {
            const h = Math.max((w.total / max) * H, 4)
            const isActive = i === active
            const isNow = w.week_start <= todayStr && todayStr <= w.week_end
            return (
              <button key={w.week_start} onClick={() => setActive(i)} onMouseEnter={() => setActive(i)} className="flex-1 min-w-[2.25rem] flex flex-col items-center gap-1.5 group">
                <span className={`text-xs font-bold tabular-nums transition-colors ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>{w.total}</span>
                <motion.div
                  className={`w-full max-w-[3rem] rounded-xl overflow-hidden flex flex-col-reverse transition-opacity ${isActive ? 'opacity-100' : 'opacity-55 group-hover:opacity-80'}`}
                  initial={{ height: 0 }} animate={{ height: h }} transition={{ duration: 0.6, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                >
                  {GROUPS.map((g) => {
                    const n = w[g.category]
                    return n > 0 ? <div key={g.category} className={g.bar} style={{ height: `${(n / w.total) * 100}%` }} /> : null
                  })}
                </motion.div>
                <span className={`text-[11px] whitespace-nowrap ${isNow ? 'text-indigo-700 font-bold' : isActive ? 'text-gray-700 font-semibold' : 'text-gray-400'}`}>
                  {format(new Date(w.week_start + 'T12:00:00'), 'd MMM', { locale: es })}
                </span>
              </button>
            )
          })}
        </div>
      </div>
      {sel && (
        <AnimatePresence mode="wait">
          <motion.div key={sel.week_start} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-2xl bg-gray-50 p-3.5">
            <p className="text-sm font-semibold text-gray-700 mb-2">
              Semana del {format(new Date(sel.week_start + 'T12:00:00'), "d 'de' MMMM", { locale: es })}: <span className="font-display text-lg">{sel.total}</span> niños
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {GROUPS.map((g) => (
                <span key={g.category} className="inline-flex items-center gap-1.5 text-sm text-gray-600">
                  <span className={`w-2.5 h-2.5 rounded-full ${g.bar}`} /> {CATEGORY_LABELS[g.category]} <span className="font-semibold text-gray-900 tabular-nums">{sel[g.category]}</span>
                </span>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  )
}

function Ranking({ rangeFrom, rangeTo, setRangeFrom, setRangeTo }: { rangeFrom: string; rangeTo: string; setRangeFrom: (v: string) => void; setRangeTo: (v: string) => void }) {
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<Category | 'todas'>('todas')
  const [rows, setRows] = useState<{ id: string; full_name: string; category: Category; visits: number; streak: number }[]>([])
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    if (!rangeFrom || !rangeTo || rangeFrom > rangeTo) return
    setLoading(true)
    const { data } = await supabase.from('attendance').select('child_id, category, session_date, children(full_name)').gte('session_date', rangeFrom).lte('session_date', rangeTo).is('deleted_at', null)
    const list = (data ?? []) as unknown as { child_id: string; category: Category; session_date: string; children: { full_name: string } | null }[]
    // Racha: cuántos de los últimos días con servicio (del rango) vino seguido.
    const serviceDays = [...new Set(list.map((r) => r.session_date))].sort().reverse()
    const byChild = new Map<string, { full_name: string; category: Category; visits: number; days: Set<string> }>()
    for (const row of list) {
      if (!row.children) continue
      const e = byChild.get(row.child_id)
      if (e) { if (!e.days.has(row.session_date)) { e.days.add(row.session_date); e.visits += 1 } }
      else byChild.set(row.child_id, { full_name: row.children.full_name, category: row.category, visits: 1, days: new Set([row.session_date]) })
    }
    setRows([...byChild.entries()].map(([id, { days, ...v }]) => {
      let streak = 0
      for (const d of serviceDays) { if (days.has(d)) streak++; else break }
      return { id, ...v, streak }
    }).sort((a, b) => b.visits - a.visits || b.streak - a.streak || a.full_name.localeCompare(b.full_name)))
    setLoading(false)
  }, [rangeFrom, rangeTo])
  useEffect(() => { load() }, [load])

  const shown = category === 'todas' ? rows : rows.filter((r) => r.category === category)
  const maxVisits = Math.max(...shown.map((r) => r.visits), 1)

  async function copyNames() {
    try { await navigator.clipboard.writeText(shown.map((r) => r.full_name).join('\n')) } catch { return }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <section className="rounded-3xl bg-white border border-gray-200/70 shadow-sm p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Trophy size={20} className="text-amber-500" />
        <h2 className="text-xl font-bold text-gray-900">Quién viene más</h2>
      </div>
      <p className="text-sm text-gray-500 -mt-2 flex items-center gap-1">El número es cuántas veces vino. <Flame size={13} className="text-orange-500" /> es su racha: los últimos días seguidos que vino.</p>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Desde"><input type="date" value={rangeFrom} max={rangeTo} onChange={(e) => setRangeFrom(e.target.value)} className={INPUT} /></Field>
        <Field label="Hasta"><input type="date" value={rangeTo} min={rangeFrom} max={todayStr} onChange={(e) => setRangeTo(e.target.value)} className={INPUT} /></Field>
        <button onClick={copyNames} disabled={shown.length === 0} className={`${BTN_SECONDARY} ml-auto`}>
          {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copiado' : 'Copiar nombres'}
        </button>
      </div>
      <FilterChips
        value={category}
        onChange={setCategory}
        options={[{ value: 'todas', label: 'Todos', count: rows.length }, ...ACTIVE_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c], count: rows.filter((r) => r.category === c).length }))]}
      />
      {loading ? <SkeletonRow /> : shown.length === 0 ? <p className="text-gray-500 text-center py-6">Nadie ha venido en ese rango todavía.</p> : (
        <ol className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-2 max-h-[28rem] overflow-y-auto pr-1">
          {shown.map((r, i) => {
            const g = groupOf(r.category)
            return (
              <li key={r.id} className="flex items-center gap-3">
                <span className={`w-7 text-right font-display font-bold tabular-nums ${i < 3 ? 'text-amber-500' : 'text-gray-400'}`}>{i + 1}</span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-semibold text-gray-800">{r.full_name}</span>
                    <span className="shrink-0 flex items-baseline gap-2">
                      {r.streak >= 2 && <span title={`Vino los últimos ${r.streak} días seguidos`} className="inline-flex items-center gap-0.5 text-xs font-semibold text-orange-600 tabular-nums"><Flame size={12} className="self-center" />{r.streak}</span>}
                      <span className="text-sm font-bold text-gray-900 tabular-nums">{r.visits}</span>
                    </span>
                  </span>
                  <span className="block h-1.5 rounded-full bg-gray-100 mt-1 overflow-hidden">
                    <motion.span className={`block h-full rounded-full ${g.bar}`} initial={{ width: 0 }} animate={{ width: `${(r.visits / maxVisits) * 100}%` }} transition={{ duration: 0.6, delay: Math.min(i, 12) * 0.03 }} />
                  </span>
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

// ─── Seguimiento ──────────────────────────────────────────────────────────────

function FollowUpTab({ absent, graduating, medical, missingBirthDate }: { absent: AbsentChild[]; graduating: RosterChild[]; medical: MedicalChild[]; missingBirthDate: number }) {
  const [view, setView] = useState<'faltas' | 'graduar' | 'medicas'>('faltas')
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <FollowCard active={view === 'faltas'} onClick={() => setView('faltas')} icon={Clock} tone="red" count={absent.length} label="Hace rato que no vienen" />
        <FollowCard active={view === 'graduar'} onClick={() => setView('graduar')} icon={PartyPopper} tone="amber" count={graduating.length} label="Listos para subir de grupo" />
        <FollowCard active={view === 'medicas'} onClick={() => setView('medicas')} icon={AlertTriangle} tone="rose" count={medical.length} label="Con alergias o notas médicas" />
      </div>

      {missingBirthDate > 0 && (
        <Link to="/familias?roster=sin_fecha_nacimiento" className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors">
          <span className="flex items-center gap-2 text-amber-800 text-sm font-semibold"><FileWarning size={16} /> {missingBirthDate} niño{missingBirthDate !== 1 ? 's' : ''} sin fecha de nacimiento (sin ella no funcionan estas alertas)</span>
          <span className="flex items-center gap-1 text-sm font-bold text-amber-800 shrink-0">Completar <ArrowRight size={14} /></span>
        </Link>
      )}

      <AnimatePresence mode="wait">
        <motion.div key={view} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          {view === 'faltas' && (absent.length === 0 ? <EmptyState icon={Check} text="Ningún niño ha faltado seguido estas semanas." /> : (
            <motion.div initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2">
              {absent.map((c, i) => (
                <motion.div key={c.id} variants={itemVariants} custom={i}
                  className={`rounded-2xl p-4 space-y-1.5 border ${c.tier === 'roja' ? 'bg-red-50/70 border-red-200' : c.tier === 'amarilla' ? 'bg-amber-50/70 border-amber-200' : 'bg-white border-gray-200'}`}>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-display font-bold text-lg text-gray-900 truncate">{c.full_name}</p>
                    <span className="text-sm font-bold text-gray-500 shrink-0 tabular-nums">{c.missed} domingos</span>
                  </div>
                  <p className="text-sm text-gray-600">{absenceMessage(c.full_name, { missed: c.missed, lastSeen: null, tier: c.tier })}</p>
                  <div className="flex items-center justify-between gap-2 pt-1 text-sm">
                    <span className="text-gray-500 truncate">{c.parentName}</span>
                    {c.parentPhone && <a href={`tel:${c.parentPhone}`} className="inline-flex items-center gap-1 font-semibold text-indigo-700 shrink-0"><Phone size={13} /> {c.parentPhone}</a>}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ))}
          {view === 'graduar' && (graduating.length === 0 ? <EmptyState icon={PartyPopper} text="Nadie por subir de grupo por ahora." /> : (
            <motion.div initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2">
              {graduating.map((c, i) => {
                const to = c.category ? NEXT_CATEGORY[c.category] : null
                return (
                  <motion.div key={c.id} variants={itemVariants} custom={i} className="rounded-2xl bg-white border border-amber-200 p-4 space-y-2">
                    <p className="font-display font-bold text-lg text-gray-900 truncate">{c.full_name}</p>
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      {c.category && <span className={`px-2.5 py-0.5 rounded-full ${groupOf(c.category).avatar}`}>{CATEGORY_LABELS[c.category]}</span>}
                      <ArrowRight size={14} className="text-amber-500" />
                      {to && <span className={`px-2.5 py-0.5 rounded-full ${groupOf(to).avatar}`}>{CATEGORY_LABELS[to]}</span>}
                    </div>
                    {to && <p className="text-sm text-gray-600">{graduationMessage(c.full_name, CATEGORY_LABELS[to])}</p>}
                  </motion.div>
                )
              })}
            </motion.div>
          ))}
          {view === 'medicas' && (medical.length === 0 ? <EmptyState icon={AlertTriangle} text="Ningún niño tiene alertas médicas registradas." /> : (
            <motion.div initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2">
              {medical.map((c, i) => (
                <motion.div key={c.id} variants={itemVariants} custom={i} className="rounded-2xl bg-white border border-red-200 p-4 space-y-2">
                  <div>
                    <p className="font-display font-bold text-lg text-gray-900">{c.full_name}</p>
                    <p className="text-sm text-gray-500">{c.parents?.full_name} · {c.parents?.phone}</p>
                  </div>
                  {c.allergies && <p className="text-sm text-red-800 bg-red-50 rounded-xl px-3 py-2"><span className="font-semibold">Alergias:</span> {c.allergies}</p>}
                  {c.medical_notes && <p className="text-sm text-orange-800 bg-orange-50 rounded-xl px-3 py-2"><span className="font-semibold">Notas:</span> {c.medical_notes}</p>}
                </motion.div>
              ))}
            </motion.div>
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function FollowCard({ active, onClick, icon: Icon, tone, count, label }: { active: boolean; onClick: () => void; icon: typeof Clock; tone: 'red' | 'amber' | 'rose'; count: number; label: string }) {
  const tones = {
    red: { bg: 'bg-red-50', icon: 'text-red-600', ring: 'ring-red-300' },
    amber: { bg: 'bg-amber-50', icon: 'text-amber-600', ring: 'ring-amber-300' },
    rose: { bg: 'bg-rose-50', icon: 'text-rose-600', ring: 'ring-rose-300' },
  }[tone]
  return (
    <motion.button whileTap={{ scale: 0.98 }} onClick={onClick}
      className={`text-left rounded-3xl p-4 flex items-center gap-3 transition-shadow ${tones.bg} ${active ? `ring-2 ${tones.ring} shadow-md` : 'hover:shadow-sm'}`}>
      <span className={`w-11 h-11 rounded-2xl bg-white flex items-center justify-center shrink-0 ${tones.icon}`}><Icon size={20} /></span>
      <span>
        <span className="block font-display text-3xl font-bold leading-none text-gray-900"><AnimatedNumber value={count} /></span>
        <span className="block text-sm text-gray-700 mt-0.5">{label}</span>
      </span>
    </motion.button>
  )
}

// ─── Exportar ─────────────────────────────────────────────────────────────────

function ExportTab({ selectedDate, byCategory, total, coordinatorName, operatorName, corderitosLeadName, weeks, rangeFrom, rangeTo, setRangeFrom, setRangeTo }: {
  selectedDate: Date
  byCategory: CategoryCount
  total: number
  coordinatorName: string
  operatorName: string
  corderitosLeadName: string
  weeks: WeekRow[]
  rangeFrom: string
  rangeTo: string
  setRangeFrom: (v: string) => void
  setRangeTo: (v: string) => void
}) {
  const selectedStr = format(selectedDate, 'yyyy-MM-dd')

  async function rangeRows() {
    if (!rangeFrom || !rangeTo || rangeFrom > rangeTo) throw new Error('Elige un rango de fechas válido.')
    const [{ rows }, staffing] = await Promise.all([fetchAttendanceRange(rangeFrom, rangeTo), fetchDailyStaffing(rangeFrom, rangeTo)])
    if (rows.length === 0) throw new Error('No hay registros en ese rango.')
    return { rows, staffing }
  }

  async function dayPDF(): Promise<Blob> {
    const [{ rows }, staffing] = await Promise.all([fetchAttendanceRange(selectedStr, selectedStr), fetchDailyStaffing(selectedStr, selectedStr)])
    return exportRangePDF(rows, selectedStr, selectedStr, staffing)
  }

  function historyCSV() {
    const headers = ['Semana inicio', 'Semana fin', 'Total', 'Corderitos 0-2', 'Corderitos 2-4', 'Hormiguitas', 'Saltamontes', 'Exploradores']
    const rows = weeks.map((r) => [r.week_start, r.week_end, r.total, r.corderitos_0_2, r.corderitos_2_4, r.hormiguitas, r.saltamontes, r.exploradores])
    downloadCSV(toCSV([headers, ...rows]), 'historial-asistencia.csv')
  }

  const note = [
    coordinatorName && `Generado por: ${coordinatorName}`,
    operatorName && `Compu: ${operatorName}`,
    corderitosLeadName && `Corderitos: ${corderitosLeadName}`,
  ].filter(Boolean).join(' · ') || undefined

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
      <section className="rounded-3xl bg-white border border-gray-200/70 shadow-sm p-5 space-y-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Reporte del día</h2>
          <p className="text-sm text-gray-500 first-letter:uppercase">{format(selectedDate, "EEEE d 'de' MMMM yyyy", { locale: es })}</p>
        </div>
        {total > 0 ? (
          <ReporteAsistenciaDescarga
            titulo="Reporte del día"
            subtitulo={format(selectedDate, "EEEE d 'de' MMMM yyyy", { locale: es })}
            lineas={ACTIVE_CATEGORIES.map((c) => ({ label: CATEGORY_LABELS[c], value: String(byCategory[c]) }))}
            totalLabel="Total de niños"
            totalValue={String(total)}
            nota={note}
            fileName={`reporte-asistencia-${selectedStr}.pdf`}
            onGenerate={dayPDF}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-center py-8 px-4 rounded-2xl border-2 border-dashed border-gray-200">
            <FileText size={22} className="text-gray-300" />
            <p className="text-sm text-gray-500">No hay registros ese día. Cambia la fecha arriba.</p>
          </div>
        )}
      </section>

      <section className="rounded-3xl bg-white border border-gray-200/70 shadow-sm p-5 space-y-4">
        <h2 className="text-xl font-bold text-gray-900">Varios días</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Desde"><input type="date" value={rangeFrom} max={rangeTo} onChange={(e) => setRangeFrom(e.target.value)} className={INPUT} /></Field>
          <Field label="Hasta"><input type="date" value={rangeTo} min={rangeFrom} max={todayStr} onChange={(e) => setRangeTo(e.target.value)} className={INPUT} /></Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <ReporteAsistenciaDescarga titulo="Asistencia (Excel/CSV)" subtitulo={`${rangeFrom} al ${rangeTo}`} icon={<FileSpreadsheet size={15} />}
            fileName={`asistencia-${rangeFrom}-a-${rangeTo}.csv`} onGenerate={async () => { const { rows, staffing } = await rangeRows(); return exportRangeCSV(rows, staffing) }} />
          <ReporteAsistenciaDescarga titulo="Asistencia (PDF)" subtitulo={`${rangeFrom} al ${rangeTo}`} icon={<FileText size={15} />}
            fileName={`asistencia-${rangeFrom}-a-${rangeTo}.pdf`} onGenerate={async () => { const { rows, staffing } = await rangeRows(); return exportRangePDF(rows, rangeFrom, rangeTo, staffing) }} />
        </div>
        <button onClick={historyCSV} disabled={weeks.length === 0} className={`${BTN_SECONDARY} w-full`}>
          <Download size={16} /> Historial semanal (CSV)
        </button>
      </section>
    </div>
  )
}
