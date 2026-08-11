const COLORS = ['#f87171','#fbbf24','#4ade80','#38bdf8','#c084fc','#f472b6','#a78bfa','#fb923c']

const BALLOONS = [
  { x:8,  y:6,  s:32, c:0, v:0, dur:4.2, d:0.0 },
  { x:78, y:4,  s:28, c:1, v:1, dur:3.8, d:0.3 },
  { x:45, y:2,  s:34, c:2, v:2, dur:4.5, d:0.6 },
  { x:90, y:28, s:26, c:3, v:3, dur:3.6, d:0.9 },
  { x:5,  y:48, s:30, c:4, v:0, dur:4.1, d:0.2 },
  { x:22, y:65, s:28, c:5, v:1, dur:3.9, d:0.7 },
  { x:65, y:70, s:32, c:6, v:2, dur:4.3, d:0.4 },
  { x:52, y:18, s:26, c:7, v:3, dur:3.7, d:1.1 },
]

function BalloonSVG({ color, size }: { color: string; size: number }) {
  return (
    <svg width={size} height={size * 1.55} viewBox="0 0 40 62" fill="none">
      <ellipse cx="20" cy="19" rx="17" ry="18" fill={color} />
      <ellipse cx="12" cy="11" rx="5.5" ry="6.5" fill="white" opacity="0.38" />
      <path d="M17 37 Q20 40 23 37 Q21 35.5 19 35.5 Q17.5 35.5 17 37Z" fill={color} />
      <path d="M20 40 Q26 50 18 61" stroke={color} strokeWidth="1.3" strokeLinecap="round" opacity="0.7" />
    </svg>
  )
}

export function BalloonBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {BALLOONS.map((b, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            left: `${b.x}%`, top: `${b.y}%`, opacity: 0.65,
            animation: `bg-appear .35s ease-out ${b.d}s both, float-${b.v} ${b.dur}s ease-in-out ${b.d}s infinite`,
          }}
        >
          <BalloonSVG color={COLORS[b.c]} size={b.s} />
        </div>
      ))}
    </div>
  )
}
