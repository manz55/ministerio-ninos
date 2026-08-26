import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, CornerDownLeft, Inbox, Wand2, AlertCircle, GraduationCap, FileWarning } from 'lucide-react'
import { CoderIcon } from './CoderIcon'
import { useCoderState } from '../../hooks/useCoderState'

// "Mini Coder" — the quick-actions version that follows you everywhere via
// the header, for the small/fast stuff (one command, one maestro request).
// The full page at /coder (reachable via the Dock, "Ver todo en Coder" at
// the bottom here) is where the bigger picture lives — every pending
// graduation, every missing birth_date, the whole requests history. Both
// share the same useCoderState so an action taken in one is instantly
// reflected in the other.
export function CoderHeaderLink() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const {
    resolvingId, commandText, setCommandText, commandError, setCommandError, pendingCommand, setPendingCommand,
    commandResult, alerts, missingBirthDate, requests, resolveRequest, submitCommand, executeCommand,
  } = useCoderState()

  const pendingCount = alerts.length + missingBirthDate + requests.length

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => { if (open) inputRef.current?.focus() }, [open])

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative block group"
        title="Coder · avisos y acciones rápidas"
      >
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
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-[340px] max-h-[75vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white/95 backdrop-blur-xl shadow-xl shadow-black/10 z-50"
          >
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shrink-0">
                <CoderIcon size={13} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 leading-tight">Mini Coder</p>
                <p className="text-xs text-gray-400 leading-tight">Cambios rápidos, sin salir de la página</p>
              </div>
            </div>

            {/* ── Command bar ── */}
            <div className="px-4 py-3 border-b border-gray-100 space-y-2">
              <div className="relative">
                <Wand2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                <input
                  ref={inputRef}
                  type="text"
                  value={commandText}
                  onChange={(e) => { setCommandText(e.target.value); setCommandError(null) }}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitCommand() }}
                  placeholder="cambiar categoría de… / cambiar nombre de…"
                  className="w-full pl-8 pr-8 py-2 text-xs border-2 border-gray-200 rounded-xl focus:border-indigo-400 focus:outline-none placeholder:text-gray-300"
                />
                {commandText && (
                  <button
                    onClick={submitCommand}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-indigo-400 hover:text-indigo-600 rounded-md hover:bg-indigo-50"
                  >
                    <CornerDownLeft size={13} />
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
                      ? <>¿A cuál le pongo fecha <span className="font-semibold text-gray-700">{pendingCommand.displayDate}</span>?</>
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

            {/* ── Solicitudes de maestros (lo mismo que ven en la página completa) ── */}
            {requests.length > 0 && (
              <div className="divide-y divide-gray-50 border-b border-gray-100">
                {requests.slice(0, 3).map((r) => (
                  <div key={r.id} className="px-4 py-3 flex items-start gap-2.5 bg-indigo-50/40">
                    <Inbox size={15} className="text-indigo-500 shrink-0 mt-0.5" />
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
              </div>
            )}

            {/* ── Resto de avisos, resumidos — el detalle vive en /coder ── */}
            {(alerts.length > 0 || missingBirthDate > 0) && (
              <div className="px-4 py-3 space-y-2 border-b border-gray-100">
                {alerts.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <GraduationCap size={14} className="text-indigo-400 shrink-0" />
                    {alerts.length} {alerts.length === 1 ? 'niño listo' : 'niños listos'} para graduar
                  </div>
                )}
                {missingBirthDate > 0 && (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <FileWarning size={14} className="text-amber-400 shrink-0" />
                    {missingBirthDate} sin fecha de nacimiento
                  </div>
                )}
              </div>
            )}

            <Link
              to="/coder"
              onClick={() => setOpen(false)}
              className="block px-4 py-3 text-center text-xs font-bold text-indigo-600 hover:bg-indigo-50 transition-colors"
            >
              Ver todo en Coder →
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
