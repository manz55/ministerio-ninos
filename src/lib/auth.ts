import { useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, AUTH_STORAGE_KEY, isNetworkError } from './supabase'
import { readCache, writeCache } from './offline'
import type { Profile } from '../types/domain'

export async function signIn(email: string, password: string) {
  const result = await supabase.auth.signInWithPassword({ email, password })
  // Equipo de hoy vive en localStorage por dispositivo, no por usuario — sin
  // esto, si un maestro entra después de otro en la misma tablet el mismo
  // día, hereda el equipo que el anterior ya había elegido en vez de que se
  // le pregunte. Cada login real empieza de cero; recargar la página a media
  // sesión no pasa por aquí, así que no la interrumpe.
  if (!result.error) {
    localStorage.removeItem('ministerio_team_session')
  }
  return result
}

export async function signOut() {
  // Sin internet, el signOut normal falla y no borra nada local — el botón
  // de "Cerrar sesión" parecía no hacer nada. 'local' siempre funciona.
  const result = await supabase.auth.signOut()
  // Copias locales de lista de niños/perfil: solo para quien inició sesión.
  // (La cola de pendientes no se toca — se sube con el próximo login.)
  try {
    Object.keys(localStorage).filter((k) => k.startsWith('offline_cache:')).forEach((k) => localStorage.removeItem(k))
  } catch { /* sin localStorage */ }
  if (result.error) return supabase.auth.signOut({ scope: 'local' })
  return result
}

export async function updateOwnPassword(newPassword: string) {
  return supabase.auth.updateUser({ password: newPassword })
}

/** Envía el correo de "olvidé mi contraseña" — el enlace regresa al sitio
 * con una sesión temporal de recuperación, detectada en useAuth() abajo. */
export async function requestPasswordReset(email: string) {
  return supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
}

/** Sin internet y con el token de acceso ya vencido (pasa después de ~1 h
 * con la app cerrada), supabase-js no puede renovarlo y getSession() devuelve
 * null — aunque la sesión sigue guardada intacta. Eso sacaba a todos a la
 * pantalla de login justo cuando no hay internet para volver a entrar. Aquí
 * se usa esa sesión guardada solo para dejar ver la app; las peticiones
 * reales esperan en la cola (lib/offline.ts) hasta que el token se renueve. */
function readStoredSession(): Session | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return parsed?.user?.id && parsed?.refresh_token ? (parsed as Session) : null
  } catch { return null }
}

/** Session + profile (role) for the currently logged-in user, kept in sync with auth state changes. */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  // true entre el momento en que alguien abre el enlace de "olvidé mi
  // contraseña" (Supabase dispara PASSWORD_RECOVERY con una sesión temporal
  // válida) y el momento en que de verdad elige una contraseña nueva — App.tsx
  // usa esto para mostrar la pantalla de "elige tu nueva contraseña" en vez
  // de dejarlo entrar a la app con la sesión de recuperación.
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)

  // Tracks whose profile is currently loaded so a silent token refresh
  // (fires roughly every 50 min while the app stays open, same user) doesn't
  // re-query `profiles` for no reason — only an actual change of user
  // (sign-in/out, switching accounts) should trigger a reload.
  const loadedForUserId = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadProfile(userId: string) {
      loadedForUserId.current = userId
      // Primero el último perfil visto en este dispositivo (si es del mismo
      // usuario) para que la app abra al instante aunque el internet esté
      // lento o caído; luego se reemplaza con el del servidor si responde.
      const cached = readCache<Profile>('profile')
      if (cached?.id === userId) {
        setProfile(cached)
        setLoading(false)
      }
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
      if (cancelled || loadedForUserId.current !== userId) return
      if (data) {
        writeCache('profile', data)
        setProfile(data as Profile)
      } else if (!(isNetworkError(error) && cached?.id === userId)) {
        setProfile(null)
      }
      setLoading(false)
    }

    // Con el token vencido y sin internet, supabase-js reintenta renovarlo
    // hasta ~30 s antes de que getSession() responda — todo ese rato la app
    // se quedaba en la ruedita. Pasados 4 s se entra con la sesión guardada.
    let settled = false
    const offlineTimer = setTimeout(() => {
      if (settled || cancelled) return
      const stored = readStoredSession()
      if (!stored) return
      settled = true
      setSession(stored)
      loadProfile(stored.user.id)
    }, 4000)

    supabase.auth.getSession().then(({ data, error }) => {
      clearTimeout(offlineTimer)
      if (cancelled) return
      const session = data.session ?? (isNetworkError(error) ? readStoredSession() : null)
      if (settled && !data.session) return // ya se entró con la guardada
      settled = true
      setSession(session)
      if (session) { if (session.user.id !== loadedForUserId.current) loadProfile(session.user.id) }
      else setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true)
      if (event === 'SIGNED_OUT') setIsPasswordRecovery(false)
      // INITIAL_SESSION llega con null cuando no se pudo renovar el token por
      // falta de internet — solo un SIGNED_OUT de verdad debe sacar al usuario.
      if (!newSession && event !== 'SIGNED_OUT') {
        const stored = readStoredSession()
        if (stored) newSession = stored
      }
      setSession(newSession)
      if (newSession) {
        if (newSession.user.id !== loadedForUserId.current) loadProfile(newSession.user.id)
      } else {
        loadedForUserId.current = null
        setProfile(null)
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
      clearTimeout(offlineTimer)
      sub.subscription.unsubscribe()
    }
  }, [])

  return {
    session,
    profile,
    loading,
    isAdmin: !!profile && profile.role === 'admin' && profile.active,
    isOwner: !!profile && profile.is_owner && profile.active,
    isPasswordRecovery,
  }
}
