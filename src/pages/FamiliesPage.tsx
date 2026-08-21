import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, ChevronRight, Edit2, Check, X, Plus, Phone,
  AlertTriangle, UserPlus, Trash2, Users, ChevronLeft,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getCategoryFromBirthDate, getEffectiveCategory, hasCategoryChanged, getAgeLabel } from '../lib/categoryUtils'
import { uploadPhoto } from '../lib/photo'
import { CategoryBadge } from '../components/ui/CategoryBadge'
import { PhotoCapture, PhotoAvatar } from '../components/ui/PhotoCapture'
import { useDebounce } from '../hooks/useDebounce'
import { NewFamilyStep } from '../components/checkin/NewFamilyStep'
import { CATEGORY_LABELS, GUARDIAN_RELATIONSHIP_LABELS, NEXT_CATEGORY, type ParentRow, type Category, type GuardianRelationship } from '../types/domain'
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
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const previewCategory = birthDate ? getCategoryFromBirthDate(birthDate) : null
  const previewAge = getAgeLabel(birthDate)

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
      category: birthDate ? getCategoryFromBirthDate(birthDate) : child.category,
      allergies: allergies.trim() || null,
      medical_notes: notes.trim() || null,
      guardian_relationship: relationship || null,
      comments: comments.trim() || null,
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
            <CategoryBadge category={previewCategory ?? child.category} size="sm" />
            {previewAge !== null && <span className="text-xs text-gray-400">{previewAge} a.</span>}
          </div>
        </div>
        {!birthDate && (
          <p className="text-xs text-gray-400 mt-1">Sin fecha de nacimiento — la categoría se mantiene fija hasta que se ingrese.</p>
        )}
      </div>
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

function NewChildForm({ parentId, onSaved, onCancel }: { parentId: string; onSaved: () => void; onCancel: () => void }) {
  const [name, setName]         = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [allergies, setAllergies] = useState('')
  const [notes, setNotes]       = useState('')
  const [relationship, setRelationship] = useState<GuardianRelationship | ''>('')
  const [comments, setComments] = useState('')
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
    }).select().single()
    if (err || !data) { setSaving(false); setError('Error al guardar.'); return }
    if (photoBlob) {
      const path = await uploadPhoto(`children/${data.id}.jpg`, photoBlob)
      if (path) await supabase.from('children').update({ photo_url: path }).eq('id', data.id)
    }
    setSaving(false)
    onSaved()
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
}: {
  family: FamilyDetail
  onClose: () => void
  onRefresh: () => void
  onDeleted: () => void
}) {
  const [editingParent, setEditingParent]   = useState(false)
  const [parentName, setParentName]         = useState(family.full_name)
  const [parentPhone, setParentPhone]       = useState(family.phone ?? '')
  const [parentPhotoBlob, setParentPhotoBlob] = useState<Blob | null>(null)
  const [savingParent, setSavingParent]     = useState(false)
  const [editingChildId, setEditingChildId] = useState<string | null>(null)
  const [addingChild, setAddingChild]       = useState(false)

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
    await supabase.from('parents').update(update).eq('id', family.id)
    setSavingParent(false)
    setEditingParent(false)
    onRefresh()
  }

  async function saveChild(childId: string, data: Omit<Partial<ChildDetail>, 'id' | 'parent_id' | 'attendance'>) {
    await supabase.from('children').update(data).eq('id', childId)
    setEditingChildId(null)
    onRefresh()
  }

  async function deleteChild(child: ChildDetail) {
    setDeleteError(null)
    // First delete attendance records for this child
    await supabase.from('attendance').delete().eq('child_id', child.id)
    const { error } = await supabase.from('children').delete().eq('id', child.id)
    if (error) { setDeleteError('Error al eliminar. Intenta de nuevo.'); return }
    setConfirmDeleteChild(null)
    onRefresh()
  }

  async function deleteFamily() {
    setDeleteError(null)
    // Delete attendance for all children
    for (const child of family.children) {
      await supabase.from('attendance').delete().eq('child_id', child.id)
    }
    // Delete children
    await supabase.from('children').delete().eq('parent_id', family.id)
    // Delete parent
    const { error } = await supabase.from('parents').delete().eq('id', family.id)
    if (error) { setDeleteError('Error al eliminar la familia. Intenta de nuevo.'); return }
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
            subtext={`Se eliminarán también sus ${confirmDeleteChild.attendance?.[0]?.count ?? 0} registro(s) de asistencia. Esta acción no se puede deshacer.`}
            destructive
            onConfirm={() => deleteChild(confirmDeleteChild)}
            onCancel={() => setConfirmDeleteChild(null)}
          />
        )}
        {confirmDeleteFamily && (
          <ConfirmDialog
            message={`¿Eliminar la familia "${family.full_name}"?`}
            subtext={`Se eliminarán ${family.children.length} niño(s) y todos sus registros de asistencia (${totalVisits} en total). Esta acción no se puede deshacer.`}
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
                      <button onClick={() => { setEditingChildId(child.id); setAddingChild(false) }}
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

                {child.comments && !isEditing && (
                  <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                    <span className="font-semibold">Comentarios:</span> {child.comments}
                  </p>
                )}

                {isEditing && (
                  <ChildEditForm
                    child={child}
                    onSave={(data) => saveChild(child.id, data)}
                    onCancel={() => setEditingChildId(null)}
                  />
                )}
              </div>
            )
          })}

          {addingChild ? (
            <NewChildForm
              parentId={family.id}
              onSaved={() => { setAddingChild(false); onRefresh() }}
              onCancel={() => setAddingChild(false)}
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
type RosterFilter = 'todos' | 'sin_responsable' | 'sin_categoria'

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
  const category = getEffectiveCategory(child)
  const age = getAgeLabel(child.birth_date)

  async function assignParent(parent: { id: string; full_name: string }) {
    await supabase.from('children').update({ parent_id: parent.id }).eq('id', child.id)
    setAssigning(false)
    onChanged()
  }

  async function saveChild(data: Omit<Partial<ChildDetail>, 'id' | 'parent_id' | 'attendance'>) {
    await supabase.from('children').update(data).eq('id', child.id)
    setEditing(false)
    onChanged()
  }

  async function handleDelete() {
    setDeleting(true)
    await supabase.from('attendance').delete().eq('child_id', child.id)
    await supabase.from('children').delete().eq('id', child.id)
    setDeleting(false)
    setConfirmDelete(false)
    onChanged()
  }

  return (
    <>
      <AnimatePresence>
        {confirmDelete && (
          <ConfirmDialog
            message={`¿Eliminar a ${child.full_name}?`}
            subtext="Se eliminarán también sus registros de asistencia. Esta acción no se puede deshacer."
            destructive
            onConfirm={handleDelete}
            onCancel={() => setConfirmDelete(false)}
          />
        )}
      </AnimatePresence>
      <div className="bg-white rounded-xl border-2 border-gray-200 p-4 space-y-2">
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
              <button onClick={() => setEditing(true)}
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
      </div>
    </>
  )
}

function RosterPanel({ onClose }: { onClose: () => void }) {
  const [children, setChildren] = useState<RosterChild[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<RosterFilter>('todos')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('children')
      .select('*, parents(id, full_name, phone), attendance(count)')
      .order('full_name')
    setChildren((data as RosterChild[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const filtered = children.filter((c) => {
    if (filter === 'sin_responsable') return !c.parent_id
    if (filter === 'sin_categoria') return getEffectiveCategory(c) === null
    return true
  })

  const counts = {
    todos: children.length,
    sin_responsable: children.filter((c) => !c.parent_id).length,
    sin_categoria: children.filter((c) => getEffectiveCategory(c) === null).length,
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronLeft size={18} />
        </button>
        <div>
          <h3 className="text-lg font-bold text-gray-900">Roster completo</h3>
          <p className="text-xs text-gray-400">Todos los niños, con filtros para casos incompletos</p>
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {([
          ['todos', `Todos (${counts.todos})`],
          ['sin_responsable', `Sin responsable (${counts.sin_responsable})`],
          ['sin_categoria', `Sin categoría (${counts.sin_categoria})`],
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
      <div className="space-y-2">
        {filtered.map((c) => <RosterRow key={c.id} child={c} onChanged={fetchAll} />)}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FamiliesPage() {
  const [query, setQuery]           = useState('')
  const [results, setResults]       = useState<FamilyDetail[]>([])
  const [allFamilies, setAllFamilies] = useState<FamilyDetail[]>([])
  const [loading, setLoading]       = useState(false)
  const [loadingAll, setLoadingAll] = useState(false)
  const [searched, setSearched]     = useState(false)
  const [showAll, setShowAll]       = useState(false)
  const [selected, setSelected]     = useState<FamilyDetail | null>(null)
  const [showNewFamily, setShowNewFamily] = useState(false)
  const [showRoster, setShowRoster] = useState(false)
  const [totalFamilies, setTotalFamilies] = useState<number | null>(null)

  const debouncedQuery = useDebounce(query.trim(), 350)

  // Total count
  useEffect(() => {
    supabase.from('parents').select('id', { count: 'exact', head: true })
      .then(({ count }) => setTotalFamilies(count))
  }, [])

  // Search
  useEffect(() => {
    if (debouncedQuery.length < 2) { setResults([]); setSearched(false); return }
    let cancelled = false
    setLoading(true)
    supabase
      .from('parents')
      .select('*, children(*, attendance(count))')
      .or(`full_name.ilike.%${debouncedQuery}%,phone.ilike.%${debouncedQuery}%`)
      .limit(20)
      .then(({ data }) => {
        if (!cancelled) { setResults((data as FamilyDetail[]) ?? []); setSearched(true); setLoading(false) }
      })
    return () => { cancelled = true }
  }, [debouncedQuery])

  // Load all families
  const loadAllFamilies = useCallback(async () => {
    setLoadingAll(true)
    const { data } = await supabase
      .from('parents')
      .select('*, children(*, attendance(count))')
      .order('full_name')
      .limit(200)
    setAllFamilies((data as FamilyDetail[]) ?? [])
    setLoadingAll(false)
    setShowAll(true)
  }, [])

  const fetchFamily = useCallback(async (id: string): Promise<FamilyDetail | null> => {
    const { data } = await supabase
      .from('parents')
      .select('*, children(*, attendance(count))')
      .eq('id', id)
      .single()
    return data as FamilyDetail | null
  }, [])

  async function handleRefresh() {
    if (!selected) return
    const updated = await fetchFamily(selected.id)
    if (updated) {
      setSelected(updated)
      setResults((prev) => prev.map((f) => f.id === updated.id ? updated : f))
      setAllFamilies((prev) => prev.map((f) => f.id === updated.id ? updated : f))
    }
  }

  function handleDeleted() {
    const id = selected?.id
    setSelected(null)
    setResults((prev) => prev.filter((f) => f.id !== id))
    setAllFamilies((prev) => prev.filter((f) => f.id !== id))
    setTotalFamilies((n) => (n !== null ? n - 1 : n))
  }

  async function handleNewFamilySaved(parent: ParentRow) {
    setShowNewFamily(false)
    const family = await fetchFamily(parent.id)
    if (family) setSelected(family)
    setTotalFamilies((n) => (n !== null ? n + 1 : n))
  }

  if (showNewFamily) {
    return <NewFamilyStep onSaved={handleNewFamilySaved} onCancel={() => setShowNewFamily(false)} />
  }

  if (showRoster) {
    return <RosterPanel onClose={() => setShowRoster(false)} />
  }

  if (selected) {
    return (
      <FamilyDetailPanel
        family={selected}
        onClose={() => setSelected(null)}
        onRefresh={handleRefresh}
        onDeleted={handleDeleted}
      />
    )
  }

  const displayList = debouncedQuery.length >= 2 ? results : showAll ? allFamilies : []

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
            Roster por niño
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
          <button onClick={() => { setQuery(''); setSearched(false) }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Ver todas */}
      {!showAll && debouncedQuery.length < 2 && (
        <button
          onClick={loadAllFamilies}
          disabled={loadingAll}
          className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-gray-600 bg-white border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
        >
          <Users size={15} />
          {loadingAll ? 'Cargando…' : `Ver todas las familias (${totalFamilies ?? '…'})`}
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

      {loading && <p className="text-center text-gray-400 py-6">Buscando…</p>}

      {!loading && searched && results.length === 0 && (
        <div className="text-center py-10 text-gray-400 bg-white rounded-2xl border border-gray-200">
          <Search size={36} className="mx-auto opacity-30 mb-2" />
          <p>Sin resultados para «{debouncedQuery}»</p>
        </div>
      )}

      {displayList.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-2"
        >
          {displayList.map((family) => (
            <FamilyListItem key={family.id} family={family} onSelect={() => setSelected(family)} />
          ))}
        </motion.div>
      )}

      {!searched && !showAll && !loading && (
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
