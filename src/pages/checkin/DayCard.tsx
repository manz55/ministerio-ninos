import { useState } from 'react'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Baby, Monitor, Pencil, User, Check } from 'lucide-react'
import type { TeamColor } from '../../types/domain'
import { AnimatedNumber } from '../../components/motion'
import { TEAM_META } from './shared'

/** Encabezado del día: fecha, cuántos van, equipo y los encargados. */
export function DayCard({
  totalToday, teamColor, onChangeTeam, coordinatorName, operatorName, onSaveCoordinator, onSaveOperator, corderitosLeadName, onSaveCorderitosLead,
}: {
  totalToday: number
  teamColor: TeamColor
  onChangeTeam: () => void
  coordinatorName: string
  operatorName: string
  onSaveCoordinator: (name: string) => Promise<string | null>
  onSaveOperator: (name: string) => Promise<string | null>
  corderitosLeadName: string
  onSaveCorderitosLead: (name: string) => Promise<string | null>
}) {
  const team = TEAM_META[teamColor]
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-3xl bg-white border border-gray-200/70 shadow-sm overflow-hidden"
    >
      <div className="flex items-stretch">
        <div className="flex-1 min-w-0 px-5 pt-4 pb-3.5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{format(new Date(), 'EEEE', { locale: es })}</p>
          <h1 className="text-[26px] sm:text-3xl font-semibold text-gray-900 leading-tight">{format(new Date(), "d 'de' MMMM", { locale: es })}</h1>
          <p className="mt-1 text-sm text-gray-600 flex items-baseline gap-1.5">
            <span className="font-display text-2xl font-semibold text-emerald-600 leading-none"><AnimatedNumber value={totalToday} /></span>
            {totalToday === 1 ? 'niño registrado hoy' : 'niños registrados hoy'}
          </p>
        </div>
        <motion.button
          onClick={onChangeTeam}
          whileTap={{ scale: 0.96 }}
          className={`shrink-0 w-28 sm:w-32 m-2 rounded-2xl flex flex-col items-center justify-center gap-0.5 ${team.bg} ${team.text} shadow-sm hover:brightness-95 transition`}
          title="Cambiar equipo"
        >
          <span className="text-[11px] font-semibold uppercase tracking-wider opacity-80">Equipo</span>
          <span className="font-display text-2xl font-semibold leading-none">{team.label}</span>
          <span className="text-[11px] font-medium opacity-85 mt-0.5">Cambiar</span>
        </motion.button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 border-t border-gray-100 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
        <NameSlot icon={User} label="Encargado" value={coordinatorName} onSave={onSaveCoordinator} />
        <NameSlot icon={Monitor} label="En la compu" value={operatorName} onSave={onSaveOperator} />
        <NameSlot icon={Baby} label="Corderitos" value={corderitosLeadName} onSave={onSaveCorderitosLead} />
      </div>
    </motion.section>
  )
}

function NameSlot({ icon: Icon, label, value, onSave }: { icon: typeof User; label: string; value: string; onSave: (name: string) => Promise<string | null> }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function commit() {
    setEditing(false)
    const name = draft.trim()
    if (!name || name === value) return
    const err = await onSave(name)
    setError(err)
    if (!err) { setSaved(true); setTimeout(() => setSaved(false), 1400) }
  }

  return (
    <div className="flex items-center gap-3 px-5 py-3 min-w-0">
      <span className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
        {saved ? <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}><Check size={16} strokeWidth={3} /></motion.span> : <Icon size={16} />}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
        {editing ? (
          <input
            autoFocus
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur() }
              if (e.key === 'Escape') { setDraft(value); setEditing(false) }
            }}
            placeholder="Nombre…"
            className="w-full text-[15px] border-b-2 border-indigo-400 focus:outline-none font-semibold text-gray-800 bg-transparent"
          />
        ) : (
          <button onClick={() => { setDraft(value); setEditing(true) }} className="group flex items-center gap-1.5 max-w-full text-left">
            <span className={`truncate text-[15px] ${value ? 'font-semibold text-gray-800' : 'text-indigo-600 font-medium'}`}>{value || 'Agregar nombre'}</span>
            <Pencil size={12} className="shrink-0 text-gray-400 group-hover:text-indigo-600 transition-colors" />
          </button>
        )}
        {error && <p className="text-[11px] text-red-600 mt-0.5">{error}</p>}
      </div>
    </div>
  )
}
