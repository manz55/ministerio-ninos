import { useState, useEffect, useCallback, useMemo } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Search, X, User, Send, Users, Calendar, Filter } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useDebounce } from '../hooks/useDebounce'
import { TEAM_COLOR_LABELS, type TeamColor } from '../types/domain'

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

function Chip({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 pl-2 pr-1 py-1 bg-gray-100 rounded-full text-[11px] font-semibold text-gray-600">
      {children}
      <button type="button" onClick={onRemove} className="p-0.5 hover:text-gray-900">
        <X size={10} />
      </button>
    </span>
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
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
        <input
          type="text" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar niño…" autoFocus
          className="w-full pl-9 pr-3 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm bg-white"
        />
      </div>
      {results.length > 0 && (
        <div className="space-y-1">
          {results.map((c) => (
            <button key={c.id} type="button" onClick={() => onSelect(c)}
              className="w-full text-left px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 transition-colors">
              {c.full_name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// A compact chat-style composer instead of an always-open form — team/child/date
// are optional tags you attach only when you need them, not fields you fill in
// every time you jot something down mid-shift.
function NoteComposer({ onSaved }: { onSaved: () => void }) {
  const { profile } = useAuth()
  const [sessionDate, setSessionDate] = useState(todayStr)
  const [teamColor, setTeamColor] = useState<TeamColor | ''>('')
  const [note, setNote] = useState('')
  const [selectedChild, setSelectedChild] = useState<ChildOption | null>(null)
  const [panel, setPanel] = useState<'date' | 'team' | 'child' | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function togglePanel(p: 'date' | 'team' | 'child') {
    setPanel((cur) => (cur === p ? null : p))
  }

  async function handleSave() {
    if (!note.trim()) return
    setSaving(true)
    setError(null)
    const { error: err } = await supabase.from('shift_notes').insert({
      session_date: sessionDate,
      team_color: teamColor || null,
      child_id: selectedChild?.id ?? null,
      author_id: profile?.id ?? null,
      note: note.trim(),
    })
    setSaving(false)
    if (err) { setError('Error al guardar la nota.'); return }
    setNote(''); setSelectedChild(null); setTeamColor(''); setSessionDate(todayStr); setPanel(null)
    onSaved()
  }

  const dateLabel = sessionDate === todayStr ? null : format(new Date(sessionDate + 'T12:00:00'), "d MMM", { locale: es })

  return (
    <div className="bg-white rounded-2xl border-2 border-gray-200 p-3 space-y-2.5">
      {(dateLabel || teamColor || selectedChild) && (
        <div className="flex flex-wrap gap-1.5">
          {dateLabel && (
            <Chip onRemove={() => setSessionDate(todayStr)}>
              <Calendar size={11} /> {dateLabel}
            </Chip>
          )}
          {teamColor && (
            <Chip onRemove={() => setTeamColor('')}>
              <span className={`w-2 h-2 rounded-full ${TEAM_DOT[teamColor]}`} /> {TEAM_COLOR_LABELS[teamColor]}
            </Chip>
          )}
          {selectedChild && (
            <Chip onRemove={() => setSelectedChild(null)}>
              <User size={11} /> {selectedChild.full_name}
            </Chip>
          )}
        </div>
      )}

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="Escribe una nota del turno…"
        className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none text-sm resize-none placeholder:text-gray-300"
      />

      {panel === 'date' && (
        <input
          type="date" value={sessionDate} max={todayStr} autoFocus
          onChange={(e) => { setSessionDate(e.target.value); setPanel(null) }}
          className="px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm"
        />
      )}
      {panel === 'team' && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button" onClick={() => { setTeamColor(''); setPanel(null) }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-colors ${
              teamColor === '' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            General
          </button>
          {TEAM_ORDER.map((t) => (
            <button
              key={t} type="button" onClick={() => { setTeamColor(t); setPanel(null) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-colors ${
                teamColor === t ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${TEAM_DOT[t]}`} /> {TEAM_COLOR_LABELS[t]}
            </button>
          ))}
        </div>
      )}
      {panel === 'child' && !selectedChild && (
        <ChildPicker onSelect={(c) => { setSelectedChild(c); setPanel(null) }} />
      )}

      {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex items-center justify-between pt-0.5">
        <div className="flex items-center gap-1">
          <button
            type="button" title="Cambiar fecha" onClick={() => togglePanel('date')}
            className={`p-2 rounded-lg transition-colors ${panel === 'date' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
          >
            <Calendar size={16} />
          </button>
          <button
            type="button" title="Asignar equipo" onClick={() => togglePanel('team')}
            className={`p-2 rounded-lg transition-colors ${panel === 'team' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
          >
            <Users size={16} />
          </button>
          <button
            type="button" title="Etiquetar niño" onClick={() => togglePanel('child')} disabled={!!selectedChild}
            className={`p-2 rounded-lg transition-colors disabled:opacity-30 ${panel === 'child' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
          >
            <User size={16} />
          </button>
        </div>
        <button
          onClick={handleSave} disabled={saving || !note.trim()}
          className="w-9 h-9 flex items-center justify-center bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-30 transition-colors shrink-0"
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  )
}

export default function NotesPage() {
  const [notes, setNotes] = useState<NoteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [childFilter, setChildFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const debouncedChild = useDebounce(childFilter.trim(), 300)
  const filtersActive = Boolean(fromDate || toDate || childFilter)

  const fetchNotes = useCallback(async () => {
    setLoading(true)

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
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Notas del turno</h2>
        <p className="text-gray-500 text-sm mt-0.5">Registro de actividades, incidentes y notas por niño</p>
      </div>

      <NoteComposer onSaved={fetchNotes} />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-700">Notas recientes</h3>
          <button
            type="button" onClick={() => setFiltersOpen((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filtersOpen || filtersActive ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <Filter size={13} /> Filtrar
            {filtersActive && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
          </button>
        </div>

        {filtersOpen && (
          <div className="space-y-2 bg-gray-50 rounded-xl p-3">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-gray-400 shrink-0" />
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white" />
              <span className="text-gray-400 text-xs">a</span>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white" />
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="text" value={childFilter} onChange={(e) => setChildFilter(e.target.value)}
                placeholder="Filtrar por nombre de niño…"
                className="w-full pl-9 pr-3 py-2 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none text-sm bg-white"
              />
            </div>
            {filtersActive && (
              <button
                type="button"
                onClick={() => { setFromDate(''); setToDate(''); setChildFilter('') }}
                className="text-xs font-semibold text-gray-400 hover:text-gray-600"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        )}

        {loading && <p className="text-center text-gray-400 py-8">Cargando…</p>}
        {!loading && notes.length === 0 && (
          <p className="text-center text-gray-400 py-8 bg-white rounded-2xl border border-gray-200">Sin notas para estos filtros.</p>
        )}

        {!loading && grouped.map((g) => (
          <div key={g.date} className="space-y-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">
              {g.date === todayStr ? 'Hoy' : format(new Date(g.date + 'T12:00:00'), "d 'de' MMMM", { locale: es })}
            </p>
            <div className="space-y-2">
              {g.items.map((n) => (
                <div key={n.id} className="bg-white rounded-xl border border-gray-200 p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {n.team_color && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          <span className={`w-1.5 h-1.5 rounded-full ${TEAM_DOT[n.team_color]}`} /> {TEAM_COLOR_LABELS[n.team_color]}
                        </span>
                      )}
                      {n.children && (
                        <span className="text-xs font-semibold text-indigo-600 flex items-center gap-1">
                          <User size={11} /> {n.children.full_name}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-400">{n.profiles?.full_name ?? 'Autor desconocido'}</span>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{n.note}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
