import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { CATEGORY_LABELS, type Category } from '../../types/domain'
import { AnimatedNumber } from '../../components/motion'
import { listVariants, itemVariants } from '../../components/motion/presets'
import { GROUPS } from './shared'

/**
 * Los cinco grupos. Renglones en celular/tablet (sin cuadro huérfano, sin
 * nombres partidos) y cinco columnas en pantallas anchas. El ícono y el
 * nombre comparten `layoutId` con el encabezado de la vista del grupo, así
 * que al tocar uno "vuelan" a su lugar arriba en vez de cambiar de golpe.
 */
export function GroupTiles({ counts, totals, onOpen, wide }: {
  counts: Partial<Record<Category, number>>
  totals: Partial<Record<Category, number>>
  onOpen: (c: Category) => void
  wide: boolean
}) {
  return (
    <motion.div
      variants={listVariants}
      initial="hidden"
      animate="show"
      className={`grid gap-2.5 ${wide ? 'grid-cols-1 sm:grid-cols-2 2xl:grid-cols-5' : 'grid-cols-1 sm:grid-cols-2'}`}
    >
      {GROUPS.map((g, i) => {
        const count = counts[g.category] ?? 0
        const total = totals[g.category] ?? 0
        const pct = total > 0 ? Math.min(100, Math.round((count / total) * 100)) : 0
        const Icon = g.icon
        const last = i === GROUPS.length - 1
        return (
          <motion.button
            key={g.category}
            variants={itemVariants}
            custom={i}
            onClick={() => onOpen(g.category)}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            className={`group relative overflow-hidden rounded-2xl text-left border border-black/[0.04] shadow-sm hover:shadow-md transition-shadow ${g.tile}
              flex 2xl:flex-col items-center 2xl:items-stretch gap-3.5 px-4 py-3.5 2xl:p-5 ${last ? `sm:col-span-2 ${wide ? '2xl:col-span-1' : ''}` : ''}`}
          >
            <motion.span layoutId={`group-icon-${g.category}`} className={`rounded-xl ${g.iconBg} flex items-center justify-center w-12 h-12 shrink-0`}>
              <Icon className={`w-6 h-6 ${g.iconColor} transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6`} />
            </motion.span>
            <span className="flex-1 min-w-0">
              <motion.span layoutId={`group-title-${g.category}`} className={`block w-fit font-display font-semibold text-lg leading-tight ${g.text}`}>
                {CATEGORY_LABELS[g.category]}
              </motion.span>
              <span className={`block text-xs ${g.iconColor} opacity-80 mt-0.5`}>
                {g.ages}{total > 0 ? ` · ${total} en lista` : ''}
              </span>
              <span className={`block h-1.5 w-full rounded-full ${g.barBg} mt-2.5 overflow-hidden`}>
                <motion.span
                  className={`block h-full rounded-full ${g.bar}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.15 + i * 0.05 }}
                />
              </span>
            </span>
            <span className={`shrink-0 flex items-center gap-2 2xl:justify-between ${g.text}`}>
              <span className="text-right 2xl:text-left">
                <span className="block font-display text-[32px] font-semibold leading-none"><AnimatedNumber value={count} /></span>
                <span className={`block text-[11px] font-medium ${g.iconColor} mt-0.5`}>hoy</span>
              </span>
              <ArrowRight size={18} className={`hidden 2xl:block ${g.iconColor} opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all`} />
            </span>
          </motion.button>
        )
      })}
    </motion.div>
  )
}
