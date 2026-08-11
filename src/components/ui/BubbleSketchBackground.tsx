import { useEffect, useRef } from 'react'

interface Bubble {
  x: number
  y: number
  r: number
  vx: number
  vy: number
  opacity: number
  wobble: Float32Array
  phase: number
  phaseSpeed: number
}

function makeBubble(w: number, h: number, start = false): Bubble {
  const r = 18 + Math.random() * 52
  const wobblePoints = 12
  const wobble = new Float32Array(wobblePoints)
  for (let i = 0; i < wobblePoints; i++) {
    wobble[i] = (Math.random() - 0.5) * 0.14
  }
  return {
    x: r + Math.random() * (w - r * 2),
    y: start ? Math.random() * h : h + r + Math.random() * 80,
    r,
    vx: (Math.random() - 0.5) * 0.35,
    vy: -(0.25 + Math.random() * 0.45),
    opacity: 0.1 + Math.random() * 0.2,
    wobble,
    phase: Math.random() * Math.PI * 2,
    phaseSpeed: 0.008 + Math.random() * 0.012,
  }
}

function drawSketchCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  wobble: Float32Array,
  phase: number,
) {
  const n = wobble.length
  ctx.beginPath()
  for (let i = 0; i <= n; i++) {
    const angle = (i / n) * Math.PI * 2
    const w = wobble[i % n] * Math.sin(phase + i)
    const px = x + (r + r * w) * Math.cos(angle)
    const py = y + (r + r * w) * Math.sin(angle)
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
}

export function BubbleSketchBackground({ count = 14 }: { count?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<{ bubbles: Bubble[]; raf: number }>({ bubbles: [], raf: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      stateRef.current.bubbles = Array.from({ length: count }, () =>
        makeBubble(canvas.width, canvas.height, true)
      )
    }

    resize()
    window.addEventListener('resize', resize)

    const STROKE = [251, 191, 36] // amber-400

    const draw = () => {
      const { width, height } = canvas
      ctx.clearRect(0, 0, width, height)

      for (const b of stateRef.current.bubbles) {
        b.phase += b.phaseSpeed
        b.x += b.vx
        b.y += b.vy

        if (b.x < -b.r || b.x > width + b.r) b.vx *= -1
        if (b.y + b.r < 0) Object.assign(b, makeBubble(width, height))

        ctx.save()

        // Double-stroke for a hand-drawn look
        drawSketchCircle(ctx, b.x, b.y, b.r, b.wobble, b.phase)
        ctx.strokeStyle = `rgba(${STROKE[0]},${STROKE[1]},${STROKE[2]},${b.opacity * 0.5})`
        ctx.lineWidth = 2.5
        ctx.stroke()

        drawSketchCircle(ctx, b.x + 1, b.y + 0.5, b.r * 0.98, b.wobble, b.phase + 0.3)
        ctx.strokeStyle = `rgba(${STROKE[0]},${STROKE[1]},${STROKE[2]},${b.opacity})`
        ctx.lineWidth = 1.2
        ctx.stroke()

        ctx.restore()
      }

      stateRef.current.raf = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(stateRef.current.raf)
      window.removeEventListener('resize', resize)
    }
  }, [count])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-screen h-screen pointer-events-none z-0"
    />
  )
}
