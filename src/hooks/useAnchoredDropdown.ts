import { useLayoutEffect, useState, type RefObject } from 'react'

// Header dropdowns (CoordinatorRequestButton, TeacherRequestsButton) used to
// position themselves with `absolute right-0` relative to their own icon
// button. That works only when the icon sits flush against the header's
// right edge — but it doesn't, there are more icon buttons after it — so on
// narrow screens the fixed-width panel bled off the left edge of the
// viewport, cutting off text. This computes a `fixed` position anchored to
// the trigger button's actual on-screen rect, clamped so the panel always
// stays within the viewport regardless of screen width.
export function useAnchoredDropdown(open: boolean, anchorRef: RefObject<HTMLElement | null>, maxWidth: number) {
  const [pos, setPos] = useState<{ top: number; right: number; width: number } | null>(null)

  useLayoutEffect(() => {
    if (!open) { setPos(null); return }
    function compute() {
      const el = anchorRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const margin = 12
      const width = Math.min(maxWidth, window.innerWidth - margin * 2)
      const right = Math.min(
        Math.max(window.innerWidth - rect.right, margin),
        Math.max(window.innerWidth - width - margin, margin)
      )
      setPos({ top: rect.bottom + 8, right, width })
    }
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [open, anchorRef, maxWidth])

  return pos
}
