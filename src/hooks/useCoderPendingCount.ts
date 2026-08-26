import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { hasCategoryChanged } from '../lib/categoryUtils'
import type { Category } from '../types/domain'

type ChildRow = { id: string; birth_date: string | null; category: Category | null }

// Lightweight badge count for the header link — mirrors the three alert
// types CoderPage shows in full (graduations, missing birth_date,
// pending requests) without holding all their detail in memory. Mounted
// independently of whether /coder is the current route, so the badge stays
// live everywhere in the admin app, not just while the page is open.
export function useCoderPendingCount() {
  const [count, setCount] = useState(0)

  const refresh = useCallback(async () => {
    const [{ data: children }, { data: requests }] = await Promise.all([
      supabase.from('children').select('id, birth_date, category'),
      supabase.from('coordinator_requests').select('id').eq('status', 'pendiente'),
    ])
    const rows = (children ?? []) as ChildRow[]
    const graduating = rows.filter(hasCategoryChanged).length
    const missingBirthDate = rows.filter((c) => !c.birth_date).length
    setCount(graduating + missingBirthDate + (requests?.length ?? 0))
  }, [])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    const channel = supabase
      .channel('coder-pending-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'children' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coordinator_requests' }, () => refresh())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [refresh])

  return count
}
