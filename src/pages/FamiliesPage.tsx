import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSearchParams, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, Phone, UserPlus, Users, AlertTriangle } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { getAgeLabel, getEffectiveCategory } from '../lib/categoryUtils'
import { markRequestResolved } from '../lib/coordinatorRequests'
import { createChildSearcher, searchChildrenSplit, findBySurname, normalizeName } from '../lib/fuzzySearch'
import { useDebounce } from '../hooks/useDebounce'
import { NewFamilyStep } from '../components/checkin/NewFamilyStep'
import { CATEGORY_LABELS, CATEGORY_COLORS, type ParentRow, type ChildPrefill } from '../types/domain'
import { itemVariants } from '../components/motion/presets'
import { SkeletonRow } from '../components/motion'
import { PageHeader, BTN_PRIMARY } from '../components/ui/PageHeader'
import { SearchField } from '../components/ui/SearchField'
import { Segmented, FilterChips } from '../components/ui/Segmented'
import { EmptyState } from '../components/ui/EmptyState'
import { groupOf, initials } from './checkin/shared'
import { FamilyView } from './families/FamilyView'
import { ChildSheet } from './families/ChildSheet'
import { fetchAllFamilies, fetchFamily, fetchRoster, type FamilyDetail, type RosterChild } from './families/data'

type Tab = 'familias' | 'ninos'
type RosterFilter = 'todos' | 'sin_responsable' | 'sin_categoria' | 'sin_fecha_nacimiento'

export default function FamiliesPage() {
  const location = useLocation()
  const { session } = useAuth()
  // Llegando desde un mensaje de un maestro: esa solicitud se marca como
  // resuelta solo cuando de verdad se agrega al niño (aquí o con "Nueva
  // familia"). Ref para que solo dispare una vez por visita.
  const armedRequestId = useRef((location.state as { requestId?: string } | null)?.requestId ?? null)
  const [resolveWarning, setResolveWarning] = useState(false)
  const resolveArmedRequest = useCallback(async () => {
    const id = armedRequestId.current
    if (!id) return
    armedRequestId.current = null
    const ok = await markRequestResolved(id, session?.user.id ?? null)
    if (!ok) setResolveWarning(true)
  }, [session])
  const mensajesPrefill = (location.state as { prefill?: ChildPrefill } | null)?.prefill

  const [searchParams, setSearchParams] = useSearchParams()
  const rosterParam = searchParams.get('roster') as RosterFilter | null
  const [tab, setTab] = useState<Tab>(rosterParam ? 'ninos' : 'familias')
  const [query, setQuery] = useState(() => searchParams.get('buscar') ?? '')
  const debouncedQuery = useDebounce(query.trim(), 250)
  const searched = debouncedQuery.length >= 2

  const [allFamilies, setAllFamilies] = useState<FamilyDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<FamilyDetail | null>(null)
  const [childPrefillForSelected, setChildPrefillForSelected] = useState<ChildPrefill | null>(null)
  const [showNewFamily, setShowNewFamily] = useState(false)

  const loadAll = useCallback(async () => {
    const data = await fetchAllFamilies()
    setAllFamilies(data)
    setLoading(false)
  }, [])
  useEffect(() => { loadAll() }, [loadAll])

  // Buscar por niño, responsable o teléfono — con el mismo buscador
  // tolerante a tildes y errores que usa Registro.
  const searchIndex = useMemo(() => allFamilies.flatMap((f): { full_name: string; parents: { full_name: string } | null; familyId: string }[] =>
    f.children.length > 0
      ? f.children.map((c) => ({ full_name: c.full_name, parents: { full_name: f.full_name }, familyId: f.id }))
      : [{ full_name: f.full_name, parents: null, familyId: f.id }]
  ), [allFamilies])
  const searcher = useMemo(() => createChildSearcher(searchIndex), [searchIndex])

  const results = useMemo(() => {
    if (!searched) return allFamilies
    const { exact, suggestions } = searchChildrenSplit(searcher, debouncedQuery)
    const ids = new Set([...exact, ...suggestions].map((c) => c.familyId))
    const digits = debouncedQuery.replace(/\D/g, '')
    if (digits.length >= 3) for (const f of allFamilies) if (f.phone?.replace(/\D/g, '').includes(digits)) ids.add(f.id)
    return allFamilies.filter((f) => ids.has(f.id))
  }, [searched, debouncedQuery, searcher, allFamilies])

  // Un niño que nunca se ha registrado pero cuyos hermanos sí: su apellido
  // coincide con otra familia. Se sugiere agregarlo ahí en vez de duplicar.
  const sameSurname = useMemo(() => {
    if (!searched) return []
    const resultIds = new Set(results.map((f) => f.id))
    const byFamily = new Map<string, { familyId: string; parentName: string; children: string[] }>()
    for (const { item } of findBySurname(searchIndex, debouncedQuery)) {
      if (resultIds.has(item.familyId)) continue
      const entry = byFamily.get(item.familyId) ?? { familyId: item.familyId, parentName: item.parents?.full_name ?? '', children: [] }
      entry.children.push(item.full_name)
      byFamily.set(item.familyId, entry)
    }
    return [...byFamily.values()].slice(0, 3)
  }, [searched, debouncedQuery, searchIndex, results])

  function openFamilyWithPrefill(familyId: string, prefill: ChildPrefill | null) {
    const family = allFamilies.find((f) => f.id === familyId)
    if (!family) return
    setChildPrefillForSelected(prefill)
    setSelected(family)
    setTab('familias')
    if (searchParams.get('roster')) setSearchParams({})
  }

  async function refreshSelected() {
    if (!selected) return
    const updated = await fetchFamily(selected.id)
    if (updated) {
      setSelected(updated)
      setAllFamilies((prev) => prev.map((f) => (f.id === updated.id ? updated : f)))
    }
  }

  async function handleNewFamilySaved(parent: ParentRow) {
    setShowNewFamily(false)
    const family = await fetchFamily(parent.id)
    if (family) {
      setSelected(family)
      setAllFamilies((prev) => [...prev, family].sort((a, b) => a.full_name.localeCompare(b.full_name)))
    } else {
      loadAll()
    }
    resolveArmedRequest()
  }

  // ── Pantallas completas ──
  if (showNewFamily) {
    const existingChildren = allFamilies.flatMap((f) => f.children.map((c) => ({ id: c.id, full_name: c.full_name, parents: { id: f.id, full_name: f.full_name } })))
    return (
      <NewFamilyStep
        existingChildren={existingChildren}
        onLinkToFamily={(parentId, prefill) => { setShowNewFamily(false); openFamilyWithPrefill(parentId, prefill) }}
        onSaved={handleNewFamilySaved}
        onCancel={() => setShowNewFamily(false)}
      />
    )
  }

  if (selected) {
    return (
      <FamilyView
        key={selected.id}
        family={selected}
        onBack={() => { setSelected(null); setChildPrefillForSelected(null) }}
        onRefresh={refreshSelected}
        onDeleted={() => { const id = selected.id; setSelected(null); setAllFamilies((prev) => prev.filter((f) => f.id !== id)) }}
        onChildAdded={resolveArmedRequest}
        initialChildPrefill={childPrefillForSelected}
      />
    )
  }

  const totalChildren = allFamilies.reduce((s, f) => s + f.children.length, 0)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Familias"
        subtitle={loading ? 'Cargando…' : `${allFamilies.length} familias · ${totalChildren} niños`}
        actions={
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowNewFamily(true)} className={BTN_PRIMARY}>
            <UserPlus size={17} /> Nueva familia
          </motion.button>
        }
      />

      {resolveWarning && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
          La familia se guardó bien, pero no se pudo marcar el mensaje como resuelto (probablemente por la conexión). Avísale al dueño para que lo marque a mano.
        </p>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Segmented
          value={tab}
          onChange={(t) => { setTab(t); if (searchParams.get('roster')) setSearchParams({}) }}
          options={[{ value: 'familias', label: 'Familias', count: allFamilies.length }, { value: 'ninos', label: 'Niños', count: totalChildren }]}
        />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {tab === 'familias' ? (
          <motion.div key="familias" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.2 }} className="space-y-4">
            <SearchField value={query} onChange={setQuery} placeholder="Buscar por niño, responsable o teléfono…" large
              onEnter={() => { if (results[0]) setSelected(results[0]) }} />

            {sameSurname.length > 0 && (
              <SameSurnameCard
                items={sameSurname}
                onAdd={(familyId) => {
                  const prefill: ChildPrefill = mensajesPrefill && normalizeName(mensajesPrefill.full_name) === normalizeName(debouncedQuery)
                    ? mensajesPrefill
                    : { full_name: query.trim() }
                  openFamilyWithPrefill(familyId, prefill)
                }}
              />
            )}

            {loading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2">{[0, 1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} />)}</div>
            ) : results.length === 0 ? (
              <EmptyState text={searched ? `Nadie con "${debouncedQuery}".` : 'Todavía no hay familias.'} action={() => setShowNewFamily(true)} />
            ) : (
              <motion.div key={debouncedQuery} initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2 items-start">
                {results.map((f, i) => <FamilyRow key={f.id} family={f} index={i} onOpen={() => setSelected(f)} />)}
              </motion.div>
            )}
          </motion.div>
        ) : (
          <motion.div key="ninos" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>
            <ChildrenTab initialFilter={rosterParam ?? 'todos'} onAddToFamily={(familyId, name) => openFamilyWithPrefill(familyId, { full_name: name })} onChanged={loadAll} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Fila de familia ──────────────────────────────────────────────────────────

function FamilyRow({ family, index, onOpen }: { family: FamilyDetail; index: number; onOpen: () => void }) {
  const anyAlert = family.children.some((c) => c.allergies || c.medical_notes)
  return (
    <motion.button
      variants={itemVariants}
      custom={index}
      whileTap={{ scale: 0.985 }}
      onClick={onOpen}
      className="group w-full text-left p-4 bg-white rounded-2xl border border-transparent shadow-sm shadow-gray-900/5 hover:border-indigo-200 hover:shadow-md transition-[border-color,box-shadow]"
    >
      <div className="flex items-start gap-3">
        <span className="w-11 h-11 rounded-full bg-indigo-50 text-indigo-700 font-display font-bold text-base flex items-center justify-center shrink-0">{initials(family.full_name)}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <p className="font-display font-bold text-gray-900 text-lg leading-tight truncate">{family.full_name}</p>
            {anyAlert && <AlertTriangle size={14} className="text-red-500 shrink-0" />}
          </div>
          <p className="flex items-center gap-1.5 text-gray-500 text-sm whitespace-nowrap">
            <Phone size={12} className="shrink-0" />
            <span className="tabular-nums">{family.phone || 'Sin teléfono'}</span>
          </p>
          {family.children.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {family.children.map((c) => {
                const cat = getEffectiveCategory(c)
                return (
                  <span key={c.id} className={`inline-flex items-center gap-1 max-w-full rounded-full border text-xs font-semibold px-2 py-0.5 ${cat ? CATEGORY_COLORS[cat] : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                    <span className="truncate">{c.full_name.split(' ')[0]}</span>
                    <span className="opacity-60 font-medium whitespace-nowrap">· {cat ? CATEGORY_LABELS[cat] : 'Sin grupo'}</span>
                  </span>
                )
              })}
            </div>
          )}
        </div>
        <ChevronRight className="self-center text-gray-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all shrink-0" size={18} />
      </div>
    </motion.button>
  )
}

function SameSurnameCard({ items, onAdd }: { items: { familyId: string; parentName: string; children: string[] }[]; onAdd: (familyId: string) => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl bg-indigo-50 border border-indigo-100 px-4 py-3.5 space-y-2.5">
      <p className="text-sm font-semibold text-indigo-900 flex items-center gap-1.5">
        <Users size={16} className="shrink-0" /> Ya hay familias con este apellido. ¿Es un hermano o hermana nuevo?
      </p>
      {items.map((f) => (
        <div key={f.familyId} className="flex items-center justify-between gap-3 bg-white rounded-2xl px-3.5 py-2.5">
          <p className="text-sm text-gray-700 min-w-0">
            <span className="font-semibold">{f.children.join(', ')}</span>
            {f.parentName && <span className="text-gray-500"> · hijo/a de {f.parentName}</span>}
          </p>
          <button onClick={() => onAdd(f.familyId)} className="shrink-0 text-sm font-semibold text-indigo-700 hover:text-indigo-900">Agregar aquí →</button>
        </div>
      ))}
    </motion.div>
  )
}

// ─── Pestaña "Niños": todos los niños, con filtros para casos incompletos ────

function ChildrenTab({ initialFilter, onAddToFamily, onChanged }: {
  initialFilter: RosterFilter
  onAddToFamily: (familyId: string, childName: string) => void
  onChanged: () => void
}) {
  const [children, setChildren] = useState<RosterChild[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<RosterFilter>(initialFilter)
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const debounced = useDebounce(query.trim(), 250)
  const searched = debounced.length >= 2

  const load = useCallback(async () => {
    setChildren(await fetchRoster())
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const byFilter = useMemo(() => children.filter((c) => {
    if (filter === 'sin_responsable') return !c.parent_id
    if (filter === 'sin_categoria') return getEffectiveCategory(c) === null
    if (filter === 'sin_fecha_nacimiento') return !c.birth_date
    return true
  }), [children, filter])

  const searcher = useMemo(() => createChildSearcher(children), [children])
  const shown = useMemo(() => {
    if (!searched) return byFilter
    const { exact, suggestions } = searchChildrenSplit(searcher, debounced)
    const ids = new Set([...exact, ...suggestions].map((c) => c.id))
    return byFilter.filter((c) => ids.has(c.id))
  }, [searched, debounced, searcher, byFilter])

  const sameSurname = useMemo(() => {
    if (!searched || shown.length > 0) return []
    const byFamily = new Map<string, { familyId: string; parentName: string; children: string[] }>()
    for (const { item } of findBySurname(children, debounced)) {
      if (!item.parents?.id) continue
      const entry = byFamily.get(item.parents.id) ?? { familyId: item.parents.id, parentName: item.parents.full_name, children: [] }
      entry.children.push(item.full_name)
      byFamily.set(item.parents.id, entry)
    }
    return [...byFamily.values()].slice(0, 3)
  }, [searched, shown.length, children, debounced])

  const counts = {
    todos: children.length,
    sin_responsable: children.filter((c) => !c.parent_id).length,
    sin_categoria: children.filter((c) => getEffectiveCategory(c) === null).length,
    sin_fecha_nacimiento: children.filter((c) => !c.birth_date).length,
  }
  const open = children.find((c) => c.id === openId) ?? null

  return (
    <div className="space-y-4">
      <SearchField value={query} onChange={setQuery} placeholder="Buscar niño por nombre…" large onEnter={() => { if (shown[0]) setOpenId(shown[0].id) }} />
      <FilterChips
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'todos', label: 'Todos', count: counts.todos },
          { value: 'sin_responsable', label: 'Sin responsable', count: counts.sin_responsable, tone: 'warn' },
          { value: 'sin_categoria', label: 'Sin grupo', count: counts.sin_categoria, tone: 'warn' },
          { value: 'sin_fecha_nacimiento', label: 'Sin fecha de nacimiento', count: counts.sin_fecha_nacimiento, tone: 'warn' },
        ]}
      />
      {sameSurname.length > 0 && <SameSurnameCard items={sameSurname} onAdd={(id) => onAddToFamily(id, query.trim())} />}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2">{[0, 1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} />)}</div>
      ) : shown.length === 0 ? (
        <EmptyState text={filter === 'todos' ? `Nadie con "${debounced}".` : '¡Nada pendiente aquí!'} />
      ) : (
        <motion.div key={`${filter}-${debounced}`} initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2 items-start">
          {shown.map((c, i) => <RosterRow key={c.id} child={c} index={i} onOpen={() => setOpenId(c.id)} />)}
        </motion.div>
      )}
      <ChildSheet child={open} onClose={() => setOpenId(null)} onChanged={() => { load(); onChanged() }} />
    </div>
  )
}

function RosterRow({ child, index, onOpen }: { child: RosterChild; index: number; onOpen: () => void }) {
  const category = getEffectiveCategory(child)
  const g = groupOf(category)
  const age = getAgeLabel(child.birth_date)
  const hasAlert = !!(child.allergies || child.medical_notes)
  return (
    <motion.button
      variants={itemVariants}
      custom={index}
      whileTap={{ scale: 0.985 }}
      onClick={onOpen}
      className="group w-full text-left flex items-center gap-3 rounded-2xl px-3.5 py-3 bg-white border border-transparent shadow-sm shadow-gray-900/5 hover:border-indigo-200 hover:shadow-md transition-[border-color,box-shadow]"
    >
      <span className={`relative w-11 h-11 rounded-full flex items-center justify-center font-display font-bold shrink-0 ${g.avatar}`}>
        {initials(child.full_name)}
        {hasAlert && <span className="absolute -top-0.5 -right-0.5 w-[18px] h-[18px] rounded-full bg-red-500 ring-2 ring-white text-white text-[10px] font-bold flex items-center justify-center">!</span>}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-display font-bold text-lg leading-tight text-gray-900 truncate">{child.full_name}</span>
        <span className="block text-sm text-gray-500 truncate">
          <span className={`font-semibold ${g.iconColor}`}>{category ? CATEGORY_LABELS[category] : 'Sin grupo'}</span>
          {age !== null && ` · ${age} años`}
          {' · '}
          {child.parents?.full_name ?? <span className="text-amber-700 font-semibold">sin responsable</span>}
        </span>
      </span>
      <ChevronRight size={18} className="text-gray-300 group-hover:text-indigo-500 transition-colors shrink-0" />
    </motion.button>
  )
}

