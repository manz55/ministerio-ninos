import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useOutletContext } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ClipboardList, BarChart3, Users, NotebookPen, UserCog, Contact, LogOut, KeyRound, UserRound } from 'lucide-react'
import Dock from '../ui/Dock'
import { ChurchLogo } from '../ui/ChurchLogo'
import { ChangePasswordModal } from '../ui/ChangePasswordModal'
import { EditProfileModal } from '../ui/EditProfileModal'
import { LivingBackground } from '../ui/LivingBackground'
import { OfflineStatus } from '../ui/OfflineStatus'
import { getOfflineState } from '../../lib/offline'
import { DemoBar } from '../ui/DemoBar'
import { signOut } from '../../lib/auth'
import type { Profile } from '../../types/domain'

const CONTAINER = 'max-w-4xl lg:max-w-6xl xl:max-w-[88rem] 2xl:max-w-[112rem] mx-auto'

export default function Layout({ isAdmin, profile }: { isAdmin: boolean; profile: Profile }) {
  const navItems = isAdmin
    ? [
        { icon: ClipboardList,  label: 'Registro', to: '/registro' },
        { icon: BarChart3,      label: 'Reportes', to: '/reportes' },
        { icon: Users,          label: 'Familias', to: '/familias' },
        { icon: Contact,        label: 'Maestros', to: '/maestros' },
        { icon: NotebookPen,    label: 'Notas',    to: '/notas' },
        { icon: UserCog,        label: 'Usuarios', to: '/usuarios' },
      ]
    : [
        { icon: ClipboardList,  label: 'Registro', to: '/registro' },
        { icon: NotebookPen,    label: 'Notas',    to: '/notas' },
      ]
  const location = useLocation()
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [showEditProfile, setShowEditProfile] = useState(false)
  // Local override so the header updates the instant the name is saved,
  // without waiting on useAuth() to notice the profiles row changed.
  const [displayName, setDisplayName] = useState(profile.full_name)

  // La altura real del encabezado (cambia cuando aparece el aviso de "sin
  // internet") en una variable CSS, para que lo que va pegado debajo
  // (encabezado de cada categoría, fondos animados) nunca se le encime.
  const headerRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const update = () => document.documentElement.style.setProperty('--app-header-h', `${el.offsetHeight}px`)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div style={{ minHeight: '100dvh' }}>
      <LivingBackground />
      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
      {showEditProfile && (
        <EditProfileModal
          profile={profile}
          onClose={() => setShowEditProfile(false)}
          onSaved={setDisplayName}
        />
      )}

      <header
        ref={headerRef}
        className="sticky top-0 z-[3] bg-white/80 backdrop-blur-xl border-b border-gray-200/70 px-4 py-3"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <div className={`${CONTAINER} flex items-center gap-2.5`}>
          <ChurchLogo size={38} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-display font-semibold text-[17px] text-gray-900 leading-tight truncate">Maestros de Niños</span>
              {/* Version stamp — its own separate pill, not folded into the
                  name line. Lives in the (sticky, always-on-top) header
                  instead of floating over the page: a fixed badge anywhere
                  above the Dock inevitably overlaps whatever scrollable page
                  content happens to land in that same screen band on a
                  longer page (found this the hard way — it sat on top of
                  Reportes' date-range inputs). The header never has that
                  problem since content scrolls underneath it, never over it.
                  __APP_VERSION__/__COMMIT_HASH__ come from vite.config.ts
                  (git commit count / short hash) — always accurate, no
                  manual bumping, traceable to an exact commit. */}
              <span
                title={`commit ${__COMMIT_HASH__}`}
                className="shrink-0 text-[9px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full"
              >
                {__APP_VERSION__}
              </span>
            </div>
            <span className="text-xs text-gray-400 leading-tight truncate block">{displayName}</span>
          </div>
          <button
            onClick={() => setShowEditProfile(true)}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
            title="Mis datos"
          >
            <UserRound size={18} />
          </button>
          <button
            onClick={() => setShowChangePassword(true)}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
            title="Cambiar contraseña"
          >
            <KeyRound size={18} />
          </button>
          <button
            onClick={() => {
              const { pending } = getOfflineState()
              if (pending > 0 && !window.confirm(
                `Hay ${pending} registro(s) sin subir por falta de internet. Se quedan guardados en este dispositivo y se suben cuando alguien vuelva a entrar aquí. ¿Cerrar sesión de todos modos?`
              )) return
              signOut()
            }}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
            title="Cerrar sesión"
          >
            <LogOut size={18} />
          </button>
        </div>
        {/* Dentro del header para que quede pegado arriba junto con él. */}
        <div className="-mx-4 -mb-3 mt-3 empty:hidden">
          <OfflineStatus />
          {import.meta.env.VITE_DEMO === '1' && <DemoBar />}
        </div>
      </header>

      <main
        className={`${CONTAINER} px-4 py-6`}
        style={{ paddingBottom: 'max(8rem, calc(6rem + env(safe-area-inset-bottom)))' }}
      >
        {/* Cada página entra con un fundido suave. Solo opacidad: un
            transform aquí rompería los fondos `fixed` de las páginas. */}
        <motion.div key={location.pathname} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
          <Outlet context={profile} />
        </motion.div>
      </main>

      <Dock items={navItems} />
    </div>
  )
}

// Pages already know `profile` is loaded — Layout only mounts once App.tsx
// has confirmed session+profile — so this skips the loading/null states a
// fresh useAuth() call would otherwise have to handle.
export function useLayoutProfile() {
  return useOutletContext<Profile>()
}
