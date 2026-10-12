import { LogoShapes } from './LogoShapes'

// Fondo de la pantalla de inicio de Registro — el mismo lenguaje que el resto
// de la app (crema + formas del logo), con un poco más de presencia.
export function SoftGradientBackground() {
  return (
    <div className="fixed inset-0 z-[1] pointer-events-none bg-canvas">
      <LogoShapes opacity={0.12} />
    </div>
  )
}
