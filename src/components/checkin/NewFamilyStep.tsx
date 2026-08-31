import { useMemo, useState } from 'react'
import { ChevronLeft, Plus, Trash2, AlertTriangle } from 'lucide-react'
import { differenceInYears } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { getCategoryFromBirthDate } from '../../lib/categoryUtils'
import { uploadPhoto } from '../../lib/photo'
import { createChildSearcher, searchChildrenSplit, type SearchableChild } from '../../lib/fuzzySearch'
import { CategoryBadge } from '../ui/CategoryBadge'
import { PhotoCapture } from '../ui/PhotoCapture'
import { GUARDIAN_RELATIONSHIP_LABELS, isCorderitos, type Category, type GuardianRelationship, type ParentRow, type ChildRow } from '../../types/domain'

interface ChildDraft {
  key: string
  full_name: string
  birth_date: string
  allergies: string
  medical_notes: string
  guardian_relationship: GuardianRelationship | ''
  comments: string
  toilet_trained: boolean | null
  photoBlob: Blob | null
}

interface Props {
  prefillName?: string
  prefillPhone?: string
  prefillChildName?: string
  prefillChildBirthDate?: string
  prefillChildComments?: string
  existingChildren?: (SearchableChild & { id: string })[]
  onSaved: (parent: ParentRow) => void
  onCancel: () => void
}

function newChild(key: string): ChildDraft {
  return {
    key, full_name: '', birth_date: '', allergies: '', medical_notes: '',
    guardian_relationship: '', comments: '', toilet_trained: null, photoBlob: null,
  }
}

export function NewFamilyStep({
  prefillName = '',
  prefillPhone = '',
  prefillChildName = '',
  prefillChildBirthDate = '',
  prefillChildComments = '',
  existingChildren = [],
  onSaved,
  onCancel,
}: Props) {
  const [parentName, setParentName] = useState(prefillName)
  const [parentPhone, setParentPhone] = useState(prefillPhone)
  const [parentPhotoBlob, setParentPhotoBlob] = useState<Blob | null>(null)
  const [children, setChildren] = useState<ChildDraft[]>([
    { ...newChild('0'), full_name: prefillChildName, birth_date: prefillChildBirthDate, comments: prefillChildComments },
  ])
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Catches the common case of someone re-registering a child who's already
  // in the system (often under a different guardian) instead of the request
  // reaching an admin who'd have spotted the existing record.
  const duplicateSearcher = useMemo(() => createChildSearcher(existingChildren), [existingChildren])
  function findPossibleDuplicates(name: string) {
    if (name.trim().length < 4) return []
    const { exact, suggestions } = searchChildrenSplit(duplicateSearcher, name.trim())
    return [...exact, ...suggestions].slice(0, 3)
  }

  // ── Child helpers ───────────────────────────────────────────────────────────
  function updateChild<K extends keyof ChildDraft>(key: string, field: K, value: ChildDraft[K]) {
    setChildren((prev) =>
      prev.map((c) => (c.key === key ? { ...c, [field]: value } : c))
    )
  }

  function addChild() {
    setChildren((prev) => [...prev, newChild(String(Date.now()))])
  }

  function removeChild(key: string) {
    setChildren((prev) => prev.filter((c) => c.key !== key))
  }

  // ── Validation ──────────────────────────────────────────────────────────────
  function validate(): Record<string, string> {
    const e: Record<string, string> = {}
    if (!parentName.trim()) e.parentName = 'Nombre requerido'
    if (!parentPhone.trim()) e.parentPhone = 'Teléfono requerido'
    children.forEach((c, i) => {
      if (!c.full_name.trim()) e[`name_${i}`] = 'Nombre requerido'
      if (!c.birth_date) e[`date_${i}`] = 'Fecha requerida'
    })
    return e
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setErrors({})
    setSaving(true)

    // 1. Insert parent
    const { data: parentData, error: parentErr } = await supabase
      .from('parents')
      .insert({ full_name: parentName.trim(), phone: parentPhone.trim() })
      .select()
      .single()

    if (parentErr || !parentData) {
      setErrors({ global: 'Error al guardar el padre/madre. Intenta de nuevo.' })
      setSaving(false)
      return
    }

    // 2. Insert children
    const { data: childrenData, error: childrenErr } = await supabase
      .from('children')
      .insert(
        children.map((c) => ({
          parent_id: parentData.id,
          full_name: c.full_name.trim(),
          birth_date: c.birth_date,
          category: getCategoryFromBirthDate(c.birth_date),
          allergies: c.allergies.trim() || null,
          medical_notes: c.medical_notes.trim() || null,
          guardian_relationship: c.guardian_relationship || null,
          comments: c.comments.trim() || null,
          toilet_trained: c.toilet_trained,
        }))
      )
      .select()

    if (childrenErr || !childrenData) {
      setErrors({ global: 'Error al guardar los niños. Intenta de nuevo.' })
      setSaving(false)
      return
    }

    // 3. Upload photos (if any) now that we have real ids, then attach the paths
    let parentPhotoUrl: string | null = null
    if (parentPhotoBlob) {
      parentPhotoUrl = await uploadPhoto(`parents/${parentData.id}.jpg`, parentPhotoBlob)
      if (parentPhotoUrl) await supabase.from('parents').update({ photo_url: parentPhotoUrl }).eq('id', parentData.id)
    }

    const childrenWithPhotos = await Promise.all(
      childrenData.map(async (row, i) => {
        const blob = children[i]?.photoBlob
        if (!blob) return row
        const path = await uploadPhoto(`children/${row.id}.jpg`, blob)
        if (path) await supabase.from('children').update({ photo_url: path }).eq('id', row.id)
        return { ...row, photo_url: path ?? row.photo_url }
      })
    )

    // Construye ParentRow completo para pasar al siguiente paso
    const newParent: ParentRow = {
      ...parentData,
      photo_url: parentPhotoUrl,
      children: childrenWithPhotos.map((c) => ({ ...c, category: c.category as Category | null, attendance: [] })) as ChildRow[],
    }
    onSaved(newParent)
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-7">
      <div>
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-3 transition-colors"
        >
          <ChevronLeft size={15} /> Volver a la búsqueda
        </button>
        <h2 className="text-2xl font-bold text-gray-900">Nueva familia</h2>
        <p className="text-gray-500 mt-0.5">Completa los datos para registrarla</p>
      </div>

      {/* ── Padre / madre ── */}
      <section className="bg-white rounded-xl border-2 border-gray-200 p-5 space-y-4">
        <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wider">
          Padre o madre
        </h3>

        <PhotoCapture onFileReady={setParentPhotoBlob} />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Nombre completo <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={parentName}
            onChange={(e) => setParentName(e.target.value)}
            placeholder="Ej. María González"
            className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none text-base ${
              errors.parentName
                ? 'border-red-300 focus:border-red-500'
                : 'border-gray-200 focus:border-indigo-500'
            }`}
            autoFocus={!prefillName}
          />
          {errors.parentName && (
            <p className="text-xs text-red-600 mt-1">{errors.parentName}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Teléfono <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            inputMode="tel"
            value={parentPhone}
            onChange={(e) => setParentPhone(e.target.value)}
            placeholder="Ej. 55 1234 5678"
            className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none text-base ${
              errors.parentPhone
                ? 'border-red-300 focus:border-red-500'
                : 'border-gray-200 focus:border-indigo-500'
            }`}
          />
          {errors.parentPhone && (
            <p className="text-xs text-red-600 mt-1">{errors.parentPhone}</p>
          )}
        </div>
      </section>

      {/* ── Niños ── */}
      <section className="space-y-3">
        <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wider">
          Niños
        </h3>

        {children.map((child, i) => {
          const hasDate = !!child.birth_date
          const age = hasDate ? differenceInYears(new Date(), new Date(child.birth_date)) : null
          const category = hasDate ? getCategoryFromBirthDate(child.birth_date) : null
          const duplicates = findPossibleDuplicates(child.full_name)

          return (
            <div key={child.key} className="bg-white rounded-xl border-2 border-gray-200 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-600">
                  Niño {i + 1}
                </span>
                {children.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeChild(child.key)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              <PhotoCapture onFileReady={(blob) => updateChild(child.key, 'photoBlob', blob)} />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Nombre completo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={child.full_name}
                  onChange={(e) => updateChild(child.key, 'full_name', e.target.value)}
                  placeholder="Nombre del niño"
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none text-base ${
                    errors[`name_${i}`]
                      ? 'border-red-300 focus:border-red-500'
                      : 'border-gray-200 focus:border-indigo-500'
                  }`}
                />
                {errors[`name_${i}`] && (
                  <p className="text-xs text-red-600 mt-1">{errors[`name_${i}`]}</p>
                )}
                {duplicates.length > 0 && (
                  <div className="mt-2 rounded-xl border-2 border-amber-200 bg-amber-50 px-3.5 py-2.5 space-y-1">
                    <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                      <AlertTriangle size={13} className="shrink-0" />
                      Ya hay alguien con nombre parecido — revisa que no sea el mismo niño
                    </p>
                    {duplicates.map((m) => (
                      <p key={m.id} className="text-xs text-amber-700 pl-[19px]">
                        <span className="font-semibold">{m.full_name}</span>
                        {m.parents?.full_name ? <> · hijo/a de {m.parents.full_name}</> : null}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Fecha de nacimiento <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="date"
                    value={child.birth_date}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={(e) => updateChild(child.key, 'birth_date', e.target.value)}
                    className={`flex-1 px-4 py-3 border-2 rounded-xl focus:outline-none text-base ${
                      errors[`date_${i}`]
                        ? 'border-red-300 focus:border-red-500'
                        : 'border-gray-200 focus:border-indigo-500'
                    }`}
                  />
                  {category && (
                    <div className="flex items-center gap-2 shrink-0">
                      <CategoryBadge category={category} size="sm" />
                      <span className="text-xs text-gray-400">{age} años</span>
                    </div>
                  )}
                </div>
                {errors[`date_${i}`] && (
                  <p className="text-xs text-red-600 mt-1">{errors[`date_${i}`]}</p>
                )}
              </div>

              {isCorderitos(category) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    ¿Ya va solo al baño?
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { value: true, label: 'Sí' },
                      { value: false, label: 'No / pañal' },
                      { value: null, label: 'No sé' },
                    ] as const).map((opt) => (
                      <button
                        key={String(opt.value)}
                        type="button"
                        onClick={() => updateChild(child.key, 'toilet_trained', opt.value)}
                        className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${
                          child.toilet_trained === opt.value
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
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Parentesco del responsable{' '}
                  <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <select
                  value={child.guardian_relationship}
                  onChange={(e) => updateChild(child.key, 'guardian_relationship', e.target.value as GuardianRelationship | '')}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none text-base bg-white"
                >
                  <option value="">Sin especificar</option>
                  {Object.entries(GUARDIAN_RELATIONSHIP_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Alergias{' '}
                  <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={child.allergies}
                  onChange={(e) => updateChild(child.key, 'allergies', e.target.value)}
                  placeholder="Ej. maní, polvo, penicilina…"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Notas médicas{' '}
                  <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={child.medical_notes}
                  onChange={(e) => updateChild(child.key, 'medical_notes', e.target.value)}
                  placeholder="Ej. asma, epilepsia controlada…"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Comentarios adicionales{' '}
                  <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <textarea
                  value={child.comments}
                  onChange={(e) => updateChild(child.key, 'comments', e.target.value)}
                  placeholder="Ej. ya va solo al baño, le teme a los globos…"
                  rows={2}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none text-base resize-none"
                />
              </div>
            </div>
          )
        })}

        <button
          type="button"
          onClick={addChild}
          className="w-full py-3 flex items-center justify-center gap-2 text-sm font-medium text-indigo-600 border-2 border-dashed border-indigo-200 rounded-xl hover:bg-indigo-50 transition-colors"
        >
          <Plus size={16} />
          Agregar otro niño
        </button>
      </section>

      {errors.global && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {errors.global}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full py-4 text-lg font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {saving ? 'Guardando…' : 'Guardar familia y continuar'}
      </button>
    </form>
  )
}
