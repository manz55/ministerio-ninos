import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow, parse, format, isValid } from 'date-fns'
import { es } from 'date-fns/locale'
import { Inbox, Check, Clock, UserPlus, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { CoordinatorRequest } from '../types/domain'
import { CoordinatorRequestBox } from '../components/ui/CoordinatorRequestBox'

// A full page instead of a header popover — the popover version anchored to
// its own icon, which wasn't flush with the header's right edge (more icons
// followed it), so on narrow phones the fixed-width panel bled off the left
// side of the screen and cut off text. A page has no such anchoring problem,
// and it's also just easier to find than a small header icon.

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
  const alerts = line('Alertas/comentarios')
  return { childName, parentName, phone, birthDate, alerts }
}

function AdminInbox() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [requests, setRequests] = useState<CoordinatorRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  const fetchRequests = useCallback(async () => {
    const { data } = await supabase
      .from('coordinator_requests')
      .select('*, profiles!coordinator_requests_author_id_fkey(full_name)')
      .eq('status', 'pendiente')
      .order('created_at', { ascending: false })
    setRequests((data ?? []) as CoordinatorRequest[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchRequests() }, [fetchRequests])

  useEffect(() => {
    const channel = supabase
      .channel('teacher-requests-admin-inbox-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coordinator_requests' }, () => fetchRequests())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchRequests])

  function goToNewFamily(r: CoordinatorRequest) {
    navigate('/registro?nueva=1', { state: parseChildFields(r.message) })
  }

  // Pre-fills the search box with the child's name (when the request has
  // one — most do, since they usually come from the empty-search box) so
  // Familias' "ya tenemos familia(s) con este apellido" suggestion runs
  // immediately instead of the coordinator retyping the name from memory.
  function goSearchFamilies(r: CoordinatorRequest) {
    const { childName } = parseChildFields(r.message)
    navigate(childName ? `/familias?buscar=${encodeURIComponent(childName)}` : '/familias')
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

  if (loading) return <p className="text-center text-gray-400 py-8">Cargando…</p>

  if (requests.length === 0) {
    return <p className="text-center text-gray-400 py-10 bg-white rounded-2xl border border-gray-200">Sin solicitudes pendientes</p>
  }

  return (
    <div className="space-y-2">
      {requests.map((r) => (
        <div key={r.id} className="bg-white rounded-2xl border border-gray-200 px-4 py-3 flex items-start gap-2.5">
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
                onClick={() => goSearchFamilies(r)}
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
  )
}

function MaestroInbox({ authorId }: { authorId: string }) {
  const [requests, setRequests] = useState<CoordinatorRequest[]>([])
  const [loading, setLoading] = useState(true)
  const marked = useRef(false)

  const fetchRequests = useCallback(async () => {
    const { data } = await supabase
      .from('coordinator_requests')
      .select('*, resolver:profiles!coordinator_requests_resolved_by_fkey(full_name)')
      .eq('author_id', authorId)
      .order('created_at', { ascending: false })
      .limit(20)
    setRequests((data ?? []) as CoordinatorRequest[])
    setLoading(false)
  }, [authorId])

  useEffect(() => { fetchRequests() }, [fetchRequests])

  useEffect(() => {
    const channel = supabase
      .channel(`coordinator-requests-own-page-${authorId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coordinator_requests', filter: `author_id=eq.${authorId}` }, () => fetchRequests())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [authorId, fetchRequests])

  // Marks unseen-resolved requests as seen once the maestro actually visits
  // this page — not on fetch — so the Dock badge survives until it's
  // genuinely been looked at.
  useEffect(() => {
    if (marked.current || loading) return
    const ids = requests.filter((r) => r.status === 'resuelta' && !r.seen_by_author).map((r) => r.id)
    if (ids.length === 0) return
    marked.current = true
    supabase.from('coordinator_requests').update({ seen_by_author: true }).in('id', ids).then(() => fetchRequests())
  }, [requests, loading, fetchRequests])

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <CoordinatorRequestBox authorId={authorId} onSent={fetchRequests} />
      </div>

      {loading ? (
        <p className="text-center text-gray-400 py-8">Cargando…</p>
      ) : requests.length === 0 ? (
        <p className="text-center text-gray-400 py-8">Aún no has enviado ninguna solicitud.</p>
      ) : (
        <div className="space-y-2">
          {requests.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl border border-gray-200 px-4 py-3 flex items-start gap-2.5">
              {r.status === 'resuelta' ? (
                <Check size={15} className="text-emerald-500 shrink-0 mt-0.5" />
              ) : (
                <Clock size={15} className="text-amber-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 leading-snug whitespace-pre-line">{r.message}</p>
                <p className="text-xs mt-1">
                  {r.status === 'resuelta' ? (
                    <span className="text-emerald-600 font-medium">
                      Resuelta{r.resolver?.full_name ? ` por ${r.resolver.full_name}` : ''}
                    </span>
                  ) : (
                    <span className="text-amber-500 font-medium">Pendiente</span>
                  )}
                  <span className="text-gray-300">
                    {' · '}
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: es })}
                  </span>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function MessagesPage() {
  const { isAdmin, profile } = useAuth()

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-black text-gray-900 leading-tight">Mensajes</h1>
        <p className="text-sm text-gray-400 leading-tight">
          {isAdmin ? 'Niños nuevos y otros cambios pedidos por maestros' : 'Notas y solicitudes a tu coordinador'}
        </p>
      </div>

      {isAdmin ? <AdminInbox /> : profile ? <MaestroInbox authorId={profile.id} /> : null}
    </div>
  )
}
