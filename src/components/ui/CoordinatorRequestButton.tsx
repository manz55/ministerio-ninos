import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { MessageSquarePlus, Check, Clock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { CoordinatorRequest } from '../../types/domain'
import { CoordinatorRequestBox } from './CoordinatorRequestBox'
import { useAnchoredDropdown } from '../../hooks/useAnchoredDropdown'

// Header entry point for maestros — CoordinatorRequestBox also appears
// inline under an empty search result (pre-filled with the searched name),
// but that's only reachable if you happen to search for a name first. This
// is the always-visible way to reach it, mirroring where Coder sits for
// admins. It also doubles as the maestro's inbox: once a coordinator
// resolves a request, it shows up here with a badge until the maestro has
// actually opened the panel and seen it (seen_by_author flips true then).
export function CoordinatorRequestButton({ authorId }: { authorId: string }) {
  const [open, setOpen] = useState(false)
  const [requests, setRequests] = useState<CoordinatorRequest[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const pos = useAnchoredDropdown(open, containerRef, 320)

  const fetchRequests = useCallback(async () => {
    const { data } = await supabase
      .from('coordinator_requests')
      .select('*, resolver:profiles!coordinator_requests_resolved_by_fkey(full_name)')
      .eq('author_id', authorId)
      .order('created_at', { ascending: false })
      .limit(20)
    setRequests((data ?? []) as CoordinatorRequest[])
  }, [authorId])

  useEffect(() => { fetchRequests() }, [fetchRequests])

  useEffect(() => {
    const channel = supabase
      .channel(`coordinator-requests-own-${authorId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'coordinator_requests', filter: `author_id=eq.${authorId}` },
        () => fetchRequests()
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [authorId, fetchRequests])

  const unseenResolvedCount = requests.filter((r) => r.status === 'resuelta' && !r.seen_by_author).length

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

  // Mark unseen-resolved requests as seen once the maestro actually opens
  // the panel and can see them — not on fetch, so the badge survives until
  // it's genuinely been looked at.
  useEffect(() => {
    if (!open || unseenResolvedCount === 0) return
    const ids = requests.filter((r) => r.status === 'resuelta' && !r.seen_by_author).map((r) => r.id)
    supabase.from('coordinator_requests').update({ seen_by_author: true }).in('id', ids).then(() => fetchRequests())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        title="Notas a tu coordinador"
      >
        <MessageSquarePlus size={18} />
        {unseenResolvedCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-emerald-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white"
            style={{ animation: 'badge-pulse 2.2s ease-in-out infinite' }}
          >
            {unseenResolvedCount > 9 ? '9+' : unseenResolvedCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && pos && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            style={{ position: 'fixed', top: pos.top, right: pos.right, width: pos.width }}
            className="max-h-[70vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white/95 backdrop-blur-xl shadow-xl shadow-black/10 z-50"
          >
            <div className="p-4 border-b border-gray-100">
              <CoordinatorRequestBox authorId={authorId} onSent={fetchRequests} />
            </div>

            {requests.length > 0 && (
              <div className="divide-y divide-gray-50">
                {requests.map((r) => (
                  <div key={r.id} className="px-4 py-3 flex items-start gap-2.5">
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
