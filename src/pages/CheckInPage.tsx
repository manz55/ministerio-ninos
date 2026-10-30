import { useState, useEffect, useRef, useCallback, useMemo, startTransition } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import { format } from 'date-fns'
import { UserPlus, ChevronLeft, Users } from 'lucide-react'
import { SearchField } from '../components/ui/SearchField'
import { EmptyState } from '../components/ui/EmptyState'
import { supabase } from '../lib/supabase'
import { onSynced, readCache, writeCache, pruneDatedCache } from '../lib/offline'
import { useAuth } from '../lib/auth'
import { getEffectiveCategory } from '../lib/categoryUtils'
import { EMPTY_STAFF, fetchStaff, saveStaff, subscribeStaff, type Staff, type StaffRole } from '../lib/dailyStaff'
import { createChildSearcher, searchChildrenSplit } from '../lib/fuzzySearch'
import { CATEGORY_LABELS, type Category, type TeamColor, type ParentRow } from '../types/domain'
import { NewFamilyStep } from '../components/checkin/NewFamilyStep'
import { useDebounce } from '../hooks/useDebounce'
import { useMediaQuery, DESKTOP_QUERY } from '../hooks/useMediaQuery'
import { LogoShapes } from '../components/ui/LogoShapes'
import { AnimatedNumber, SkeletonRow } from '../components/motion'
import { listVariants } from '../components/motion/presets'
import {
  CHILD_SELECT, today, getStoredTeamForToday, persistTeam, groupOf, isInToday, todayBadgeOf,
  withPendingRecords, buildRoster,
  type ChildResult, type TodayRecord, type RosterChild, type TodayAtt,
} from './checkin/shared'
import { ChildRow } from './checkin/ChildRow'
import { CheckInSheet } from './checkin/CheckInSheet'
import { TodayBoard } from './checkin/TodayBoard'
import { DayCard } from './checkin/DayCard'
import { GroupTiles } from './checkin/GroupTiles'
import { BirthdayCard } from './checkin/BirthdayCard'
import { TeamPicker } from './checkin/TeamPicker'

export default function CheckInPage() {
  const { isAdmin, session } = useAuth()
  const desktop = useMediaQuery(DESKTOP_QUERY)
  const [activeCategory, setActiveCategory] = useState<Category | null>(null)
  const [todayCounts, setTodayCounts] = useState<Partial<Record<Category, number>>>({})
  const [totalToday, setTotalToday] = useState(0)
  const [todayRecords, setTodayRecords] = useState<TodayRecord[]>([])
  const [filter, setFilter] = useState('')
  /** Niño cuyo panel (registrar / corregir) está abierto. */
  const [openChildId, setOpenChildId] = useState<string | null>(null)
  const [teamColor, setTeamColor] = useState<TeamColor>(getStoredTeamForToday() ?? 'rojo')
  const [teamConfirmed, setTeamConfirmed] = useState(() => getStoredTeamForToday() !== null)
  const [staff, setStaff] = useState<Staff>(EMPTY_STAFF)
  const [searchParams, setSearchParams] = useSearchParams()
  const [showNewFamily, setShowNewFamily] = useState(() => searchParams.get('nueva') !== null)

  // ── Búsqueda global ──
  const [globalSearch, setGlobalSearch] = useState('')
  const debouncedGlobal = useDebounce(globalSearch.trim(), 220)

  // ── Padrón general (niños ya existentes en la base de datos) ──
  const [allChildren, setAllChildren] = useState<ChildResult[]>([])
  const [loadingAllChildren, setLoadingAllChildren] = useState(false)
  const [showAllChildren, setShowAllChildren] = useState(false)

  // ─── Datos ─────────────────────────────────────────────────────────────────

  const countsShownFromCache = useRef(false)
  const fetchCounts = useCallback(async () => {
    const cacheKey = `today_records:${today}`
    const apply = async (rows: TodayRecord[]) => {
      // Más los check-ins hechos sin internet que todavía no suben.
      const records = await withPendingRecords(rows)
      const counts: Partial<Record<Category, number>> = {}
      for (const row of records) counts[row.category] = (counts[row.category] ?? 0) + 1
      setTodayCounts(counts)
      setTotalToday(records.length)
      setTodayRecords(records)
    }
    // La primera vez se pinta al instante lo último que se vio hoy en este
    // dispositivo, sin esperar a la red.
    const cached = readCache<TodayRecord[]>(cacheKey)
    if (!countsShownFromCache.current && cached) {
      countsShownFromCache.current = true
      await apply(cached)
    }
    const { data, error } = await supabase
      .from('attendance')
      .select('id, child_id, category, badge_number, pager_number, checked_in_at, children(full_name, allergies, medical_notes, toilet_trained, comments)')
      .eq('session_date', today)
      .is('deleted_at', null)
      .order('checked_in_at', { ascending: false })
    if (error) console.error('fetchCounts failed:', error)
    let rows = data as unknown as TodayRecord[] | null
    if (rows?.length) {
      // "Primera vez": no tiene registros de domingos anteriores.
      const { data: before } = await supabase.from('attendance').select('child_id')
        .in('child_id', rows.map((r) => r.child_id)).lt('session_date', today).is('deleted_at', null)
      if (before) {
        const returning = new Set(before.map((b) => b.child_id))
        rows = rows.map((r) => ({ ...r, first_time: !returning.has(r.child_id) }))
      }
    }
    if (rows) writeCache(cacheKey, rows)
    await apply(rows ?? cached ?? [])
  }, [])

  useEffect(() => { pruneDatedCache(today); fetchCounts() }, [fetchCounts])

  // `today` se calcula una sola vez al cargar — si la tablet/celular dejó la
  // app abierta desde el domingo pasado (o desde anoche), todo seguía
  // escribiendo y leyendo en la fecha vieja. Al cambiar de día se recarga.
  useEffect(() => {
    const checkDay = () => {
      if (format(new Date(), 'yyyy-MM-dd') !== today) window.location.reload()
    }
    const interval = setInterval(checkDay, 60_000)
    document.addEventListener('visibilitychange', checkDay)
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', checkDay) }
  }, [])

  // Carga el padrón completo una sola vez: alimenta la búsqueda difusa (más
  // rápida en el navegador que una consulta por tecla, y sí ignora tildes).
  // Con internet lento, la primera vez se pinta de inmediato la última copia
  // guardada en este dispositivo y luego se reemplaza con la del servidor.
  const rosterShownFromCache = useRef(false)
  const rosterLoaded = useRef(false)
  const fetchRoster = useCallback(async () => {
    // Solo la primera carga muestra siluetas; los refrescos posteriores van
    // por detrás sin vaciar la lista ni cerrar el panel abierto.
    if (!rosterLoaded.current) setLoadingAllChildren(true)
    const attKey = `today_att:${today}`
    const cachedRoster = readCache<RosterChild[]>('roster')
    const cachedAtt = readCache<TodayAtt[]>(attKey) ?? []
    if (!rosterShownFromCache.current && cachedRoster) {
      rosterShownFromCache.current = true
      setAllChildren(await buildRoster(cachedRoster, cachedAtt))
      rosterLoaded.current = true
      setLoadingAllChildren(false)
    }
    const [{ data: fetchedAll }, { data: fetchedTodayAtt }] = await Promise.all([
      supabase.from('children').select(CHILD_SELECT).is('deleted_at', null).order('full_name'),
      supabase.from('attendance').select('child_id, badge_number').eq('session_date', today).is('deleted_at', null),
    ])
    // Sin internet se usa la última copia guardada. Una lista vacía tampoco
    // la pisa: pasa cuando el token venció y la consulta salió como anónima
    // (RLS devuelve [] sin error).
    const all = (fetchedAll as RosterChild[] | null)?.length ? (fetchedAll as RosterChild[]) : cachedRoster ?? []
    if (fetchedAll?.length) writeCache('roster', fetchedAll)
    const todayAtt = fetchedTodayAtt ?? cachedAtt
    if (fetchedTodayAtt) writeCache(attKey, fetchedTodayAtt)
    setAllChildren(await buildRoster(all, todayAtt))
    rosterLoaded.current = true
    setLoadingAllChildren(false)
  }, [])

  useEffect(() => { fetchRoster() }, [fetchRoster])

  // Cuando la cola sin conexión termina de subir, se recargan las listas
  // para cambiar las copias locales por los registros reales.
  useEffect(() => onSynced(() => { fetchRoster(); fetchCounts() }), [fetchRoster, fetchCounts])

  // Auto-refresco: después de cualquier acción se vuelve a pedir todo por
  // detrás, agrupando varias acciones seguidas en una sola consulta.
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current)
    refreshTimer.current = setTimeout(() => { fetchRoster(); fetchCounts() }, 600)
  }, [fetchRoster, fetchCounts])
  useEffect(() => () => { if (refreshTimer.current) clearTimeout(refreshTimer.current) }, [])

  // Tiempo real: check-ins de cualquier dispositivo, cambios a niños (desde
  // Familias u otro maestro), y los encargados del día.
  useEffect(() => {
    const attendance = supabase
      .channel('attendance-today-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance', filter: `session_date=eq.${today}` }, (payload) => {
        fetchCounts()
        if (payload.eventType === 'INSERT') {
          const { child_id: childId, badge_number: badgeNumber } = payload.new as { child_id: string; badge_number: number | null }
          setAllChildren((prev) => prev.map((c) =>
            c.id === childId && !isInToday(c) ? { ...c, attendance: [...c.attendance, { session_date: today, badge_number: badgeNumber }] } : c))
        } else if (
          payload.eventType === 'DELETE' ||
          // "Borrar" es un soft-delete (UPDATE de deleted_at), no un DELETE.
          (payload.eventType === 'UPDATE' && (payload.new as { deleted_at: string | null }).deleted_at)
        ) {
          const childId = ((payload.eventType === 'DELETE' ? payload.old : payload.new) as { child_id: string }).child_id
          setAllChildren((prev) => prev.map((c) => c.id === childId ? { ...c, attendance: c.attendance.filter((a) => a.session_date !== today) } : c))
        } else {
          scheduleRefresh()
        }
      })
      .subscribe()
    const children = supabase
      .channel('children-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'children' }, () => scheduleRefresh())
      .subscribe()
    const unsubscribeStaff = subscribeStaff(today, (role, name) => setStaff((prev) => ({ ...prev, [role]: name })))
    return () => { [attendance, children].forEach((ch) => supabase.removeChannel(ch)); unsubscribeStaff() }
  }, [fetchCounts, scheduleRefresh])

  useEffect(() => { fetchStaff(today).then(setStaff) }, [])

  // ─── Derivados ─────────────────────────────────────────────────────────────

  const globalSearcher = useMemo(() => createChildSearcher(allChildren), [allChildren])
  const globalResults = useMemo(
    () => {
      if (debouncedGlobal.length < 2) return { exact: [] as ChildResult[], suggestions: [] as ChildResult[] }
      const { exact, suggestions } = searchChildrenSplit(globalSearcher, debouncedGlobal)
      return { exact: exact.slice(0, 20), suggestions: suggestions.slice(0, 8) }
    },
    [debouncedGlobal, globalSearcher]
  )

  const totalsByCategory = useMemo(() => {
    const t: Partial<Record<Category, number>> = {}
    for (const c of allChildren) { const cat = getEffectiveCategory(c); if (cat) t[cat] = (t[cat] ?? 0) + 1 }
    return t
  }, [allChildren])

  // Los ya registrados hoy flotan arriba (ordenados por gafete: "1, 2, 3…"),
  // luego el resto en orden alfabético.
  const groupChildren = useMemo(() => {
    if (!activeCategory) return []
    return allChildren
      .filter((c) => getEffectiveCategory(c) === activeCategory)
      .sort((a, b) => {
        const aIn = isInToday(a), bIn = isInToday(b)
        if (aIn !== bIn) return aIn ? -1 : 1
        if (aIn && bIn) {
          const d = (todayBadgeOf(a) ?? Infinity) - (todayBadgeOf(b) ?? Infinity)
          if (d !== 0) return d
        }
        return a.full_name.localeCompare(b.full_name)
      })
  }, [allChildren, activeCategory])

  const groupSearcher = useMemo(() => createChildSearcher(groupChildren), [groupChildren])
  const filteredGroup = useMemo(
    () => (filter.trim() ? searchChildrenSplit(groupSearcher, filter) : { exact: groupChildren, suggestions: [] }),
    [filter, groupChildren, groupSearcher]
  )
  const registeredInGroup = useMemo(() => groupChildren.filter(isInToday).length, [groupChildren])

  const recordByChild = useMemo(() => new Map(todayRecords.map((r) => [r.child_id, r])), [todayRecords])

  const openChild = useMemo<ChildResult | null>(() => {
    if (!openChildId) return null
    const found = allChildren.find((c) => c.id === openChildId)
    if (found) return found
    // Abierto desde "Registrados hoy" antes de que cargue el padrón.
    const rec = recordByChild.get(openChildId)
    if (!rec) return null
    return {
      id: rec.child_id, full_name: rec.children.full_name, birth_date: null, category: rec.category,
      allergies: rec.children.allergies, medical_notes: rec.children.medical_notes, toilet_trained: rec.children.toilet_trained,
      comments: rec.children.comments, guardian_relationship: null, parent_id: null, parents: null,
      attendance: [{ session_date: today, badge_number: rec.badge_number }], partial: true,
    }
  }, [openChildId, allChildren, recordByChild])

  // ─── Acciones ──────────────────────────────────────────────────────────────

  function openCategory(category: Category) {
    startTransition(() => {
      setActiveCategory(category)
      setFilter('')
      setGlobalSearch('')
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleBack() {
    setActiveCategory(null)
    fetchCounts()
  }

  function handleRegistered(childId: string, badgeNumber: number | null) {
    scheduleRefresh()
    setAllChildren((prev) => prev.map((c) =>
      c.id === childId ? { ...c, attendance: [...c.attendance, { session_date: today, badge_number: badgeNumber }] } : c))
    setOpenChildId(null)
    // Limpia la búsqueda para escribir de una vez el nombre del siguiente.
    setGlobalSearch('')
    setFilter('')
    const child = allChildren.find((c) => c.id === childId)
    const cat = child ? getEffectiveCategory(child) : activeCategory
    if (cat) {
      setTodayCounts((prev) => ({ ...prev, [cat]: (prev[cat] ?? 0) + 1 }))
      setTotalToday((n) => n + 1)
    }
  }

  function handleChildEdited(childId: string, patch: Partial<ChildResult>) {
    setAllChildren((prev) => prev.map((c) => (c.id === childId ? { ...c, ...patch } : c)))
    scheduleRefresh()
  }

  function handleChildDeleted(childId: string) {
    setAllChildren((prev) => prev.filter((c) => c.id !== childId))
    scheduleRefresh()
  }

  function handleFamilySaved(parent: ParentRow) {
    setShowNewFamily(false)
    if (searchParams.get('nueva') !== null) setSearchParams({})
    // Los niños nuevos entran a la lista de inmediato (sin esperar a la red,
    // que puede tardar o no estar), y el padrón se refresca por detrás.
    const added: ChildResult[] = parent.children.map((c) => ({
      id: c.id, full_name: c.full_name, birth_date: c.birth_date, category: c.category,
      allergies: c.allergies, medical_notes: c.medical_notes, toilet_trained: c.toilet_trained, comments: c.comments,
      guardian_relationship: c.guardian_relationship, parent_id: parent.id,
      parents: { full_name: parent.full_name, phone: parent.phone ?? '' }, attendance: [],
    }))
    setAllChildren((prev) => [...prev.filter((c) => !added.some((a) => a.id === c.id)), ...added].sort((a, b) => a.full_name.localeCompare(b.full_name)))
    fetchRoster()
    // Domingo en la mañana no hay tiempo de buscar de nuevo al niño: el
    // primero de la familia recién guardada queda abierto, listo para el gafete.
    const firstChild = parent.children[0]
    if (firstChild?.category) {
      openCategory(firstChild.category)
      setOpenChildId(firstChild.id)
    }
  }

  function confirmTeam(color: TeamColor, names: Staff) {
    setTeamColor(color)
    setTeamConfirmed(true)
    persistTeam(color)
    // Solo se escribe si es nuevo/cambió.
    for (const role of Object.keys(names) as StaffRole[]) {
      if (names[role] && names[role] !== staff[role]) updateStaff(role, names[role])
    }
  }

  async function updateStaff(role: StaffRole, name: string): Promise<string | null> {
    const err = await saveStaff(role, today, name)
    if (!err) setStaff((prev) => ({ ...prev, [role]: name }))
    return err
  }

  // Quitar / corregir un registro de hoy. Devuelven el mensaje de error, o
  // null si salió bien.
  async function removeAttendance(id: string): Promise<string | null> {
    const rec = todayRecords.find((r) => r.id === id)
    const { data: { session: s } } = await supabase.auth.getSession()
    // Marcar (no borrar): queda en la papelera (Usuarios). .select() hace
    // que PostgREST diga qué filas marcó — un update bloqueado por RLS no
    // da error y parecería borrado cuando no lo está.
    const { data, error } = await supabase.from('attendance')
      .update({ deleted_at: new Date().toISOString(), deleted_by: s?.user.id })
      .eq('id', id).select('id')
    if (error || !data || data.length === 0) return 'No se pudo quitar el registro. Revisa la conexión e intenta de nuevo.'
    setTodayRecords((prev) => prev.filter((r) => r.id !== id))
    if (rec) {
      setAllChildren((prev) => prev.map((c) => c.id === rec.child_id ? { ...c, attendance: c.attendance.filter((a) => a.session_date !== today) } : c))
      setTodayCounts((prev) => ({ ...prev, [rec.category]: Math.max(0, (prev[rec.category] ?? 0) - 1) }))
      setTotalToday((n) => Math.max(0, n - 1))
    }
    scheduleRefresh()
    return null
  }

  async function editAttendanceNumbers(id: string, badge: number | null, pager: number | null): Promise<string | null> {
    const rec = todayRecords.find((r) => r.id === id)
    const { data, error } = await supabase.from('attendance').update({ badge_number: badge, pager_number: pager }).eq('id', id).select('id')
    if (error || !data || data.length === 0) {
      const cat = rec ? ` en ${CATEGORY_LABELS[rec.category]}` : ''
      if (error?.code === '23505' && error.message.includes('attendance_badge_category_unique')) return `El gafete #${badge} ya lo tiene otro niño hoy${cat}.`
      if (error?.code === '23505' && error.message.includes('attendance_pager_category_unique')) return `El bíper #${pager} ya lo tiene otro niño hoy${cat}.`
      return 'No se pudo guardar. Revisa la conexión e intenta de nuevo.'
    }
    setTodayRecords((prev) => prev.map((r) => (r.id === id ? { ...r, badge_number: badge, pager_number: pager } : r)))
    if (rec) {
      setAllChildren((prev) => prev.map((c) => c.id === rec.child_id
        ? { ...c, attendance: c.attendance.map((a) => (a.session_date === today ? { ...a, badge_number: badge } : a)) }
        : c))
    }
    scheduleRefresh()
    return null
  }

  const isSearching = debouncedGlobal.length >= 2
  // Mientras el debounce alcanza lo escrito, unos puntitos (como "escribiendo…").
  const isTyping = globalSearch.trim().length >= 2 && globalSearch.trim() !== debouncedGlobal

  // ─── Pantallas previas ─────────────────────────────────────────────────────

  if (!teamConfirmed) {
    return <TeamPicker onConfirm={confirmTeam} initialStaff={staff} />
  }

  if (showNewFamily) {
    return (
      <NewFamilyStep
        existingChildren={allChildren}
        onSaved={handleFamilySaved}
        onCancel={() => { setShowNewFamily(false); if (searchParams.get('nueva') !== null) setSearchParams({}) }}
      />
    )
  }

  // ─── Piezas ────────────────────────────────────────────────────────────────

  const newFamilyButton = session && (
    <button
      onClick={() => setShowNewFamily(true)}
      className="w-full flex items-center justify-center gap-2 py-3.5 text-sm font-semibold text-indigo-700 border-2 border-dashed border-indigo-200 rounded-2xl hover:bg-indigo-50 hover:border-indigo-300 transition-colors"
    >
      <UserPlus size={16} /> ¿Primera vez? Registrar familia nueva
    </button>
  )

  const board = (
    <TodayBoard
      records={todayRecords}
      onOpen={setOpenChildId}
      onlyCategory={activeCategory}
      defaultOpen={desktop}
    />
  )

  function resultList(list: ChildResult[], showGroup: boolean) {
    return (
      <motion.div variants={listVariants} initial="hidden" animate="show" className="grid grid-cols-1 xl:grid-cols-2 gap-2">
        {list.map((child, i) => <ChildRow key={child.id} child={child} onOpen={setOpenChildId} showGroup={showGroup} index={i} />)}
      </motion.div>
    )
  }

  // ── Vista de un grupo ──
  const groupView = activeCategory && (() => {
    const g = groupOf(activeCategory)
    const Icon = g.icon
    const pct = groupChildren.length ? Math.round((registeredInGroup / groupChildren.length) * 100) : 0
    return (
      <div className="space-y-3.5">
        <div
          className="sticky z-10 rounded-3xl bg-white/90 backdrop-blur-xl border border-gray-200/70 shadow-sm px-3 py-3 flex items-center gap-3"
          style={{ top: 'calc(var(--app-header-h, calc(4.5rem + env(safe-area-inset-top))) + 0.5rem)' }}
        >
          <motion.button
            onClick={handleBack}
            whileTap={{ scale: 0.9 }}
            className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 active:bg-gray-200 transition-colors"
            aria-label="Volver a los grupos"
          >
            <ChevronLeft size={22} />
          </motion.button>
          <motion.span layoutId={`group-icon-${activeCategory}`} className={`rounded-xl ${g.iconBg} flex items-center justify-center w-11 h-11 shrink-0`}>
            <Icon className={`w-5 h-5 ${g.iconColor}`} />
          </motion.span>
          <div className="flex-1 min-w-0">
            <motion.h1 layoutId={`group-title-${activeCategory}`} className={`w-fit font-display text-xl font-semibold leading-tight ${g.text}`}>
              {CATEGORY_LABELS[activeCategory]}
            </motion.h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`flex-1 h-1.5 rounded-full ${g.barBg} overflow-hidden max-w-48`}>
                <motion.span className={`block h-full rounded-full ${g.bar}`} initial={false} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} />
              </span>
              <span className="text-xs font-semibold text-gray-500 tabular-nums shrink-0">
                <AnimatedNumber value={registeredInGroup} /> de {groupChildren.length}
              </span>
            </div>
          </div>
        </div>

        <SearchField
          value={filter}
          onChange={setFilter}
          placeholder={`Buscar en ${CATEGORY_LABELS[activeCategory]}…`}
          autoFocus={desktop}
          onEnter={() => { const first = filteredGroup.exact[0] ?? filteredGroup.suggestions[0]; if (first) setOpenChildId(first.id) }}
        />

        {loadingAllChildren && allChildren.length === 0 ? (
          <div className="space-y-2">{[0, 1, 2, 3].map((i) => <SkeletonRow key={i} />)}</div>
        ) : filteredGroup.exact.length === 0 && filteredGroup.suggestions.length === 0 ? (
          <EmptyState
            text={filter ? `Nadie se llama "${filter}" en ${CATEGORY_LABELS[activeCategory]}.` : 'Todavía no hay niños en este grupo.'}
            action={session ? () => setShowNewFamily(true) : undefined}
          />
        ) : (
          <>
            {filteredGroup.exact.length > 0 && resultList(filteredGroup.exact, false)}
            {filteredGroup.suggestions.length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">¿Quisiste decir…?</p>
                {resultList(filteredGroup.suggestions, false)}
              </div>
            )}
            {newFamilyButton}
          </>
        )}
      </div>
    )
  })()

  // ── Inicio ──
  const homeView = (
    <div className="space-y-4">
      <DayCard
        totalToday={totalToday}
        teamColor={teamColor}
        onChangeTeam={() => setTeamConfirmed(false)}
        staff={staff}
        onSaveStaff={updateStaff}
      />

      <SearchField
        value={globalSearch}
        onChange={setGlobalSearch}
        placeholder="Buscar niño por nombre…"
        typing={isTyping}
        large
        onEnter={() => { const first = globalResults.exact[0] ?? globalResults.suggestions[0]; if (first) setOpenChildId(first.id) }}
      />

      <AnimatePresence mode="wait" initial={false}>
        {isSearching ? (
          <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: isTyping ? 0.55 : 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="space-y-2.5">
            {loadingAllChildren && allChildren.length === 0 ? (
              <div className="space-y-2">{[0, 1, 2].map((i) => <SkeletonRow key={i} />)}</div>
            ) : globalResults.exact.length === 0 && globalResults.suggestions.length === 0 ? (
              <EmptyState text={`Nadie se llama "${debouncedGlobal}" todavía.`} action={session ? () => setShowNewFamily(true) : undefined} />
            ) : (
              <>
                {globalResults.exact.length > 0 && resultList(globalResults.exact, true)}
                {globalResults.suggestions.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">¿Quisiste decir…?</p>
                    {resultList(globalResults.suggestions, true)}
                  </div>
                )}
                {newFamilyButton}
              </>
            )}
          </motion.div>
        ) : (
          <motion.div key="groups" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="space-y-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">O entra a un grupo</p>
            <GroupTiles counts={todayCounts} totals={totalsByCategory} onOpen={openCategory} wide={!desktop} />

            <BirthdayCard kids={allChildren} onOpen={setOpenChildId} />

            <div className="lg:hidden">{board}</div>

            <div className="space-y-2.5">
              <button
                onClick={() => setShowAllChildren((v) => !v)}
                className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold text-gray-700 bg-white/80 border border-gray-200 rounded-2xl hover:bg-white transition-colors"
              >
                <Users size={16} />
                {showAllChildren ? 'Ocultar lista completa' : `Ver lista completa${allChildren.length ? ` (${allChildren.length} niños)` : ''}`}
              </button>
              {showAllChildren && (allChildren.length === 0
                ? <p className="text-center text-gray-500 py-6 text-sm">No hay niños registrados todavía.</p>
                : resultList(allChildren, true))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )

  const g = activeCategory ? groupOf(activeCategory) : null

  return (
    <LayoutGroup>
      {/* Fondo: crema con las formas del logo; en un grupo, teñido de su color. */}
      <div className="fixed inset-0 z-[1] pointer-events-none bg-canvas">
        <AnimatePresence>
          {g && (
            <motion.div
              key={activeCategory}
              className={`absolute inset-x-0 top-0 h-[70vh] bg-gradient-to-b ${g.wash} to-transparent`}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}
            />
          )}
        </AnimatePresence>
        <LogoShapes opacity={0.11} />
      </div>

      <div className="relative z-[2] lg:grid lg:grid-cols-[minmax(0,1fr)_23rem] xl:grid-cols-[minmax(0,1fr)_26rem] lg:gap-6 lg:items-start">
        <motion.div key={activeCategory ?? 'home'} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }} className="min-w-0">
          {groupView || homeView}
        </motion.div>
        <aside
          className="hidden lg:block sticky overflow-y-auto overscroll-contain rounded-3xl"
          style={{
            top: 'calc(var(--app-header-h, 4.5rem) + 1rem)',
            maxHeight: 'calc(100dvh - var(--app-header-h, 4.5rem) - 9rem)',
          }}
        >
          {board}
        </aside>
      </div>

      <CheckInSheet
        child={openChild}
        todayRecord={openChildId ? recordByChild.get(openChildId) : undefined}
        teamColor={teamColor}
        isAdmin={isAdmin}
        onClose={() => setOpenChildId(null)}
        onRegistered={handleRegistered}
        onEdited={handleChildEdited}
        onDeleted={handleChildDeleted}
        onEditAttendance={editAttendanceNumbers}
        onRemoveAttendance={removeAttendance}
      />
    </LayoutGroup>
  )
}
