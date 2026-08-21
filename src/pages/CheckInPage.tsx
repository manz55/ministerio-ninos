import { useState, useEffect, useRef, useCallback, useMemo, startTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Search, CheckCircle2, UserPlus, AlertTriangle, ChevronLeft, Bug, Zap, Compass, User, Pencil, LogIn, Trash2, X, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getCategoryFromBirthDate, getEffectiveCategory, hasCategoryChanged, getAgeLabel, requiresBadge, requiresPager } from '../lib/categoryUtils'
import { CATEGORY_LABELS, CATEGORY_COLORS, NEXT_CATEGORY, type Category, type TeamColor } from '../types/domain'
import { CategoryBadge } from '../components/ui/CategoryBadge'
import { ChildContacts } from '../components/ui/ChildContacts'
import { useAuth } from '../lib/auth'
import { NewFamilyStep } from '../components/checkin/NewFamilyStep'
import { useDebounce } from '../hooks/useDebounce'
import { BalloonBackground } from '../components/ui/BalloonBackground'
import { FloatingIconsBackground } from '../components/ui/FloatingIconsBackground'
import { SaltamontesBackground } from '../components/ui/SaltamontesBackground'
import { SoftGradientBackground } from '../components/ui/SoftGradientBackground'

// ─── Types ────────────────────────────────────────────────────────────────────

type TodayRecord = {
  id: string
  category: Category
  badge_number: number | null
  checked_in_at: string
  checked_out_at: string | null
  children: { full_name: string }
}

type ChildResult = {
  id: string
  full_name: string
  birth_date: string | null
  category: Category | null
  allergies: string | null
  medical_notes: string | null
  parent_id: string | null
  parents: { full_name: string; phone: string } | null
  attendance: { session_date: string }[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TEAM_KEY        = 'ministerio_team_session'
const COORDINATOR_KEY = 'ministerio_coordinator_session'
const today = format(new Date(), 'yyyy-MM-dd')

function getStoredTeamForToday(): TeamColor | null {
  try {
    const raw = localStorage.getItem(TEAM_KEY)
    if (!raw) return null
    const { color, date } = JSON.parse(raw)
    return date === today ? (color as TeamColor) : null
  } catch { return null }
}

function getStoredCoordinatorForToday(): string {
  try {
    const raw = localStorage.getItem(COORDINATOR_KEY)
    if (!raw) return ''
    const { name, date } = JSON.parse(raw)
    return date === today ? (name ?? '') : ''
  } catch { return '' }
}

function persistTeam(color: TeamColor) {
  localStorage.setItem(TEAM_KEY, JSON.stringify({ color, date: today }))
}

function persistCoordinator(name: string) {
  localStorage.setItem(COORDINATOR_KEY, JSON.stringify({ name, date: today }))
}

const TEAM_META: Record<TeamColor, { label: string; bg: string; dot: string; text: string; cardBg: string; cardText: string }> = {
  rojo:     { label: 'Rojo',     bg: 'bg-red-500',    dot: 'bg-red-500',    text: 'text-white',    cardBg: 'bg-red-50',    cardText: 'text-red-700'    },
  amarillo: { label: 'Amarillo', bg: 'bg-yellow-400', dot: 'bg-yellow-400', text: 'text-gray-800', cardBg: 'bg-yellow-50', cardText: 'text-yellow-700' },
  azul:     { label: 'Azul',     bg: 'bg-blue-500',   dot: 'bg-blue-500',   text: 'text-white',    cardBg: 'bg-blue-50',   cardText: 'text-blue-700'   },
}

const TILES = [
  {
    category: 'hormiguitas' as Category,
    icon: Bug,
    ages: '4–6 años',
    cardBg: 'bg-emerald-100',
    iconBg: 'bg-emerald-500/20',
    iconColor: 'text-emerald-700',
    bar: 'bg-emerald-500',
    barBg: 'bg-emerald-200/60',
    textColor: 'text-emerald-900',
  },
  {
    category: 'saltamontes' as Category,
    icon: Zap,
    ages: '7–9 años',
    cardBg: 'bg-amber-100',
    iconBg: 'bg-amber-500/20',
    iconColor: 'text-amber-700',
    bar: 'bg-amber-500',
    barBg: 'bg-amber-200/60',
    textColor: 'text-amber-900',
  },
  {
    category: 'exploradores' as Category,
    icon: Compass,
    ages: '10+ años',
    cardBg: 'bg-sky-100',
    iconBg: 'bg-sky-500/20',
    iconColor: 'text-sky-700',
    bar: 'bg-sky-500',
    barBg: 'bg-sky-200/60',
    textColor: 'text-sky-900',
  },
]

// ─── Team picker screen ───────────────────────────────────────────────────────

function TeamPickerScreen({ onConfirm }: { onConfirm: (color: TeamColor, coordinator: string) => void }) {
  const [coordinator, setCoordinator] = useState(getStoredCoordinatorForToday)

  const TEAMS: { color: TeamColor; hover: string }[] = [
    { color: 'rojo',     hover: 'hover:brightness-110' },
    { color: 'amarillo', hover: 'hover:brightness-105' },
    { color: 'azul',     hover: 'hover:brightness-110' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-[70vh] flex flex-col items-center justify-center gap-8 py-8"
    >
      {/* Date */}
      <div className="text-center">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          {format(new Date(), 'EEEE', { locale: es })}
        </p>
        <p className="text-3xl font-black text-gray-900 mt-1">
          {format(new Date(), "d 'de' MMMM", { locale: es })}
        </p>
        <p className="text-base text-gray-400 mt-0.5">
          {format(new Date(), 'yyyy')}
        </p>
      </div>

      {/* Coordinator field */}
      <div className="w-full max-w-sm space-y-2">
        <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-widest px-1">
          <User size={12} />
          ¿Quién está de encargado hoy?
        </label>
        <input
          type="text"
          value={coordinator}
          onChange={(e) => setCoordinator(e.target.value)}
          placeholder="Tu nombre…"
          autoComplete="off"
          className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-2xl text-base font-medium text-gray-800 placeholder:text-gray-300 focus:border-indigo-400 focus:outline-none shadow-sm"
        />
      </div>

      {/* Prompt */}
      <div className="text-center space-y-1">
        <p className="text-xl font-bold text-gray-800">¿Cuál es el equipo de hoy?</p>
        <p className="text-sm text-gray-400">Selecciona antes de registrar niños</p>
      </div>

      {/* Team cards */}
      <div className="grid grid-cols-3 gap-4 w-full max-w-md">
        {TEAMS.map(({ color, hover }) => {
          const m = TEAM_META[color]
          return (
            <motion.button
              key={color}
              onClick={() => onConfirm(color, coordinator.trim())}
              whileTap={{ scale: 0.94 }}
              whileHover={{ scale: 1.04 }}
              className={`${m.bg} ${hover} ${m.text} rounded-3xl py-8 flex flex-col items-center gap-4 shadow-lg font-bold transition-all`}
            >
              <div className="w-14 h-14 rounded-full bg-white/25 flex items-center justify-center">
                <div className="w-7 h-7 rounded-full bg-white/70" />
              </div>
              <span className="text-lg font-black tracking-wide">{m.label}</span>
            </motion.button>
          )
        })}
      </div>
    </motion.div>
  )
}

// ─── Child card ───────────────────────────────────────────────────────────────

function ChildCard({
  child,
  teamColor,
  isSelected,
  onSelect,
  onDeselect,
  onRegistered,
}: {
  child: ChildResult
  teamColor: TeamColor
  isSelected: boolean
  onSelect: () => void
  onDeselect: () => void
  onRegistered: (childId: string) => void
}) {
  const computedCategory = getCategoryFromBirthDate(child.birth_date)
  const category = getEffectiveCategory(child)
  const categoryChanged = hasCategoryChanged(child)
  const age = getAgeLabel(child.birth_date)
  const alreadyIn = child.attendance.some((a) => a.session_date === today)
  const hasAlert = !!(child.allergies || child.medical_notes)
  const needsBadge = requiresBadge(category)
  const needsPager = requiresPager(category)

  const [badge, setBadge] = useState('')
  const [pager, setPager] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showStamp, setShowStamp] = useState(false)
  const [showContacts, setShowContacts] = useState(false)
  const badgeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isSelected && needsBadge) {
      setTimeout(() => badgeRef.current?.focus(), 50)
    }
  }, [isSelected, needsBadge])

  async function doCheckIn(badgeNumber: number | null, pagerNumber: number | null) {
    if (!category) { setError('Este niño no tiene categoría asignada. Complétala en Familias.'); return }
    setSubmitting(true)
    setError(null)
    const { error: err } = await supabase.from('attendance').insert({
      child_id: child.id,
      session_date: today,
      team_color: teamColor,
      category,
      badge_number: badgeNumber,
      pager_number: pagerNumber,
    })
    if (err) {
      setSubmitting(false)
      if (err.code === '23505' && err.message.includes('attendance_badge_category_unique')) {
        setError(`El gafete #${badgeNumber} ya está en uso en ${CATEGORY_LABELS[category]} hoy.`)
      } else if (err.code === '23505') {
        setError('Este niño ya fue registrado hoy.')
      } else {
        setError('Error al registrar. Intenta de nuevo.')
      }
      return
    }
    // Keep the stored category in sync with age now that we know it — future
    // imports/no-birth-date children simply keep whatever was last set. Uses a
    // narrow RPC (not a blanket UPDATE grant) so a maestro's session can only
    // ever touch this one column, not rewrite arbitrary child data.
    if (computedCategory && computedCategory !== child.category) {
      await supabase.rpc('sync_child_category', { p_child_id: child.id, p_category: computedCategory })
    }
    setSubmitting(false)
    setBadge('')
    setPager('')
    setShowStamp(true)
    setTimeout(() => {
      setShowStamp(false)
      onRegistered(child.id)
    }, 1600)
  }

  // Auto-check-in for no-badge categories (corderitos) reads fresh values via
  // this ref instead of depending on `doCheckIn`/`needsBadge`/`alreadyIn`
  // directly — those change identity every render, so including them as
  // effect deps would either miss updates (stale closure) or re-fire the
  // check-in on every unrelated re-render while still selected.
  const latest = useRef({ needsBadge, alreadyIn, category, doCheckIn })
  latest.current = { needsBadge, alreadyIn, category, doCheckIn }

  useEffect(() => {
    if (!isSelected) return
    const { needsBadge, alreadyIn, category, doCheckIn } = latest.current
    if (!needsBadge && !alreadyIn && category) {
      doCheckIn(null, null)
    }
  }, [isSelected])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const num = parseInt(badge, 10)
    if (!badge || isNaN(num) || num <= 0) { setError('Ingresa un número válido.'); return }
    doCheckIn(num, pager ? parseInt(pager, 10) : null)
  }

  return (
    <div className="relative">
    <div
      className={`rounded-2xl border-2 overflow-hidden transition-all ${
        alreadyIn
          ? 'border-green-200 bg-green-50'
          : isSelected
          ? 'border-indigo-400 bg-white shadow-md'
          : 'border-gray-200 bg-white hover:border-indigo-300'
      }`}
    >
      {/* ── Card header ── */}
      <button
        className="w-full text-left px-5 py-4 disabled:cursor-not-allowed"
        onClick={alreadyIn || !category ? undefined : isSelected ? onDeselect : onSelect}
        disabled={alreadyIn || submitting || !category}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-2">
              <p className="font-bold text-gray-900 text-lg leading-tight">{child.full_name}</p>
              {hasAlert && <AlertTriangle size={15} className="text-red-500 shrink-0" />}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <CategoryBadge category={category} size="sm" />
              {categoryChanged && category && NEXT_CATEGORY[child.category!] === category && (
                <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                  🎉 Ya cumplió años, puede pasar a {CATEGORY_LABELS[category]}
                </span>
              )}
              <span className="text-sm text-gray-400">
                {age !== null ? `${age} año${age !== 1 ? 's' : ''} · ` : ''}{child.parents?.full_name ?? 'Sin responsable'}
              </span>
            </div>
          </div>

          {alreadyIn && (
            <div className="flex items-center gap-1.5 text-green-600 shrink-0">
              <CheckCircle2 size={20} />
              <span className="text-sm font-semibold">Registrado</span>
            </div>
          )}
          {!alreadyIn && !needsBadge && isSelected && submitting && (
            <span className="text-sm text-gray-400 shrink-0">Registrando…</span>
          )}
        </div>
      </button>

      {/* ── Otros contactos autorizados ── */}
      <div className="px-5 pb-3 -mt-1">
        <button
          type="button"
          onClick={() => setShowContacts((v) => !v)}
          className="text-xs font-medium text-gray-400 hover:text-indigo-600 transition-colors"
        >
          {showContacts ? 'Ocultar otros contactos' : '+ Otros contactos autorizados'}
        </button>
        {showContacts && (
          <div className="mt-2">
            <ChildContacts childId={child.id} />
          </div>
        )}
      </div>

      {/* ── Inline badge form ── */}
      {isSelected && needsBadge && (
        <form onSubmit={handleSubmit} className="px-5 pb-5 space-y-3 border-t border-gray-100 pt-4">

          {hasAlert && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
              <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-1">⚠ Alerta médica</p>
              {child.allergies && (
                <p className="text-sm text-red-700"><span className="font-semibold">Alergias:</span> {child.allergies}</p>
              )}
              {child.medical_notes && (
                <p className="text-sm text-red-700"><span className="font-semibold">Notas:</span> {child.medical_notes}</p>
              )}
            </div>
          )}

          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">
                Gafete <span className="text-red-500">*</span>
              </label>
              <input
                ref={badgeRef}
                type="number"
                inputMode="numeric"
                min={1}
                value={badge}
                onChange={(e) => { setBadge(e.target.value); setError(null) }}
                placeholder="Núm."
                className="w-full px-3 py-4 text-3xl font-black border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none text-center"
              />
            </div>

            {needsPager && (
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">
                  Biper <span className="text-gray-300 font-normal">(opcional)</span>
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={pager}
                  onChange={(e) => setPager(e.target.value)}
                  placeholder="Núm."
                  className="w-full px-3 py-4 text-3xl font-black border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none text-center"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !badge}
              className="px-6 py-4 bg-indigo-600 text-white rounded-xl font-bold text-2xl hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-40 transition-colors"
            >
              {submitting ? '…' : '✓'}
            </button>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              {error}
            </p>
          )}
        </form>
      )}
    </div>

    {/* ── Stamp ── */}
    <AnimatePresence>
      {showStamp && (
        <motion.div
          initial={{ scale: 0, rotate: -12, opacity: 0 }}
          animate={{ scale: 1, rotate: -12, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          className="absolute -top-4 right-4 w-28 h-28 rounded-full border-4 border-[#b3402f]
                     flex items-center justify-center text-center font-black text-[#b3402f]
                     bg-red-50/90 pointer-events-none z-10 text-sm leading-tight select-none"
        >
          REGISTRADO<br />✓
        </motion.div>
      )}
    </AnimatePresence>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CheckInPage() {
  const { isAdmin } = useAuth()
  const [activeCategory, setActiveCategory] = useState<Category | null>(null)
  const [todayCounts, setTodayCounts] = useState<Partial<Record<Category, number>>>({})
  const [totalToday, setTotalToday] = useState(0)
  const [todayRecords, setTodayRecords] = useState<TodayRecord[]>([])
  const [confirmDeleteRecordId, setConfirmDeleteRecordId] = useState<string | null>(null)
  const [deleteRecordError, setDeleteRecordError] = useState<string | null>(null)
  const [children, setChildren] = useState<ChildResult[]>([])
  const [filter, setFilter] = useState('')
  const [loadingChildren, setLoadingChildren] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [teamColor, setTeamColor]         = useState<TeamColor>(getStoredTeamForToday() ?? 'rojo')
  const [teamConfirmed, setTeamConfirmed]   = useState(() => getStoredTeamForToday() !== null)
  const [coordinatorName, setCoordinatorName] = useState(getStoredCoordinatorForToday)
  const [editingCoordinator, setEditingCoordinator] = useState(false)
  const [showNewFamily, setShowNewFamily] = useState(false)

  // ── Búsqueda global ──
  const [globalSearch, setGlobalSearch] = useState('')
  const [globalResults, setGlobalResults] = useState<ChildResult[]>([])
  const [globalLoading, setGlobalLoading] = useState(false)
  const debouncedGlobal = useDebounce(globalSearch.trim(), 280)

  // ── Padrón general (niños ya existentes en la base de datos) ──
  const [totalChildren, setTotalChildren] = useState<number | null>(null)
  const [allChildren, setAllChildren] = useState<ChildResult[]>([])
  const [loadingAllChildren, setLoadingAllChildren] = useState(false)
  const [showAllChildren, setShowAllChildren] = useState(false)

  const fetchCounts = useCallback(async () => {
    const { data } = await supabase
      .from('attendance')
      .select('id, category, badge_number, checked_in_at, checked_out_at, children(full_name)')
      .eq('session_date', today)
      .order('checked_in_at', { ascending: false })
    if (!data) return
    const counts: Partial<Record<Category, number>> = {}
    for (const row of data) {
      const cat = row.category as Category
      counts[cat] = (counts[cat] ?? 0) + 1
    }
    setTodayCounts(counts)
    setTotalToday(data.length)
    setTodayRecords(data as unknown as TodayRecord[])
  }, [])

  useEffect(() => { fetchCounts() }, [fetchCounts])

  useEffect(() => {
    supabase.from('children').select('id', { count: 'exact', head: true })
      .then(({ count }) => setTotalChildren(count))
  }, [])

  // Keeps every maestro's screen in sync — a check-in (or its deletion) made
  // from any other device today shows up here without needing to refresh.
  useEffect(() => {
    const channel = supabase
      .channel('attendance-today-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance', filter: `session_date=eq.${today}` },
        (payload) => {
          fetchCounts()
          if (payload.eventType === 'INSERT') {
            const childId = (payload.new as { child_id: string }).child_id
            const mark = (c: ChildResult) =>
              c.id === childId && !c.attendance.some((a) => a.session_date === today)
                ? { ...c, attendance: [...c.attendance, { session_date: today }] }
                : c
            setChildren((prev) => prev.map(mark))
            setGlobalResults((prev) => prev.map(mark))
            setAllChildren((prev) => prev.map(mark))
          } else if (payload.eventType === 'DELETE') {
            const childId = (payload.old as { child_id: string }).child_id
            const unmark = (c: ChildResult) =>
              c.id === childId ? { ...c, attendance: c.attendance.filter((a) => a.session_date !== today) } : c
            setChildren((prev) => prev.map(unmark))
            setGlobalResults((prev) => prev.map(unmark))
            setAllChildren((prev) => prev.map(unmark))
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchCounts])

  const loadAllChildren = useCallback(async () => {
    setLoadingAllChildren(true)
    const [{ data: all }, { data: todayAtt }] = await Promise.all([
      supabase
        .from('children')
        .select('id, full_name, birth_date, category, allergies, medical_notes, parent_id, parents(full_name, phone)')
        .order('full_name'),
      supabase
        .from('attendance')
        .select('child_id')
        .eq('session_date', today),
    ])
    const attSet = new Set((todayAtt ?? []).map((a) => a.child_id))
    setAllChildren(
      ((all ?? []) as Omit<ChildResult, 'attendance'>[]).map((c) => ({
        ...c,
        attendance: attSet.has(c.id) ? [{ session_date: today }] : [],
      })) as ChildResult[]
    )
    setLoadingAllChildren(false)
    setShowAllChildren(true)
  }, [])

  // Búsqueda global: dos queries pequeñas en paralelo
  useEffect(() => {
    if (debouncedGlobal.length < 2) { setGlobalResults([]); return }
    let cancelled = false
    setGlobalLoading(true)
    ;(async () => {
      const [{ data: found }, { data: todayAtt }] = await Promise.all([
        supabase
          .from('children')
          .select('id, full_name, birth_date, category, allergies, medical_notes, parent_id, parents(full_name, phone)')
          .ilike('full_name', `%${debouncedGlobal}%`)
          .order('full_name')
          .limit(20),
        supabase
          .from('attendance')
          .select('child_id')
          .eq('session_date', today),
      ])
      if (cancelled) return
      const attSet = new Set((todayAtt ?? []).map((a) => a.child_id))
      setGlobalResults(
        ((found ?? []) as Omit<ChildResult, 'attendance'>[]).map((c) => ({
          ...c,
          attendance: attSet.has(c.id) ? [{ session_date: today }] : [],
        })) as ChildResult[]
      )
      setGlobalLoading(false)
    })()
    return () => { cancelled = true }
  }, [debouncedGlobal])

  // Evita que una respuesta "vieja" (de una categoría abandonada) sobrescriba
  // la lista de la categoría que el usuario seleccionó después
  const categoryRequestRef = useRef(0)

  // Abre grupo: dos queries pequeñas en lugar de un join masivo
  async function openCategory(category: Category) {
    const requestId = ++categoryRequestRef.current

    // startTransition mantiene el home interactivo mientras React prepara la nueva vista
    startTransition(() => {
      setActiveCategory(category)
      setFilter('')
      setSelectedId(null)
      setGlobalSearch('')
      setLoadingChildren(true)
    })

    const [{ data: all }, { data: todayAtt }] = await Promise.all([
      supabase
        .from('children')
        .select('id, full_name, birth_date, category, allergies, medical_notes, parent_id, parents(full_name, phone)')
        .order('full_name'),
      supabase
        .from('attendance')
        .select('child_id')
        .eq('session_date', today),
    ])

    // Otra categoría fue seleccionada (o se volvió al home) mientras esta consulta estaba en vuelo
    if (categoryRequestRef.current !== requestId) return

    const attSet = new Set((todayAtt ?? []).map((a) => a.child_id))
    const filtered = ((all ?? []) as Omit<ChildResult, 'attendance'>[])
      .filter((c) => getEffectiveCategory(c) === category)
      .map((c) => ({
        ...c,
        attendance: attSet.has(c.id) ? [{ session_date: today }] : [],
      })) as ChildResult[]

    setChildren(filtered)
    setLoadingChildren(false)
  }

  function handleBack() {
    categoryRequestRef.current++ // invalida cualquier openCategory() pendiente
    setActiveCategory(null)
    setChildren([])
    setSelectedId(null)
    fetchCounts()
  }

  function handleRegistered(childId: string) {
    const mark = (c: ChildResult) =>
      c.id === childId ? { ...c, attendance: [...c.attendance, { session_date: today }] } : c
    setChildren((prev) => prev.map(mark))
    setGlobalResults((prev) => prev.map(mark))
    setAllChildren((prev) => prev.map(mark))
    setSelectedId(null)
    // Deriving category from data avoids depending on activeCategory
    const child = [...children, ...globalResults, ...allChildren].find((c) => c.id === childId)
    const cat = child ? getEffectiveCategory(child) : activeCategory
    if (cat) {
      setTodayCounts((prev) => ({ ...prev, [cat]: (prev[cat] ?? 0) + 1 }))
      setTotalToday((n) => n + 1)
    }
  }

  function confirmTeam(color: TeamColor, coordinator: string) {
    setTeamColor(color)
    setCoordinatorName(coordinator)
    setTeamConfirmed(true)
    persistTeam(color)
    persistCoordinator(coordinator)
  }

  async function deleteAttendanceRecord(id: string) {
    setDeleteRecordError(null)
    // Capture the record before any state update to avoid closure staleness
    const rec = todayRecords.find((r) => r.id === id)
    // .select() forces PostgREST to report which rows were actually deleted —
    // without it, a DELETE silently blocked by RLS (only admins may delete
    // attendance) still returns no error, and the record would falsely look
    // deleted here while reappearing on the next reload/refetch.
    const { data, error } = await supabase.from('attendance').delete().eq('id', id).select('id')
    if (error || !data || data.length === 0) {
      setDeleteRecordError('No se pudo borrar el registro. Intenta de nuevo.')
      return
    }
    setTodayRecords((prev) => prev.filter((r) => r.id !== id))
    if (rec) {
      setTodayCounts((prev) => ({
        ...prev,
        [rec.category]: Math.max(0, (prev[rec.category] ?? 0) - 1),
      }))
    }
    setTotalToday((n) => Math.max(0, n - 1))
    setConfirmDeleteRecordId(null)
  }

  function saveCoordinator(name: string) {
    setCoordinatorName(name)
    persistCoordinator(name)
    setEditingCoordinator(false)
  }

  const filteredChildren = useMemo(() =>
    filter.trim()
      ? children.filter(
          (c) =>
            c.full_name.toLowerCase().includes(filter.toLowerCase()) ||
            c.parents?.full_name.toLowerCase().includes(filter.toLowerCase())
        )
      : children,
  [filter, children])

  const registeredCount = useMemo(
    () => children.filter((c) => c.attendance.some((a) => a.session_date === today)).length,
    [children]
  )

  const isSearching = debouncedGlobal.length >= 2

  // Team must be confirmed before anything else each day
  if (!teamConfirmed) {
    return <TeamPickerScreen onConfirm={confirmTeam} />
  }

  if (showNewFamily) {
    return (
      <NewFamilyStep
        onSaved={() => setShowNewFamily(false)}
        onCancel={() => setShowNewFamily(false)}
      />
    )
  }

  // ── Category view ──────────────────────────────────────────────────────────
  if (activeCategory) {
    const tile = TILES.find((t) => t.category === activeCategory)!
    return (
      <>
      {/* Full-viewport background */}
      <div className={`fixed inset-0 -z-10 ${
        activeCategory === 'saltamontes' ? 'bg-white' :
        activeCategory === 'exploradores' ? 'bg-sky-50' :
        'bg-emerald-50/70'
      }`} />
      {activeCategory === 'hormiguitas'  && <BalloonBackground />}
      {activeCategory === 'exploradores' && <FloatingIconsBackground />}
      {activeCategory === 'saltamontes'  && <SaltamontesBackground />}
      <div className="relative z-10 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 bg-white rounded-2xl border border-gray-200 px-4 py-3">
          <button
            onClick={handleBack}
            className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft size={22} />
          </button>
          <div className="flex-1 min-w-0">
            <div className={`flex items-center gap-2 font-bold text-lg leading-tight ${tile.iconColor}`}>
              <tile.icon size={18} />
              {CATEGORY_LABELS[activeCategory]}
            </div>
            <p className="text-xs text-gray-400">{tile.ages}</p>
          </div>
          {!loadingChildren && (
            <span className="text-sm font-semibold text-gray-500 shrink-0">
              {registeredCount}/{children.length}
            </span>
          )}
        </div>

        {/* Filter */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            value={filter}
            onChange={(e) => { setFilter(e.target.value); setSelectedId(null) }}
            placeholder="Buscar por nombre…"
            className="w-full pl-12 pr-4 py-4 text-lg border-2 border-gray-200 rounded-2xl focus:border-indigo-500 focus:outline-none bg-white"
            autoFocus
          />
        </div>

        {/* Children list */}
        {loadingChildren ? (
          <p className="text-center text-gray-400 py-10 text-lg">Cargando…</p>
        ) : filteredChildren.length === 0 ? (
          <div className="text-center py-12 space-y-4 text-gray-400">
            <p className="text-base">{filter ? `Sin resultados para "${filter}"` : 'No hay niños en esta categoría todavía'}</p>
            <button
              onClick={() => setShowNewFamily(true)}
              className="inline-flex items-center gap-2 px-6 py-3.5 text-base font-semibold text-white bg-indigo-600 rounded-2xl hover:bg-indigo-700 transition-colors"
            >
              <UserPlus size={18} />
              Registrar familia nueva
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredChildren.map((child) => (
              <ChildCard
                key={child.id}
                child={child}
                teamColor={teamColor}
                isSelected={selectedId === child.id}
                onSelect={() => setSelectedId(child.id)}
                onDeselect={() => setSelectedId(null)}
                onRegistered={handleRegistered}
              />
            ))}
          </div>
        )}

        {!loadingChildren && children.length > 0 && (
          <button
            onClick={() => setShowNewFamily(true)}
            className="w-full flex items-center justify-center gap-2 py-3.5 text-sm font-medium text-indigo-600 border-2 border-dashed border-indigo-200 rounded-2xl hover:bg-indigo-50 transition-colors"
          >
            <UserPlus size={15} />
            ¿Primera vez? Registrar familia nueva
          </button>
        )}
      </div>
      </>
    )
  }

  // ── Grid / home view ───────────────────────────────────────────────────────
  const [hero, ...rest] = TILES

  return (
    <>
    <SoftGradientBackground />
    <div className="relative z-[2] space-y-4">

      {/* ── Session card ── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          {/* Date + count */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              {format(new Date(), 'EEEE', { locale: es })}
            </p>
            <p className="text-xl font-black text-gray-900 leading-tight">
              {format(new Date(), "d 'de' MMMM yyyy", { locale: es })}
            </p>
            {totalToday > 0 && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <CheckCircle2 size={13} className="text-emerald-500" />
                <span className="text-sm font-semibold text-emerald-600">
                  {totalToday} niño{totalToday !== 1 ? 's' : ''} registrado{totalToday !== 1 ? 's' : ''}
                </span>
              </div>
            )}

            {/* Coordinator — inline editable */}
            <div className="flex items-center gap-1.5 mt-2">
              <User size={12} className="text-indigo-400 shrink-0" />
              {editingCoordinator ? (
                <input
                  autoFocus
                  type="text"
                  defaultValue={coordinatorName}
                  onBlur={(e) => saveCoordinator(e.target.value.trim())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveCoordinator((e.target as HTMLInputElement).value.trim())
                    if (e.key === 'Escape') setEditingCoordinator(false)
                  }}
                  placeholder="Tu nombre…"
                  className="text-sm border-b-2 border-indigo-400 focus:outline-none font-medium text-gray-700 bg-transparent w-36"
                />
              ) : (
                <button
                  onClick={() => setEditingCoordinator(true)}
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-indigo-600 transition-colors group"
                >
                  <span className={coordinatorName ? 'font-semibold text-gray-700' : 'italic text-gray-300'}>
                    {coordinatorName || 'Agregar encargado…'}
                  </span>
                  <Pencil size={11} className="opacity-0 group-hover:opacity-50 transition-opacity" />
                </button>
              )}
            </div>
          </div>

          {/* Team indicator */}
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl ${TEAM_META[teamColor].cardBg}`}>
              <div className={`w-2.5 h-2.5 rounded-full ${TEAM_META[teamColor].dot}`} />
              <span className={`text-sm font-bold ${TEAM_META[teamColor].cardText}`}>
                Equipo {TEAM_META[teamColor].label}
              </span>
            </div>
            <button
              onClick={() => setTeamConfirmed(false)}
              className="text-xs text-gray-400 hover:text-gray-600 font-medium transition-colors pr-1"
            >
              Cambiar equipo →
            </button>
          </div>
        </div>
      </div>

      {/* ── Búsqueda global ── */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
        <input
          type="text"
          value={globalSearch}
          onChange={(e) => { setGlobalSearch(e.target.value); setSelectedId(null) }}
          placeholder="Buscar niño por nombre…"
          className="w-full pl-12 pr-10 py-4 text-base border-2 border-gray-200 rounded-2xl focus:border-indigo-500 focus:outline-none bg-white shadow-sm"
        />
        {globalSearch && (
          <button
            onClick={() => { setGlobalSearch(''); setGlobalResults([]) }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* ── Resultados de búsqueda global ── */}
      {isSearching ? (
        <div className="space-y-2.5">
          {globalLoading && (
            <p className="text-center text-gray-400 py-8 text-base">Buscando…</p>
          )}
          {!globalLoading && globalResults.length === 0 && (
            <div className="text-center py-10 space-y-4 bg-white rounded-2xl border border-gray-200">
              <p className="text-gray-400">Sin resultados para "{debouncedGlobal}"</p>
              <button
                onClick={() => setShowNewFamily(true)}
                className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-indigo-600 rounded-2xl hover:bg-indigo-700 transition-colors"
              >
                <UserPlus size={16} /> Registrar familia nueva
              </button>
            </div>
          )}
          {globalResults.map((child) => (
            <ChildCard
              key={child.id}
              child={child}
              teamColor={teamColor}
              isSelected={selectedId === child.id}
              onSelect={() => setSelectedId(child.id)}
              onDeselect={() => setSelectedId(null)}
              onRegistered={handleRegistered}
            />
          ))}
          {!globalLoading && globalResults.length > 0 && (
            <button
              onClick={() => setShowNewFamily(true)}
              className="w-full flex items-center justify-center gap-2 py-3.5 text-sm font-medium text-indigo-600 border-2 border-dashed border-indigo-200 rounded-2xl hover:bg-indigo-50 transition-colors"
            >
              <UserPlus size={15} /> ¿Primera vez? Registrar familia nueva
            </button>
          )}
        </div>
      ) : (
      <>

      {/* ── Label ── */}
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest text-center">
        O selecciona el grupo
      </p>

      {/* ── Hero tile (Hormiguitas) ── */}
      {(() => {
        const { category, icon: Icon, ages, cardBg, iconBg, iconColor, bar, barBg, textColor } = hero
        const count = todayCounts[category] ?? 0
        return (
          <motion.button
            onClick={() => openCategory(category)}
            whileTap={{ scale: 0.98 }}
            whileHover={{ scale: 1.01 }}
            className={`relative w-full overflow-hidden rounded-2xl p-5 text-left shadow-md ${cardBg}`}
          >
            <div className="flex items-center gap-5">
              <div className={`w-16 h-16 rounded-2xl ${iconBg} flex items-center justify-center shrink-0 backdrop-blur-sm`}>
                <Icon className={`w-8 h-8 ${iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-black text-base uppercase tracking-wide ${textColor}`}>
                  {CATEGORY_LABELS[category]}
                </p>
                <p className={`text-xs ${iconColor} opacity-70 mb-2`}>{ages}</p>
                <div className={`h-1.5 w-full rounded-full ${barBg}`}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: count > 0 ? `${Math.min(count * 10, 100)}%` : '0%' }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                    className={`h-1.5 rounded-full ${bar}`}
                  />
                </div>
                <span className={`text-xs font-medium mt-1 block ${iconColor}`}>
                  {count > 0 ? `${count} registrado${count !== 1 ? 's' : ''}` : 'Sin registros aún'}
                </span>
              </div>
              {count > 0 && (
                <div className={`w-14 h-14 rounded-2xl ${iconBg} flex items-center justify-center shrink-0 backdrop-blur-sm`}>
                  <span className={`text-3xl font-black ${iconColor}`}>{count}</span>
                </div>
              )}
            </div>
          </motion.button>
        )
      })()}

      {/* ── Remaining 2 tiles ── */}
      <div className="grid grid-cols-2 gap-3">
        {rest.map(({ category, icon: Icon, ages, cardBg, iconBg, iconColor, bar, barBg, textColor }) => {
          const count = todayCounts[category] ?? 0
          return (
            <motion.button
              key={category}
              onClick={() => openCategory(category)}
              whileTap={{ scale: 0.97 }}
              whileHover={{ scale: 1.02 }}
              className={`relative overflow-hidden rounded-2xl p-5 text-left shadow-md ${cardBg}`}
            >
              <div>
                <div className={`w-12 h-12 rounded-2xl ${iconBg} flex items-center justify-center mb-4 backdrop-blur-sm`}>
                  <Icon className={`w-6 h-6 ${iconColor}`} />
                </div>
                <p className={`font-bold text-sm uppercase tracking-wide ${textColor} leading-tight`}>
                  {CATEGORY_LABELS[category]}
                </p>
                <p className={`text-xs ${iconColor} opacity-70 mt-0.5 mb-3`}>{ages}</p>
                <div className={`h-1.5 w-full rounded-full ${barBg} mb-1.5`}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: count > 0 ? `${Math.min(count * 10, 100)}%` : '0%' }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                    className={`h-1.5 rounded-full ${bar}`}
                  />
                </div>
                <span className={`text-xs font-medium ${iconColor}`}>
                  {count > 0 ? `${count} registrado${count !== 1 ? 's' : ''}` : 'Sin registros aún'}
                </span>
              </div>
            </motion.button>
          )
        })}
      </div>

      {/* ── Padrón general: niños ya existentes en la base de datos ── */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <Users size={13} className="text-gray-400" />
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
              Niños registrados en el sistema{totalChildren !== null ? ` · ${totalChildren}` : ''}
            </p>
          </div>
          {showAllChildren && (
            <button
              onClick={() => setShowAllChildren(false)}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
            >
              Ocultar
            </button>
          )}
        </div>

        {!showAllChildren ? (
          <button
            onClick={loadAllChildren}
            disabled={loadingAllChildren}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-gray-600 bg-white border-2 border-gray-200 rounded-2xl hover:bg-gray-50 transition-colors"
          >
            <Users size={15} />
            {loadingAllChildren ? 'Cargando…' : `Ver padrón completo${totalChildren !== null ? ` (${totalChildren})` : ''}`}
          </button>
        ) : (
          <div className="space-y-2.5">
            {allChildren.length === 0 ? (
              <p className="text-center text-gray-400 py-6 text-sm bg-white rounded-2xl border border-gray-200">
                No hay niños registrados todavía.
              </p>
            ) : (
              allChildren.map((child) => (
                <ChildCard
                  key={child.id}
                  child={child}
                  teamColor={teamColor}
                  isSelected={selectedId === child.id}
                  onSelect={() => setSelectedId(child.id)}
                  onDeselect={() => setSelectedId(null)}
                  onRegistered={handleRegistered}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* ── Registros de hoy ── */}
      {todayRecords.length > 0 && (
        <div className="space-y-2 pt-1">
          {deleteRecordError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{deleteRecordError}</p>
          )}
          <div className="flex items-center gap-2 px-1">
            <LogIn size={13} className="text-gray-400" />
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
              Registrados hoy · {todayRecords.length}
            </p>
          </div>
          <div className="space-y-1.5">
            {todayRecords.map((rec) => {
              const isConfirming = confirmDeleteRecordId === rec.id
              return (
                <motion.div
                  key={rec.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-sm transition-colors ${
                    isConfirming ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm leading-tight truncate">
                      {rec.children.full_name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className={`inline-flex items-center rounded-full border font-semibold text-xs px-2 py-0.5 ${CATEGORY_COLORS[rec.category]}`}>
                        {CATEGORY_LABELS[rec.category]}
                      </span>
                      {rec.badge_number && (
                        <span className="text-xs text-gray-400 font-medium">
                          #{rec.badge_number}
                        </span>
                      )}
                    </div>
                  </div>

                  {isConfirming ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => deleteAttendanceRecord(rec.id)}
                        className="px-2.5 py-1.5 text-xs font-bold text-white bg-red-500 rounded-lg hover:bg-red-600 active:bg-red-700 transition-colors"
                      >
                        Borrar
                      </button>
                      <button
                        onClick={() => setConfirmDeleteRecordId(null)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-400 font-medium">
                          {format(new Date(rec.checked_in_at), 'HH:mm')}
                        </span>
                        {isAdmin && (
                          <button
                            onClick={() => setConfirmDeleteRecordId(rec.id)}
                            className="p-1 text-gray-300 hover:text-red-400 rounded-lg hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                      {rec.checked_out_at ? (
                        <span className="text-xs font-semibold text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                          Salió
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5">
                          Adentro
                        </span>
                      )}
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        </div>
      )}

      </>
      )}

    </div>
    </>
  )
}
