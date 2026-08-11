import { differenceInYears } from 'date-fns'
import type { Category } from '../types/domain'

export function getCategoryFromBirthDate(birthDate: string): Category {
  const age = differenceInYears(new Date(), new Date(birthDate))

  if (age <= 2) return 'corderitos'
  if (age <= 4) return 'hormiguitas'
  if (age <= 7) return 'saltamontes'
  return 'exploradores'
}

export function requiresBadge(category: Category): boolean {
  return category !== 'corderitos'
}

export function requiresPager(category: Category): boolean {
  return category === 'hormiguitas'
}

export function requiresCheckout(category: Category): boolean {
  return category !== 'corderitos'
}
