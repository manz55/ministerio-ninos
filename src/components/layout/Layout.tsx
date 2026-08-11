import { Outlet } from 'react-router-dom'
import { ClipboardList, BarChart3, Users } from 'lucide-react'
import Dock from '../ui/Dock'
import { ChurchLogo } from '../ui/ChurchLogo'

const navItems = [
  { icon: ClipboardList, label: 'Registro', to: '/registro' },
  { icon: BarChart3,    label: 'Reportes',  to: '/reportes' },
  { icon: Users,        label: 'Familias',  to: '/familias' },
]

export default function Layout() {
  return (
    <div className="bg-gray-50" style={{ minHeight: '100dvh' }}>
      <header
        className="sticky top-0 z-[3] bg-white/90 backdrop-blur-md border-b border-gray-200 px-4 py-3"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <div className="max-w-4xl mx-auto flex items-center gap-2.5">
          <ChurchLogo size={38} />
          <span className="font-semibold text-gray-900">Maestros de Niños</span>
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
