export function AnimatedBlobBackground() {
  return (
    <div
      className="fixed inset-0 z-[1] pointer-events-none"
      style={{
        background: `
          radial-gradient(ellipse 65% 55% at 0% 0%,   rgba(129,140,248,.18) 0%, transparent 100%),
          radial-gradient(ellipse 55% 50% at 90% 10%,  rgba(34,211,238,.14)  0%, transparent 100%),
          radial-gradient(ellipse 55% 48% at 20% 65%,  rgba(167,139,250,.15) 0%, transparent 100%),
          radial-gradient(ellipse 48% 44% at 80% 65%,  rgba(52,211,153,.12)  0%, transparent 100%),
          radial-gradient(ellipse 42% 38% at 50% 90%,  rgba(244,114,182,.12) 0%, transparent 100%),
          white
        `,
      }}
    />
  )
}
