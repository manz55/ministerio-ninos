// Coder's mark: a bold open "C" ring, not a stock icon — deliberately not
// another sparkle/star glyph, which is the generic "this is an AI feature"
// visual cliché every app reaches for.
export function CoderIcon({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M17.4 6.6A7.6 7.6 0 1 0 17.4 17.4"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
    </svg>
  )
}
