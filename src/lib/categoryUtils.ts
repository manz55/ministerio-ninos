import { differenceInYears, isValid, parseISO } from 'date-fns'
import type { Category } from '../types/domain'

/**
 * Returns null (instead of silently guessing) when birthDate is missing or
 * malformed, so callers can show "Sin categoría" rather than misclassifying.
 * Uses parseISO instead of `new Date(string)` — the latter parses
 * 'YYYY-MM-DD' as UTC midnight, which can shift the computed age by a day
 * against local time and flip a child's category right at a birthday.
 */
export function getCategoryFromBirthDate(birthDate: string | null | undefined): Category | null {
  if (!birthDate) return null
  const parsed = parseISO(birthDate)
  if (!isValid(parsed)) return null
  const age = differenceInYears(new Date(), parsed)
  if (age < 0) return null

  if (age <= 3) return 'corderitos'
  if (age <= 6) return 'hormiguitas'
  if (age <= 9) return 'saltamontes'
  return 'exploradores'
}

export function requiresBadge(category: Category | null): boolean {
  return category !== null && category !== 'corderitos'
}

export function requiresPager(category: Category | null): boolean {
  return category === 'hormiguitas'
}

export function requiresCheckout(category: Category | null): boolean {
  return category !== null && category !== 'corderitos'
}

/**
 * The category to actually use for a child: computed live from birth_date
 * when available, otherwise the manually-assigned `category` stored on the
 * record (set at import time for children with no birth_date on file).
 */
export function getEffectiveCategory(child: { birth_date: string | null; category: Category | null }): Category | null {
  return getCategoryFromBirthDate(child.birth_date) ?? child.category
}

/** True when the child has aged into a new category since their `category` was last synced. */
export function hasCategoryChanged(child: { birth_date: string | null; category: Category | null }): boolean {
  const computed = getCategoryFromBirthDate(child.birth_date)
  return computed !== null && child.category !== null && computed !== child.category
}

export function getAgeLabel(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null
  const parsed = parseISO(birthDate)
  if (!isValid(parsed)) return null
  const age = differenceInYears(new Date(), parsed)
  return age >= 0 ? age : null
}
