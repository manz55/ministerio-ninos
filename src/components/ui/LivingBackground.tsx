// Persistent ambient backdrop for the whole app shell — three slow-drifting
// blurred blobs behind the header/dock/pages, giving the app a subtle sense
// of always being "alive" without competing with any page's own content or
// per-category backgrounds (CheckInPage paints its own opaque wash on top).
export function LivingBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none bg-[#fafafc]">
      <div
        className="aura-blob absolute -top-1/4 -left-1/4 w-[70vw] h-[70vw] max-w-[900px] max-h-[900px] rounded-full opacity-[0.16] blur-3xl"
        style={{
          background: 'radial-gradient(circle, #818cf8 0%, transparent 70%)',
          animation: 'aura-drift-a 26s ease-in-out infinite',
        }}
      />
      <div
        className="aura-blob absolute -bottom-1/4 -right-1/4 w-[65vw] h-[65vw] max-w-[850px] max-h-[850px] rounded-full opacity-[0.14] blur-3xl"
        style={{
          background: 'radial-gradient(circle, #34d399 0%, transparent 70%)',
          animation: 'aura-drift-b 32s ease-in-out infinite',
        }}
      />
      <div
        className="aura-blob absolute top-1/3 right-0 w-[45vw] h-[45vw] max-w-[600px] max-h-[600px] rounded-full opacity-[0.12] blur-3xl"
        style={{
          background: 'radial-gradient(circle, #f0abfc 0%, transparent 70%)',
          animation: 'aura-drift-c 22s ease-in-out infinite',
        }}
      />
    </div>
  )
}
