import { differenceInYears, isValid, parseISO } from 'date-fns'
import { isCorderitos, type Category } from '../types/domain'

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

  if (age <= 1) return 'corderitos_0_2'
  if (age <= 3) return 'corderitos_2_4'
  if (age <= 6) return 'hormiguitas'
  if (age <= 9) return 'saltamontes'
  return 'exploradores'
}

export function requiresBadge(category: Category | null): boolean {
  return category !== null && !isCorderitos(category)
}

export function requiresPager(category: Category | null): boolean {
  return category === 'hormiguitas'
}

export function requiresCheckout(category: Category | null): boolean {
  return category !== null && !isCorderitos(category)
}

/**
 * The category to actually use for a child: the stored `category` when set
 * (whether from a coordinator's manual override, a prior graduation sync, or
 * initial registration), otherwise computed live from birth_date as a
 * fallback for children whose category was never set. Stored must win over
 * computed — otherwise a manual override always displays as unchanged even
 * right after being saved, since birth_date keeps recomputing the same
 * age-based category regardless of what was just written to the DB.
 */
export function getEffectiveCategory(child: { birth_date: string | null; category: Category | null }): Category | null {
  return child.category ?? getCategoryFromBirthDate(child.birth_date)
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
