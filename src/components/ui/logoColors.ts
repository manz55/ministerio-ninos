export type ShapeKind = 'circle' | 'hex' | 'tri'

/** Los tres colores del logo, en el mismo orden que las formas. */
export const LOGO_COLORS = ['oklch(0.66 0.16 250)', 'oklch(0.62 0.2 27)', 'oklch(0.85 0.16 90)'] as const
export const LOGO_KINDS: ShapeKind[] = ['circle', 'hex', 'tri']

