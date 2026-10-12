import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Baby, MessageSquareText, Pencil, PartyPopper, Trash2, UserRound, Users, LogIn, Link2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { getAgeLabel, getEffectiveCategory, hasCategoryChanged } from '../../lib/categoryUtils'
import { CATEGORY_LABELS, GUARDIAN_RELATIONSHIP_LABELS, NEXT_CATEGORY, isCorderitos } from '../../types/domain'
import { Sheet } from '../../components/motion'
import { ChildContacts } from '../../components/ui/ChildContacts'
import { QuickCheckIn } from '../../components/ui/QuickCheckIn'
import { PhotoAvatar } from '../../components/ui/PhotoCapture'
import { ConfirmSheet } from '../../components/ui/ConfirmSheet'
import { FormError, INPUT } from '../../components/ui/form'
import { useDebounce } from '../../hooks/useDebounce'
import { groupOf } from '../checkin/shared'
import { ChildForm } from './ChildForm'
import { assignParent, deleteChild, updateChild, visitsOf, type ChildDetail, type RosterChild } from './data'

/**
 * Panel de un niño desde Familias: todo lo que se sabe de él, editar,
 * borrar, contactos, y registrarlo hoy sin ir a Registro.
 */
export function ChildSheet({ child, onClose, onChanged, startInEdit = false, highlightCheckIn = false, parentName }: {
  child: (ChildDetail | RosterChild) | null
  onClose: () => void
  /** Algo cambió (guardado, borrado, asignado): recargar la lista. */
  onChanged: () => void
  startInEdit?: boolean
  /** Recién creado: mostrar "registrar hoy" arriba. */
  highlightCheckIn?: boolean
  /** Nombre del responsable cuando se abre desde la familia. */
  parentName?: string
}) {
  const [shown, setShown] = useState(child)
  useEffect(() => { if (child) setShown(child) }, [child])
  return (
    <Sheet open={!!child} onClose={onClose} title={shown ? shown.full_name : 'Niño'} wide>
      {shown && <Body key={shown.id} child={child ?? shown} onClose={onClose} onChanged={onChanged} startInEdit={startInEdit} highlightCheckIn={highlightCheckIn} parentName={parentName} />}
    </Sheet>
  )
}

function Body({ child, onClose, onChanged, startInEdit, highlightCheckIn, parentName }: {
  child: ChildDetail | RosterChild
  onClose: () => void
  onChanged: () => void
  startInEdit: boolean
  highlightCheckIn: boolean
  parentName?: string
}) {
  const [editing, setEditing] = useState(startInEdit)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [assigning, setAssigning] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  const category = getEffectiveCategory(child)
  const g = groupOf(category)
  const age = getAgeLabel(child.birth_date)
  const visits = visitsOf(child)
  const hasAlert = !!(child.allergies || child.medical_notes)
  const graduatesTo = hasCategoryChanged(child) && child.category ? NEXT_CATEGORY[child.category] : null
  const parent = 'parents' in child ? child.parents : undefined
  const maestro = child.assigned_maestro ? `${child.assigned_maestro.nombre} ${child.assigned_maestro.apellido}` : child.assigned_maestro_name

  async function handleDelete() {
    setDeleting(true)
    const err = await deleteChild(child.id)
    setDeleting(false)
    if (err) { setError(err); setConfirmDelete(false); return }
    setConfirmDelete(false)
    onChanged()
    onClose()
  }

  if (editing) {
    return (
      <div className="px-5 sm:px-7 pt-3 sm:pt-7 pb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-5 pr-10">Editar a {child.full_name.split(' ')[0]}</h2>
        <ChildForm
          child={child}
          submitLabel="Guardar cambios"
          onCancel={() => setEditing(false)}
          onSubmit={async (d) => {
            const err = await updateChild(child.id, d, child.photo_url)
            if (!err) { setEditing(false); setSavedFlash(true); onChanged(); setTimeout(() => setSavedFlash(false), 1600) }
            return err
          }}
        />
      </div>
    )
  }

  return (
    <div className="px-5 sm:px-7 pt-3 sm:pt-7 pb-6 space-y-4">
      {/* ── Encabezado ── */}
      <div className="flex items-center gap-4 pr-10">
        <div className="relative shrink-0">
          {child.photo_url ? <PhotoAvatar path={child.photo_url} size={64} /> : (
            <span className={`w-16 h-16 rounded-full flex items-center justify-center font-display font-bold text-2xl ${g.avatar}`}>
              {child.full_name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <h2 className="text-[26px] font-bold text-gray-900 leading-tight">{child.full_name}</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            <span className={`font-semibold ${g.iconColor}`}>{category ? CATEGORY_LABELS[category] : 'Sin grupo'}</span>
            {age !== null && <> · {age} año{age !== 1 ? 's' : ''}</>}
          </p>
        </div>
      </div>

      <AnimatePresence>
        {savedFlash && (
          <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-2xl bg-emerald-50 text-emerald-800 text-sm font-semibold px-4 py-2.5">
            ✓ Cambios guardados
          </motion.p>
        )}
      </AnimatePresence>

      {/* ── Datos rápidos ── */}
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Visitas" value={String(visits)} />
        <Stat label="Responsable" value={parent === undefined ? (parentName ?? '—') : parent?.full_name ?? 'Sin asignar'} warn={parent === null} />
      </div>

      {hasAlert && (
        <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 flex gap-3">
          <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />
          <div className="text-sm text-red-800 space-y-0.5">
            <p className="font-semibold">Alerta médica</p>
            {child.allergies && <p><span className="font-medium">Alergias:</span> {child.allergies}</p>}
            {child.medical_notes && <p><span className="font-medium">Notas:</span> {child.medical_notes}</p>}
          </div>
        </div>
      )}
      {graduatesTo && (
        <p className="rounded-2xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800 flex items-center gap-2">
          <PartyPopper size={16} className="shrink-0" /> Ya cumplió años: puede pasar a {CATEGORY_LABELS[graduatesTo]}.
        </p>
      )}
      {!child.birth_date && (
        <p className="rounded-2xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800">Falta su fecha de nacimiento. Agrégala en "Editar" para que su grupo se calcule solo.</p>
      )}

      {(isCorderitos(category) || child.comments || child.guardian_relationship) && (
        <ul className="rounded-2xl bg-gray-50 divide-y divide-gray-100 text-sm">
          {isCorderitos(category) && (
            <InfoRow icon={Baby} text={child.toilet_trained === true ? 'Ya va solo al baño' : child.toilet_trained === false ? 'Aún usa pañal / no va solo al baño' : 'No se sabe si va solo al baño'} />
          )}
          {isCorderitos(category) && maestro && <InfoRow icon={UserRound} text={`Maestro responsable: ${maestro}${child.assigned_maestro ? '' : ' (aún sin registrar)'}`} />}
          {child.guardian_relationship && <InfoRow icon={Users} text={`Lo trae: ${GUARDIAN_RELATIONSHIP_LABELS[child.guardian_relationship]}`} />}
          {child.comments && <InfoRow icon={MessageSquareText} text={child.comments} />}
        </ul>
      )}

      {parent === null && (
        <div className="rounded-2xl border-2 border-dashed border-amber-200 p-3 space-y-2">
          {assigning ? <ParentPicker onSelect={async (p) => {
            const err = await assignParent(child.id, p.id)
            if (err) { setError(err); return }
            setAssigning(false); onChanged()
          }} /> : (
            <button onClick={() => setAssigning(true)} className="w-full flex items-center justify-center gap-2 py-2 text-sm font-semibold text-amber-800">
              <Link2 size={15} /> Asignarle un responsable
            </button>
          )}
        </div>
      )}

      {/* ── Registrar hoy ── */}
      <motion.div
        initial={highlightCheckIn ? { scale: 0.97, opacity: 0 } : false}
        animate={{ scale: 1, opacity: 1 }}
        className={`rounded-2xl px-4 py-3 space-y-2 ${highlightCheckIn ? 'bg-indigo-50 ring-2 ring-indigo-200' : 'bg-indigo-50/60'}`}
      >
        <p className="text-sm font-semibold text-indigo-800 flex items-center gap-1.5"><LogIn size={15} /> Registrar hoy</p>
        <QuickCheckIn childId={child.id} category={category} />
      </motion.div>

      <ChildContacts childId={child.id} />

      <FormError error={error} />

      <div className="flex gap-2 pt-1">
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => setEditing(true)}
          className="flex-[2] inline-flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-indigo-600 text-white font-display font-bold text-lg hover:bg-indigo-700 transition-colors">
          <Pencil size={17} /> Editar datos
        </motion.button>
        <button onClick={() => setConfirmDelete(true)} className="flex-1 inline-flex items-center justify-center gap-1.5 py-3.5 rounded-2xl bg-gray-100 text-gray-600 font-semibold hover:bg-red-50 hover:text-red-700 transition-colors">
          <Trash2 size={16} /> Eliminar
        </button>
      </div>

      <ConfirmSheet
        open={confirmDelete}
        title={`¿Eliminar a ${child.full_name}?`}
        message={`Se marcarán también sus ${visits} registro(s) de asistencia. Queda en la papelera por si hay que restaurarlo.`}
        confirmLabel="Sí, eliminar"
        destructive
        busy={deleting}
        onConfirm={handleDelete}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  )
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`rounded-2xl px-4 py-3 ${warn ? 'bg-amber-50' : 'bg-gray-50'}`}>
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`font-display font-bold text-lg leading-tight truncate ${warn ? 'text-amber-800' : 'text-gray-900'}`}>{value}</p>
    </div>
  )
}

function InfoRow({ icon: Icon, text }: { icon: typeof Baby; text: string }) {
  return (
    <li className="flex items-start gap-2.5 px-4 py-2.5 text-gray-700">
      <Icon size={16} className="text-gray-400 shrink-0 mt-0.5" />
      <span>{text}</span>
    </li>
  )
}

function ParentPicker({ onSelect }: { onSelect: (parent: { id: string; full_name: string }) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ id: string; full_name: string; phone: string | null }[]>([])
  const debounced = useDebounce(query.trim(), 300)
  useEffect(() => {
    if (debounced.length < 2) { setResults([]); return }
    let cancelled = false
    supabase.from('parents').select('id, full_name, phone').ilike('full_name', `%${debounced}%`).limit(8)
      .then(({ data }) => { if (!cancelled) setResults(data ?? []) })
    return () => { cancelled = true }
  }, [debounced])
  return (
    <div className="space-y-2">
      <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar responsable por nombre…" className={INPUT} />
      {results.map((p) => (
        <button key={p.id} onClick={() => onSelect(p)}
          className="w-full text-left px-4 py-2.5 rounded-2xl bg-white border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors text-sm">
          <span className="font-semibold text-gray-800">{p.full_name}</span>
          {p.phone && <span className="text-gray-500"> · {p.phone}</span>}
        </button>
      ))}
    </div>
  )
}
