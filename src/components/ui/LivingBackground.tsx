import { LogoShapes } from './LogoShapes'

// Fondo fijo de toda la app: crema muy clara con las formas del logo,
// apenas visibles y moviéndose muy despacio (se detienen con
// prefers-reduced-motion — ver .aura-blob en index.css).
export function LivingBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none bg-canvas">
      <LogoShapes />
    </div>
  )
}
