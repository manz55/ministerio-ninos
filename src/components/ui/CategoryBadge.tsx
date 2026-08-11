import { CATEGORY_LABELS, CATEGORY_COLORS, type Category } from '../../types/domain'

interface Props {
  category: Category
  size?: 'sm' | 'md'
}

export function CategoryBadge({ category, size = 'md' }: Props) {
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'
  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold ${sizeClass} ${CATEGORY_COLORS[category]}`}
    >
      {CATEGORY_LABELS[category]}
    </span>
  )
}
