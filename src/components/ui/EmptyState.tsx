import { motion } from 'framer-motion'
import { UserPlus, type LucideIcon } from 'lucide-react'

/** Mensaje de "no hay nada aquí", con una acción opcional. */
export function EmptyState({ text, action, actionLabel = 'Registrar familia nueva', icon: Icon = UserPlus }: {
  text: string
  action?: () => void
  actionLabel?: string
  icon?: LucideIcon
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center py-10 px-4 space-y-4 bg-white/80 rounded-3xl border border-gray-200/70">
      <p className="text-gray-600">{text}</p>
      {action && (
        <motion.button whileTap={{ scale: 0.96 }} onClick={action}
          className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-indigo-600 rounded-2xl hover:bg-indigo-700 shadow-md shadow-indigo-900/10 transition-colors">
          <Icon size={16} /> {actionLabel}
        </motion.button>
      )}
    </motion.div>
  )
}
