import { supabase } from './supabase'

// The "mark as resuelta" update runs right after the real work (a family or
// child actually saved) — it's just bookkeeping so the inbox and the
// maestro's own status view reflect reality. But because nothing calling
// this ever checked for an error, a transient failure here used to leave a
// request stuck showing "Pendiente" forever with nobody aware it happened,
// even though the underlying family/child was saved correctly. One retry
// covers the common transient case (a network blip) automatically; the
// caller still gets a clear ok/false so a real, repeated failure can be
// surfaced instead of silently disappearing.
export async function markRequestResolved(requestId: string, resolvedBy: string | null): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { error } = await supabase
      .from('coordinator_requests')
      .update({ status: 'resuelta', resolved_by: resolvedBy, resolved_at: new Date().toISOString() })
      .eq('id', requestId)
    if (!error) return true
  }
  return false
}
