import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { TEAM_COLOR_LABELS, type Maestro, type TeamColor } from '../../types/domain'

const TEAM_ORDER: TeamColor[] = ['rojo', 'amarillo', 'azul']
const TEAM_DOT: Record<TeamColor, string> = { rojo: 'bg-red-500', amarillo: 'bg-yellow-400', azul: 'bg-blue-500' }

interface Props {
  value: string | null
  onChange: (id: string | null) => void
  freeTextValue: string | null
  onFreeTextChange: (name: string | null) => void
  compact?: boolean
}

/**
 * Selector de "maestro responsable" para niños de Corderitos: primero se
 * elige el equipo (rojo/amarillo/azul) para acotar la lista, luego se
 * escoge el maestro dentro de ese equipo — evita desplazarse entre ~27
 * maestros de golpe. Nada impide asignar el mismo maestro a varios niños.
 *
 * También incluye un campo de texto libre (assigned_maestro_name) para
 * cuando el maestro todavía no está cargado en el directorio — temporal,
 * mientras se completa `maestros`. Elegir uno de los dos modos limpia el
 * otro, para no guardar ambos a la vez y no saber cuál mostrar.
 */
export function AssignedMaestroField({ value, onChange, freeTextValue, onFreeTextChange, compact }: Props) {
  const [maestros, setMaestros] = useState<Maestro[]>([])
  const [team, setTeam] = useState<TeamColor | null>(null)

  useEffect(() => {
    supabase.from('maestros').select('*').order('nombre').then(({ data }) => {
      setMaestros((data ?? []) as Maestro[])
    })
  }, [])

  // Si ya hay un maestro asignado, precarga su equipo para no abrir el
  // dropdown vacío.
  useEffect(() => {
    if (value && maestros.length > 0) {
      const current = maestros.find((m) => m.id === value)
      if (current) setTeam((t) => t ?? current.team_color)
    }
  }, [value, maestros])

  const filtered = team ? maestros.filter((m) => m.team_color === team) : []
  const labelClass = compact ? 'block text-xs font-medium text-gray-500 mb-1' : 'block text-sm font-medium text-gray-700 mb-1.5'
  const inputClass = compact
    ? 'w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm bg-white'
    : 'w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none text-base bg-white'

  return (
    <div>
      <label className={labelClass}>
        Maestro responsable <span className="text-gray-400 font-normal">(opcional)</span>
      </label>
      <div className="grid grid-cols-3 gap-2 mb-2">
        {TEAM_ORDER.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTeam(t)}
            className={`flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold border-2 transition-colors ${compact ? 'py-2' : 'py-2.5'} ${
              team === t ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${TEAM_DOT[t]}`} />
            {TEAM_COLOR_LABELS[t]}
          </button>
        ))}
      </div>
      {team && (
        filtered.length > 0 ? (
          <select
            value={value ?? ''}
            onChange={(e) => { onChange(e.target.value || null); if (e.target.value) onFreeTextChange(null) }}
            className={inputClass}
          >
            <option value="">Sin asignar</option>
            {filtered.map((m) => (
              <option key={m.id} value={m.id}>{m.nombre} {m.apellido}</option>
            ))}
          </select>
        ) : (
          <p className="text-xs text-gray-400">Aún no hay maestros en el equipo {TEAM_COLOR_LABELS[team]}.</p>
        )
      )}
      <div className="mt-2">
        <label className={`${labelClass} !text-gray-400 !font-normal`}>
          ¿Aún no está en la lista? Escribe su nombre (temporal)
        </label>
        <input
          type="text"
          value={freeTextValue ?? ''}
          onChange={(e) => { const v = e.target.value; onFreeTextChange(v || null); if (v) onChange(null) }}
          placeholder="Nombre y apellido"
          className={inputClass}
        />
      </div>
    </div>
  )
}
