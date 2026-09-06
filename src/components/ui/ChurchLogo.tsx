// Official children's-ministry logo (replaces the previous hand-drawn SVG
// flame, which looked slightly off-center/crooked at small sizes). A plain
// <img> instead of inline SVG since this is a real illustration, not an icon
// that benefits from vector redraw at arbitrary sizes.
export function ChurchLogo({ size = 36 }: { size?: number }) {
  return (
    <img
      src="/logo-ninos-192.png"
      alt="Maestros de Niños"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className="shrink-0 object-contain"
    />
  )
}
