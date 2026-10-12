// Las tres formas del logo (círculo azul, hexágono rojo, triángulo amarillo)
// como fondo muy tenue — reemplaza las manchas de degradado morado, que no
// tenían nada que ver con la identidad del ministerio.
const SHAPES: { kind: 'circle' | 'hex' | 'tri'; x: string; y: string; size: number; rot: number; color: string }[] = [
  { kind: 'circle', x: '6%',  y: '14%', size: 54,  rot: 0,   color: 'oklch(0.66 0.16 250)' },
  { kind: 'hex',    x: '88%', y: '10%', size: 70,  rot: 12,  color: 'oklch(0.62 0.2 27)' },
  { kind: 'tri',    x: '78%', y: '58%', size: 60,  rot: -14, color: 'oklch(0.85 0.16 90)' },
  { kind: 'circle', x: '14%', y: '72%', size: 34,  rot: 0,   color: 'oklch(0.85 0.16 90)' },
  { kind: 'hex',    x: '40%', y: '92%', size: 44,  rot: -8,  color: 'oklch(0.66 0.16 250)' },
  { kind: 'tri',    x: '52%', y: '30%', size: 30,  rot: 20,  color: 'oklch(0.62 0.2 27)' },
]

import type { ShapeKind } from './logoColors'

/** Una de las tres formas del logo, dibujada dentro de un cuadro de `size`. */
export function Shape({ kind, size, color }: { kind: ShapeKind; size: number; color: string }) {
  if (kind === 'circle') return <circle cx={size / 2} cy={size / 2} r={size / 2} fill={color} />
  if (kind === 'hex') {
    const r = size / 2
    const pts = Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i - Math.PI / 2
      return `${r + r * Math.cos(a)},${r + r * Math.sin(a)}`
    }).join(' ')
    return <polygon points={pts} fill={color} />
  }
  return <polygon points={`${size / 2},${size * 0.06} ${size * 0.97},${size * 0.9} ${size * 0.03},${size * 0.9}`} fill={color} strokeLinejoin="round" />
}

export function LogoShapes({ opacity = 0.09 }: { opacity?: number }) {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ opacity }}>
      {SHAPES.map((s, i) => (
        <svg
          key={i}
          width={s.size}
          height={s.size}
          viewBox={`0 0 ${s.size} ${s.size}`}
          className="absolute aura-blob"
          style={{ left: s.x, top: s.y, animation: `aura-drift-${'abc'[i % 3]} ${24 + i * 3}s ease-in-out infinite` }}
        >
          <g transform={`rotate(${s.rot} ${s.size / 2} ${s.size / 2})`}>
            <Shape kind={s.kind} size={s.size} color={s.color} />
          </g>
        </svg>
      ))}
    </div>
  )
}
