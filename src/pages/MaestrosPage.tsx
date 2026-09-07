import { useState, useEffect, useCallback, useMemo } from 'react'
import { Search, Plus, ChevronLeft, Trash2, Droplet, Wind } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { uploadPhoto } from '../lib/photo'
import { PhotoCapture, PhotoAvatar } from '../components/ui/PhotoCapture'
import type { Maestro, TeamColor } from '../types/domain'
import { TEAM_COLOR_LABELS } from '../types/domain'

// Same palette CheckInPage's own team picker uses (TEAM_META there) — kept
// as a small local const here rather than shared, since the two screens
// otherwise have nothing to do with each other.
const TEAM_ORDER: TeamColor[] = ['rojo', 'amarillo', 'azul']
const TEAM_DOT: Record<TeamColor, string> = { rojo: 'bg-red-500', amarillo: 'bg-yellow-400', azul: 'bg-blue-500' }

// Admin-only directory of teachers/volunteers (name, discipulador, baptism
// status, DPI…) — a separate table from `profiles` since not everyone here
// necessarily has an app login, and this tracks church-membership info
// profiles was never meant to hold.
export default function MaestrosPage() {
  const [maestros, setMaestros] = useState<Maestro[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Maestro | 'new' | null>(null)

  const fetchMaestros = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('maestros').select('*').order('nombre')
    setMaestros((data ?? []) as Maestro[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchMaestros() }, [fetchMaestros])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return maestros
    return maestros.filter((m) => `${m.nombre} ${m.apellido}`.toLowerCase().includes(q))
  }, [maestros, search])

  // Optimistic update — the coordinator moving people between teams before
  // service shouldn't wait on a round-trip per tap. Reverts if the write
  // fails so the UI doesn't silently drift from the database.
  async function moveTeam(id: string, team_color: TeamColor) {
    const prev = maestros
    setMaestros((cur) => cur.map((m) => (m.id === id ? { ...m, team_color } : m)))
    const { error } = await supabase.from('maestros').update({ team_color }).eq('id', id)
    if (error) setMaestros(prev)
  }

  if (editing) {
    return (
      <MaestroForm
        maestro={editing === 'new' ? null : editing}
        onSaved={() => { setEditing(null); fetchMaestros() }}
        onCancel={() => setEditing(null)}
      />
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-900 leading-tight">Maestros</h1>
          <p className="text-sm text-gray-400 leading-tight">
            {maestros.length} {maestros.length === 1 ? 'registrado' : 'registrados'}
          </p>
        </div>
        <button
          onClick={() => setEditing('new')}
          className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors shrink-0"
        >
          <Plus size={16} />
          Agregar maestro
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre…"
          className="w-full pl-10 pr-4 py-3 text-sm border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none placeholder:text-gray-300"
        />
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-10">Cargando…</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-gray-100 py-10 text-center">
          <p className="text-sm text-gray-400">
            {search ? 'Nadie coincide con esa búsqueda.' : 'Aún no hay maestros registrados.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {TEAM_ORDER.map((team) => {
            const members = filtered.filter((m) => m.team_color === team)
            if (members.length === 0) return null
            return (
              <div key={team}>
                <div className="flex items-center gap-2 mb-2.5 px-1">
                  <span className={`w-2.5 h-2.5 rounded-full ${TEAM_DOT[team]}`} />
                  <h2 className="text-sm font-bold text-gray-700">Equipo {TEAM_COLOR_LABELS[team]}</h2>
                  <span className="text-xs text-gray-400">{members.length}</span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                  {members.map((m) => (
                    <div
                      key={m.id}
                      className="bg-white rounded-2xl border-2 border-gray-200 hover:border-indigo-300 p-4 flex items-center gap-3 transition-colors"
                    >
                      <button onClick={() => setEditing(m)} className="text-left flex items-center gap-3 min-w-0 flex-1">
                        <PhotoAvatar path={m.photo_url} size={48} />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-gray-900 truncate">{m.nombre} {m.apellido}</p>
                          <p className="text-xs text-gray-400 truncate">
                            {m.discipulador ? `Discípulo de ${m.discipulador}` : 'Sin discipulador'}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {m.bautizado_aguas && (
                              <span title="Bautizado en aguas" className="text-sky-500 shrink-0"><Droplet size={13} /></span>
                            )}
                            {m.bautizado_espiritu && (
                              <span title="Bautizado en el Espíritu" className="text-amber-500 shrink-0"><Wind size={13} /></span>
                            )}
                            {m.celular && <span className="text-xs text-gray-400 truncate">{m.celular}</span>}
                          </div>
                        </div>
                      </button>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {TEAM_ORDER.map((t) => (
                          <button
                            key={t}
                            title={`Mover a ${TEAM_COLOR_LABELS[t]}`}
                            onClick={(e) => { e.stopPropagation(); moveTeam(m.id, t) }}
                            className={`w-4 h-4 rounded-full ${TEAM_DOT[t]} ${t === m.team_color ? 'ring-2 ring-offset-1 ring-gray-400' : 'opacity-30 hover:opacity-70'} transition-opacity`}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function BoolToggle({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean | null
  onChange: (v: boolean) => void
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${
            value === true ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
          }`}
        >
          Sí
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${
            value === false ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
          }`}
        >
          No
        </button>
      </div>
    </div>
  )
}

function MaestroForm({
  maestro,
  onSaved,
  onCancel,
}: {
  maestro: Maestro | null
  onSaved: () => void
  onCancel: () => void
}) {
  const [nombre, setNombre] = useState(maestro?.nombre ?? '')
  const [apellido, setApellido] = useState(maestro?.apellido ?? '')
  const [discipulador, setDiscipulador] = useState(maestro?.discipulador ?? '')
  const [fechaNacimiento, setFechaNacimiento] = useState(maestro?.fecha_nacimiento ?? '')
  const [dpi, setDpi] = useState(maestro?.dpi ?? '')
  const [celular, setCelular] = useState(maestro?.celular ?? '')
  const [tiempoAsistencia, setTiempoAsistencia] = useState(maestro?.tiempo_asistencia ?? '')
  const [bautizadoAguas, setBautizadoAguas] = useState<boolean | null>(maestro?.bautizado_aguas ?? null)
  const [bautizadoEspiritu, setBautizadoEspiritu] = useState<boolean | null>(maestro?.bautizado_espiritu ?? null)
  const [profesion, setProfesion] = useState(maestro?.profesion ?? '')
  const [teamColor, setTeamColor] = useState<TeamColor>(maestro?.team_color ?? 'amarillo')
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleSave() {
    if (!nombre.trim() || !apellido.trim()) { setError('Nombre y apellido son requeridos.'); return }
    setSaving(true)
    setError(null)

    const payload = {
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      discipulador: discipulador.trim() || null,
      fecha_nacimiento: fechaNacimiento || null,
      dpi: dpi.trim() || null,
      celular: celular.trim() || null,
      tiempo_asistencia: tiempoAsistencia.trim() || null,
      bautizado_aguas: bautizadoAguas,
      bautizado_espiritu: bautizadoEspiritu,
      profesion: profesion.trim() || null,
      team_color: teamColor,
    }

    let id = maestro?.id
    if (maestro) {
      const { error: err } = await supabase.from('maestros').update(payload).eq('id', maestro.id)
      if (err) { setError('Error al guardar. Intenta de nuevo.'); setSaving(false); return }
    } else {
      const { data, error: err } = await supabase.from('maestros').insert(payload).select().single()
      if (err || !data) { setError('Error al guardar. Intenta de nuevo.'); setSaving(false); return }
      id = data.id
    }

    if (photoBlob && id) {
      const path = await uploadPhoto(`maestros/${id}.jpg`, photoBlob)
      if (path) await supabase.from('maestros').update({ photo_url: path }).eq('id', id)
    }

    setSaving(false)
    onSaved()
  }

  async function handleDelete() {
    if (!maestro) return
    setSaving(true)
    await supabase.from('maestros').delete().eq('id', maestro.id)
    setSaving(false)
    onSaved()
  }

  return (
    <div className="space-y-5">
      <button
        onClick={onCancel}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ChevronLeft size={15} /> Volver a Maestros
      </button>

      <div className="bg-white rounded-xl border-2 border-gray-200 p-5 space-y-4">
        <PhotoCapture existingPath={maestro?.photo_url} onFileReady={setPhotoBlob} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              autoFocus
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none text-base"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Apellido <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={apellido}
              onChange={(e) => setApellido(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none text-base"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Discipulador <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <input
            type="text"
            value={discipulador}
            onChange={(e) => setDiscipulador(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none text-base"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Fecha de nacimiento</label>
            <input
              type="date"
              value={fechaNacimiento}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setFechaNacimiento(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none text-base"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              DPI <span className="text-gray-400 font-normal">(si es mayor de edad)</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={dpi}
              onChange={(e) => setDpi(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none text-base"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Número de celular</label>
            <input
              type="tel"
              inputMode="tel"
              value={celular}
              onChange={(e) => setCelular(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none text-base"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Tiempo de asistir a la Iglesia</label>
            <input
              type="text"
              value={tiempoAsistencia}
              onChange={(e) => setTiempoAsistencia(e.target.value)}
              placeholder="Ej. 3 años"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none text-base placeholder:text-gray-300"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Profesión u oficio <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <input
            type="text"
            value={profesion}
            onChange={(e) => setProfesion(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none text-base"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <BoolToggle label="¿Está bautizado en aguas?" value={bautizadoAguas} onChange={setBautizadoAguas} />
          <BoolToggle label="¿Está bautizado en el Espíritu?" value={bautizadoEspiritu} onChange={setBautizadoEspiritu} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Equipo</label>
          <div className="grid grid-cols-3 gap-2">
            {TEAM_ORDER.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTeamColor(t)}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${
                  teamColor === t ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${TEAM_DOT[t]}`} />
                {TEAM_COLOR_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
          {maestro && (
            confirmDelete ? (
              <button
                onClick={handleDelete}
                disabled={saving}
                className="px-4 py-3 text-sm font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                ¿Seguro? Confirmar
              </button>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="px-4 py-3 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
              >
                <Trash2 size={18} />
              </button>
            )
          )}
        </div>
      </div>
    </div>
  )
}
