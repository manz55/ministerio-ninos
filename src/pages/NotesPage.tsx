import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { NotebookPen, Search, X, User, Check, Calendar } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useDebounce } from '../hooks/useDebounce'
import { TEAM_COLOR_LABELS, type TeamColor } from '../types/domain'

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
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
        <input
          type="text" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar niño…"
          className="w-full pl-9 pr-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm bg-white"
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

function NewNoteForm({ onSaved }: { onSaved: () => void }) {
  const { profile } = useAuth()
  const [sessionDate, setSessionDate] = useState(todayStr)
  const [teamColor, setTeamColor] = useState<TeamColor | ''>('')
  const [note, setNote] = useState('')
  const [aboutChild, setAboutChild] = useState(false)
  const [selectedChild, setSelectedChild] = useState<ChildOption | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!note.trim()) { setError('Escribe la nota.'); return }
    setSaving(true)
    setError(null)
    const { error: err } = await supabase.from('shift_notes').insert({
      session_date: sessionDate,
      team_color: teamColor || null,
      child_id: aboutChild ? selectedChild?.id ?? null : null,
      author_id: profile?.id ?? null,
      note: note.trim(),
    })
    setSaving(false)
    if (err) { setError('Error al guardar la nota.'); return }
    setNote(''); setAboutChild(false); setSelectedChild(null)
    onSaved()
  }

  return (
    <div className="bg-white rounded-2xl border-2 border-gray-200 p-4 space-y-3">
      <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
        <NotebookPen size={14} className="text-indigo-500" /> Nueva nota
      </p>
      {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Fecha</label>
          <input type="date" value={sessionDate} max={todayStr} onChange={(e) => setSessionDate(e.target.value)}
            className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Equipo</label>
          <select value={teamColor} onChange={(e) => setTeamColor(e.target.value as TeamColor | '')}
            className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm bg-white">
            <option value="">General</option>
            {(['rojo', 'amarillo', 'azul'] as TeamColor[]).map((t) => (
              <option key={t} value={t}>{TEAM_COLOR_LABELS[t]}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Nota</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
          placeholder="Actividades del turno, incidentes, novedades…"
          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm resize-none" />
      </div>

      <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
        <input type="checkbox" checked={aboutChild} onChange={(e) => { setAboutChild(e.target.checked); setSelectedChild(null) }} />
        ¿Es sobre un niño en particular?
      </label>

      {aboutChild && (
        selectedChild ? (
          <div className="flex items-center justify-between px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg">
            <span className="text-sm font-medium text-indigo-700 flex items-center gap-1.5">
              <User size={13} /> {selectedChild.full_name}
            </span>
            <button onClick={() => setSelectedChild(null)} className="text-indigo-400 hover:text-indigo-700">
              <X size={14} />
            </button>
          </div>
        ) : (
          <ChildPicker onSelect={setSelectedChild} />
        )
      )}

      <button onClick={handleSave} disabled={saving}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors">
        <Check size={14} />
        {saving ? 'Guardando…' : 'Guardar nota'}
      </button>
    </div>
  )
}

export default function NotesPage() {
  const [notes, setNotes] = useState<NoteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [childFilter, setChildFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const debouncedChild = useDebounce(childFilter.trim(), 300)

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

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Notas del turno</h2>
        <p className="text-gray-500 text-sm mt-0.5">Registro de actividades, incidentes y notas por niño</p>
      </div>

      <NewNoteForm onSaved={fetchNotes} />

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-gray-400" />
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
            className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-xs" />
          <span className="text-gray-400 text-xs">a</span>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
            className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-xs" />
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
          <input
            type="text" value={childFilter} onChange={(e) => setChildFilter(e.target.value)}
            placeholder="Filtrar por nombre de niño…"
            className="w-full pl-9 pr-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none text-sm bg-white"
          />
        </div>

        {loading && <p className="text-center text-gray-400 py-8">Cargando…</p>}
        {!loading && notes.length === 0 && (
          <p className="text-center text-gray-400 py-8 bg-white rounded-2xl border border-gray-200">Sin notas para estos filtros.</p>
        )}

        {!loading && notes.map((n) => (
          <div key={n.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-1.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-500">
                  {format(new Date(n.session_date + 'T12:00:00'), "d 'de' MMMM yyyy", { locale: es })}
                </span>
                {n.team_color && (
                  <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    {TEAM_COLOR_LABELS[n.team_color]}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-gray-400">{n.profiles?.full_name ?? 'Autor desconocido'}</span>
            </div>
            {n.children && (
              <p className="text-xs font-semibold text-indigo-600 flex items-center gap-1">
                <User size={11} /> {n.children.full_name}
              </p>
            )}
            <p className="text-sm text-gray-700">{n.note}</p>
          </div>
        ))}
      </section>
    </div>
  )
}
