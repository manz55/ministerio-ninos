import { useState } from 'react'
import { ChevronLeft, Plus, Trash2 } from 'lucide-react'
import { differenceInYears } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { getCategoryFromBirthDate } from '../../lib/categoryUtils'
import { CategoryBadge } from '../ui/CategoryBadge'
import type { ParentRow } from '../../types/domain'

interface ChildDraft {
  key: string
  full_name: string
  birth_date: string
  allergies: string
  medical_notes: string
}

interface Props {
  prefillName?: string
  onSaved: (parent: ParentRow) => void
  onCancel: () => void
}

function newChild(key: string): ChildDraft {
  return { key, full_name: '', birth_date: '', allergies: '', medical_notes: '' }
}

export function NewFamilyStep({ prefillName = '', onSaved, onCancel }: Props) {
  const [parentName, setParentName] = useState(prefillName)
  const [parentPhone, setParentPhone] = useState('')
  const [children, setChildren] = useState<ChildDraft[]>([newChild('0')])
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // ── Child helpers ───────────────────────────────────────────────────────────
  function updateChild(key: string, field: keyof ChildDraft, value: string) {
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
          allergies: c.allergies.trim() || null,
          medical_notes: c.medical_notes.trim() || null,
        }))
      )
      .select()

    if (childrenErr) {
      setErrors({ global: 'Error al guardar los niños. Intenta de nuevo.' })
      setSaving(false)
      return
    }

    // Construye ParentRow completo para pasar al siguiente paso
    const newParent: ParentRow = {
      ...parentData,
      children: (childrenData ?? []).map((c) => ({ ...c, attendance: [] })),
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
