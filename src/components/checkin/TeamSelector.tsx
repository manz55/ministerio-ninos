import { motion } from 'framer-motion'
import type { TeamColor } from '../../types/domain'

const TEAMS: {
  color: TeamColor
  label: string
  pill: string
  textActive: string
}[] = [
  { color: 'rojo',     label: 'Rojo',     pill: 'bg-red-500',    textActive: 'text-white' },
  { color: 'amarillo', label: 'Amarillo', pill: 'bg-yellow-400', textActive: 'text-gray-800' },
  { color: 'azul',     label: 'Azul',     pill: 'bg-blue-500',   textActive: 'text-white' },
]

interface Props {
  value: TeamColor
  onChange: (v: TeamColor) => void
}

export function TeamSelector({ value, onChange }: Props) {
  const selectedIndex = TEAMS.findIndex((t) => t.color === value)

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-0.5">
        Equipo de hoy
      </span>
      <div className="relative flex bg-gray-100 rounded-xl p-1 gap-0.5">
        {/* Sliding pill */}
        <motion.div
          className={`absolute top-1 bottom-1 rounded-lg ${TEAMS[selectedIndex].pill} shadow-sm`}
          style={{ width: `calc(${100 / TEAMS.length}% - 4px)` }}
          animate={{ x: `calc(${selectedIndex * 100}% + ${selectedIndex * 2}px)` }}
          transition={{ type: 'spring', stiffness: 420, damping: 38 }}
        />
        {TEAMS.map((t) => (
          <button
            key={t.color}
            onClick={() => onChange(t.color)}
            className={`relative z-10 flex-1 py-1.5 px-2 text-sm font-semibold rounded-lg transition-colors duration-150 ${
              value === t.color ? t.textActive : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}
