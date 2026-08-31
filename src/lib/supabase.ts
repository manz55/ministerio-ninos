import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan variables de entorno VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  // Supabase's REST responses carry no Cache-Control header, which leaves
  // freshness up to the browser's heuristics. Force every request through
  // the network so a delete/edit is never followed by a stale cached read
  // (e.g. a "deleted" record reappearing after a page reload).
  global: {
    fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
  },
})

// supabase-js's auto token refresh is a setTimeout, which stops firing once
// the tab is backgrounded/locked — exactly what happens to a phone during a
// multi-hour Sunday service. The access token then quietly expires and every
// request starts failing until the maestro logs in again, with no error
// explaining why. This is Supabase's own documented fix: force a refresh
// check whenever the tab becomes visible again, instead of relying only on
// the background timer.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') supabase.auth.startAutoRefresh()
    else supabase.auth.stopAutoRefresh()
  })
}
