import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { AnimatePresence, motion } from 'framer-motion'
import {
  GraduationCap, Check, FileWarning, ArrowRight, Wand2, AlertCircle, CornerDownLeft,
  Inbox, UserPlus, Repeat, Pencil, CalendarDays,
} from 'lucide-react'
import { CoderIcon } from '../components/ui/CoderIcon'
import { CATEGORY_LABELS } from '../types/domain'
import { useCoderState } from '../hooks/useCoderState'

// Clicking one of these fills the command bar with its starter text instead
// of just describing it — you still have to type the name (and category/
// fecha/nombre nuevo), but you don't have to remember the exact phrasing.
const CAPABILITIES = [
  { Icon: Repeat, title: 'Cambiar categoría', template: 'cambiar categoría de ' },
  { Icon: Pencil, title: 'Cambiar nombre', template: 'cambiar nombre de ' },
  { Icon: CalendarDays, title: 'Poner fecha de nacimiento', template: 'cambiar fecha de nacimiento de ' },
  { Icon: UserPlus, title: 'Crear familia nueva', to: '/registro?nueva=1' },
] as const

// Full-page version of the same state MiniCoder (the header popover) drives
// — this is Coder's home: graduation alerts, missing-data nudges, maestro
// requests, and the rule-based command bar, all with room to breathe
// instead of squeezed into a small popover.
export default function CoderPage() {
  const {
    resolvingId, actions, commandText, setCommandText, commandError, setCommandError,
    pendingCommand, setPendingCommand, commandResult, alerts, missingBirthDate,
    requests, resolveRequest, graduate, fillTemplate, submitCommand, executeCommand,
  } = useCoderState()
  const commandInputRef = useRef<HTMLInputElement>(null)

  function fillAndFocus(template: string) {
    fillTemplate(template)
    commandInputRef.current?.focus()
  }

  const nothingPending = alerts.length === 0 && Object.keys(actions).length === 0 && missingBirthDate === 0 && requests.length === 0

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shrink-0 shadow-md shadow-indigo-500/20">
          <CoderIcon size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-black text-gray-900 leading-tight">Soy Coder 👋</h1>
          <p className="text-sm text-gray-400 leading-tight">Toca una de estas o escríbeme abajo — yo busco al niño y te confirmo antes de guardar nada.</p>
        </div>
      </div>

      {/* ── ¿Qué puede hacer? ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {CAPABILITIES.map((cap) =>
          'to' in cap ? (
            <Link
              key={cap.title}
              to={cap.to}
              className="bg-white rounded-2xl border-2 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors p-4 flex items-start gap-3"
            >
              <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                <cap.Icon size={16} className="text-indigo-500" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900">{cap.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">Abrir el formulario →</p>
              </div>
            </Link>
          ) : (
            <button
              key={cap.title}
              onClick={() => fillAndFocus(cap.template)}
              className="text-left bg-white rounded-2xl border-2 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors p-4 flex items-start gap-3"
            >
              <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                <cap.Icon size={16} className="text-indigo-500" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900">{cap.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">Toca para empezar →</p>
              </div>
            </button>
          )
        )}
      </div>

      {/* ── Command bar: rule-based, no LLM — see coderCommands.ts ── */}
      <div className="bg-white rounded-2xl border-2 border-gray-200 p-4 space-y-2">
        <div className="relative">
          <Wand2 size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            ref={commandInputRef}
            type="text"
            value={commandText}
            onChange={(e) => { setCommandText(e.target.value); setCommandError(null) }}
            onKeyDown={(e) => { if (e.key === 'Enter') submitCommand() }}
            placeholder="cambiar categoría de… / cambiar nombre de… / cambiar fecha de nacimiento de…"
            className="w-full pl-9 pr-9 py-3 text-sm border-2 border-gray-200 rounded-xl focus:border-indigo-400 focus:outline-none placeholder:text-gray-300"
          />
          {commandText && (
            <button
              onClick={submitCommand}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-indigo-400 hover:text-indigo-600 rounded-md hover:bg-indigo-50"
            >
              <CornerDownLeft size={15} />
            </button>
          )}
        </div>

        {commandError && (
          <p className="text-xs text-red-600 flex items-start gap-1.5 leading-snug">
            <AlertCircle size={13} className="shrink-0 mt-0.5" />
            {commandError}
          </p>
        )}

        {commandResult && (
          <p className="text-xs text-emerald-600 font-medium flex items-center gap-1.5">
            <Check size={13} className="shrink-0" />
            {commandResult.message}
          </p>
        )}

        {pendingCommand && (
          <div className="space-y-1.5 pt-1">
            <p className="text-xs text-gray-500">
              {pendingCommand.type === 'rename'
                ? <>¿A cuál renombro a <span className="font-semibold text-gray-700">"{pendingCommand.newName}"</span>?</>
                : pendingCommand.type === 'birthdate'
                ? <>¿A cuál le pongo fecha de nacimiento <span className="font-semibold text-gray-700">{pendingCommand.displayDate}</span>?</>
                : <>¿A cuál paso a <span className="font-semibold text-indigo-600">{pendingCommand.targetLabel}</span>?</>}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {pendingCommand.candidates.map((c) => (
                <button
                  key={c.id}
                  onClick={() => executeCommand(c)}
                  className="px-2.5 py-1.5 text-xs font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                >
                  {c.full_name}
                </button>
              ))}
            </div>
            <button onClick={() => setPendingCommand(null)} className="text-xs text-gray-400 hover:text-gray-600">
              Cancelar
            </button>
          </div>
        )}
      </div>

      {/* ── Alertas ── */}
      {nothingPending ? (
        <div className="bg-white rounded-2xl border-2 border-gray-100 py-10 text-center">
          <p className="text-sm text-gray-400">Todo al día ✨</p>
          <p className="text-xs text-gray-300 mt-1">No hay avisos pendientes</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 items-start">
          {requests.map((r) => (
            <div key={r.id} className="bg-indigo-50/60 border-2 border-indigo-100 rounded-2xl px-4 py-3.5 flex items-start gap-2.5">
              <Inbox size={16} className="text-indigo-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 leading-snug">{r.message}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {r.profiles?.full_name ?? 'Un maestro'} ·{' '}
                  {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: es })}
                </p>
                <button
                  onClick={() => resolveRequest(r.id)}
                  disabled={resolvingId === r.id}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors disabled:opacity-40"
                >
                  <Check size={13} />
                  {resolvingId === r.id ? 'Marcando…' : 'Marcar como resuelta'}
                </button>
              </div>
            </div>
          ))}

          {missingBirthDate > 0 && (
            <div className="bg-amber-50/60 border-2 border-amber-100 rounded-2xl px-4 py-3.5 flex items-start gap-2.5">
              <FileWarning size={16} className="text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 leading-snug">
                  <span className="font-semibold text-gray-900">{missingBirthDate}</span>{' '}
                  {missingBirthDate === 1 ? 'niño no tiene' : 'niños no tienen'} fecha de nacimiento — no se les
                  puede calcular la edad ni avisar cuándo deben graduar. Dime uno por uno y se los pongo aquí mismo.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => fillAndFocus('cambiar fecha de nacimiento de ')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors"
                  >
                    <CalendarDays size={13} />
                    Ponerle fecha a uno aquí
                  </button>
                  <Link
                    to="/familias?roster=sin_fecha_nacimiento"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors"
                  >
                    Ver la lista completa
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            </div>
          )}

          <AnimatePresence initial={false}>
            {Object.entries(actions).map(([id, a]) => (
              <motion.div
                key={id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-white border-2 border-gray-100 rounded-2xl px-4 py-3.5 flex items-center gap-2.5"
              >
                {a.status === 'thinking' ? (
                  <>
                    <div className="flex items-center gap-0.5 shrink-0 w-5 justify-center">
                      {[0, 1, 2].map((i) => (
                        <motion.span
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-indigo-400"
                          animate={{ y: [0, -4, 0] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                        />
                      ))}
                    </div>
                    <p className="text-sm text-gray-500 leading-snug">
                      Pensando… pasando a <span className="font-semibold text-gray-700">{a.name}</span> a{' '}
                      <span className="font-semibold text-indigo-600">{CATEGORY_LABELS[a.to]}</span>
                    </p>
                  </>
                ) : (
                  <>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                      className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0"
                    >
                      <Check size={12} className="text-white" strokeWidth={3} />
                    </motion.div>
                    <p className="text-sm text-gray-700 leading-snug">
                      <span className="font-semibold text-gray-900">{a.name}</span> ya está en{' '}
                      <span className="font-semibold text-emerald-600">{CATEGORY_LABELS[a.to]}</span> — ¡hecho!
                    </p>
                  </>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {alerts.map((a) => (
            <div key={a.id} className="bg-white border-2 border-gray-100 rounded-2xl px-4 py-3.5 flex items-start gap-2.5">
              <span className="text-lg leading-none mt-0.5">🎉</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 leading-snug">
                  <span className="font-semibold text-gray-900">{a.name}</span> ya cumplió años — puede pasar a{' '}
                  <span className="font-semibold text-indigo-600">{CATEGORY_LABELS[a.to]}</span>
                </p>
                <button
                  onClick={() => graduate(a)}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                >
                  <GraduationCap size={13} />
                  Graduar a {CATEGORY_LABELS[a.to]}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
