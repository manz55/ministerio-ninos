import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'

/** Encabezado común de cada sección: título grande, subtítulo y acciones. */
export function PageHeader({ title, subtitle, actions, onBack, eyebrow }: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  onBack?: () => void
  eyebrow?: ReactNode
}) {
  return (
    <motion.header
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3"
    >
      <div className="flex items-start gap-2 min-w-0">
        {onBack && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onBack}
            className="mt-1 p-2 -ml-2 rounded-xl text-gray-500 hover:bg-white hover:text-gray-800 transition-colors"
            aria-label="Volver"
          >
            <ChevronLeft size={22} />
          </motion.button>
        )}
        <div className="min-w-0">
          {eyebrow && <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{eyebrow}</p>}
          <h1 className="text-[32px] sm:text-4xl font-bold text-gray-900 leading-[1.05]">{title}</h1>
          {subtitle && <p className="text-gray-500 mt-1">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:shrink-0">{actions}</div>}
    </motion.header>
  )
}

/** Botón principal (azul) y secundario (blanco) con el mismo tamaño. */
export const BTN_PRIMARY = 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-900/10 hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50 transition'
export const BTN_SECONDARY = 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-white text-gray-700 font-semibold border border-gray-200 hover:border-indigo-300 hover:text-indigo-700 active:scale-[0.98] disabled:opacity-50 transition'
