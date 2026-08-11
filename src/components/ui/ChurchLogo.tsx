export function ChurchLogo({ size = 36 }: { size?: number }) {
  const h = Math.round(size * 0.9)
  return (
    <svg width={size} height={h} viewBox="0 0 80 72" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        {/* Flame: bright yellow tip → gold → amber base */}
        <linearGradient id="cl-flame" x1="40" y1="11" x2="40" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#FFF59D" />
          <stop offset="38%"  stopColor="#FFD600" />
          <stop offset="100%" stopColor="#F9A825" />
        </linearGradient>

        {/* Inner flame shine */}
        <radialGradient id="cl-flame-shine" cx="38%" cy="30%" r="55%">
          <stop offset="0%"   stopColor="#FFFF8D" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#FFD600"  stopOpacity="0" />
        </radialGradient>

        {/* Center petal: highlight at top-center */}
        <radialGradient id="cl-pc" cx="50%" cy="18%" r="72%">
          <stop offset="0%"   stopColor="#F8FAFC" />
          <stop offset="55%"  stopColor="#CBD5E1" />
          <stop offset="100%" stopColor="#94A3B8" />
        </radialGradient>

        {/* Left petal: highlight shifted right (outer face) */}
        <radialGradient id="cl-pl" cx="68%" cy="22%" r="72%">
          <stop offset="0%"   stopColor="#F1F5F9" />
          <stop offset="55%"  stopColor="#C8D4DF" />
          <stop offset="100%" stopColor="#8EA5B4" />
        </radialGradient>

        {/* Right petal: highlight shifted left */}
        <radialGradient id="cl-pr" cx="32%" cy="22%" r="72%">
          <stop offset="0%"   stopColor="#F1F5F9" />
          <stop offset="55%"  stopColor="#C8D4DF" />
          <stop offset="100%" stopColor="#8EA5B4" />
        </radialGradient>
      </defs>

      {/* ── Petals (back to front) ── */}

      {/* Left petal */}
      <ellipse
        cx="28" cy="53" rx="9.5" ry="18"
        fill="url(#cl-pl)"
        transform="rotate(-30 28 53)"
      />

      {/* Right petal */}
      <ellipse
        cx="52" cy="53" rx="9.5" ry="18"
        fill="url(#cl-pr)"
        transform="rotate(30 52 53)"
      />

      {/* Center petal (top layer of petals) */}
      <ellipse
        cx="40" cy="57" rx="10" ry="16"
        fill="url(#cl-pc)"
      />

      {/* ── Flame / teardrop ── */}
      <path
        d="M40 11
           C36 17 26 30 26 41
           C26 48 32 53 40 53
           C48 53 54 48 54 41
           C54 30 44 17 40 11Z"
        fill="url(#cl-flame)"
      />

      {/* Flame inner shine */}
      <path
        d="M40 11
           C36 17 26 30 26 41
           C26 48 32 53 40 53
           C48 53 54 48 54 41
           C54 30 44 17 40 11Z"
        fill="url(#cl-flame-shine)"
      />
    </svg>
  )
}
