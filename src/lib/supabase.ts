import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan variables de entorno VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY')
}

// Same value supabase-js would derive on its own — spelled out so auth.ts
// can read the stored session directly when there's no internet (see
// readStoredSession there). Changing it would log everyone out.
export const AUTH_STORAGE_KEY = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`

// Con el internet de la iglesia a medias, una petición puede quedarse
// colgada minutos sin fallar — el botón se quedaba en "Guardando…" para
// siempre. Pasado este tiempo se aborta y la cola sin conexión
// (lib/offline.ts) se encarga de guardarlo para después.
const REQUEST_TIMEOUT_MS = 20_000

function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new DOMException('Tiempo de espera agotado', 'TimeoutError')), REQUEST_TIMEOUT_MS)
  const outer = init?.signal
  if (outer) {
    if (outer.aborted) controller.abort(outer.reason)
    else outer.addEventListener('abort', () => controller.abort(outer.reason), { once: true })
  }
  // Supabase's REST responses carry no Cache-Control header, which leaves
  // freshness up to the browser's heuristics. Force every request through
  // the network so a delete/edit is never followed by a stale cached read
  // (e.g. a "deleted" record reappearing after a page reload).
  return fetch(input, { ...init, cache: 'no-store', signal: controller.signal })
    .finally(() => clearTimeout(timer))
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: { storageKey: AUTH_STORAGE_KEY },
  global: { fetch: fetchWithTimeout },
})

/** true when a supabase-js error means "couldn't reach the server" (no
 * internet, timeout) rather than the server rejecting the request — postgrest
 * reports those with an empty `code` and the fetch exception's text. */
export function isNetworkError(err: { code?: string; message?: string; name?: string } | null | undefined): boolean {
  if (!err) return false
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  if (err.code) return false
  return /fetch|network|load failed|abort|timeout|tiempo de espera/i.test(`${err.name ?? ''} ${err.message ?? ''}`)
}

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
