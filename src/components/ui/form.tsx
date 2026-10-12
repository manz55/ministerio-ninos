import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

/** Clase común para cajas de texto, selects y áreas de texto. */
export const INPUT = 'w-full px-4 py-3 rounded-2xl border-2 border-gray-200 bg-white text-base text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none transition-colors'

export function Field({ label, hint, required, children, error }: {
  label: string
  hint?: string
  required?: boolean
  children: ReactNode
  error?: string | null
}) {
  return (
    <label className="block">
      <span className="flex items-baseline gap-1.5 text-sm font-semibold text-gray-700 mb-1.5">
        {label}
        {required && <span className="text-red-500">*</span>}
        {hint && <span className="font-normal text-gray-400">{hint}</span>}
      </span>
      {children}
      {error && <span className="block text-xs text-red-600 mt-1">{error}</span>}
    </label>
  )
}

/** Opciones de una sola elección como botones grandes (Sí / No / No sé). */
export function ChoiceChips<T>({ value, onChange, options }: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <motion.button
            key={String(o.value)}
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={() => onChange(o.value)}
            className={`py-2.5 rounded-2xl text-sm font-semibold border-2 transition-colors ${
              active ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }`}
          >
            {o.label}
          </motion.button>
        )
      })}
    </div>
  )
}

/** Mensaje de error que "tiembla" un poquito al aparecer. */
export function FormError({ error }: { error: string | null | undefined }) {
  if (!error) return null
  return (
    <motion.p
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, x: [0, -6, 6, -3, 3, 0] }}
      transition={{ duration: 0.35 }}
      role="alert"
      className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-2xl px-4 py-3"
    >
      {error}
    </motion.p>
  )
}
