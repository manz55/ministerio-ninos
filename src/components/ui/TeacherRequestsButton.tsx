import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { formatDistanceToNow, parse, format, isValid } from 'date-fns'
import { es } from 'date-fns/locale'
import { Inbox, Check, UserPlus, Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import type { CoordinatorRequest } from '../../types/domain'

// Pulls the "Nombre del niño: …" style lines CoordinatorRequestBox folds
// into the message back out into fields, so "Agregar familia nueva" can
// hand them to NewFamilyStep instead of the coordinator retyping what
// they just read.
function parseChildFields(message: string) {
  const line = (label: string) => message.match(new RegExp(`^${label}:\\s*(.+)$`, 'm'))?.[1]?.trim()
  const childName = line('Nombre del niño')
  const parentName = line('Padre/madre')
  const phone = line('Teléfono')
  const birthDateText = line('Fecha de nacimiento')
  let birthDate: string | undefined
  if (birthDateText) {
    const parsed = parse(birthDateText, 'd MMM yyyy', new Date(), { locale: es })
    if (isValid(parsed)) birthDate = format(parsed, 'yyyy-MM-dd')
  }
  return { childName, parentName, phone, birthDate }
}

// Admin-facing inbox for maestro requests (mostly "agregar a este niño
// nuevo"). Used to live inside Coder's header popover — pulled out on its
// own now that Coder is hidden from nav, so coordinators don't lose sight
// of pending requests while that feature is paused.
export function TeacherRequestsButton() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [requests, setRequests] = useState<CoordinatorRequest[]>([])
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const fetchRequests = useCallback(async () => {
    const { data } = await supabase
      .from('coordinator_requests')
      .select('*, profiles!coordinator_requests_author_id_fkey(full_name)')
      .eq('status', 'pendiente')
      .order('created_at', { ascending: false })
    setRequests((data ?? []) as CoordinatorRequest[])
  }, [])

  useEffect(() => { fetchRequests() }, [fetchRequests])

  useEffect(() => {
    const channel = supabase
      .channel('teacher-requests-admin-inbox')
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

  function goTo(path: string) {
    setOpen(false)
    navigate(path)
  }

  function goToNewFamily(r: CoordinatorRequest) {
    setOpen(false)
    navigate('/registro?nueva=1', { state: parseChildFields(r.message) })
  }

  async function resolveRequest(id: string) {
    setResolvingId(id)
    await supabase
      .from('coordinator_requests')
      .update({ status: 'resuelta', resolved_by: session?.user.id ?? null, resolved_at: new Date().toISOString() })
      .eq('id', id)
    setResolvingId(null)
    setRequests((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        title="Solicitudes de maestros"
      >
        <Inbox size={18} />
        {requests.length > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white"
            style={{ animation: 'badge-pulse 2.2s ease-in-out infinite' }}
          >
            {requests.length > 9 ? '9+' : requests.length}
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
            className="absolute right-0 top-full mt-2 w-[min(320px,calc(100vw-2rem))] max-h-[70vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white/95 backdrop-blur-xl shadow-xl shadow-black/10 z-50"
          >
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-bold text-gray-900 leading-tight">Solicitudes de maestros</p>
              <p className="text-xs text-gray-400 leading-tight">Niños nuevos y otros cambios pedidos</p>
            </div>

            {requests.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-400 text-center">Sin solicitudes pendientes</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {requests.map((r) => (
                  <div key={r.id} className="px-4 py-3 flex items-start gap-2.5">
                    <Inbox size={15} className="text-indigo-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 leading-snug whitespace-pre-line">{r.message}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {r.profiles?.full_name ?? 'Un maestro'} ·{' '}
                        {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: es })}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <button
                          onClick={() => goToNewFamily(r)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                        >
                          <UserPlus size={13} />
                          Agregar familia nueva
                        </button>
                        <button
                          onClick={() => goTo('/familias')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                          <Search size={13} />
                          Buscar en Familias
                        </button>
                        <button
                          onClick={() => resolveRequest(r.id)}
                          disabled={resolvingId === r.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors disabled:opacity-40"
                        >
                          <Check size={13} />
                          {resolvingId === r.id ? 'Marcando…' : 'Marcar como resuelta'}
                        </button>
                      </div>
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
