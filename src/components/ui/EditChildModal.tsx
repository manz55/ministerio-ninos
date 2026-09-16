import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Check, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { uploadPhoto } from '../../lib/photo'
import { getCategoryFromBirthDate, getAgeLabel } from '../../lib/categoryUtils'
import {
  CATEGORY_LABELS, GUARDIAN_RELATIONSHIP_LABELS, isCorderitos,
  type Category, type GuardianRelationship,
} from '../../types/domain'
import { CategoryBadge } from './CategoryBadge'
import { PhotoCapture } from './PhotoCapture'
import { AssignedMaestroField } from './AssignedMaestroField'

export interface EditableChild {
  id: string
  full_name: string
  birth_date: string | null
  category: Category | null
  allergies: string | null
  medical_notes: string | null
  guardian_relationship: GuardianRelationship | null
  comments: string | null
  toilet_trained: boolean | null
  photo_url: string | null
  assigned_maestro_id: string | null
  assigned_maestro_name: string | null
}

/**
 * Edición/borrado rápido de un niño sin salir de Registro — reutiliza los
 * mismos campos que FamiliesPage.ChildEditForm pero como modal, para poder
 * abrirla desde la tarjeta de cada categoría en Inicio. El borrado es lógico
 * (deleted_at), igual que en Familias — pasa por la papelera, no un DELETE real.
 */
export function EditChildModal({
  child,
  onClose,
  onSaved,
  onDeleted,
}: {
  child: EditableChild
  onClose: () => void
  onSaved: (patch: Partial<EditableChild>) => void
  onDeleted: () => void
}) {
  const [name, setName] = useState(child.full_name)
  const [birthDate, setBirthDate] = useState(child.birth_date ?? '')
  const [allergies, setAllergies] = useState(child.allergies ?? '')
  const [notes, setNotes] = useState(child.medical_notes ?? '')
  const [relationship, setRelationship] = useState<GuardianRelationship | ''>(child.guardian_relationship ?? '')
  const [comments, setComments] = useState(child.comments ?? '')
  const [toiletTrained, setToiletTrained] = useState<boolean | null>(child.toilet_trained)
  const [assignedMaestroId, setAssignedMaestroId] = useState<string | null>(child.assigned_maestro_id)
  const [assignedMaestroName, setAssignedMaestroName] = useState<string | null>(child.assigned_maestro_name)
  const [manualCategory, setManualCategory] = useState<Category | ''>(child.category ?? '')
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const previewCategory = birthDate ? getCategoryFromBirthDate(birthDate) : null
  const previewAge = getAgeLabel(birthDate)
  const effectiveCategory = manualCategory || previewCategory || child.category

  async function handleSave() {
    if (!name.trim()) { setError('El nombre es requerido'); return }
    setSaving(true)
    setError(null)
    let photo_url = child.photo_url
    if (photoBlob) {
      const path = await uploadPhoto(`children/${child.id}.jpg`, photoBlob)
      if (path) photo_url = path
    }
    const patch: Partial<EditableChild> = {
      full_name: name.trim(),
      birth_date: birthDate || null,
      category: manualCategory || null,
      allergies: allergies.trim() || null,
      medical_notes: notes.trim() || null,
      guardian_relationship: relationship || null,
      comments: comments.trim() || null,
      toilet_trained: toiletTrained,
      assigned_maestro_id: assignedMaestroId,
      assigned_maestro_name: assignedMaestroName,
      photo_url,
    }
    const { data, error: err } = await supabase.from('children').update(patch).eq('id', child.id).select('id')
    setSaving(false)
    if (err || !data || data.length === 0) { setError('No se pudo guardar. Intenta de nuevo.'); return }
    onSaved(patch)
  }

  async function handleDelete() {
    setSaving(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    const now = new Date().toISOString()
    await supabase.from('attendance').update({ deleted_at: now, deleted_by: user?.id }).eq('child_id', child.id)
    const { data, error: err } = await supabase.from('children').update({ deleted_at: now, deleted_by: user?.id }).eq('id', child.id).select('id')
    setSaving(false)
    if (err || !data || data.length === 0) { setError('No se pudo eliminar. Intenta de nuevo.'); return }
    onDeleted()
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[90vh] overflow-y-auto p-5 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900">Editar niño</h3>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition-colors">
              <X size={18} />
            </button>
          </div>

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
              <input type="date" value={birthDate} max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setBirthDate(e.target.value)}
                className="flex-1 px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm" />
              <div className="flex items-center gap-1.5 shrink-0">
                <CategoryBadge category={effectiveCategory} size="sm" />
                {previewAge !== null && <span className="text-xs text-gray-400">{previewAge} a.</span>}
              </div>
            </div>
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

          {isCorderitos(effectiveCategory) && (
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

          {isCorderitos(effectiveCategory) && (
            <AssignedMaestroField
              value={assignedMaestroId}
              onChange={setAssignedMaestroId}
              freeTextValue={assignedMaestroName}
              onFreeTextChange={setAssignedMaestroName}
              compact
            />
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
            <input type="text" value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="Ninguna"
              className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Notas médicas</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ninguna"
              className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Comentarios adicionales</label>
            <textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={2} placeholder="Ej. le teme a los globos…"
              className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm resize-none" />
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={handleSave} disabled={saving}
              className="flex-[2] py-2.5 flex items-center justify-center gap-1.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              <Check size={14} />
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
            {confirmDelete ? (
              <button onClick={handleDelete} disabled={saving}
                className="flex-1 py-2.5 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors">
                ¿Seguro?
              </button>
            ) : (
              <button onClick={() => setConfirmDelete(true)} disabled={saving}
                className="px-3 py-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
