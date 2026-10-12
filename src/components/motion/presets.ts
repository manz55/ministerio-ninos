import type { Transition } from 'framer-motion'

export const SPRING: Transition = { type: 'spring', stiffness: 420, damping: 34, mass: 0.9 }
export const SPRING_SOFT: Transition = { type: 'spring', stiffness: 260, damping: 28 }
export const EASE_OUT = [0.22, 1, 0.36, 1] as const

/** Para listas: cada elemento entra un poquito después del anterior. El
 * retraso se topa en el elemento 12 para que una lista de 200 niños no
 * tarde segundos en terminar de aparecer. Pasar `custom={índice}`. */
export const listVariants = {
  hidden: {},
  show: {},
}
export const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: EASE_OUT, delay: Math.min(i, 12) * 0.03 },
  }),
}
