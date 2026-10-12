import { useState } from 'react'
import { motion } from 'framer-motion'
import { Phone, Pencil, Plus, Trash2, ChevronRight, Check } from 'lucide-react'
import { getAgeLabel, getEffectiveCategory, hasCategoryChanged } from '../../lib/categoryUtils'
import { CATEGORY_LABELS, type ChildPrefill } from '../../types/domain'
import { Sheet } from '../../components/motion'
import { itemVariants } from '../../components/motion/presets'
import { PageHeader, BTN_SECONDARY } from '../../components/ui/PageHeader'
import { PhotoAvatar, PhotoCapture } from '../../components/ui/PhotoCapture'
import { ConfirmSheet } from '../../components/ui/ConfirmSheet'
import { Field, FormError, INPUT } from '../../components/ui/form'
import { groupOf, initials } from '../checkin/shared'
import { ChildForm } from './ChildForm'
import { ChildSheet } from './ChildSheet'
import { createChild, deleteFamily, saveParent, visitsOf, type ChildDetail, type FamilyDetail } from './data'

/** Una familia: quién la trae, sus niños, y todo lo que se puede hacer. */
export function FamilyView({ family, onBack, onRefresh, onDeleted, onChildAdded, initialChildPrefill }: {
  family: FamilyDetail
  onBack: () => void
  onRefresh: () => void
  onDeleted: () => void
  onChildAdded?: () => void
  /** Llegamos desde "Agregar a esta familia": abrir de una vez el formulario lleno. */
  initialChildPrefill?: ChildPrefill | null
}) {
  const [openChildId, setOpenChildId] = useState<string | null>(null)
  const [justAddedId, setJustAddedId] = useState<string | null>(null)
  const [adding, setAdding] = useState(!!initialChildPrefill)
  const [prefill, setPrefill] = useState(initialChildPrefill ?? null)
  const [editingParent, setEditingParent] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalVisits = family.children.reduce((s, c) => s + visitsOf(c), 0)
  const openChild = family.children.find((c) => c.id === openChildId) ?? null

  async function handleDeleteFamily() {
    setDeleting(true)
    const err = await deleteFamily(family)
    setDeleting(false)
    setConfirmDelete(false)
    if (err) { setError(err); return }
    onDeleted()
  }

  return (
    <div className="space-y-5">
      <PageHeader
        onBack={onBack}
        eyebrow="Familia"
        title={family.full_name}
        actions={
          <button onClick={() => setConfirmDelete(true)} className={`${BTN_SECONDARY} !text-red-600 hover:!border-red-200 hover:!bg-red-50`}>
            <Trash2 size={16} /> Eliminar familia
          </button>
        }
      />

      <FormError error={error} />

      {/* ── Responsable ── */}
      <motion.section
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="rounded-3xl bg-white border border-gray-200/70 shadow-sm p-5 flex flex-col sm:flex-row sm:items-center gap-4"
      >
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {family.photo_url ? <PhotoAvatar path={family.photo_url} size={64} /> : (
            <span className="w-16 h-16 rounded-full bg-indigo-50 text-indigo-700 font-display font-bold text-2xl flex items-center justify-center shrink-0">{initials(family.full_name)}</span>
          )}
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Padre, madre o responsable</p>
            <p className="font-display text-xl font-bold text-gray-900 leading-tight truncate">{family.full_name}</p>
            <a href={family.phone ? `tel:${family.phone.replace(/\s/g, '')}` : undefined} className="inline-flex items-center gap-1.5 text-gray-600 mt-0.5 hover:text-indigo-700">
              <Phone size={14} /> <span className="tabular-nums">{family.phone || 'Sin teléfono'}</span>
            </a>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <MiniStat label="Niños" value={family.children.length} />
          <MiniStat label="Visitas" value={totalVisits} />
          <button onClick={() => setEditingParent(true)} className={`${BTN_SECONDARY} ml-auto sm:ml-0`}>
            <Pencil size={15} /> Editar
          </button>
        </div>
      </motion.section>

      {/* ── Niños ── */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xl font-bold text-gray-900">Niños</h2>
          <span className="text-sm text-gray-500">Toca uno para ver todo y editarlo</span>
        </div>
        <motion.div initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          {family.children.map((c, i) => (
            <FamilyChildRow key={c.id} child={c} index={i} justAdded={c.id === justAddedId} onOpen={() => setOpenChildId(c.id)} />
          ))}
        </motion.div>
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => setAdding(true)}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-dashed border-indigo-200 text-indigo-700 font-semibold hover:bg-indigo-50 hover:border-indigo-300 transition-colors"
        >
          <Plus size={18} /> Agregar niño a esta familia
        </motion.button>
      </section>

      {/* ── Paneles ── */}
      <ChildSheet
        child={openChild}
        highlightCheckIn={openChildId === justAddedId}
        parentName={family.full_name}
        onClose={() => setOpenChildId(null)}
        onChanged={onRefresh}
      />

      <Sheet open={adding} onClose={() => { setAdding(false); setPrefill(null) }} title="Agregar niño" wide>
        <div className="px-5 sm:px-7 pt-3 sm:pt-7 pb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-1 pr-10">Agregar niño</h2>
          <p className="text-gray-500 mb-5">A la familia de {family.full_name}</p>
          <ChildForm
            prefill={prefill}
            submitLabel="Agregar niño"
            onCancel={() => { setAdding(false); setPrefill(null) }}
            onSubmit={async (d) => {
              const res = await createChild(family.id, d)
              if ('error' in res) return res.error
              setAdding(false)
              setPrefill(null)
              setJustAddedId(res.id)
              onRefresh()
              onChildAdded?.()
              // Abre su panel para registrarlo hoy de una vez.
              setTimeout(() => setOpenChildId(res.id), 450)
              return null
            }}
          />
        </div>
      </Sheet>

      <ParentSheet open={editingParent} family={family} onClose={() => setEditingParent(false)} onSaved={() => { setEditingParent(false); onRefresh() }} />

      <ConfirmSheet
        open={confirmDelete}
        title={`¿Eliminar la familia de ${family.full_name}?`}
        message={`Se marcarán ${family.children.length} niño(s) y todos sus registros de asistencia (${totalVisits} en total). Queda en la papelera por si hay que restaurarla.`}
        confirmLabel="Sí, eliminar"
        destructive
        busy={deleting}
        onConfirm={handleDeleteFamily}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-gray-50 px-4 py-2 text-center min-w-[4.5rem]">
      <p className="font-display text-2xl font-bold text-gray-900 leading-none tabular-nums">{value}</p>
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  )
}

function FamilyChildRow({ child, index, onOpen, justAdded }: { child: ChildDetail; index: number; onOpen: () => void; justAdded: boolean }) {
  const category = getEffectiveCategory(child)
  const g = groupOf(category)
  const age = getAgeLabel(child.birth_date)
  const hasAlert = !!(child.allergies || child.medical_notes)
  const visits = visitsOf(child)
  return (
    <motion.button
      layout="position"
      variants={itemVariants}
      custom={index}
      whileTap={{ scale: 0.985 }}
      onClick={onOpen}
      className={`group w-full text-left flex items-center gap-3 rounded-2xl px-3.5 py-3 bg-white border shadow-sm shadow-gray-900/5 hover:shadow-md transition-[border-color,box-shadow] ${justAdded ? 'border-emerald-300 ring-4 ring-emerald-100' : 'border-transparent hover:border-indigo-200'}`}
    >
      <span className={`relative w-12 h-12 rounded-full flex items-center justify-center font-display font-bold text-base shrink-0 ${g.avatar}`}>
        {justAdded ? <Check size={20} strokeWidth={3} /> : initials(child.full_name)}
        {hasAlert && <span className="absolute -top-0.5 -right-0.5 w-[18px] h-[18px] rounded-full bg-red-500 ring-2 ring-white text-white text-[10px] font-bold flex items-center justify-center">!</span>}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-display font-bold text-lg leading-tight text-gray-900 truncate">{child.full_name}</span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5 text-sm text-gray-500">
          <span className={`font-semibold ${g.iconColor}`}>{category ? CATEGORY_LABELS[category] : 'Sin grupo'}</span>
          {age !== null && <span>{age} años</span>}
          <span>· {visits} visita{visits !== 1 ? 's' : ''}</span>
          {hasCategoryChanged(child) && <span className="text-amber-700 font-semibold">· 🎉 puede subir de grupo</span>}
        </span>
      </span>
      <ChevronRight size={18} className="text-gray-300 group-hover:text-indigo-500 transition-colors shrink-0" />
    </motion.button>
  )
}

function ParentSheet({ open, family, onClose, onSaved }: { open: boolean; family: FamilyDetail; onClose: () => void; onSaved: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Editar responsable">
      {open && <ParentForm family={family} onClose={onClose} onSaved={onSaved} />}
    </Sheet>
  )
}

function ParentForm({ family, onClose, onSaved }: { family: FamilyDetail; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(family.full_name)
  const [phone, setPhone] = useState(family.phone ?? '')
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Escribe el nombre.'); return }
    setSaving(true)
    const err = await saveParent(family.id, { full_name: name.trim(), phone: phone.trim() }, photo)
    setSaving(false)
    if (err) { setError(err); return }
    onSaved()
  }
  return (
    <form onSubmit={submit} className="px-5 sm:px-7 pt-3 sm:pt-7 pb-6 space-y-5">
      <h2 className="text-2xl font-bold text-gray-900 pr-10">Editar responsable</h2>
      <PhotoCapture existingPath={family.photo_url} onFileReady={setPhoto} size={76} />
      <Field label="Nombre completo" required>
        <input value={name} onChange={(e) => setName(e.target.value)} className={INPUT} autoFocus />
      </Field>
      <Field label="Teléfono">
        <input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={INPUT} />
      </Field>
      <FormError error={error} />
      <div className="flex gap-2">
        <button type="button" onClick={onClose} className="flex-1 py-3.5 rounded-2xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200">Cancelar</button>
        <button type="submit" disabled={saving} className="flex-[2] py-3.5 rounded-2xl bg-indigo-600 text-white font-display font-bold text-lg hover:bg-indigo-700 disabled:opacity-60">
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}
