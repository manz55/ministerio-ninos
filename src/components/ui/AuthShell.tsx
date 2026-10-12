import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { ChurchLogo } from './ChurchLogo'
import { LogoShapes } from './LogoShapes'

/** Marco de las pantallas antes de entrar (login, recuperar contraseña). */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="relative min-h-dvh flex items-center justify-center px-4 py-10 bg-canvas overflow-hidden">
      <div className="absolute inset-0 pointer-events-none"><LogoShapes opacity={0.16} /></div>
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-sm rounded-[32px] bg-white/90 backdrop-blur-xl border border-gray-200/70 shadow-xl shadow-gray-900/5 px-6 py-8 sm:px-8"
      >
        <div className="text-center space-y-2 mb-7">
          <motion.div
            className="w-20 h-20 rounded-3xl bg-white border border-gray-200/70 shadow-md shadow-gray-900/5 flex items-center justify-center mx-auto"
            initial={{ rotate: -10, scale: 0.7 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 13, delay: 0.1 }}
          >
            <ChurchLogo size={48} />
          </motion.div>
          <h1 className="text-[28px] font-semibold text-gray-900 pt-2">{title}</h1>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>
        {children}
      </motion.div>
    </div>
  )
}
