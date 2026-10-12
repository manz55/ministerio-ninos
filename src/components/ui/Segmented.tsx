import { motion } from 'framer-motion'
import { useId } from 'react'

/** Pestañas tipo "píldora": el fondo se desliza a la opción elegida. */
export function Segmented<T extends string>({ value, onChange, options }: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; count?: number }[]
}) {
  const id = useId()
  return (
    <div className="flex w-full sm:inline-flex sm:w-auto p-1 rounded-2xl bg-white/80 border border-gray-200/70 shadow-sm max-w-full">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`relative flex-1 sm:flex-none min-w-0 px-2 sm:px-4 py-2 rounded-xl text-[13px] sm:text-sm font-semibold whitespace-nowrap transition-colors ${active ? 'text-white' : 'text-gray-600 hover:text-gray-900'}`}
          >
            {active && (
              <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-xl bg-indigo-600 shadow-sm" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />
            )}
            <span className="relative">
              {o.label}
              {o.count !== undefined && <span className={`${options.length > 3 ? 'hidden sm:inline ' : ''}ml-1 sm:ml-1.5 tabular-nums ${active ? 'text-white/80' : 'text-gray-400'}`}>{o.count}</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** Filtros pequeños (chips) para acotar una lista. */
export function FilterChips<T extends string>({ value, onChange, options }: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; count?: number; tone?: 'warn' }[]
}) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {options.map((o) => {
        const active = o.value === value
        return (
          <motion.button
            key={o.value}
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => onChange(o.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              active
                ? 'bg-gray-900 text-white border-gray-900'
                : o.tone === 'warn' && o.count
                ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            {o.label}{o.count !== undefined && <span className="ml-1 tabular-nums opacity-70">{o.count}</span>}
          </motion.button>
        )
      })}
    </div>
  )
}
