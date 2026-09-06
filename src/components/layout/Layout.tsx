import { useState } from 'react'
import { Outlet, useOutletContext } from 'react-router-dom'
import { ClipboardList, BarChart3, Users, NotebookPen, UserCog, Contact, LogOut, KeyRound, MessageSquare } from 'lucide-react'
import Dock from '../ui/Dock'
import { ChurchLogo } from '../ui/ChurchLogo'
import { ChangePasswordModal } from '../ui/ChangePasswordModal'
import { LivingBackground } from '../ui/LivingBackground'
import { useMessagesBadgeCount } from '../../hooks/useMessagesBadgeCount'
import { signOut } from '../../lib/auth'
import type { Profile } from '../../types/domain'

const CONTAINER = 'max-w-4xl lg:max-w-6xl xl:max-w-[88rem] mx-auto'

export default function Layout({ isAdmin, profile }: { isAdmin: boolean; profile: Profile }) {
  const messagesBadge = useMessagesBadgeCount(profile.id, isAdmin)
  const navItems = isAdmin
    ? [
        { icon: ClipboardList,  label: 'Registro', to: '/registro' },
        { icon: MessageSquare,  label: 'Mensajes', to: '/mensajes', badge: messagesBadge },
        { icon: BarChart3,      label: 'Reportes', to: '/reportes' },
        { icon: Users,          label: 'Familias', to: '/familias' },
        { icon: Contact,        label: 'Maestros', to: '/maestros' },
        { icon: NotebookPen,    label: 'Notas',    to: '/notas' },
        { icon: UserCog,        label: 'Usuarios', to: '/usuarios' },
      ]
    : [
        { icon: ClipboardList,  label: 'Registro', to: '/registro' },
        { icon: MessageSquare,  label: 'Mensajes', to: '/mensajes', badge: messagesBadge },
        { icon: NotebookPen,    label: 'Notas',    to: '/notas' },
      ]
  const [showChangePassword, setShowChangePassword] = useState(false)

  return (
    <div style={{ minHeight: '100dvh' }}>
      <LivingBackground />
      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}

      <header
        className="sticky top-0 z-[3] bg-white/80 backdrop-blur-xl border-b border-gray-200/70 px-4 py-3"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <div className={`${CONTAINER} flex items-center gap-2.5`}>
          <ChurchLogo size={38} />
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-gray-900 block leading-tight">Maestros de Niños</span>
            <span className="text-xs text-gray-400 leading-tight truncate block">{profile.full_name}</span>
          </div>
          <button
            onClick={() => setShowChangePassword(true)}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
            title="Cambiar contraseña"
          >
            <KeyRound size={18} />
          </button>
          <button
            onClick={() => signOut()}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
            title="Cerrar sesión"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main
        className={`${CONTAINER} px-4 py-6`}
        style={{ paddingBottom: 'max(8rem, calc(6rem + env(safe-area-inset-bottom)))' }}
      >
        <Outlet context={profile} />
      </main>

      {/* Version stamp — centered directly above the Dock, the same way the
          Dock itself centers relative to the full viewport (not the
          content-column CONTAINER, which on a wide desktop window sits far
          to the right of the Dock's actual — much narrower — centered
          pill). Centering both the same way keeps them paired as one visual
          group at every screen width instead of drifting apart. The Dock
          only grows taller at the `sm:` breakpoint (bigger icons/padding)
          and never beyond it, so one fixed clearance comfortably clears it
          everywhere. __APP_VERSION__/__COMMIT_HASH__ come from vite.config.ts
          (git commit count / short hash) — always accurate, no manual
          bumping, and traceable to an exact commit. */}
      <div
        className="fixed inset-x-0 z-40 flex justify-center pointer-events-none"
        style={{ bottom: 'calc(130px + env(safe-area-inset-bottom))' }}
      >
        <span
          title={`commit ${__COMMIT_HASH__}`}
          className="text-[10px] font-medium text-gray-500 bg-white/90 backdrop-blur-md px-2 py-1 rounded-full border border-gray-200 shadow-sm"
        >
          {__APP_VERSION__}
        </span>
      </div>

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
