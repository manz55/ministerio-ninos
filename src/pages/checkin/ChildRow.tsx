import { motion } from 'framer-motion'
import { Check, ChevronRight, FileWarning, PartyPopper } from 'lucide-react'
import { getAgeLabel, getEffectiveCategory, hasCategoryChanged } from '../../lib/categoryUtils'
import { CATEGORY_LABELS, NEXT_CATEGORY } from '../../types/domain'
import { itemVariants } from '../../components/motion/presets'
import { groupOf, initials, isInToday, todayBadgeOf, type ChildResult } from './shared'

/**
 * Un niño en la lista. Toda la tarjeta es un botón (Enter/Espacio funcionan
 * solos): abre el panel de registro, o el de corrección si ya está adentro.
 * `layout` hace que, al registrarlo, se deslice a su nuevo lugar arriba con
 * los ya registrados en vez de brincar.
 */
export function ChildRow({ child, onOpen, showGroup = false, index = 0 }: { child: ChildResult; onOpen: (id: string) => void; showGroup?: boolean; index?: number }) {
  const category = getEffectiveCategory(child)
  const g = groupOf(category)
  const inToday = isInToday(child)
  const badge = todayBadgeOf(child)
  const age = getAgeLabel(child.birth_date)
  const hasAlert = !!(child.allergies || child.medical_notes)
  const graduatesTo = hasCategoryChanged(child) && child.category ? NEXT_CATEGORY[child.category] : null

  return (
    <motion.button
      layout="position"
      variants={itemVariants}
      custom={index}
      type="button"
      onClick={() => onOpen(child.id)}
      whileTap={{ scale: 0.985 }}
      className={`group w-full text-left flex items-center gap-3 rounded-2xl px-3.5 py-3 border transition-[background-color,border-color,box-shadow] duration-300 ${
        inToday
          ? 'bg-emerald-50 border-emerald-200/80 hover:border-emerald-300'
          : 'bg-white border-transparent shadow-sm shadow-gray-900/5 hover:border-indigo-200 hover:shadow-md'
      }`}
    >
      <span
        className={`relative w-11 h-11 rounded-full flex items-center justify-center font-display font-semibold text-[15px] shrink-0 transition-colors duration-300 ${
          inToday ? 'bg-emerald-500 text-white' : g.avatar
        }`}
      >
        {inToday ? <Check size={20} strokeWidth={3} /> : initials(child.full_name)}
        {hasAlert && (
          <span
            className="absolute -top-0.5 -right-0.5 w-[18px] h-[18px] rounded-full bg-red-500 ring-2 ring-white text-white text-[10px] font-bold flex items-center justify-center"
            title="Tiene alergias o notas médicas"
          >
            !
          </span>
        )}
      </span>

      <span className="flex-1 min-w-0">
        <span className="block font-display font-semibold text-[17px] leading-tight text-gray-900 truncate">{child.full_name}</span>
        <span className="block text-sm text-gray-500 truncate mt-0.5">
          {age !== null ? `${age} año${age !== 1 ? 's' : ''} · ` : ''}
          {child.parents?.full_name ?? 'Sin responsable'}
        </span>
        {(showGroup || graduatesTo || !child.birth_date) && (
          <span className="flex flex-wrap gap-1 mt-1.5">
            {showGroup && (
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${g.avatar}`}>
                {category ? CATEGORY_LABELS[category] : 'Sin grupo'}
              </span>
            )}
            {graduatesTo && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold bg-amber-100 text-amber-800">
                <PartyPopper size={11} /> Ya puede pasar a {CATEGORY_LABELS[graduatesTo]}
              </span>
            )}
            {!child.birth_date && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-700">
                <FileWarning size={11} /> Sin fecha de nacimiento
              </span>
            )}
          </span>
        )}
      </span>

      {inToday ? (
        <motion.span
          key={badge ?? 'listo'}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 22 }}
          className="shrink-0 rounded-xl bg-emerald-600 text-white font-display font-semibold text-lg leading-none px-2.5 py-2 tabular-nums shadow-sm"
        >
          {badge ? `#${badge}` : 'Listo'}
        </motion.span>
      ) : (
        <span className="shrink-0 flex items-center gap-0.5 text-sm font-semibold text-indigo-600">
          <span className="hidden sm:inline opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">Registrar</span>
          <ChevronRight size={18} className="text-gray-300 group-hover:text-indigo-500 transition-colors" />
        </span>
      )}
    </motion.button>
  )
}
