import { useState } from 'react'
import { motion } from 'framer-motion'
import { getAgeLabel, getCategoryFromBirthDate } from '../../lib/categoryUtils'
import { CATEGORY_LABELS, GUARDIAN_RELATIONSHIP_LABELS, isCorderitos, type Category, type GuardianRelationship, type ChildPrefill } from '../../types/domain'
import { Field, ChoiceChips, FormError, INPUT } from '../../components/ui/form'
import { groupOf } from '../checkin/shared'
import type { ChildFormData } from './data'
import { birthDateError, fullNameError, tidyName } from '../../lib/validation'

/**
 * Formulario de niño, el mismo para agregar uno nuevo y para editar.
 * El grupo sigue a la fecha de nacimiento solo cuando alguien CAMBIA la
 * fecha: abrir y guardar sin tocar nada nunca mueve a un niño de grupo
 * (antes eso pasaba y reacomodó a muchos de golpe).
 */
/** Lo que el formulario necesita de un niño ya existente (sirve tanto el de
 * Familias como el de Registro). */
type EditableChild = Pick<ChildFormData, 'full_name' | 'birth_date' | 'category' | 'allergies' | 'medical_notes' | 'guardian_relationship' | 'comments' | 'toilet_trained'>

export function ChildForm({ child, prefill, submitLabel, onSubmit, onCancel }: {
  child?: EditableChild
  prefill?: ChildPrefill | null
  submitLabel: string
  onSubmit: (data: ChildFormData) => Promise<string | null>
  onCancel: () => void
}) {
  const isNew = !child
  const [name, setName] = useState(child?.full_name ?? prefill?.full_name ?? '')
  const [birthDate, setBirthDate] = useState(child?.birth_date ?? prefill?.birth_date ?? '')
  const [category, setCategory] = useState<Category | ''>(child?.category ?? (prefill?.birth_date ? getCategoryFromBirthDate(prefill.birth_date) ?? '' : ''))
  const [allergies, setAllergies] = useState(child?.allergies ?? prefill?.allergies ?? '')
  const [notes, setNotes] = useState(child?.medical_notes ?? prefill?.medical_notes ?? '')
  const [relationship, setRelationship] = useState<GuardianRelationship | ''>(child?.guardian_relationship ?? prefill?.guardian_relationship ?? '')
  const [comments, setComments] = useState(child?.comments ?? prefill?.comments ?? '')
  const [toiletTrained, setToiletTrained] = useState<boolean | null>(child?.toilet_trained ?? prefill?.toilet_trained ?? null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const age = getAgeLabel(birthDate)
  const effective = (category || getCategoryFromBirthDate(birthDate) || null) as Category | null
  const g = groupOf(effective)

  function changeBirthDate(v: string) {
    setBirthDate(v)
    const computed = v ? getCategoryFromBirthDate(v) : null
    if (computed) setCategory(computed)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const nameErr = fullNameError(name)
    if (nameErr) { setError(nameErr === 'Escribe el nombre.' ? 'Escribe el nombre del niño.' : nameErr); return }
    const dateErr = birthDateError(birthDate, isNew)
    if (dateErr) { setError(isNew && !birthDate ? 'La fecha de nacimiento es necesaria para saber su grupo.' : dateErr); return }
    setSaving(true)
    setError(null)
    const err = await onSubmit({
      full_name: tidyName(name),
      birth_date: birthDate || null,
      category: effective,
      allergies: allergies.trim() || null,
      medical_notes: notes.trim() || null,
      guardian_relationship: relationship || null,
      comments: comments.trim() || null,
      toilet_trained: toiletTrained,
    })
    setSaving(false)
    if (err) setError(err)
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Field label="Nombre completo" required>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre y apellidos" className={INPUT} autoFocus={isNew} />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Fecha de nacimiento" required={isNew}>
          <input type="date" value={birthDate} max={new Date().toISOString().split('T')[0]} onChange={(e) => changeBirthDate(e.target.value)} className={INPUT} />
        </Field>
        <Field label="Grupo" hint={birthDate ? '(se puede cambiar a mano)' : '(sin fecha, elige a mano)'}>
          <select value={category} onChange={(e) => setCategory(e.target.value as Category | '')} className={INPUT}>
            <option value="">Sin grupo</option>
            {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
      </div>
      {effective && (
        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className={`-mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${g.avatar}`}>
          {CATEGORY_LABELS[effective]}{age !== null && <span className="font-medium opacity-75">· {age} año{age !== 1 ? 's' : ''}</span>}
        </motion.p>
      )}

      {isCorderitos(effective) && (
        <div className="rounded-3xl bg-sky-50/60 p-4">
          <Field label="¿Ya va solo al baño?">
            <ChoiceChips value={toiletTrained} onChange={setToiletTrained} options={[{ value: true, label: 'Sí' }, { value: false, label: 'No / pañal' }, { value: null, label: 'No sé' }]} />
          </Field>
        </div>
      )}

      <Field label="Alergias" hint="(opcional)">
        <input value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="Ej. maní, penicilina…" className={INPUT} />
      </Field>
      <Field label="Notas médicas" hint="(opcional)">
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej. asma, trae inhalador…" className={INPUT} />
      </Field>
      <Field label="Parentesco del responsable" hint="(opcional)">
        <select value={relationship} onChange={(e) => setRelationship(e.target.value as GuardianRelationship | '')} className={INPUT}>
          <option value="">Sin especificar</option>
          {Object.entries(GUARDIAN_RELATIONSHIP_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>
      <Field label="Comentarios" hint="(opcional)">
        <textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={2} placeholder="Ej. Ya va solo al baño, pero hay que recordarle que se lave las manos" className={`${INPUT} resize-none`} />
      </Field>

      <FormError error={error} />

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} className="flex-1 py-3.5 rounded-2xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 transition-colors">Cancelar</button>
        <motion.button type="submit" disabled={saving} whileTap={{ scale: 0.97 }}
          className="flex-[2] py-3.5 rounded-2xl bg-indigo-600 text-white font-display font-bold text-lg shadow-md shadow-indigo-900/10 hover:bg-indigo-700 disabled:opacity-60 transition-colors">
          {saving ? 'Guardando…' : submitLabel}
        </motion.button>
      </div>
    </form>
  )
}
