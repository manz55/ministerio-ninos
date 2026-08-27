import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Inbox, GraduationCap, FileWarning } from 'lucide-react'
import { CoderIcon } from './CoderIcon'
import { CoderPicker } from './CoderPicker'
import { useCoderState } from '../../hooks/useCoderState'

// The header version of Coder — same buscar-y-toca flow as the full /coder
// page, just small enough to use without leaving whatever page you're on.
// Both read/write the same useCoderState, so acting here shows up on the
// full page instantly and vice versa. "Solicitudes de maestros" always
// renders (even at zero) so it never reads as having disappeared.
export function CoderHeaderLink() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const state = useCoderState()
  const { resolvingId, alerts, missingBirthDate, requests, resolveRequest } = state

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
                <p className="text-sm font-bold text-gray-900 leading-tight">Coder</p>
                <p className="text-xs text-gray-400 leading-tight">Busca y toca lo que quieras cambiar</p>
              </div>
            </div>

            {/* ── Buscar y tocar ── */}
            <div className="px-4 py-3 border-b border-gray-100">
              <CoderPicker state={state} />
            </div>

            {/* ── Solicitudes de maestros — siempre visible, aunque esté vacía ── */}
            <div className="border-b border-gray-100">
              <p className="px-4 pt-3 pb-1 text-[11px] font-bold uppercase tracking-widest text-gray-400">
                Solicitudes de maestros
              </p>
              {requests.length === 0 ? (
                <p className="px-4 pb-3 text-xs text-gray-400">Sin solicitudes pendientes</p>
              ) : (
                <div className="divide-y divide-gray-50">
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
            </div>

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
