import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, LayoutGroup, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, Droplet, Wind, Phone, Contact } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { uploadPhoto } from '../lib/photo'
import { PhotoCapture, PhotoAvatar } from '../components/ui/PhotoCapture'
import { Sheet, SkeletonRow } from '../components/motion'
import { PageHeader, BTN_PRIMARY } from '../components/ui/PageHeader'
import { SearchField } from '../components/ui/SearchField'
import { Segmented } from '../components/ui/Segmented'
import { ConfirmSheet } from '../components/ui/ConfirmSheet'
import { EmptyState } from '../components/ui/EmptyState'
import { Field, ChoiceChips, FormError, INPUT } from '../components/ui/form'
import { useMediaQuery, DESKTOP_QUERY } from '../hooks/useMediaQuery'
import type { Maestro, TeamColor } from '../types/domain'
import { TEAM_COLOR_LABELS } from '../types/domain'
import { initials } from './checkin/shared'

const TEAM_ORDER: TeamColor[] = ['rojo', 'amarillo', 'azul']
const TEAM_STYLE: Record<TeamColor, { dot: string; head: string; soft: string; ring: string }> = {
  rojo: { dot: 'bg-red-500', head: 'text-red-700', soft: 'bg-red-50', ring: 'ring-red-300' },
  amarillo: { dot: 'bg-yellow-400', head: 'text-yellow-800', soft: 'bg-yellow-50', ring: 'ring-yellow-300' },
  azul: { dot: 'bg-blue-500', head: 'text-blue-700', soft: 'bg-blue-50', ring: 'ring-blue-300' },
}

// Directorio de maestros y voluntarios (separado de `profiles`: no todos
// tienen cuenta en la app, y aquí van datos de membresía que profiles no
// guarda). Tablero por equipo: en compu, tres columnas; en celular, pestañas.
export default function MaestrosPage() {
  const desktop = useMediaQuery(DESKTOP_QUERY)
  const [maestros, setMaestros] = useState<Maestro[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [teamTab, setTeamTab] = useState<TeamColor | 'todos'>('todos')
  const [editing, setEditing] = useState<Maestro | 'new' | null>(null)

  const fetchMaestros = useCallback(async () => {
    const { data } = await supabase.from('maestros').select('*').order('nombre')
    setMaestros((data ?? []) as Maestro[])
    setLoading(false)
  }, [])
  useEffect(() => { fetchMaestros() }, [fetchMaestros])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? maestros.filter((m) => `${m.nombre} ${m.apellido}`.toLowerCase().includes(q)) : maestros
  }, [maestros, search])

  // Optimista: mover gente de equipo antes del culto no debe esperar a la
  // red por cada toque. Si falla, se regresa.
  async function moveTeam(id: string, team_color: TeamColor) {
    const prev = maestros
    setMaestros((cur) => cur.map((m) => (m.id === id ? { ...m, team_color } : m)))
    const { error } = await supabase.from('maestros').update({ team_color }).eq('id', id)
    if (error) setMaestros(prev)
  }

  const columns = desktop ? TEAM_ORDER : teamTab === 'todos' ? TEAM_ORDER : [teamTab]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Maestros"
        subtitle={loading ? 'Cargando…' : `${maestros.length} en el equipo de servicio`}
        actions={
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => setEditing('new')} className={BTN_PRIMARY}>
            <Plus size={17} /> Agregar maestro
          </motion.button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="flex-1"><SearchField value={search} onChange={setSearch} placeholder="Buscar por nombre…" /></div>
        {!desktop && (
          <Segmented
            value={teamTab}
            onChange={setTeamTab}
            options={[{ value: 'todos', label: 'Todos' }, ...TEAM_ORDER.map((t) => ({ value: t, label: TEAM_COLOR_LABELS[t], count: maestros.filter((m) => m.team_color === t).length }))]}
          />
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">{[0, 1, 2].map((i) => <SkeletonRow key={i} />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Plus} text={search ? 'Nadie coincide con esa búsqueda.' : 'Aún no hay maestros registrados.'} actionLabel="Agregar maestro" action={() => setEditing('new')} />
      ) : (
        <LayoutGroup>
          <div className={`grid gap-4 ${desktop ? 'grid-cols-3' : 'grid-cols-1'}`}>
            {columns.map((team) => {
              const members = filtered.filter((m) => m.team_color === team)
              const st = TEAM_STYLE[team]
              if (!desktop && members.length === 0) return null
              return (
                <section key={team} className={`rounded-3xl ${desktop ? `${st.soft} p-3` : ''} space-y-2.5`}>
                  <header className="flex items-center gap-2 px-2 pt-1">
                    <span className={`w-3 h-3 rounded-full ${st.dot}`} />
                    <h2 className={`text-lg font-bold ${st.head}`}>Equipo {TEAM_COLOR_LABELS[team]}</h2>
                    <span className="ml-auto text-sm font-semibold text-gray-500 tabular-nums">{members.length}</span>
                  </header>
                  <AnimatePresence initial={false}>
                    {members.map((m) => <MaestroCard key={m.id} maestro={m} onOpen={() => setEditing(m)} onMove={(t) => moveTeam(m.id, t)} />)}
                  </AnimatePresence>
                  {desktop && members.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-6 rounded-2xl border-2 border-dashed border-gray-300/60">Nadie en este equipo todavía.</p>
                  )}
                </section>
              )
            })}
          </div>
        </LayoutGroup>
      )}

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Nuevo maestro' : 'Maestro'} wide>
        {editing && (
          <MaestroForm
            key={editing === 'new' ? 'new' : editing.id}
            maestro={editing === 'new' ? null : editing}
            onSaved={() => { setEditing(null); fetchMaestros() }}
            onCancel={() => setEditing(null)}
          />
        )}
      </Sheet>
    </div>
  )
}

function MaestroCard({ maestro: m, onOpen, onMove }: { maestro: Maestro; onOpen: () => void; onMove: (t: TeamColor) => void }) {
  return (
    <motion.div
      layout
      layoutId={`maestro-${m.id}`}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      className="group rounded-2xl bg-white shadow-sm shadow-gray-900/5 border border-transparent hover:border-indigo-200 hover:shadow-md transition-[border-color,box-shadow]"
    >
      <button onClick={onOpen} className="w-full text-left flex items-center gap-3 p-3.5 pb-2">
        {m.photo_url ? <PhotoAvatar path={m.photo_url} size={48} /> : (
          <span className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-700 font-display font-bold text-base flex items-center justify-center shrink-0">{initials(`${m.nombre} ${m.apellido}`)}</span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block font-display font-bold text-lg leading-tight text-gray-900 truncate">{m.nombre} {m.apellido}</span>
          <span className="block text-sm text-gray-500 truncate">{m.discipulador ? `Discípulo de ${m.discipulador}` : 'Sin discipulador'}</span>
        </span>
      </button>
      <div className="flex items-center gap-2 px-3.5 pb-3">
        <div className="flex items-center gap-1.5 min-w-0 flex-1 text-xs text-gray-500">
          {m.bautizado_aguas && <span title="Bautizado en aguas" className="inline-flex items-center gap-0.5 text-sky-600"><Droplet size={13} /></span>}
          {m.bautizado_espiritu && <span title="Bautizado en el Espíritu" className="inline-flex items-center gap-0.5 text-amber-600"><Wind size={13} /></span>}
          {m.celular && <span className="inline-flex items-center gap-1 truncate"><Phone size={12} /> {m.celular}</span>}
        </div>
        {/* Cambiar de equipo con un toque */}
        <div className="flex items-center gap-1 rounded-full bg-gray-50 p-1">
          {TEAM_ORDER.map((t) => (
            <button
              key={t}
              title={`Mover a ${TEAM_COLOR_LABELS[t]}`}
              aria-label={`Mover a ${TEAM_COLOR_LABELS[t]}`}
              onClick={() => t !== m.team_color && onMove(t)}
              className={`w-5 h-5 rounded-full ${TEAM_STYLE[t].dot} transition ${t === m.team_color ? `ring-2 ring-offset-1 ${TEAM_STYLE[t].ring}` : 'opacity-30 hover:opacity-80 hover:scale-110'}`}
            />
          ))}
        </div>
      </div>
    </motion.div>
  )
}

function MaestroForm({ maestro, onSaved, onCancel }: { maestro: Maestro | null; onSaved: () => void; onCancel: () => void }) {
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
  const [email, setEmail] = useState(maestro?.email ?? '')
  const [disponibilidad, setDisponibilidad] = useState(maestro?.disponibilidad ?? '')
  const [teamColor, setTeamColor] = useState<TeamColor>(maestro?.team_color ?? 'amarillo')
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim() || !apellido.trim()) { setError('Nombre y apellido son necesarios.'); return }
    setSaving(true)
    setError(null)
    const payload = {
      nombre: nombre.trim(), apellido: apellido.trim(), discipulador: discipulador.trim() || null,
      fecha_nacimiento: fechaNacimiento || null, dpi: dpi.trim() || null, celular: celular.trim() || null,
      tiempo_asistencia: tiempoAsistencia.trim() || null, bautizado_aguas: bautizadoAguas,
      bautizado_espiritu: bautizadoEspiritu, profesion: profesion.trim() || null, team_color: teamColor,
      email: email.trim().toLowerCase() || null, disponibilidad: disponibilidad.trim() || null,
    }
    let id = maestro?.id
    if (maestro) {
      const { error: err } = await supabase.from('maestros').update(payload).eq('id', maestro.id)
      if (err) { setError('No se pudo guardar. Intenta de nuevo.'); setSaving(false); return }
    } else {
      const { data, error: err } = await supabase.from('maestros').insert(payload).select().single()
      if (err || !data) { setError('No se pudo guardar. Intenta de nuevo.'); setSaving(false); return }
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
    setConfirmDelete(false)
    onSaved()
  }

  return (
    <form onSubmit={handleSave} className="px-5 sm:px-7 pt-3 sm:pt-7 pb-6 space-y-5">
      <div className="flex items-center gap-3 pr-10">
        <span className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center"><Contact size={20} /></span>
        <h2 className="text-2xl font-bold text-gray-900">{maestro ? `${maestro.nombre} ${maestro.apellido}` : 'Nuevo maestro'}</h2>
      </div>

      <PhotoCapture existingPath={maestro?.photo_url} onFileReady={setPhotoBlob} size={76} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Nombre" required><input value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus={!maestro} className={INPUT} /></Field>
        <Field label="Apellido" required><input value={apellido} onChange={(e) => setApellido(e.target.value)} className={INPUT} /></Field>
      </div>

      <Field label="Equipo">
        <div className="grid grid-cols-3 gap-2">
          {TEAM_ORDER.map((t) => (
            <motion.button key={t} type="button" whileTap={{ scale: 0.96 }} onClick={() => setTeamColor(t)}
              className={`flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold border-2 transition-colors ${teamColor === t ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}>
              <span className={`w-3 h-3 rounded-full ${TEAM_STYLE[t].dot}`} /> {TEAM_COLOR_LABELS[t]}
            </motion.button>
          ))}
        </div>
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Celular"><input type="tel" inputMode="tel" value={celular} onChange={(e) => setCelular(e.target.value)} className={INPUT} /></Field>
        <Field label="Discipulador" hint="(opcional)"><input value={discipulador} onChange={(e) => setDiscipulador(e.target.value)} className={INPUT} /></Field>
        <Field label="Fecha de nacimiento"><input type="date" value={fechaNacimiento} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setFechaNacimiento(e.target.value)} className={INPUT} /></Field>
        <Field label="DPI" hint="(si es mayor de edad)"><input inputMode="numeric" value={dpi} onChange={(e) => setDpi(e.target.value)} className={INPUT} /></Field>
        <Field label="Tiempo en la iglesia"><input value={tiempoAsistencia} onChange={(e) => setTiempoAsistencia(e.target.value)} placeholder="Ej. 3 años" className={INPUT} /></Field>
        <Field label="Profesión u oficio" hint="(opcional)"><input value={profesion} onChange={(e) => setProfesion(e.target.value)} className={INPUT} /></Field>
        <Field label="Correo" hint="(opcional)"><input type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} /></Field>
      </div>

      <Field label="Disponibilidad" hint="(si puede servir cada domingo que le toca u otros compromisos)">
        <textarea value={disponibilidad} onChange={(e) => setDisponibilidad(e.target.value)} rows={2} className={`${INPUT} resize-none`} />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="¿Bautizado en aguas?">
          <ChoiceChips value={bautizadoAguas} onChange={setBautizadoAguas} options={[{ value: true, label: 'Sí' }, { value: false, label: 'No' }]} />
        </Field>
        <Field label="¿Bautizado en el Espíritu?">
          <ChoiceChips value={bautizadoEspiritu} onChange={setBautizadoEspiritu} options={[{ value: true, label: 'Sí' }, { value: false, label: 'No' }]} />
        </Field>
      </div>

      <FormError error={error} />

      <div className="flex gap-2 pt-1">
        {maestro && (
          <button type="button" onClick={() => setConfirmDelete(true)} className="px-4 py-3.5 rounded-2xl bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-700 transition-colors" aria-label="Eliminar maestro">
            <Trash2 size={18} />
          </button>
        )}
        <button type="button" onClick={onCancel} className="flex-1 py-3.5 rounded-2xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200">Cancelar</button>
        <motion.button type="submit" disabled={saving} whileTap={{ scale: 0.97 }} className="flex-[2] py-3.5 rounded-2xl bg-indigo-600 text-white font-display font-bold text-lg hover:bg-indigo-700 disabled:opacity-60">
          {saving ? 'Guardando…' : 'Guardar'}
        </motion.button>
      </div>

      <ConfirmSheet
        open={confirmDelete}
        title={`¿Eliminar a ${maestro?.nombre ?? ''}?`}
        message="Se quita del directorio de maestros. Esto no borra su cuenta de la app, si tiene."
        confirmLabel="Sí, eliminar"
        destructive
        busy={saving}
        onConfirm={handleDelete}
        onClose={() => setConfirmDelete(false)}
      />
    </form>
  )
}
