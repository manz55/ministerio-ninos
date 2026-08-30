import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Feeds the small badge on the "Mensajes" Dock item — pending requests count
// for admins, unseen-resolved count for maestros — without needing the full
// MessagesPage mounted (it lives in Layout, which is always mounted).
export function useMessagesBadgeCount(profileId: string | undefined, isAdmin: boolean) {
  const [count, setCount] = useState(0)

  const fetchCount = useCallback(async () => {
    if (isAdmin) {
      const { count: c } = await supabase
        .from('coordinator_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pendiente')
      setCount(c ?? 0)
    } else if (profileId) {
      const { count: c } = await supabase
        .from('coordinator_requests')
        .select('id', { count: 'exact', head: true })
        .eq('author_id', profileId)
        .eq('status', 'resuelta')
        .eq('seen_by_author', false)
      setCount(c ?? 0)
    }
  }, [isAdmin, profileId])

  useEffect(() => { fetchCount() }, [fetchCount])

  useEffect(() => {
    const channel = supabase
      .channel(`messages-badge-${isAdmin ? 'admin' : profileId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coordinator_requests' }, () => fetchCount())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchCount, isAdmin, profileId])

  return count
}
