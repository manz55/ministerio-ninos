import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'

interface DockItem {
  icon: React.ComponentType<{ className?: string }>
  label: string
  to: string
}

interface DockProps {
  items: DockItem[]
}

export default function Dock({ items }: DockProps) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 flex justify-center z-50 pointer-events-none"
      style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
    >
      <div className="pointer-events-auto flex items-end gap-1 px-4 py-3 rounded-3xl border border-gray-200/80 bg-white/80 backdrop-blur-xl shadow-xl shadow-black/10">
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} className="outline-none">
            {({ isActive }) => (
              <motion.div
                whileTap={{ scale: 0.9 }}
                className="relative flex flex-col items-center gap-1 px-5 py-1 min-w-[60px]"
              >
                <div
                  className={[
                    'relative rounded-2xl p-2.5 transition-colors',
                    isActive ? 'bg-indigo-50' : 'bg-transparent',
                  ].join(' ')}
                >
                  <item.icon
                    className={[
                      'h-6 w-6 transition-colors',
                      isActive ? 'text-indigo-600' : 'text-gray-500',
                    ].join(' ')}
                  />
                </div>

                <span
                  className={[
                    'text-[11px] font-medium leading-none transition-colors',
                    isActive ? 'text-indigo-600' : 'text-gray-400',
                  ].join(' ')}
                >
                  {item.label}
                </span>

                {isActive ? (
                  <motion.div
                    layoutId="dock-dot"
                    className="w-1 h-1 rounded-full bg-indigo-600"
                  />
                ) : (
                  <div className="w-1 h-1" />
                )}
              </motion.div>
            )}
          </NavLink>
        ))}
      </div>
    </div>
  )
}
