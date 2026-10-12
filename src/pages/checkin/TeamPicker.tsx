import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Monitor, User } from 'lucide-react'
import type { TeamColor } from '../../types/domain'
import { ChurchLogo } from '../../components/ui/ChurchLogo'
import { listVariants, itemVariants } from '../../components/motion/presets'
import { TEAM_META } from './shared'

const TEAMS: TeamColor[] = ['rojo', 'amarillo', 'azul']

/** Primera pantalla de cada domingo: quién está a cargo y qué equipo sirve. */
export function TeamPicker({
  onConfirm, initialCoordinator, initialComputerOperator,
}: {
  onConfirm: (color: TeamColor, coordinator: string, computerOperator: string) => void
  initialCoordinator: string
  initialComputerOperator: string
}) {
  const [coordinator, setCoordinator] = useState(initialCoordinator)
  useEffect(() => setCoordinator(initialCoordinator), [initialCoordinator])
  const [operator, setOperator] = useState(initialComputerOperator)
  useEffect(() => setOperator(initialComputerOperator), [initialComputerOperator])
  const [picked, setPicked] = useState<TeamColor | null>(null)

  function pick(color: TeamColor) {
    if (picked) return
    setPicked(color)
    // Deja ver la selección un instante antes de pasar a Registro.
    setTimeout(() => onConfirm(color, coordinator.trim(), operator.trim()), 320)
  }

  const input = 'w-full pl-11 pr-4 py-3.5 bg-white border-2 border-gray-200 rounded-2xl text-base font-medium text-gray-800 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none shadow-sm transition-colors'

  return (
    <motion.div variants={listVariants} initial="hidden" animate="show" className="min-h-[72vh] flex flex-col items-center justify-center gap-7 py-8">
      <motion.div variants={itemVariants} custom={0} className="flex flex-col items-center text-center">
        <motion.div initial={{ rotate: -8, scale: 0.8 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }}>
          <span className="block rounded-[28px] bg-white p-2.5 shadow-md shadow-gray-900/5 border border-gray-200/60">
            <ChurchLogo size={68} />
          </span>
        </motion.div>
        <p className="mt-4 text-xs font-semibold text-gray-500 uppercase tracking-widest">{format(new Date(), 'EEEE', { locale: es })}</p>
        <h1 className="text-4xl font-semibold text-gray-900 mt-1">{format(new Date(), "d 'de' MMMM", { locale: es })}</h1>
        <p className="text-gray-500 mt-1">¡Bienvenidos! Antes de empezar:</p>
      </motion.div>

      <motion.div variants={itemVariants} custom={1} className="w-full max-w-sm space-y-3">
        <label className="block relative">
          <span className="sr-only">¿Quién está de encargado hoy?</span>
          <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500" />
          <input type="text" value={coordinator} onChange={(e) => setCoordinator(e.target.value)} placeholder="¿Quién está de encargado hoy?" autoComplete="off" className={input} />
        </label>
        <label className="block relative">
          <span className="sr-only">¿Quién está en la compu hoy?</span>
          <Monitor size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500" />
          <input type="text" value={operator} onChange={(e) => setOperator(e.target.value)} placeholder="¿Quién está en la compu hoy?" autoComplete="off" className={input} />
        </label>
      </motion.div>

      <motion.div variants={itemVariants} custom={2} className="w-full max-w-md">
        <p className="text-center font-display text-xl font-semibold text-gray-800 mb-3">¿Qué equipo sirve hoy?</p>
        <div className="grid grid-cols-3 gap-3">
          {TEAMS.map((color) => {
            const m = TEAM_META[color]
            const isPicked = picked === color
            return (
              <motion.button
                key={color}
                onClick={() => pick(color)}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.94 }}
                animate={picked ? { scale: isPicked ? 1.06 : 0.92, opacity: isPicked ? 1 : 0.4 } : { scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                className={`${m.bg} ${m.text} rounded-3xl py-7 flex flex-col items-center gap-3 shadow-lg shadow-gray-900/10`}
              >
                <span className="w-12 h-12 rounded-full bg-white/25 flex items-center justify-center">
                  <motion.span className="w-6 h-6 rounded-full bg-white/80" animate={isPicked ? { scale: [1, 1.5, 1] } : {}} transition={{ duration: 0.35 }} />
                </span>
                <span className="font-display text-xl font-semibold">{m.label}</span>
              </motion.button>
            )
          })}
        </div>
      </motion.div>
    </motion.div>
  )
}
