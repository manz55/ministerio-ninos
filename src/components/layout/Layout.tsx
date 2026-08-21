import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { ClipboardList, BarChart3, Users, NotebookPen, UserCog, LogOut, KeyRound } from 'lucide-react'
import Dock from '../ui/Dock'
import { ChurchLogo } from '../ui/ChurchLogo'
import { ChangePasswordModal } from '../ui/ChangePasswordModal'
import { signOut } from '../../lib/auth'
import type { Profile } from '../../types/domain'

const maestroNavItems = [
  { icon: ClipboardList, label: 'Registro', to: '/registro' },
  { icon: NotebookPen,   label: 'Notas',    to: '/notas' },
]

const adminNavItems = [
  { icon: ClipboardList, label: 'Registro', to: '/registro' },
  { icon: BarChart3,     label: 'Reportes', to: '/reportes' },
  { icon: Users,         label: 'Familias', to: '/familias' },
  { icon: NotebookPen,   label: 'Notas',    to: '/notas' },
  { icon: UserCog,       label: 'Usuarios', to: '/usuarios' },
]

export default function Layout({ isAdmin, profile }: { isAdmin: boolean; profile: Profile }) {
  const navItems = isAdmin ? adminNavItems : maestroNavItems
  const [showChangePassword, setShowChangePassword] = useState(false)

  return (
    <div className="bg-gray-50" style={{ minHeight: '100dvh' }}>
      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}

      <header
        className="sticky top-0 z-[3] bg-white/90 backdrop-blur-md border-b border-gray-200 px-4 py-3"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <div className="max-w-4xl mx-auto flex items-center gap-2.5">
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
        className="max-w-4xl mx-auto px-4 py-6"
        style={{ paddingBottom: 'max(8rem, calc(6rem + env(safe-area-inset-bottom)))' }}
      >
        <Outlet />
      </main>

      <Dock items={navItems} />
    </div>
  )
}
