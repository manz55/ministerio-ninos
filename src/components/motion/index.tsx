// ─── Animaciones compartidas ──────────────────────────────────────────────────
//
// Dirección "punto medio": la app se mueve con suavidad y rapidez (nada que
// haga esperar a un maestro con fila de niños), y guarda el momento divertido
// para cuando un niño queda registrado (confeti con las formas del logo).
// Todo respeta "reducir movimiento" del sistema vía <MotionConfig
// reducedMotion="user"> en main.tsx: ahí solo quedan los cambios de opacidad.

import { useEffect, useId, useMemo, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useDragControls } from 'framer-motion'
import { SPRING, EASE_OUT } from './presets'
import { X } from 'lucide-react'
import { Shape } from '../ui/LogoShapes'
import { LOGO_COLORS, LOGO_KINDS } from '../ui/logoColors'
import { useMediaQuery } from '../../hooks/useMediaQuery'

/** Número que "rueda" hacia arriba cuando cambia (conteos de registrados). */
export function AnimatedNumber({ value, className = '' }: { value: number; className?: string }) {
  return (
    <span className={`inline-grid overflow-hidden align-bottom ${className}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: '-70%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '70%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 520, damping: 32 }}
          className="[grid-area:1/1] tabular-nums"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

/** Explosión de figuritas del logo (círculo, hexágono, triángulo). */
export function Confetti({ count = 18 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5
        const dist = 80 + Math.random() * 90
        return {
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist * 0.8 + 40,
          size: 9 + Math.round(Math.random() * 9),
          kind: LOGO_KINDS[i % 3],
          color: LOGO_COLORS[i % 3],
          rotate: (Math.random() - 0.5) * 540,
          delay: Math.random() * 0.08,
        }
      }),
    [count]
  )
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
      {pieces.map((p, i) => (
        <motion.svg
          key={i}
          width={p.size}
          height={p.size}
          viewBox={`0 0 ${p.size} ${p.size}`}
          className="absolute"
          initial={{ x: 0, y: 0, scale: 0.2, opacity: 1, rotate: 0 }}
          animate={{ x: p.x, y: p.y, scale: 1, opacity: [1, 1, 0], rotate: p.rotate }}
          transition={{ duration: 1.05, delay: p.delay, ease: [0.15, 0.7, 0.35, 1], opacity: { times: [0, 0.6, 1], duration: 1.05, delay: p.delay } }}
        >
          <Shape kind={p.kind} size={p.size} color={p.color} />
        </motion.svg>
      ))}
    </div>
  )
}

/** Palomita que se dibuja sola (éxito). */
export function DrawnCheck({ size = 64, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      <motion.circle
        cx="32" cy="32" r="29" fill="currentColor" opacity={0.12}
        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }}
        style={{ transformOrigin: '32px 32px' }}
      />
      <motion.path
        d="M19 33.5 L28 42 L45 23"
        fill="none" stroke="currentColor" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.35, delay: 0.1, ease: EASE_OUT }}
      />
    </svg>
  )
}

/** Silueta de una tarjeta mientras carga la lista. */
export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-3.5 shadow-sm">
      <div className="w-11 h-11 rounded-full bg-gray-200/80 animate-pulse" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-2/5 rounded-full bg-gray-200/80 animate-pulse" />
        <div className="h-3 w-3/5 rounded-full bg-gray-100 animate-pulse" />
      </div>
    </div>
  )
}

/**
 * Panel que sube desde abajo en celular (se cierra arrastrando la manija o
 * tocando afuera) y aparece centrado en compu. Escape también cierra.
 */
export function Sheet({
  open,
  onClose,
  children,
  title,
  wide = false,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  /** Nombre accesible del panel (no se muestra). */
  title: string
  wide?: boolean
}) {
  const desktop = useMediaQuery('(min-width: 640px)')
  const drag = useDragControls()
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-6">
          <motion.div
            className="absolute inset-0 bg-gray-950/35 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={`relative w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'} bg-white rounded-t-[28px] sm:rounded-[28px] shadow-2xl shadow-gray-950/20 max-h-[90dvh] overflow-y-auto overscroll-contain`}
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            initial={desktop ? { opacity: 0, scale: 0.96, y: 14 } : { y: '100%' }}
            animate={desktop ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
            exit={desktop ? { opacity: 0, scale: 0.97, y: 10 } : { y: '100%' }}
            transition={SPRING}
            drag={desktop ? false : 'y'}
            dragControls={drag}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => { if (info.offset.y > 110 || info.velocity.y > 600) onClose() }}
          >
            <span id={titleId} className="sr-only">{title}</span>
            {!desktop && (
              <div className="sticky top-0 z-10 flex justify-center pt-2.5 pb-1 bg-white/90 backdrop-blur touch-none cursor-grab" onPointerDown={(e) => drag.start(e)}>
                <span className="h-1.5 w-11 rounded-full bg-gray-300" />
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 z-20 p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}
