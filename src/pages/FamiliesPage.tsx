import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSearchParams, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, ChevronRight, Edit2, Check, X, Plus, Phone,
  AlertTriangle, UserPlus, Trash2, Users, ChevronLeft,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { getCategoryFromBirthDate, getEffectiveCategory, hasCategoryChanged, getAgeLabel } from '../lib/categoryUtils'
import { createChildSearcher, searchChildrenSplit, findBySurname, normalizeName } from '../lib/fuzzySearch'
import { uploadPhoto } from '../lib/photo'
import { CategoryBadge } from '../components/ui/CategoryBadge'
import { PhotoCapture, PhotoAvatar } from '../components/ui/PhotoCapture'
import { ChildContacts } from '../components/ui/ChildContacts'
import { QuickCheckIn } from '../components/ui/QuickCheckIn'
import { useDebounce } from '../hooks/useDebounce'
import { NewFamilyStep } from '../components/checkin/NewFamilyStep'
import { CATEGORY_LABELS, GUARDIAN_RELATIONSHIP_LABELS, NEXT_CATEGORY, isCorderitos, type ParentRow, type Category, type GuardianRelationship, type ChildPrefill } from '../types/domain'
import { BackgroundRadialViolet } from '../components/ui/BackgroundRadialViolet'

// ─── Types ────────────────────────────────────────────────────────────────────

type ChildDetail = {
  id: string
  parent_id: string | null
  full_name: string
  birth_date: string | null
  category: Category | null
  allergies: string | null
  medical_notes: string | null
  guardian_relationship: GuardianRelationship | null
  comments: string | null
  toilet_trained: boolean | null
  photo_url: string | null
  attendance: { count: number }[]
}

type FamilyDetail = {
  id: string
  full_name: string
  phone: string
  photo_url: string | null
  children: ChildDetail[]
}

// ─── Confirm dialog ───────────────────────────────────────────────────────────

function ConfirmDialog({
  message,
  subtext,
  destructive,
  onConfirm,
  onCancel,
}: {
  message: string
  subtext?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
    >
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4">
        <p className="font-bold text-gray-900">{message}</p>
        {subtext && <p className="text-sm text-gray-500">{subtext}</p>}
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2.5 text-sm font-semibold text-white rounded-xl transition-colors ${
              destructive ? 'bg-red-500 hover:bg-red-600' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            Confirmar
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Child edit form ──────────────────────────────────────────────────────────

function ChildEditForm({
  child,
  onSave,
  onCancel,
}: {
  child: ChildDetail
  onSave: (data: Omit<Partial<ChildDetail>, 'id' | 'parent_id' | 'attendance'>) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName]         = useState(child.full_name)
  const [birthDate, setBirthDate] = useState(child.birth_date ?? '')
  const [allergies, setAllergies] = useState(child.allergies ?? '')
  const [notes, setNotes]       = useState(child.medical_notes ?? '')
  const [relationship, setRelationship] = useState<GuardianRelationship | ''>(child.guardian_relationship ?? '')
  const [comments, setComments] = useState(child.comments ?? '')
  const [toiletTrained, setToiletTrained] = useState<boolean | null>(child.toilet_trained)
  const [manualCategory, setManualCategory] = useState<Category | ''>(child.category ?? '')
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const previewCategory = birthDate ? getCategoryFromBirthDate(birthDate) : null
  const previewAge = getAgeLabel(birthDate)

  // Category normally follows birth date, but a coordinator can override it by
  // hand (e.g. a child who's aged past what the category allows but stays put
  // for another reason) — only re-sync to the computed category when the
  // birth date itself changes, so a manual override made afterward sticks.
  useEffect(() => {
    if (birthDate) {
      const computed = getCategoryFromBirthDate(birthDate)
      if (computed) setManualCategory(computed)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [birthDate])

  async function handleSave() {
    if (!name.trim()) { setError('El nombre es requerido'); return }
    setSaving(true)
    let photo_url = child.photo_url
    if (photoBlob) {
      const path = await uploadPhoto(`children/${child.id}.jpg`, photoBlob)
      if (path) photo_url = path
    }
    await onSave({
      full_name: name.trim(),
      birth_date: birthDate || null,
      category: manualCategory || null,
      allergies: allergies.trim() || null,
      medical_notes: notes.trim() || null,
      guardian_relationship: relationship || null,
      comments: comments.trim() || null,
      toilet_trained: toiletTrained,
      photo_url,
    })
    setSaving(false)
  }

  return (
    <div className="space-y-3 pt-2">
      {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <PhotoCapture existingPath={child.photo_url} onFileReady={setPhotoBlob} />
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Nombre completo</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Fecha de nacimiento</label>
        <div className="flex items-center gap-2">
          <input type="date" value={birthDate ?? ''} max={new Date().toISOString().split('T')[0]}
            onChange={(e) => setBirthDate(e.target.value)}
            className="flex-1 px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm" />
          <div className="flex items-center gap-1.5 shrink-0">
            <CategoryBadge category={manualCategory || previewCategory || child.category} size="sm" />
            {previewAge !== null && <span className="text-xs text-gray-400">{previewAge} a.</span>}
          </div>
        </div>
        {!birthDate && (
          <p className="text-xs text-gray-400 mt-1">Sin fecha de nacimiento — elige la clase a mano abajo.</p>
        )}
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Categoría {birthDate ? '(cámbiala a mano si hace falta)' : '(manual, sin fecha de nacimiento)'}
        </label>
        <select value={manualCategory} onChange={(e) => setManualCategory(e.target.value as Category | '')}
          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm bg-white">
          <option value="">Sin categoría</option>
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>
      {isCorderitos(manualCategory || previewCategory || child.category) && (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">¿Ya va solo al baño?</label>
          <div className="grid grid-cols-3 gap-2">
            {([
              { value: true, label: 'Sí' },
              { value: false, label: 'No / pañal' },
              { value: null, label: 'No sé' },
            ] as const).map((opt) => (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => setToiletTrained(opt.value)}
                className={`py-2 rounded-lg text-xs font-semibold border-2 transition-colors ${
                  toiletTrained === opt.value
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Parentesco del responsable</label>
        <select value={relationship} onChange={(e) => setRelationship(e.target.value as GuardianRelationship | '')}
          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm bg-white">
          <option value="">Sin especificar</option>
          {Object.entries(GUARDIAN_RELATIONSHIP_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Alergias</label>
        <input type="text" value={allergies} onChange={(e) => setAllergies(e.target.value)}
          placeholder="Ninguna"
          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Notas médicas</label>
        <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Ninguna"
          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Comentarios adicionales</label>
        <textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={2}
          placeholder="Ej. ya va solo al baño…"
          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm resize-none" />
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel}
          className="flex-1 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
          Cancelar
        </button>
        <button onClick={handleSave} disabled={saving}
          className="flex-[2] py-2 flex items-center justify-center gap-1.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
          <Check size={14} />
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  )
}

// ─── New child form ───────────────────────────────────────────────────────────

function NewChildForm({ parentId, prefill, onSaved, onCancel }: { parentId: string; prefill?: ChildPrefill; onSaved: (childId: string) => void; onCancel: () => void }) {
  const [name, setName]         = useState(prefill?.full_name ?? '')
  const [birthDate, setBirthDate] = useState(prefill?.birth_date ?? '')
  const [allergies, setAllergies] = useState(prefill?.allergies ?? '')
  const [notes, setNotes]       = useState(prefill?.medical_notes ?? '')
  const [relationship, setRelationship] = useState<GuardianRelationship | ''>(prefill?.guardian_relationship ?? '')
  const [comments, setComments] = useState(prefill?.comments ?? '')
  const [toiletTrained, setToiletTrained] = useState<boolean | null>(prefill?.toilet_trained ?? null)
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const previewCategory = birthDate ? getCategoryFromBirthDate(birthDate) : null
  const previewAge = getAgeLabel(birthDate)

  async function handleSave() {
    if (!name.trim()) { setError('El nombre es requerido'); return }
    if (!birthDate) { setError('La fecha de nacimiento es requerida'); return }
    setSaving(true)
    const { data, error: err } = await supabase.from('children').insert({
      parent_id: parentId, full_name: name.trim(), birth_date: birthDate,
      category: getCategoryFromBirthDate(birthDate),
      allergies: allergies.trim() || null, medical_notes: notes.trim() || null,
      guardian_relationship: relationship || null, comments: comments.trim() || null,
      toilet_trained: toiletTrained,
    }).select().single()
    if (err || !data) { setSaving(false); setError('Error al guardar.'); return }
    if (photoBlob) {
      const path = await uploadPhoto(`children/${data.id}.jpg`, photoBlob)
      if (path) await supabase.from('children').update({ photo_url: path }).eq('id', data.id)
    }
    setSaving(false)
    onSaved(data.id)
  }

  return (
    <div className="border-2 border-dashed border-indigo-200 rounded-xl p-4 space-y-3 bg-indigo-50">
      <p className="text-sm font-semibold text-indigo-700">Nuevo niño</p>
      {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <PhotoCapture onFileReady={setPhotoBlob} />
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Nombre completo *</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del niño" autoFocus
          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm bg-white" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Fecha de nacimiento *</label>
        <div className="flex items-center gap-2">
          <input type="date" value={birthDate} max={new Date().toISOString().split('T')[0]}
            onChange={(e) => setBirthDate(e.target.value)}
            className="flex-1 px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm bg-white" />
          {previewCategory && (
            <div className="flex items-center gap-1.5 shrink-0">
              <CategoryBadge category={previewCategory} size="sm" />
              {previewAge !== null && <span className="text-xs text-gray-400">{previewAge} a.</span>}
            </div>
          )}
        </div>
      </div>
      {isCorderitos(previewCategory) && (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">¿Ya va solo al baño?</label>
          <div className="grid grid-cols-3 gap-2">
            {([
              { value: true, label: 'Sí' },
              { value: false, label: 'No / pañal' },
              { value: null, label: 'No sé' },
            ] as const).map((opt) => (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => setToiletTrained(opt.value)}
                className={`py-2 rounded-lg text-xs font-semibold border-2 transition-colors ${
                  toiletTrained === opt.value
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Parentesco del responsable</label>
        <select value={relationship} onChange={(e) => setRelationship(e.target.value as GuardianRelationship | '')}
          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm bg-white">
          <option value="">Sin especificar</option>
          {Object.entries(GUARDIAN_RELATIONSHIP_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Alergias</label>
        <input type="text" value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="Opcional"
          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm bg-white" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Notas médicas</label>
        <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional"
          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm bg-white" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Comentarios adicionales</label>
        <textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={2} placeholder="Opcional"
          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm bg-white resize-none" />
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel}
          className="flex-1 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
          Cancelar
        </button>
        <button onClick={handleSave} disabled={saving}
          className="flex-[2] py-2 flex items-center justify-center gap-1.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
          <Check size={14} />
          {saving ? 'Guardando…' : 'Agregar niño'}
        </button>
      </div>
    </div>
  )
}

// ─── Family detail panel ──────────────────────────────────────────────────────

function FamilyDetailPanel({
  family,
  onClose,
  onRefresh,
  onDeleted,
  onChildAdded,
  initialChildPrefill,
}: {
  family: FamilyDetail
  onClose: () => void
  onRefresh: () => void
  onDeleted: () => void
  onChildAdded?: () => void
  /** Set when we arrived here via "Agregar a esta familia" from a same-surname
   * suggestion — opens straight into the add-child form, already filled in,
   * instead of making the coordinator click through and retype the name. */
  initialChildPrefill?: ChildPrefill | null
}) {
  const [editingParent, setEditingParent]   = useState(false)
  const [parentName, setParentName]         = useState(family.full_name)
  const [parentPhone, setParentPhone]       = useState(family.phone ?? '')
  const [parentPhotoBlob, setParentPhotoBlob] = useState<Blob | null>(null)
  const [savingParent, setSavingParent]     = useState(false)
  const [editingChildId, setEditingChildId] = useState<string | null>(null)
  const [addingChild, setAddingChild]       = useState(!!initialChildPrefill)
  // Local copy so it only ever fills the form once — otherwise closing and
  // reopening "Agregar niño" later in the same visit would keep re-showing
  // the first suggestion's data instead of starting blank.
  const [childPrefill, setChildPrefill]     = useState(initialChildPrefill ?? null)
  const [justSavedChildId, setJustSavedChildId] = useState<string | null>(null)

  // Confirm dialogs
  const [confirmDeleteChild, setConfirmDeleteChild] = useState<ChildDetail | null>(null)
  const [confirmDeleteFamily, setConfirmDeleteFamily] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function saveParent() {
    if (!parentName.trim()) return
    setSavingParent(true)
    const update: { full_name: string; phone: string; photo_url?: string } = {
      full_name: parentName.trim(), phone: parentPhone.trim(),
    }
    if (parentPhotoBlob) {
      const path = await uploadPhoto(`parents/${family.id}.jpg`, parentPhotoBlob)
      if (path) update.photo_url = path
    }
    // .select('id') forces PostgREST to report which rows were actually
    // updated — without it, an update silently blocked by RLS (0 rows
    // affected) still returns no error, and the UI would act like it saved.
    const { data, error } = await supabase.from('parents').update(update).eq('id', family.id).select('id')
    setSavingParent(false)
    if (error || !data || data.length === 0) { setDeleteError('No se pudo guardar. Intenta de nuevo.'); return }
    setEditingParent(false)
    onRefresh()
  }

  async function saveChild(childId: string, data: Omit<Partial<ChildDetail>, 'id' | 'parent_id' | 'attendance'>) {
    const { data: updated, error } = await supabase.from('children').update(data).eq('id', childId).select('id')
    if (error || !updated || updated.length === 0) { setDeleteError('No se pudo guardar. Intenta de nuevo.'); return }
    setEditingChildId(null)
    setJustSavedChildId(childId)
    onRefresh()
  }

  async function deleteChild(child: ChildDetail) {
    setDeleteError(null)
    const { data: { user } } = await supabase.auth.getUser()
    const now = new Date().toISOString()
    // Marcar (no borrar): la papelera guarda el registro hasta que alguien lo
    // restaure o el dueño lo purgue de verdad.
    await supabase.from('attendance').update({ deleted_at: now, deleted_by: user?.id }).eq('child_id', child.id)
    // .select() fuerza a PostgREST a reportar qué filas se marcaron de
    // verdad — sin esto, un update bloqueado por RLS (0 filas afectadas)
    // igual no da error, y el niño seguiría apareciendo como si nada.
    const { data, error } = await supabase.from('children').update({ deleted_at: now, deleted_by: user?.id }).eq('id', child.id).select('id')
    if (error || !data || data.length === 0) { setDeleteError('Error al eliminar. Intenta de nuevo.'); return }
    setConfirmDeleteChild(null)
    onRefresh()
  }

  async function deleteFamily() {
    setDeleteError(null)
    const { data: { user } } = await supabase.auth.getUser()
    const now = new Date().toISOString()
    // Marcar asistencia y niños de la familia
    for (const child of family.children) {
      await supabase.from('attendance').update({ deleted_at: now, deleted_by: user?.id }).eq('child_id', child.id)
    }
    await supabase.from('children').update({ deleted_at: now, deleted_by: user?.id }).eq('parent_id', family.id)
    // Marcar al padre/madre
    const { data, error } = await supabase.from('parents').update({ deleted_at: now, deleted_by: user?.id }).eq('id', family.id).select('id')
    if (error || !data || data.length === 0) { setDeleteError('Error al eliminar la familia. Intenta de nuevo.'); return }
    setConfirmDeleteFamily(false)
    onDeleted()
  }

  const totalVisits = family.children.reduce((s, c) => s + (c.attendance?.[0]?.count ?? 0), 0)

  return (
    <>
      <AnimatePresence>
        {confirmDeleteChild && (
          <ConfirmDialog
            message={`¿Eliminar a ${confirmDeleteChild.full_name}?`}
            subtext={`Se marcarán también sus ${confirmDeleteChild.attendance?.[0]?.count ?? 0} registro(s) de asistencia. Quedará en la papelera por si hay que restaurarlo.`}
            destructive
            onConfirm={() => deleteChild(confirmDeleteChild)}
            onCancel={() => setConfirmDeleteChild(null)}
          />
        )}
        {confirmDeleteFamily && (
          <ConfirmDialog
            message={`¿Eliminar la familia "${family.full_name}"?`}
            subtext={`Se marcarán ${family.children.length} niño(s) y todos sus registros de asistencia (${totalVisits} en total). Quedará en la papelera por si hay que restaurarlo.`}
            destructive
            onConfirm={deleteFamily}
            onCancel={() => setConfirmDeleteFamily(false)}
          />
        )}
      </AnimatePresence>

      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronLeft size={18} />
          </button>
          <h3 className="text-lg font-bold text-gray-900 flex-1">Detalle de familia</h3>
          <button
            onClick={() => setConfirmDeleteFamily(true)}
            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 px-2 py-1.5 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 size={12} /> Eliminar familia
          </button>
        </div>

        {deleteError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{deleteError}</p>
        )}

        {/* Padre / madre */}
        <section className="bg-white rounded-xl border-2 border-gray-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Padre o madre</p>
            {!editingParent && (
              <button onClick={() => setEditingParent(true)}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors">
                <Edit2 size={12} /> Editar
              </button>
            )}
          </div>

          {!editingParent ? (
            <div className="flex items-center gap-3">
              <PhotoAvatar path={family.photo_url} size={48} />
              <div className="space-y-1 min-w-0">
                <p className="text-lg font-bold text-gray-900">{family.full_name}</p>
                <div className="flex items-center gap-1.5 text-gray-500">
                  <Phone size={13} />
                  <span className="text-sm">{family.phone}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {family.children.length} niño{family.children.length !== 1 ? 's' : ''} · {totalVisits} visita{totalVisits !== 1 ? 's' : ''} en total
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <PhotoCapture existingPath={family.photo_url} onFileReady={setParentPhotoBlob} />
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Nombre</label>
                <input type="text" value={parentName} onChange={(e) => setParentName(e.target.value)}
                  className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm" autoFocus />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Teléfono</label>
                <input type="tel" value={parentPhone} onChange={(e) => setParentPhone(e.target.value)}
                  className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditingParent(false)}
                  className="flex-1 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                  Cancelar
                </button>
                <button onClick={saveParent} disabled={savingParent}
                  className="flex-[2] py-2 flex items-center justify-center gap-1.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                  <Check size={14} />
                  {savingParent ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Niños */}
        <section className="space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Niños ({family.children.length})
          </p>

          {family.children.map((child) => {
            const category      = getEffectiveCategory(child)
            const categoryChanged = hasCategoryChanged(child)
            const age           = getAgeLabel(child.birth_date)
            const visits        = child.attendance?.[0]?.count ?? 0
            const hasAlert      = !!(child.allergies || child.medical_notes)
            const isEditing     = editingChildId === child.id

            return (
              <div key={child.id}
                className={`bg-white rounded-xl border-2 p-4 space-y-3 ${hasAlert ? 'border-red-200' : 'border-gray-200'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3 min-w-0">
                    <PhotoAvatar path={child.photo_url} size={40} />
                    <div className="space-y-1.5 min-w-0">
                      <p className="font-bold text-gray-900 leading-tight">{child.full_name}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <CategoryBadge category={category} size="sm" />
                        {age !== null && <span className="text-xs text-gray-400">{age} años</span>}
                        <span className="text-xs text-gray-400">·</span>
                        <span className="text-xs font-semibold text-indigo-600">{visits} visita{visits !== 1 ? 's' : ''}</span>
                      </div>
                      {categoryChanged && category && child.category && NEXT_CATEGORY[child.category] === category && (
                        <span className="inline-block text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                          🎉 Ya cumplió años, puede pasar a {CATEGORY_LABELS[category]}
                        </span>
                      )}
                      {child.guardian_relationship && (
                        <p className="text-xs text-gray-400">Responsable: {GUARDIAN_RELATIONSHIP_LABELS[child.guardian_relationship]}</p>
                      )}
                    </div>
                  </div>
                  {!isEditing && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => { setEditingChildId(child.id); setAddingChild(false); setJustSavedChildId(null) }}
                        className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1 hover:bg-indigo-50 rounded-lg transition-colors">
                        <Edit2 size={11} /> Editar
                      </button>
                      <button onClick={() => setConfirmDeleteChild(child)}
                        className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 px-2 py-1 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  )}
                </div>

                {hasAlert && !isEditing && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 space-y-1">
                    <div className="flex items-center gap-1.5 text-red-700">
                      <AlertTriangle size={13} className="shrink-0" />
                      <span className="text-xs font-bold uppercase tracking-wide">Alerta médica</span>
                    </div>
                    {child.allergies && (
                      <p className="text-xs text-red-700 ml-5"><span className="font-semibold">Alergias:</span> {child.allergies}</p>
                    )}
                    {child.medical_notes && (
                      <p className="text-xs text-red-700 ml-5"><span className="font-semibold">Notas:</span> {child.medical_notes}</p>
                    )}
                  </div>
                )}

                {isCorderitos(category) && child.toilet_trained !== null && !isEditing && (
                  <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                    🚼 {child.toilet_trained ? 'Ya va solo al baño' : 'Aún usa pañal / no va solo al baño'}
                  </p>
                )}

                {child.comments && !isEditing && (
                  <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                    <span className="font-semibold">Comentarios:</span> {child.comments}
                  </p>
                )}

                {!isEditing && <ChildContacts childId={child.id} />}

                {isEditing && (
                  <ChildEditForm
                    child={child}
                    onSave={(data) => saveChild(child.id, data)}
                    onCancel={() => setEditingChildId(null)}
                  />
                )}

                {justSavedChildId === child.id && !isEditing && (
                  <div className="rounded-lg bg-indigo-50/60 border border-indigo-100 px-3 py-2.5 flex items-start justify-between gap-2">
                    <QuickCheckIn childId={child.id} category={category} />
                    <button onClick={() => setJustSavedChildId(null)} className="text-xs text-gray-400 hover:text-gray-600 shrink-0">
                      Listo
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          {addingChild ? (
            <NewChildForm
              parentId={family.id}
              prefill={childPrefill ?? undefined}
              onSaved={(childId) => { setAddingChild(false); setChildPrefill(null); setJustSavedChildId(childId); onRefresh(); onChildAdded?.() }}
              onCancel={() => { setAddingChild(false); setChildPrefill(null) }}
            />
          ) : (
            <button
              onClick={() => { setAddingChild(true); setEditingChildId(null) }}
              className="w-full py-3 flex items-center justify-center gap-2 text-sm font-medium text-indigo-600 border-2 border-dashed border-indigo-200 rounded-xl hover:bg-indigo-50 transition-colors"
            >
              <Plus size={15} /> Agregar niño a esta familia
            </button>
          )}
        </section>
      </div>
    </>
  )
}

// ─── Family list item ─────────────────────────────────────────────────────────

function FamilyListItem({ family, onSelect }: { family: FamilyDetail; onSelect: () => void }) {
  const anyAlert = family.children?.some((c) => c.allergies || c.medical_notes)
  return (
    <button
      onClick={onSelect}
      className="w-full text-left p-4 bg-white rounded-xl border-2 border-gray-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all group"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-900 leading-tight truncate">{family.full_name}</p>
            {anyAlert && <AlertTriangle size={13} className="text-red-500 shrink-0" />}
          </div>
          <div className="flex items-center gap-1.5 text-gray-500 mt-0.5 text-sm">
            <Phone size={12} />
            <span>{family.phone}</span>
            <span className="mx-1 text-gray-300">·</span>
            <span>{family.children?.length ?? 0} niño{family.children?.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {family.children?.slice(0, 3).map((c) => (
            <CategoryBadge key={c.id} category={getEffectiveCategory(c)} size="sm" />
          ))}
          <ChevronRight className="text-gray-300 group-hover:text-indigo-500 transition-colors" size={18} />
        </div>
      </div>
    </button>
  )
}

// ─── Roster completo (por niño, con filtros para casos incompletos) ───────────

type RosterChild = ChildDetail & { parents: { id: string; full_name: string; phone: string } | null }
type RosterFilter = 'todos' | 'sin_responsable' | 'sin_categoria' | 'sin_fecha_nacimiento'

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
    <div className="space-y-2 pt-1">
      <input
        type="text" value={query} onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar responsable por nombre…"
        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm"
      />
      {results.map((p) => (
        <button key={p.id} onClick={() => onSelect(p)}
          className="w-full text-left px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 transition-colors">
          {p.full_name} · {p.phone}
        </button>
      ))}
    </div>
  )
}

function RosterRow({ child, onChanged }: { child: RosterChild; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)
  const category = getEffectiveCategory(child)
  const age = getAgeLabel(child.birth_date)

  async function assignParent(parent: { id: string; full_name: string }) {
    const { data, error } = await supabase.from('children').update({ parent_id: parent.id }).eq('id', child.id).select('id')
    if (error || !data || data.length === 0) { setDeleteError('No se pudo asignar. Intenta de nuevo.'); return }
    setAssigning(false)
    onChanged()
  }

  async function saveChild(data: Omit<Partial<ChildDetail>, 'id' | 'parent_id' | 'attendance'>) {
    const { data: updated, error } = await supabase.from('children').update(data).eq('id', child.id).select('id')
    if (error || !updated || updated.length === 0) { setDeleteError('No se pudo guardar. Intenta de nuevo.'); return }
    setEditing(false)
    setJustSaved(true)
    onChanged()
  }

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(null)
    const { data: { user } } = await supabase.auth.getUser()
    const now = new Date().toISOString()
    // Marcar (no borrar): la papelera guarda el registro hasta que alguien lo
    // restaure o el dueño lo purgue de verdad.
    await supabase.from('attendance').update({ deleted_at: now, deleted_by: user?.id }).eq('child_id', child.id)
    // .select() fuerza a PostgREST a reportar qué filas se marcaron de
    // verdad — sin esto, un update bloqueado por RLS (0 filas afectadas)
    // igual no da error, y la UI actuaría como si hubiera funcionado.
    const { data, error } = await supabase.from('children').update({ deleted_at: now, deleted_by: user?.id }).eq('id', child.id).select('id')
    setDeleting(false)
    if (error || !data || data.length === 0) {
      setDeleteError('No se pudo eliminar. Intenta de nuevo.')
      return
    }
    setConfirmDelete(false)
    onChanged()
  }

  return (
    <>
      <AnimatePresence>
        {confirmDelete && (
          <ConfirmDialog
            message={`¿Eliminar a ${child.full_name}?`}
            subtext="Se marcarán también sus registros de asistencia. Quedará en la papelera por si hay que restaurarlo."
            destructive
            onConfirm={handleDelete}
            onCancel={() => setConfirmDelete(false)}
          />
        )}
      </AnimatePresence>
      <div className="bg-white rounded-xl border-2 border-gray-200 p-4 space-y-2">
        {deleteError && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{deleteError}</p>}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 min-w-0">
            <PhotoAvatar path={child.photo_url} size={36} />
            <div className="space-y-1 min-w-0">
              <p className="font-bold text-gray-900 leading-tight">{child.full_name}</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <CategoryBadge category={category} size="sm" />
                {age !== null && <span className="text-xs text-gray-400">{age} años</span>}
                {!child.parent_id && (
                  <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                    Sin responsable
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400">{child.parents?.full_name ?? 'Sin responsable asignado'}</p>
            </div>
          </div>
          {!editing && (
            <div className="flex items-center gap-1 shrink-0">
              {!child.parent_id && (
                <button onClick={() => setAssigning((v) => !v)}
                  className="text-xs text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded-lg font-medium transition-colors">
                  Asignar
                </button>
              )}
              <button onClick={() => { setEditing(true); setJustSaved(false) }}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1 hover:bg-indigo-50 rounded-lg transition-colors">
                <Edit2 size={11} /> Editar
              </button>
              <button onClick={() => setConfirmDelete(true)} disabled={deleting}
                className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>
        {assigning && <ParentPicker onSelect={assignParent} />}
        {editing && <ChildEditForm child={child} onSave={saveChild} onCancel={() => setEditing(false)} />}
        {justSaved && !editing && (
          <div className="rounded-lg bg-indigo-50/60 border border-indigo-100 px-3 py-2.5 flex items-start justify-between gap-2">
            <QuickCheckIn childId={child.id} category={category} />
            <button onClick={() => setJustSaved(false)} className="text-xs text-gray-400 hover:text-gray-600 shrink-0">
              Listo
            </button>
          </div>
        )}
      </div>
    </>
  )
}

function RosterPanel({ onClose, initialFilter, onLinkToFamily }: {
  onClose: () => void
  initialFilter?: RosterFilter
  onLinkToFamily?: (parentId: string, prefill: ChildPrefill) => void
}) {
  const [children, setChildren] = useState<RosterChild[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<RosterFilter>(initialFilter ?? 'todos')
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query.trim(), 350)
  const searched = debouncedQuery.length >= 2

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('children')
      .select('*, parents(id, full_name, phone), attendance(count)')
      .is('deleted_at', null)
      .order('full_name')
    setChildren((data as RosterChild[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const pillFiltered = children.filter((c) => {
    if (filter === 'sin_responsable') return !c.parent_id
    if (filter === 'sin_categoria') return getEffectiveCategory(c) === null
    if (filter === 'sin_fecha_nacimiento') return !c.birth_date
    return true
  })

  // Search narrows whatever the active filter pill already shows — same
  // fuzzy/accent-tolerant matcher Familias itself uses.
  const searcher = useMemo(() => createChildSearcher(children), [children])
  const filtered = useMemo(() => {
    if (!searched) return pillFiltered
    const { exact, suggestions } = searchChildrenSplit(searcher, debouncedQuery)
    const matchedIds = new Set([...exact, ...suggestions].map((c) => c.id))
    return pillFiltered.filter((c) => matchedIds.has(c.id))
  }, [searched, debouncedQuery, searcher, pillFiltered])

  // Same "podría ser la misma familia" signal Familias' own search has —
  // checked against the full roster regardless of which pill is active,
  // since the point is finding a family a narrow filter might be hiding.
  const sameSurnameFamilies = useMemo(() => {
    if (!searched || filtered.length > 0) return []
    const byFamily = new Map<string, { familyId: string; parentName: string; children: string[] }>()
    for (const { item } of findBySurname(children, debouncedQuery)) {
      if (!item.parents?.id) continue
      const entry = byFamily.get(item.parents.id) ?? { familyId: item.parents.id, parentName: item.parents.full_name, children: [] }
      entry.children.push(item.full_name)
      byFamily.set(item.parents.id, entry)
    }
    return [...byFamily.values()].slice(0, 3)
  }, [searched, filtered.length, children, debouncedQuery])

  const counts = {
    todos: children.length,
    sin_responsable: children.filter((c) => !c.parent_id).length,
    sin_categoria: children.filter((c) => getEffectiveCategory(c) === null).length,
    sin_fecha_nacimiento: children.filter((c) => !c.birth_date).length,
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronLeft size={18} />
        </button>
        <div>
          <h3 className="text-lg font-bold text-gray-900">Buscar por niño</h3>
          <p className="text-xs text-gray-400">Busca directo, o usa los filtros para casos incompletos</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar niño por nombre…"
          className="w-full pl-11 pr-4 py-3 text-base border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none bg-white"
        />
        {query && (
          <button onClick={() => setQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        )}
      </div>

      {searched && sameSurnameFamilies.length > 0 && (
        <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50 px-4 py-3.5 space-y-2.5">
          <p className="text-sm font-semibold text-indigo-800 flex items-center gap-1.5">
            <Users size={15} className="shrink-0" />
            Ya tenemos familia(s) con este apellido — ¿es un hermano/a nuevo?
          </p>
          {sameSurnameFamilies.map((f) => (
            <div key={f.familyId} className="flex items-center justify-between gap-3 bg-white rounded-xl border border-indigo-100 px-3.5 py-2.5">
              <p className="text-sm text-gray-700 min-w-0">
                <span className="font-semibold">{f.children.join(', ')}</span>
                {f.parentName && <span className="text-gray-400"> · hijo/a de {f.parentName}</span>}
              </p>
              {onLinkToFamily && (
                <button
                  onClick={() => onLinkToFamily(f.familyId, { full_name: query.trim() })}
                  className="shrink-0 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  Agregar a esta familia →
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-1.5 flex-wrap">
        {([
          ['todos', `Todos (${counts.todos})`],
          ['sin_responsable', `Sin responsable (${counts.sin_responsable})`],
          ['sin_categoria', `Sin categoría (${counts.sin_categoria})`],
          ['sin_fecha_nacimiento', `Sin fecha de nacimiento (${counts.sin_fecha_nacimiento})`],
        ] as [RosterFilter, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              filter === key ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {loading && <p className="text-center text-gray-400 py-10">Cargando…</p>}
      {!loading && filtered.length === 0 && (
        <p className="text-center text-gray-400 py-10 bg-white rounded-2xl border border-gray-200">Nada que mostrar aquí.</p>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2 items-start">
        {filtered.map((c) => <RosterRow key={c.id} child={c} onChanged={fetchAll} />)}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FamiliesPage() {
  const location = useLocation()
  const { session } = useAuth()
  // Carried over when a coordinator jumps here from a maestro's request in
  // Mensajes — there's deliberately no manual "marcar como resuelta" button
  // anymore, so this is the only way a request gets resolved: by actually
  // adding the child, here (to an existing family) or via "Nueva familia".
  // A ref (not state) so consuming it doesn't need to be in any effect's
  // dependency list, and it only ever fires once per visit from Mensajes.
  const armedRequestId = useRef((location.state as { requestId?: string } | null)?.requestId ?? null)
  const resolveArmedRequest = useCallback(async () => {
    const id = armedRequestId.current
    if (!id) return
    armedRequestId.current = null
    await supabase.from('coordinator_requests')
      .update({ status: 'resuelta', resolved_by: session?.user.id ?? null, resolved_at: new Date().toISOString() })
      .eq('id', id)
  }, [session])
  // The fuller version of the same Mensajes handoff — when the request had
  // a birth date/allergies/etc, not just a name, use all of it once the
  // coordinator confirms it's an existing family.
  const mensajesPrefill = (location.state as { prefill?: ChildPrefill } | null)?.prefill

  // Set right before opening a family via a same-surname suggestion, so
  // FamilyDetailPanel opens straight into a pre-filled add-child form.
  const [childPrefillForSelected, setChildPrefillForSelected] = useState<ChildPrefill | null>(null)

  const [searchParams, setSearchParams] = useSearchParams()
  // Lets Mensajes deep-link here with the child's name already typed in
  // (e.g. from a coordinator request) — same searched=true path as if
  // someone had typed it themselves, so the same-surname suggestion below
  // runs automatically instead of the coordinator retyping the name.
  const [query, setQuery]           = useState(() => searchParams.get('buscar') ?? '')
  const [allFamilies, setAllFamilies] = useState<FamilyDetail[]>([])
  const [loadingAll, setLoadingAll] = useState(true)
  const [showAll, setShowAll]       = useState(false)
  const [selected, setSelected]     = useState<FamilyDetail | null>(null)
  const [showNewFamily, setShowNewFamily] = useState(false)
  const rosterParam = searchParams.get('roster') as RosterFilter | null
  const [showRoster, setShowRoster] = useState(rosterParam !== null)
  const [totalFamilies, setTotalFamilies] = useState<number | null>(null)

  const debouncedQuery = useDebounce(query.trim(), 350)
  const searched = debouncedQuery.length >= 2

  // Total count
  useEffect(() => {
    supabase.from('parents').select('id', { count: 'exact', head: true })
      .then(({ count }) => setTotalFamilies(count))
  }, [])

  // Load all families. No .limit() here on purpose — a hard cap silently
  // truncates the list once the church has more families than the cap, and
  // both "Ver todas" and search run entirely over this array, so anything
  // past the cutoff would become invisible everywhere.
  const loadAllFamilies = useCallback(async () => {
    setLoadingAll(true)
    const { data } = await supabase
      .from('parents')
      .select('*, children(*, attendance(count))')
      .is('deleted_at', null)
      .is('children.deleted_at', null)
      .order('full_name')
    setAllFamilies((data as FamilyDetail[]) ?? [])
    setLoadingAll(false)
  }, [])

  // Loaded once up front, not just behind "Ver todas" — the search box needs
  // it now too.
  useEffect(() => { loadAllFamilies() }, [loadAllFamilies])

  // Search by child name, parent name, or phone — all accent/typo-tolerant
  // via the same fuzzy searcher Registro uses. The previous version only ran
  // a raw `ilike` against the parent's own name/phone, so typing a child's
  // name (the far more common case — nobody remembers "quién es el papá de
  // Samuel Morales" off the top of their head) silently found nothing even
  // when the family was right there.
  const searchIndex = useMemo(() => allFamilies.flatMap((f): { full_name: string; parents: { full_name: string } | null; familyId: string }[] =>
    f.children.length > 0
      ? f.children.map((c) => ({ full_name: c.full_name, parents: { full_name: f.full_name }, familyId: f.id }))
      : [{ full_name: f.full_name, parents: null, familyId: f.id }]
  ), [allFamilies])
  const searcher = useMemo(() => createChildSearcher(searchIndex), [searchIndex])

  const results = useMemo(() => {
    if (!searched) return []
    const { exact, suggestions } = searchChildrenSplit(searcher, debouncedQuery)
    const matchedIds = new Set([...exact, ...suggestions].map((c) => c.familyId))
    const qDigits = debouncedQuery.replace(/\D/g, '')
    if (qDigits.length >= 3) {
      for (const f of allFamilies) {
        if (f.phone?.replace(/\D/g, '').includes(qDigits)) matchedIds.add(f.id)
      }
    }
    return allFamilies.filter((f) => matchedIds.has(f.id))
  }, [searched, debouncedQuery, searcher, allFamilies])

  // Catches searching for a child who's never been registered before but
  // whose siblings have — "Joshua Zet Ramos" won't match anything by exact
  // or fuzzy name (his own name isn't in the system yet), but his surname
  // matches an existing family's children. Excludes families already in
  // `results` so it never repeats what's already shown above.
  const sameSurnameFamilies = useMemo(() => {
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

  const fetchFamily = useCallback(async (id: string): Promise<FamilyDetail | null> => {
    const { data } = await supabase
      .from('parents')
      .select('*, children(*, attendance(count))')
      .is('children.deleted_at', null)
      .eq('id', id)
      .single()
    return data as FamilyDetail | null
  }, [])

  async function handleRefresh() {
    if (!selected) return
    const updated = await fetchFamily(selected.id)
    if (updated) {
      setSelected(updated)
      setAllFamilies((prev) => prev.map((f) => f.id === updated.id ? updated : f))
    }
  }

  function handleDeleted() {
    const id = selected?.id
    setSelected(null)
    setAllFamilies((prev) => prev.filter((f) => f.id !== id))
    setTotalFamilies((n) => (n !== null ? n - 1 : n))
  }

  async function handleNewFamilySaved(parent: ParentRow) {
    setShowNewFamily(false)
    const family = await fetchFamily(parent.id)
    if (family) {
      setSelected(family)
      // So it's findable by search immediately, without waiting on a reload.
      setAllFamilies((prev) => [...prev, family].sort((a, b) => a.full_name.localeCompare(b.full_name)))
    }
    setTotalFamilies((n) => (n !== null ? n + 1 : n))
    resolveArmedRequest()
  }

  if (showNewFamily) {
    // So the "ya existe alguien con nombre parecido" duplicate warning (and
    // the same-surname "podría ser la misma familia" suggestion) work here
    // too, not just when starting a new family from Registro. Includes the
    // parent so both features can show "hijo/a de X" and jump straight to
    // that family instead of registering a duplicate one.
    const existingChildren = allFamilies.flatMap((f) =>
      f.children.map((c) => ({ id: c.id, full_name: c.full_name, parents: { id: f.id, full_name: f.full_name } }))
    )
    return (
      <NewFamilyStep
        existingChildren={existingChildren}
        onLinkToFamily={(parentId, prefill) => {
          const family = allFamilies.find((f) => f.id === parentId)
          if (family) { setChildPrefillForSelected(prefill); setShowNewFamily(false); setSelected(family) }
        }}
        onSaved={handleNewFamilySaved}
        onCancel={() => setShowNewFamily(false)}
      />
    )
  }

  if (showRoster) {
    return (
      <RosterPanel
        initialFilter={rosterParam ?? undefined}
        onClose={() => { setShowRoster(false); setSearchParams({}) }}
        onLinkToFamily={(parentId, prefill) => {
          const family = allFamilies.find((f) => f.id === parentId)
          if (family) { setChildPrefillForSelected(prefill); setShowRoster(false); setSearchParams({}); setSelected(family) }
        }}
      />
    )
  }

  if (selected) {
    return (
      <FamilyDetailPanel
        family={selected}
        onClose={() => { setSelected(null); setChildPrefillForSelected(null) }}
        onRefresh={handleRefresh}
        onDeleted={handleDeleted}
        onChildAdded={resolveArmedRequest}
        initialChildPrefill={childPrefillForSelected}
      />
    )
  }

  const displayList = searched ? results : showAll ? allFamilies : []

  return (
    <>
    <BackgroundRadialViolet />
    <div className="relative z-[2] space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Familias</h2>
          <p className="text-gray-500 text-sm mt-0.5">
            {totalFamilies !== null ? `${totalFamilies} familias registradas` : 'Cargando…'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowRoster(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 text-sm font-semibold text-gray-600 bg-white border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Buscar por niño
          </button>
          <button
            onClick={() => setShowNewFamily(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors"
          >
            <UserPlus size={15} /> Nueva familia
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setShowAll(false) }}
          placeholder="Buscar por nombre o teléfono…"
          className="w-full pl-11 pr-4 py-3.5 text-base border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none bg-white"
        />
        {query && (
          <button onClick={() => setQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Ver todas */}
      {!showAll && !searched && (
        <button
          onClick={() => setShowAll(true)}
          disabled={loadingAll}
          className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-gray-600 bg-white border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
        >
          <Users size={15} />
          {loadingAll ? 'Cargando…' : `Ver todas las familias (${totalFamilies ?? allFamilies.length})`}
        </button>
      )}

      {showAll && !query && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{allFamilies.length} familias · ordenadas A–Z</span>
          <button onClick={() => setShowAll(false)} className="text-indigo-600 hover:text-indigo-800 font-medium">
            Ocultar lista
          </button>
        </div>
      )}

      {loadingAll && (searched || showAll) && <p className="text-center text-gray-400 py-6">Cargando…</p>}

      {!loadingAll && searched && sameSurnameFamilies.length > 0 && (
        <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50 px-4 py-3.5 space-y-2.5">
          <p className="text-sm font-semibold text-indigo-800 flex items-center gap-1.5">
            <Users size={15} className="shrink-0" />
            Ya tenemos familia(s) con este apellido — ¿es un hermano/a nuevo?
          </p>
          {sameSurnameFamilies.map((f) => (
            <div key={f.familyId} className="flex items-center justify-between gap-3 bg-white rounded-xl border border-indigo-100 px-3.5 py-2.5">
              <p className="text-sm text-gray-700 min-w-0">
                <span className="font-semibold">{f.children.join(', ')}</span>
                {f.parentName && <span className="text-gray-400"> · hijo/a de {f.parentName}</span>}
              </p>
              <button
                onClick={() => {
                  const family = allFamilies.find((fam) => fam.id === f.familyId)
                  if (!family) return
                  // Reuse the richer Mensajes data (birth date, alertas…) only
                  // if the search box still says the same name it arrived
                  // with — otherwise the coordinator has since searched for
                  // someone else and only the typed name applies.
                  const prefill: ChildPrefill = mensajesPrefill && normalizeName(mensajesPrefill.full_name) === normalizeName(debouncedQuery)
                    ? mensajesPrefill
                    : { full_name: query.trim() }
                  setChildPrefillForSelected(prefill)
                  setSelected(family)
                }}
                className="shrink-0 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                Agregar a esta familia →
              </button>
            </div>
          ))}
        </div>
      )}

      {!loadingAll && searched && results.length === 0 && (
        <div className="text-center py-10 text-gray-400 bg-white rounded-2xl border border-gray-200">
          <Search size={36} className="mx-auto opacity-30 mb-2" />
          <p>Sin resultados para «{debouncedQuery}»</p>
        </div>
      )}

      {!loadingAll && displayList.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2 items-start"
        >
          {displayList.map((family) => (
            <FamilyListItem key={family.id} family={family} onSelect={() => setSelected(family)} />
          ))}
        </motion.div>
      )}

      {!searched && !showAll && !loadingAll && (
        <div className="text-center py-10 text-gray-400 space-y-1">
          <Search size={36} className="mx-auto opacity-30 mb-2" />
          <p>Escribe 2+ caracteres para buscar</p>
          <p className="text-sm">o usa "Ver todas las familias"</p>
        </div>
      )}
    </div>
    </>
  )
}
