import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, CornerDownLeft } from 'lucide-react'

/** Buscador grande de la app: puntitos mientras se escribe, botón para
 * borrar, y Enter opcional (p. ej. abrir el primer resultado). */
export function SearchField({
  value, onChange, placeholder, typing = false, large = false, autoFocus = false, onEnter,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  typing?: boolean
  large?: boolean
  autoFocus?: boolean
  /** Enter abre al primer resultado: en compu se registra sin tocar el mouse. */
  onEnter?: () => void
}) {
  return (
    <div className="relative group">
      <span className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
        {typing ? (
          <span className="flex items-center gap-0.5">
            {[0, 1, 2].map((i) => (
              <motion.span key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-500" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />
            ))}
          </span>
        ) : (
          <Search size={20} className="text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
        )}
      </span>
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && onEnter) { e.preventDefault(); onEnter() } }}
        enterKeyHint="search"
        placeholder={placeholder}
        className={`w-full pl-12 pr-12 ${large ? 'py-4 text-[17px]' : 'py-3.5 text-base'} bg-white border-2 border-gray-200/80 rounded-2xl shadow-sm focus:border-indigo-500 focus:shadow-lg focus:shadow-indigo-900/5 focus:outline-none transition-[border-color,box-shadow] placeholder:text-gray-400 [&::-webkit-search-cancel-button]:hidden`}
      />
      <AnimatePresence>
        {value && (
          <motion.button
            initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }}
            onClick={() => onChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100"
            aria-label="Borrar búsqueda"
          >
            <X size={17} />
          </motion.button>
        )}
      </AnimatePresence>
      {onEnter && value.trim().length >= 2 && (
        <span className="hidden lg:flex absolute right-12 top-1/2 -translate-y-1/2 items-center gap-1 text-[11px] text-gray-400 pointer-events-none">
          <CornerDownLeft size={12} /> abre el primero
        </span>
      )}
    </div>
  )
}
