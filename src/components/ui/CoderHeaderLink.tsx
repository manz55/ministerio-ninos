import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CoderIcon } from './CoderIcon'
import { useCoderPendingCount } from '../../hooks/useCoderPendingCount'

// The full Coder experience lives at /coder (a Dock tab, like Reportes or
// Familias), but a badge stays visible up here too — so a coordinator
// notices there's something waiting even when they're not on that tab.
export function CoderHeaderLink() {
  const pendingCount = useCoderPendingCount()

  return (
    <Link to="/coder" className="relative block group shrink-0" title="Coder · avisos y acciones">
      <motion.div
        animate={pendingCount > 0 ? { scale: [1, 1.08, 1] } : { scale: 1 }}
        transition={{ duration: 2.2, repeat: pendingCount > 0 ? Infinity : 0, ease: 'easeInOut' }}
        className={`flex items-center justify-center w-10 h-10 rounded-2xl transition-colors ${
          pendingCount > 0
            ? 'bg-gradient-to-br from-indigo-500 to-violet-500 shadow-md shadow-indigo-500/30'
            : 'bg-indigo-50 group-hover:bg-indigo-100'
        }`}
      >
        <CoderIcon size={19} className={pendingCount > 0 ? 'text-white' : 'text-indigo-400'} />
      </motion.div>
      {pendingCount > 0 && (
        <span
          className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white"
          style={{ animation: 'badge-pulse 2.2s ease-in-out infinite' }}
        >
          {pendingCount > 9 ? '9+' : pendingCount}
        </span>
      )}
    </Link>
  )
}
