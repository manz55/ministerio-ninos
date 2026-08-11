export function SoftGradientBackground() {
  return (
    <div
      className="fixed inset-0 z-[1] pointer-events-none"
      style={{
        background: `
          radial-gradient(ellipse 70% 55% at 0% 0%,   rgba(199,210,254,.55) 0%, transparent 100%),
          radial-gradient(ellipse 60% 50% at 90% 35%,  rgba(221,214,254,.45) 0%, transparent 100%),
          radial-gradient(ellipse 55% 50% at 25% 85%,  rgba(187,247,208,.40) 0%, transparent 100%),
          radial-gradient(ellipse 50% 45% at 80% 5%,   rgba(253,230,138,.32) 0%, transparent 100%),
          radial-gradient(ellipse 45% 40% at 45% 95%,  rgba(251,207,232,.32) 0%, transparent 100%),
          white
        `,
      }}
    />
  )
}
