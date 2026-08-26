import Fuse from 'fuse.js'

/** Strips accents/diacritics and lowercases, so "José" and "jose" compare equal. */
export function normalizeName(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/**
 * True if any whitespace-separated word in `text` starts with `q`. Plain
 * substring matching ("jo" matches "Alejandro") reads as random noise once
 * the roster gets past a couple dozen names — word-start matching is what
 * people actually expect from a name search ("jo" -> José, Joshua, Jordan…
 * not names that merely contain "jo" somewhere in the middle).
 */
function matchesWordPrefix(text: string, q: string): boolean {
  return text.split(/\s+/).some((word) => word.startsWith(q))
}

export interface SearchableChild {
  full_name: string
  parents?: { full_name: string } | null
}

type Indexed<T> = T & { _searchName: string; _searchParentName: string; _searchWords: string[] }

export interface ChildSearcher<T> {
  fuse: Fuse<Indexed<T>>
  indexed: Indexed<T>[]
}

/**
 * Builds a typo/accent-tolerant searcher over a roster already loaded client-side.
 * Matching happens on pre-normalized copies of the name fields (not the raw
 * Postgres `ilike`, which is case-insensitive but NOT accent-insensitive —
 * "jose" would never match "José" there).
 */
export function createChildSearcher<T extends SearchableChild>(children: T[]): ChildSearcher<T> {
  const indexed: Indexed<T>[] = children.map((c) => {
    const searchName = normalizeName(c.full_name)
    const searchParentName = normalizeName(c.parents?.full_name ?? '')
    return {
      ...c,
      _searchName: searchName,
      _searchParentName: searchParentName,
      // Fuzzy-matched per word, not against the whole "First Middle Last"
      // string — matching a short query against a long joined string lets
      // Fuse align it across word boundaries and pass a lenient threshold
      // almost regardless of what was typed. Matching per word keeps each
      // comparison bounded to a single name's length, so a 3-letter query
      // only scores well against words it's actually close to.
      _searchWords: [...searchName.split(/\s+/), ...searchParentName.split(/\s+/)].filter(Boolean),
    }
  })
  const fuse = new Fuse(indexed, {
    keys: ['_searchWords'],
    threshold: 0.3,
    ignoreLocation: true,
  })
  return { fuse, indexed }
}

/** Plain mixed results (exact + fuzzy), for callers that don't need the split. */
export function searchChildren<T extends SearchableChild>(searcher: ChildSearcher<T>, term: string): T[] {
  const q = normalizeName(term)
  if (!q) return []
  return searcher.fuse.search(q).map((r) => r.item)
}

export interface SplitSearchResults<T> {
  /** Plain substring match on the normalized name — same as typing into any search box. */
  exact: T[]
  /** Fuse hits that aren't already an exact match — typos, missing letters, etc. */
  suggestions: T[]
}

/**
 * Splits results into "exact" (accent-insensitive word-prefix match — every
 * name where some word starts with what you typed) and "suggestions"
 * (everything else Fuse considers close enough). "jose" already finds
 * "José" via `exact` since normalization strips the accent; `suggestions`
 * surfaces near-misses like "Josue" that a prefix match would miss entirely.
 */
export function searchChildrenSplit<T extends SearchableChild>(
  searcher: ChildSearcher<T>,
  term: string
): SplitSearchResults<T> {
  const q = normalizeName(term)
  if (!q) return { exact: [], suggestions: [] }
  const exact = searcher.indexed.filter(
    (c) => matchesWordPrefix(c._searchName, q) || matchesWordPrefix(c._searchParentName, q)
  )
  const exactSet = new Set<Indexed<T>>(exact)
  const suggestions = searcher.fuse.search(q).map((r) => r.item).filter((item) => !exactSet.has(item))
  return { exact, suggestions }
}
