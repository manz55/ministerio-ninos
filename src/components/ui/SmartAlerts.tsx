import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { AnimatePresence, motion } from 'framer-motion'
import { Sparkles, GraduationCap, Check, FileWarning, ArrowRight, Wand2, AlertCircle, CornerDownLeft, Inbox } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { getCategoryFromBirthDate, hasCategoryChanged } from '../../lib/categoryUtils'
import { createChildSearcher, searchChildrenSplit } from '../../lib/fuzzySearch'
import { parseCommand, resolveCategoryLabel } from '../../lib/coderCommands'
import { CATEGORY_LABELS, type Category, type CoordinatorRequest } from '../../types/domain'

type ChildRow = { id: string; full_name: string; birth_date: string | null; category: Category | null }
type ActionStatus = 'thinking' | 'done'
type ActionState = { status: ActionStatus; name: string; to: Category }

type PendingCommand =
  | { type: 'rename'; newName: string; candidates: ChildRow[] }
  | { type: 'category'; target: Category; targetLabel: string; candidates: ChildRow[] }

// "Coder" — the app's one intelligent notification surface. Currently
// watches for kids who've aged into a new category since it was last synced
// (the same check ChildCard does per-row) and can act on it directly —
// "Graduar" calls the same sync_child_category RPC the check-in flow already
// uses, so it's the exact same trusted write path, just triggered from here.
// It also flags roster rows missing a birth_date (no age shows up for them
// anywhere in the app) since that's the most common reason a kid never
// shows up in the graduation alerts at all — nobody can compute an age with
// no birth_date to compute it from.
export function SmartAlerts() {
  const { session } = useAuth()
  const [children, setChildren] = useState<ChildRow[]>([])
  const [requests, setRequests] = useState<CoordinatorRequest[]>([])
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [actions, setActions] = useState<Record<string, ActionState>>({})
  const [commandText, setCommandText] = useState('')
  const [commandError, setCommandError] = useState<string | null>(null)
  const [pendingCommand, setPendingCommand] = useState<PendingCommand | null>(null)
  const [commandResult, setCommandResult] = useState<{ status: 'thinking' | 'done'; message: string } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const fetchChildren = useCallback(async () => {
    const { data } = await supabase.from('children').select('id, full_name, birth_date, category')
    setChildren((data ?? []) as ChildRow[])
  }, [])

  const fetchRequests = useCallback(async () => {
    const { data } = await supabase
      .from('coordinator_requests')
      .select('*, profiles!coordinator_requests_author_id_fkey(full_name)')
      .eq('status', 'pendiente')
      .order('created_at', { ascending: false })
    setRequests((data ?? []) as CoordinatorRequest[])
  }, [])

  useEffect(() => { fetchChildren() }, [fetchChildren])
  useEffect(() => { fetchRequests() }, [fetchRequests])

  useEffect(() => {
    const channel = supabase
      .channel('smart-alerts-children-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'children' }, () => fetchChildren())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchChildren])

  useEffect(() => {
    const channel = supabase
      .channel('smart-alerts-requests-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coordinator_requests' }, () => fetchRequests())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchRequests])

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

  // Alerts still open in the data, minus anything we're already acting on —
  // once an action starts, that row is driven from `actions` instead so it
  // keeps showing "thinking…"/"hecho" even after the DB write makes it drop
  // out of this computed list.
  const alerts = useMemo(
    () =>
      children
        .filter(hasCategoryChanged)
        .filter((c) => !(c.id in actions))
        .map((c) => ({ id: c.id, name: c.full_name, to: getCategoryFromBirthDate(c.birth_date) as Category }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [children, actions]
  )

  const missingBirthDate = useMemo(
    () => children.filter((c) => !c.birth_date).length,
    [children]
  )

  const pendingCount =
    alerts.length +
    Object.values(actions).filter((a) => a.status === 'thinking').length +
    missingBirthDate +
    requests.length

  async function resolveRequest(id: string) {
    setResolvingId(id)
    await supabase
      .from('coordinator_requests')
      .update({ status: 'resuelta', resolved_by: session?.user.id ?? null, resolved_at: new Date().toISOString() })
      .eq('id', id)
    setResolvingId(null)
    setRequests((prev) => prev.filter((r) => r.id !== id))
  }

  async function graduate(a: { id: string; name: string; to: Category }) {
    setActions((prev) => ({ ...prev, [a.id]: { status: 'thinking', name: a.name, to: a.to } }))
    const { error } = await supabase.rpc('sync_child_category', { p_child_id: a.id, p_category: a.to })
    if (error) {
      setActions((prev) => { const next = { ...prev }; delete next[a.id]; return next })
      return
    }
    // Small deliberate pause so the "pensando…" step reads as real work even
    // when the RPC itself resolves near-instantly.
    await new Promise((r) => setTimeout(r, 550))
    setActions((prev) => ({ ...prev, [a.id]: { status: 'done', name: a.name, to: a.to } }))
    setTimeout(() => {
      setActions((prev) => { const next = { ...prev }; delete next[a.id]; return next })
    }, 2200)
  }

  // Rule-based command bar (no LLM) — recognizes two fixed sentence shapes
  // and resolves the name against the same fuzzy searcher the check-in
  // screen uses, then always asks which kid before touching real data.
  function submitCommand() {
    setCommandError(null)
    setPendingCommand(null)
    const parsed = parseCommand(commandText)
    if (!parsed) {
      setCommandError('No entendí ese comando. Prueba: "cambiar categoría de <nombre> a <categoría>" o "cambiar nombre de <nombre> a <nombre nuevo>".')
      return
    }
    const searcher = createChildSearcher(children)
    const { exact, suggestions } = searchChildrenSplit(searcher, parsed.nameQuery)
    const candidates = [...exact, ...suggestions].slice(0, 6)
    if (candidates.length === 0) {
      setCommandError(`No encontré a ningún niño parecido a "${parsed.nameQuery}".`)
      return
    }
    if (parsed.type === 'rename') {
      if (!parsed.newName) { setCommandError('Falta el nombre nuevo.'); return }
      setPendingCommand({ type: 'rename', newName: parsed.newName, candidates })
    } else {
      const target = resolveCategoryLabel(parsed.targetLabel)
      if (target === null) { setCommandError(`No reconozco la categoría "${parsed.targetLabel}".`); return }
      if (target === 'ambiguous') { setCommandError('¿Cuál Corderitos? Especifica "0-2 años" o "2-4 años".'); return }
      setPendingCommand({ type: 'category', target, targetLabel: CATEGORY_LABELS[target], candidates })
    }
  }

  async function executeCommand(child: ChildRow) {
    if (!pendingCommand) return
    const cmd = pendingCommand
    setPendingCommand(null)
    setCommandResult({ status: 'thinking', message: '' })
    const { error } =
      cmd.type === 'rename'
        ? await supabase.from('children').update({ full_name: cmd.newName }).eq('id', child.id)
        : await supabase.rpc('sync_child_category', { p_child_id: child.id, p_category: cmd.target })
    if (error) {
      setCommandResult(null)
      setCommandError('No se pudo guardar. Intenta de nuevo.')
      return
    }
    await new Promise((r) => setTimeout(r, 500))
    setCommandResult({
      status: 'done',
      message:
        cmd.type === 'rename'
          ? `Listo — ahora se llama "${cmd.newName}".`
          : `Listo — ${child.full_name} ahora está en ${cmd.targetLabel}.`,
    })
    setCommandText('')
    setTimeout(() => setCommandResult(null), 3000)
  }

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative block group"
        title="Coder · avisos inteligentes"
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
          <Sparkles size={19} className={pendingCount > 0 ? 'text-white' : 'text-indigo-400'} />
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
            className="absolute right-0 top-full mt-2 w-[340px] max-h-[70vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white/95 backdrop-blur-xl shadow-xl shadow-black/10 z-50"
          >
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shrink-0">
                <Sparkles size={13} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 leading-tight">Coder</p>
                <p className="text-xs text-gray-400 leading-tight">Avisos detectados automáticamente</p>
              </div>
            </div>

            {/* ── Command bar: rule-based, no LLM — see coderCommands.ts ── */}
            <div className="px-4 py-3 border-b border-gray-100 space-y-2">
              <div className="relative">
                <Wand2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                <input
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
                  <button
                    onClick={() => setPendingCommand(null)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>

            {alerts.length === 0 && Object.keys(actions).length === 0 && missingBirthDate === 0 && requests.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-gray-400">Todo al día ✨</p>
                <p className="text-xs text-gray-300 mt-1">No hay avisos pendientes</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {requests.map((r) => (
                  <div key={r.id} className="px-4 py-3 flex items-start gap-2.5 bg-indigo-50/40">
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
                  <div className="px-4 py-3 flex items-start gap-2.5 bg-amber-50/60">
                    <FileWarning size={16} className="text-amber-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 leading-snug">
                        <span className="font-semibold text-gray-900">{missingBirthDate}</span>{' '}
                        {missingBirthDate === 1 ? 'niño no tiene' : 'niños no tienen'} fecha de nacimiento —
                        no se les puede calcular la edad ni avisar cuándo deben graduar.
                      </p>
                      <Link
                        to="/familias?roster=sin_fecha_nacimiento"
                        onClick={() => setOpen(false)}
                        className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors"
                      >
                        Actualizar en Familias
                        <ArrowRight size={13} />
                      </Link>
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
                      className="px-4 py-3 flex items-center gap-2.5"
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
                  <div key={a.id} className="px-4 py-3 flex items-start gap-2.5">
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
