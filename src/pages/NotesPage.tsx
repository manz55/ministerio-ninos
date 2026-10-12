import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { X, User, Send, Calendar, SlidersHorizontal, Check, NotebookPen } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useDebounce } from '../hooks/useDebounce'
import { TEAM_COLOR_LABELS, type TeamColor } from '../types/domain'
import { Sheet, SkeletonRow } from '../components/motion'
import { PageHeader, BTN_SECONDARY } from '../components/ui/PageHeader'
import { Field, INPUT } from '../components/ui/form'
import { EmptyState } from '../components/ui/EmptyState'
import { initials } from './checkin/shared'

const TEAM_ORDER: TeamColor[] = ['rojo', 'amarillo', 'azul']
const TEAM_DOT: Record<TeamColor, string> = { rojo: 'bg-red-500', amarillo: 'bg-yellow-400', azul: 'bg-blue-500' }

type ChildOption = { id: string; full_name: string }
type NoteRow = {
  id: string
  session_date: string
  team_color: TeamColor | null
  note: string
  created_at: string
  children: { id: string; full_name: string } | null
  profiles: { full_name: string } | null
}

const todayStr = format(new Date(), 'yyyy-MM-dd')

function dayLabel(date: string) {
  if (date === todayStr) return 'Hoy'
  return format(new Date(date + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es })
}

export default function NotesPage() {
  const [notes, setNotes] = useState<NoteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [childFilter, setChildFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [freshId, setFreshId] = useState<string | null>(null)
  const debouncedChild = useDebounce(childFilter.trim(), 300)
  const filtersActive = Boolean(fromDate || toDate || childFilter)

  const fetchNotes = useCallback(async () => {
    let matchingChildIds: string[] | null = null
    if (debouncedChild.length >= 2) {
      const { data: matches } = await supabase.from('children').select('id').ilike('full_name', `%${debouncedChild}%`)
      matchingChildIds = (matches ?? []).map((c) => c.id)
      if (matchingChildIds.length === 0) { setNotes([]); setLoading(false); return }
    }
    let query = supabase
      .from('shift_notes')
      .select('id, session_date, team_color, note, created_at, children(id, full_name), profiles(full_name)')
      .order('session_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100)
    if (fromDate) query = query.gte('session_date', fromDate)
    if (toDate) query = query.lte('session_date', toDate)
    if (matchingChildIds) query = query.in('child_id', matchingChildIds)
    const { data } = await query
    setNotes((data as unknown as NoteRow[]) ?? [])
    setLoading(false)
  }, [fromDate, toDate, debouncedChild])

  useEffect(() => { fetchNotes() }, [fetchNotes])

  const grouped = useMemo(() => {
    const groups: { date: string; items: NoteRow[] }[] = []
    for (const n of notes) {
      const last = groups[groups.length - 1]
      if (last && last.date === n.session_date) last.items.push(n)
      else groups.push({ date: n.session_date, items: [n] })
    }
    return groups
  }, [notes])

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <PageHeader
        title="Notas del turno"
        subtitle="Lo que pasó hoy: actividades, incidentes y detalles de cada niño"
        actions={
          <button onClick={() => setFiltersOpen(true)} className={`${BTN_SECONDARY} ${filtersActive ? '!border-indigo-300 !text-indigo-700' : ''}`}>
            <SlidersHorizontal size={16} /> Filtrar
            {filtersActive && <span className="w-2 h-2 rounded-full bg-indigo-500" />}
          </button>
        }
      />

      <Composer onSaved={(id) => { setFreshId(id); fetchNotes() }} />

      {filtersActive && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-2">
          {fromDate && <ActiveFilter label={`Desde ${format(new Date(fromDate + 'T12:00:00'), 'd MMM', { locale: es })}`} onClear={() => setFromDate('')} />}
          {toDate && <ActiveFilter label={`Hasta ${format(new Date(toDate + 'T12:00:00'), 'd MMM', { locale: es })}`} onClear={() => setToDate('')} />}
          {childFilter && <ActiveFilter label={`Niño: ${childFilter}`} onClear={() => setChildFilter('')} />}
        </motion.div>
      )}

      {loading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <SkeletonRow key={i} />)}</div>
      ) : notes.length === 0 ? (
        <EmptyState icon={NotebookPen} text={filtersActive ? 'No hay notas con estos filtros.' : 'Todavía no hay notas. Escribe la primera arriba.'} />
      ) : (
        <div className="space-y-6">
          {grouped.map((g) => (
            <section key={g.date} className="space-y-2.5">
              <h2
                className="sticky z-[1] w-fit px-3 py-1 rounded-full bg-canvas/90 backdrop-blur text-sm font-bold text-gray-600 first-letter:uppercase"
                style={{ top: 'calc(var(--app-header-h, 4.5rem) + 0.5rem)' }}
              >
                {dayLabel(g.date)}
              </h2>
              <AnimatePresence initial={false}>
                {g.items.map((n, i) => <NoteCard key={n.id} note={n} index={i} fresh={n.id === freshId} />)}
              </AnimatePresence>
            </section>
          ))}
        </div>
      )}

      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filtrar notas">
        <div className="px-6 pt-3 sm:pt-7 pb-6 space-y-5">
          <h2 className="text-2xl font-bold text-gray-900 pr-10">Filtrar notas</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Desde"><input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={INPUT} /></Field>
            <Field label="Hasta"><input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={INPUT} /></Field>
          </div>
          <Field label="Nombre del niño">
            <input value={childFilter} onChange={(e) => setChildFilter(e.target.value)} placeholder="Ej. Mateo" className={INPUT} />
          </Field>
          <div className="flex gap-2">
            <button onClick={() => { setFromDate(''); setToDate(''); setChildFilter('') }} className="flex-1 py-3.5 rounded-2xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200">Limpiar</button>
            <button onClick={() => setFiltersOpen(false)} className="flex-[2] py-3.5 rounded-2xl bg-indigo-600 text-white font-display font-bold text-lg hover:bg-indigo-700">Ver notas</button>
          </div>
        </div>
      </Sheet>
    </div>
  )
}

function ActiveFilter({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full bg-indigo-50 text-indigo-800 text-sm font-semibold">
      {label}
      <button onClick={onClear} className="p-0.5 rounded-full hover:bg-indigo-100" aria-label="Quitar filtro"><X size={13} /></button>
    </span>
  )
}

function NoteCard({ note, index, fresh }: { note: NoteRow; index: number; fresh: boolean }) {
  const author = note.profiles?.full_name ?? 'Autor desconocido'
  return (
    <motion.article
      layout
      initial={fresh ? { opacity: 0, y: -14, scale: 0.97 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1], delay: fresh ? 0 : Math.min(index, 10) * 0.03 }}
      className={`flex gap-3 rounded-3xl bg-white px-4 py-3.5 shadow-sm shadow-gray-900/5 border ${fresh ? 'border-indigo-200' : 'border-transparent'}`}
    >
      <span className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-700 font-display font-bold flex items-center justify-center shrink-0">{initials(author)}</span>
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-semibold text-gray-900 truncate">{author}</p>
          <span className="text-xs text-gray-400 shrink-0 tabular-nums">{format(new Date(note.created_at), 'HH:mm')}</span>
        </div>
        <p className="text-[15px] text-gray-700 whitespace-pre-wrap leading-relaxed">{note.note}</p>
        {(note.team_color || note.children) && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {note.team_color && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full">
                <span className={`w-2 h-2 rounded-full ${TEAM_DOT[note.team_color]}`} /> Equipo {TEAM_COLOR_LABELS[note.team_color]}
              </span>
            )}
            {note.children && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full">
                <User size={12} /> {note.children.full_name}
              </span>
            )}
          </div>
        )}
      </div>
    </motion.article>
  )
}

// Escribir una nota es como mandar un mensaje: el texto primero, y fecha,
// equipo o niño solo si hacen falta. Ctrl/⌘ + Enter la envía.
function Composer({ onSaved }: { onSaved: (id: string) => void }) {
  const { profile } = useAuth()
  const [sessionDate, setSessionDate] = useState(todayStr)
  const [teamColor, setTeamColor] = useState<TeamColor | ''>('')
  const [note, setNote] = useState('')
  const [child, setChild] = useState<ChildOption | null>(null)
  const [panel, setPanel] = useState<'date' | 'team' | 'child' | null>(null)
  const [saving, setSaving] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)

  // Crece con el texto, hasta un tope.
  useEffect(() => {
    const el = textRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`
  }, [note])

  async function save() {
    if (!note.trim() || saving) return
    setSaving(true)
    setError(null)
    const { data, error: err } = await supabase.from('shift_notes').insert({
      session_date: sessionDate,
      team_color: teamColor || null,
      child_id: child?.id ?? null,
      author_id: profile?.id ?? null,
      note: note.trim(),
    }).select('id').single()
    setSaving(false)
    if (err) { setError('No se pudo guardar la nota. Intenta de nuevo.'); return }
    setNote(''); setChild(null); setTeamColor(''); setSessionDate(todayStr); setPanel(null)
    setSent(true); setTimeout(() => setSent(false), 1200)
    onSaved(data?.id ?? '')
  }

  const dateLabel = sessionDate === todayStr ? 'Hoy' : format(new Date(sessionDate + 'T12:00:00'), 'd MMM', { locale: es })

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
      className="rounded-3xl bg-white border border-gray-200/70 shadow-sm p-4 space-y-3 focus-within:border-indigo-300 focus-within:shadow-md transition-[border-color,box-shadow]">
      <textarea
        ref={textRef}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save() } }}
        rows={2}
        placeholder="¿Qué pasó en el turno? Ej. Mateo ayudó a repartir el material…"
        className="w-full px-1 text-[16px] leading-relaxed text-gray-800 placeholder:text-gray-400 bg-transparent focus:outline-none resize-none"
      />

      <AnimatePresence initial={false}>
        {panel && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="pb-1">
              {panel === 'date' && (
                <input type="date" value={sessionDate} max={todayStr} autoFocus onChange={(e) => { setSessionDate(e.target.value || todayStr); setPanel(null) }} className={INPUT} />
              )}
              {panel === 'team' && (
                <div className="flex flex-wrap gap-2">
                  {[{ v: '' as const, l: 'General' }, ...TEAM_ORDER.map((t) => ({ v: t, l: TEAM_COLOR_LABELS[t] }))].map(({ v, l }) => (
                    <button key={l} type="button" onClick={() => { setTeamColor(v); setPanel(null) }}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold border-2 transition-colors ${teamColor === v ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      {v && <span className={`w-2.5 h-2.5 rounded-full ${TEAM_DOT[v]}`} />} {l}
                    </button>
                  ))}
                </div>
              )}
              {panel === 'child' && <ChildPicker onSelect={(c) => { setChild(c); setPanel(null) }} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && <p className="text-sm text-red-700 bg-red-50 rounded-2xl px-4 py-2.5">{error}</p>}

      <div className="flex items-center gap-1.5 flex-wrap">
        <Tag active={panel === 'date' || sessionDate !== todayStr} icon={Calendar} label={dateLabel} onClick={() => setPanel(panel === 'date' ? null : 'date')} />
        <Tag active={panel === 'team' || !!teamColor} icon={null} dot={teamColor ? TEAM_DOT[teamColor] : undefined} label={teamColor ? TEAM_COLOR_LABELS[teamColor] : 'Equipo'} onClick={() => setPanel(panel === 'team' ? null : 'team')} />
        {child ? (
          <span className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full bg-indigo-50 text-indigo-800 text-sm font-semibold">
            <User size={14} /> {child.full_name}
            <button onClick={() => setChild(null)} className="p-0.5 rounded-full hover:bg-indigo-100" aria-label="Quitar niño"><X size={13} /></button>
          </span>
        ) : (
          <Tag active={panel === 'child'} icon={User} label="Niño" onClick={() => setPanel(panel === 'child' ? null : 'child')} />
        )}
        <motion.button
          onClick={save}
          disabled={saving || !note.trim()}
          whileTap={{ scale: 0.9 }}
          className="ml-auto inline-flex items-center gap-2 pl-4 pr-3.5 py-2.5 rounded-full bg-indigo-600 text-white font-semibold disabled:opacity-35 hover:bg-indigo-700 transition-colors"
        >
          <AnimatePresence mode="wait" initial={false}>
            {sent ? (
              <motion.span key="ok" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="inline-flex items-center gap-1.5"><Check size={16} strokeWidth={3} /> Guardada</motion.span>
            ) : (
              <motion.span key="send" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: 8 }} className="inline-flex items-center gap-1.5">{saving ? 'Guardando…' : 'Guardar'} <Send size={15} /></motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </motion.div>
  )
}

function Tag({ active, icon: Icon, dot, label, onClick }: { active: boolean; icon: typeof User | null; dot?: string; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${active ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
      {Icon && <Icon size={14} />}
      {dot && <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />}
      {label}
    </button>
  )
}

function ChildPicker({ onSelect }: { onSelect: (child: ChildOption) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ChildOption[]>([])
  const debounced = useDebounce(query.trim(), 300)
  useEffect(() => {
    if (debounced.length < 2) { setResults([]); return }
    let cancelled = false
    supabase.from('children').select('id, full_name').ilike('full_name', `%${debounced}%`).limit(10)
      .then(({ data }) => { if (!cancelled) setResults((data as ChildOption[]) ?? []) })
    return () => { cancelled = true }
  }, [debounced])
  return (
    <div className="space-y-2">
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar niño…" autoFocus className={INPUT} />
      <div className="flex flex-wrap gap-1.5">
        {results.map((c) => (
          <button key={c.id} type="button" onClick={() => onSelect(c)}
            className="px-3 py-1.5 rounded-full bg-white border border-gray-200 text-sm font-medium text-gray-700 hover:border-indigo-300 hover:bg-indigo-50">
            {c.full_name}
          </button>
        ))}
      </div>
    </div>
  )
}
