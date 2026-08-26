import { normalizeName } from './fuzzySearch'
import { CATEGORY_LABELS, type Category } from '../types/domain'

/**
 * Rule-based (no LLM) parser for Coder's command bar. Deliberately narrow:
 * two fixed Spanish sentence shapes, matched with regex. Anything that
 * doesn't fit one of these falls through to a "no entendí" error rather
 * than guessing — there's no model here to fall back on, and a wrong guess
 * on real children's records is worse than asking the user to rephrase.
 */
export type ParsedCommand =
  | { type: 'rename'; nameQuery: string; newName: string }
  | { type: 'category'; nameQuery: string; targetLabel: string }
  | { type: 'birthdate'; nameQuery: string; dateText: string }

const RENAME_PATTERNS = [
  /^cambiar?\s+(?:el\s+)?nombre\s+de\s+(.+?)\s+a\s+(.+)$/i,
  /^renombrar?\s+(?:a\s+)?(.+?)\s+(?:a|como)\s+(.+)$/i,
]

const CATEGORY_PATTERNS = [
  /^cambiar?\s+categor[ií]a\s+de\s+(.+?)\s+a\s+(.+)$/i,
  /^mover?\s+(?:a\s+)?(.+?)\s+a\s+(.+)$/i,
  /^pasar?\s+(?:a\s+)?(.+?)\s+a\s+(.+)$/i,
]

const BIRTHDATE_PATTERNS = [
  /^cambiar?\s+fecha\s+de\s+nacimiento\s+de\s+(.+?)\s+a\s+(.+)$/i,
  /^poner\s+fecha\s+de\s+nacimiento\s+(?:de\s+)?(.+?)\s+a\s+(.+)$/i,
  /^fecha\s+de\s+nacimiento\s+de\s+(.+?)\s+(?:es|a)\s+(.+)$/i,
]

export function parseCommand(raw: string): ParsedCommand | null {
  const text = raw.trim().replace(/\s+/g, ' ').replace(/[.!?]+$/, '')
  if (!text) return null

  for (const re of RENAME_PATTERNS) {
    const m = text.match(re)
    if (m) return { type: 'rename', nameQuery: m[1].trim(), newName: m[2].trim() }
  }
  for (const re of BIRTHDATE_PATTERNS) {
    const m = text.match(re)
    if (m) return { type: 'birthdate', nameQuery: m[1].trim(), dateText: m[2].trim() }
  }
  for (const re of CATEGORY_PATTERNS) {
    const m = text.match(re)
    if (m) return { type: 'category', nameQuery: m[1].trim(), targetLabel: m[2].trim() }
  }
  return null
}

/**
 * Accepts DD/MM/YYYY, DD-MM-YYYY, or YYYY-MM-DD — the formats someone would
 * actually type — and returns the ISO date `children.birth_date` expects,
 * or null if it doesn't parse as a real calendar date.
 */
export function parseSpanishDate(input: string): string | null {
  const s = input.trim()

  let y: number, mo: number, d: number
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (iso) { y = +iso[1]; mo = +iso[2]; d = +iso[3] }
  else if (dmy) { d = +dmy[1]; mo = +dmy[2]; y = +dmy[3] }
  else return null

  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  const currentYear = new Date().getFullYear()
  if (y < 1990 || y > currentYear) return null

  const date = new Date(Date.UTC(y, mo - 1, d))
  // Rolled over (e.g. día 31 en un mes de 30) — Date normalizes instead of throwing.
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null

  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** null = no category matches that text; 'ambiguous' = needs "0-2" or "2-4" specified. */
export function resolveCategoryLabel(input: string): Category | 'ambiguous' | null {
  const q = normalizeName(input)
  if (!q) return null
  if (q === 'corderitos' || q === 'corderito') return 'ambiguous'

  const entries = Object.entries(CATEGORY_LABELS) as [Category, string][]
  const exact = entries.find(([, label]) => normalizeName(label) === q)
  if (exact) return exact[0]

  const byKey = entries.find(([cat]) => cat === q)
  if (byKey) return byKey[0]

  const partial = entries.filter(([, label]) => {
    const norm = normalizeName(label)
    return norm.startsWith(q) || q.startsWith(norm)
  })
  if (partial.length === 1) return partial[0][0]
  if (partial.length > 1) return 'ambiguous'

  return null
}
