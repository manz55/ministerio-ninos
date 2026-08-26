import { useState } from 'react'
import { LogIn, Check, AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { requiresBadge, requiresPager } from '../../lib/categoryUtils'
import { CATEGORY_LABELS, isCorderitos, type Category, type TeamColor } from '../../types/domain'

const TEAM_KEY = 'ministerio_team_session'
const today = new Date().toISOString().slice(0, 10)

function getStoredTeamForToday(): TeamColor | null {
  try {
    const raw = localStorage.getItem(TEAM_KEY)
    if (!raw) return null
    const { color, date } = JSON.parse(raw)
    return date === today ? color : null
  } catch { return null }
}

/**
 * Domingo por la mañana no hay tiempo de guardar a un niño (nuevo o
 * editado) en Familias y luego ir a Registro a buscarlo de nuevo solo para
 * ponerle el gafete — este es ese mismo último paso, aquí mismo, justo
 * después de guardar. Reutiliza el mismo equipo del día que Registro ya
 * tiene guardado en localStorage; si todavía no se ha elegido equipo hoy,
 * no hay de dónde sacar el team_color que la tabla exige, así que se avisa
 * en vez de intentar adivinar.
 */
export function QuickCheckIn({ childId, category }: { childId: string; category: Category | null }) {
  const [badge, setBadge] = useState('')
  const [pager, setPager] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const teamColor = getStoredTeamForToday()
  const needsBadge = category ? requiresBadge(category) : false
  const needsPager = category ? requiresPager(category) : false

  if (!category) {
    return (
      <p className="text-xs text-amber-600 flex items-center gap-1.5">
        <AlertTriangle size={13} className="shrink-0" />
        Sin categoría asignada — no se puede registrar todavía.
      </p>
    )
  }

  if (!teamColor) {
    return (
      <p className="text-xs text-gray-400 flex items-center gap-1.5">
        <AlertTriangle size={13} className="shrink-0" />
        Nadie ha elegido equipo hoy en Registro — entra ahí primero.
      </p>
    )
  }

  if (done) {
    return (
      <p className="text-xs text-emerald-600 font-medium flex items-center gap-1.5">
        <Check size={13} className="shrink-0" /> Registrado hoy en {CATEGORY_LABELS[category]}.
      </p>
    )
  }

  // Re-bound as plain consts so the closure below keeps the non-null
  // narrowing — TS doesn't carry it across into a nested function.
  const cat: Category = category
  const team: TeamColor = teamColor

  async function submit() {
    const badgeNum = needsBadge ? parseInt(badge, 10) : null
    if (needsBadge && (!badge || isNaN(badgeNum!) || badgeNum! <= 0)) {
      setError('Número de gafete inválido.')
      return
    }
    setSubmitting(true)
    setError(null)
    const { error: err } = await supabase.from('attendance').insert({
      child_id: childId,
      session_date: today,
      team_color: team,
      category: cat,
      badge_number: isCorderitos(cat) ? null : badgeNum,
      pager_number: needsPager && pager ? parseInt(pager, 10) : null,
    })
    setSubmitting(false)
    if (err) {
      if (err.code === '23505' && err.message.includes('attendance_badge_category_unique')) {
        setError(`El gafete #${badgeNum} ya está en uso hoy en ${CATEGORY_LABELS[cat]}.`)
      } else if (err.code === '23505') {
        setError('Ya está registrado hoy.')
      } else {
        setError('No se pudo registrar. Intenta de nuevo.')
      }
      return
    }
    setDone(true)
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        {needsBadge && (
          <input
            type="number"
            inputMode="numeric"
            value={badge}
            onChange={(e) => setBadge(e.target.value)}
            placeholder="Gafete"
            className="w-20 px-2 py-1.5 text-xs font-bold text-center border-2 border-gray-200 rounded-lg focus:border-indigo-400 focus:outline-none"
          />
        )}
        {needsPager && (
          <input
            type="number"
            inputMode="numeric"
            value={pager}
            onChange={(e) => setPager(e.target.value)}
            placeholder="Bíper (op.)"
            className="w-24 px-2 py-1.5 text-xs font-bold text-center border-2 border-gray-200 rounded-lg focus:border-indigo-400 focus:outline-none"
          />
        )}
        <button
          onClick={submit}
          disabled={submitting}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50"
        >
          <LogIn size={13} />
          {submitting ? 'Registrando…' : `Registrar en ${CATEGORY_LABELS[category]}`}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
