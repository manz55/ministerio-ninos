import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { format, startOfWeek, endOfWeek, isSameDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { Cake } from 'lucide-react'
import { groupOf, initials, type ChildResult } from './shared'
import { getEffectiveCategory } from '../../lib/categoryUtils'

type Birthday = { child: ChildResult; date: Date; turns: number }

/** Quién cumple años esta semana (domingo a sábado), para felicitarlos. */
function birthdaysThisWeek(children: ChildResult[], now: Date): Birthday[] {
  const start = startOfWeek(now, { weekStartsOn: 0 })
  const end = endOfWeek(now, { weekStartsOn: 0 })
  const list: Birthday[] = []
  for (const child of children) {
    if (!child.birth_date) continue
    const [y, m, d] = child.birth_date.split('-').map(Number)
    // La semana puede cruzar de año (fin de diciembre), así que se prueban los dos.
    for (const year of new Set([start.getFullYear(), end.getFullYear()])) {
      // 29 de febrero en año no bisiesto: se celebra el 28.
      const date = new Date(year, m - 1, m === 2 && d === 29 && new Date(year, 1, 29).getMonth() !== 1 ? 28 : d)
      if (date >= start && date <= end) list.push({ child, date, turns: year - y })
    }
  }
  return list.filter((b) => b.turns > 0).sort((a, b) => a.date.getTime() - b.date.getTime())
}

export function BirthdayCard({ kids, onOpen }: { kids: ChildResult[]; onOpen: (childId: string) => void }) {
  const now = useMemo(() => new Date(), [])
  const list = useMemo(() => birthdaysThisWeek(kids, now), [kids, now])
  if (list.length === 0) return null

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl bg-white/85 backdrop-blur border border-gray-200/70 shadow-sm p-4 space-y-2.5"
    >
      <h2 className="font-display text-lg font-semibold text-gray-900 flex items-center gap-2">
        <Cake size={18} className="text-pink-500" /> Cumpleaños esta semana
      </h2>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {list.map(({ child, date, turns }) => {
          const today = isSameDay(date, now)
          const g = groupOf(getEffectiveCategory(child))
          return (
            <li key={child.id}>
              <button type="button" onClick={() => onOpen(child.id)}
                className={`w-full flex items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors ${today ? 'bg-pink-50 hover:bg-pink-100' : 'hover:bg-gray-50'}`}>
                <span className={`w-9 h-9 rounded-full flex items-center justify-center font-display font-semibold text-sm shrink-0 ${g.avatar}`}>{initials(child.full_name)}</span>
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-sm text-gray-800 truncate">{child.full_name}</span>
                  <span className="block text-xs text-gray-500">Cumple {turns} año{turns !== 1 ? 's' : ''}</span>
                </span>
                <span className={`shrink-0 inline-block text-xs font-semibold first-letter:uppercase ${today ? 'text-pink-600' : 'text-gray-500'}`}>
                  {today ? 'Hoy' : format(date, "EEEE d", { locale: es })}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </motion.section>
  )
}
