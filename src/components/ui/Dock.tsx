import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'

interface DockItem {
  icon: React.ComponentType<{ className?: string }>
  label: string
  to: string
  badge?: number
}

interface DockProps {
  items: DockItem[]
}

/**
 * True when the on-screen keyboard is very likely open: iOS Safari doesn't
 * resize `window.innerHeight` when the keyboard shows, but it does shrink
 * `visualViewport.height` — that gap is what we use to detect it, since a
 * `position: fixed` dock otherwise stays put and ends up sitting on top of
 * whatever input the keyboard was opened for.
 */
function useKeyboardOpen() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    function handleResize() {
      setOpen(window.innerHeight - vv!.height > 150)
    }
    handleResize()
    vv.addEventListener('resize', handleResize)
    return () => vv.removeEventListener('resize', handleResize)
  }, [])

  return open
}

export default function Dock({ items }: DockProps) {
  const keyboardOpen = useKeyboardOpen()

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 flex justify-center z-50 pointer-events-none px-2 transition-transform duration-200 ${
        keyboardOpen ? 'translate-y-full' : 'translate-y-0'
      }`}
      style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
    >
      <div className="pointer-events-auto flex items-end gap-0.5 sm:gap-1 px-1.5 sm:px-4 py-2.5 sm:py-3 rounded-3xl border border-gray-200/80 bg-white/80 backdrop-blur-xl shadow-xl shadow-black/10 max-w-full overflow-x-auto">
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} className="outline-none shrink-0">
            {({ isActive }) => (
              <motion.div
                whileTap={{ scale: 0.9 }}
                className="relative flex flex-col items-center gap-1 px-2 sm:px-5 py-1 min-w-[52px] sm:min-w-[60px]"
              >
                <div
                  className={[
                    'relative rounded-2xl p-2 sm:p-2.5 transition-colors',
                    isActive ? 'bg-indigo-50' : 'bg-transparent',
                  ].join(' ')}
                >
                  <item.icon
                    className={[
                      'h-5 w-5 sm:h-6 sm:w-6 transition-colors',
                      isActive ? 'text-indigo-600' : 'text-gray-500',
                    ].join(' ')}
                  />
                  {!!item.badge && (
                    <span
                      className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white"
                      style={{ animation: 'badge-pulse 2.2s ease-in-out infinite' }}
                    >
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </div>

                <span
                  className={[
                    'text-[10px] sm:text-[11px] font-medium leading-none whitespace-nowrap transition-colors',
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
