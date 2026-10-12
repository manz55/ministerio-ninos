// Se evalúa antes que la app (ver demo/main.tsx): desvía las llamadas a
// Supabase hacia el backend falso y deja una sesión de prueba lista.
import { demoFetch, demoSessionForStorage, DEMO_USER_ID } from './backend'
import { createSeed } from './seed'

const DEMO_HOST = new URL(import.meta.env.VITE_SUPABASE_URL as string).origin
const realFetch = window.fetch.bind(window)
window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  return url.startsWith(DEMO_HOST) ? demoFetch(input, init) : realFetch(input, init)
}

// Realtime: un WebSocket que nunca conecta ni truena (no hay servidor).
const RealWS = window.WebSocket
class SilentSocket extends EventTarget {
  readyState = 0
  url: string
  constructor(url: string) { super(); this.url = url }
  send() {}
  close() { this.readyState = 3 }
  onopen = null; onclose = null; onmessage = null; onerror = null
}
window.WebSocket = function (url: string | URL, protocols?: string | string[]) {
  const u = String(url)
  if (u.includes(new URL(DEMO_HOST).host)) return new SilentSocket(u) as unknown as WebSocket
  return new RealWS(url, protocols)
} as unknown as typeof WebSocket

function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

try {
  const key = `sb-${new URL(DEMO_HOST).hostname.split('.')[0]}-auth-token`
  if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(demoSessionForStorage()))
  const profile = createSeed().profiles.find((p) => p.id === DEMO_USER_ID)
  localStorage.setItem('offline_cache:profile', JSON.stringify(profile))
  if (!localStorage.getItem('ministerio_team_session')) {
    localStorage.setItem('ministerio_team_session', JSON.stringify({ color: 'rojo', date: today() }))
  }
} catch { /* sin localStorage: la pantalla de login acepta cualquier correo */ }
