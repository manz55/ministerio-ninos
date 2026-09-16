import { differenceInYears, isValid, parseISO } from 'date-fns'
import { isCorderitos, CATEGORY_AGE_RANGES, CATEGORY_ORDER, NEXT_CATEGORY, type Category } from '../types/domain'

/**
 * Returns null (instead of silently guessing) when birthDate is missing or
 * malformed, so callers can show "Sin categoría" rather than misclassifying.
 * Uses parseISO instead of `new Date(string)` — the latter parses
 * 'YYYY-MM-DD' as UTC midnight, which can shift the computed age by a day
 * against local time and flip a child's category right at a birthday.
 *
 * Walks CATEGORY_ORDER and picks the first category whose max age fits —
 * so where two ranges overlap on purpose (Corderitos 3-4 / Hormiguitas 4-6,
 * a deliberate transition zone) the younger group wins as the suggestion,
 * and a coordinator moves the child up manually when ready.
 */
export function getCategoryFromBirthDate(birthDate: string | null | undefined): Category | null {
  if (!birthDate) return null
  const parsed = parseISO(birthDate)
  if (!isValid(parsed)) return null
  const age = differenceInYears(new Date(), parsed)
  if (age < 0) return null

  for (const category of CATEGORY_ORDER) {
    if (age <= CATEGORY_AGE_RANGES[category].max) return category
  }
  return CATEGORY_ORDER[CATEGORY_ORDER.length - 1]
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

/**
 * True when the child already qualifies (by age) for the category right
 * after the one they're stored in — e.g. stored Hormiguitas, turned 7, so
 * now old enough for Saltamontes (min age 7). Deliberately relative to the
 * child's OWN current category, not an absolute "what does this age compute
 * to" check — that approach (an earlier version of this function) breaks in
 * the Corderitos 3-4 / Hormiguitas 4-6 overlap zone: getCategoryFromBirthDate
 * always prefers the younger group at age 4, so a child already properly
 * moved into Hormiguitas would "mismatch" against that younger suggestion
 * and get flagged as needing to move backward, which is nonsense. Asking
 * "is this child old enough for what comes after where they already are"
 * sidesteps that ambiguity entirely and is also just the more natural
 * question a maestro is actually asking.
 */
export function hasCategoryChanged(child: { birth_date: string | null; category: Category | null }): boolean {
  if (!child.category) return false
  const next = NEXT_CATEGORY[child.category]
  if (!next) return false
  const age = getAgeLabel(child.birth_date)
  if (age === null) return false
  return age >= CATEGORY_AGE_RANGES[next].min
}

export function getAgeLabel(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null
  const parsed = parseISO(birthDate)
  if (!isValid(parsed)) return null
  const age = differenceInYears(new Date(), parsed)
  return age >= 0 ? age : null
}
