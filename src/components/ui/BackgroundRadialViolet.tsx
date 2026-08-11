export function BackgroundRadialViolet() {
  return (
    <div
      className="fixed inset-0 z-[1] pointer-events-none"
      style={{
        backgroundColor: '#ffffff',
        backgroundImage: `
          radial-gradient(ellipse 90% 55% at 50% -5%,
            rgba(139, 92, 246, 0.22) 0%,
            rgba(167, 139, 250, 0.10) 45%,
            transparent 70%
          ),
          radial-gradient(ellipse 50% 35% at 85% 95%,
            rgba(196, 181, 253, 0.18) 0%,
            transparent 70%
          ),
          radial-gradient(ellipse 35% 25% at 10% 80%,
            rgba(124, 58, 237, 0.10) 0%,
            transparent 70%
          )
        `,
      }}
    />
  )
}
