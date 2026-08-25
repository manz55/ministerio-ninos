import Fuse from 'fuse.js'

/** Strips accents/diacritics and lowercases, so "José" and "jose" compare equal. */
export function normalizeName(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

export interface SearchableChild {
  full_name: string
  parents?: { full_name: string } | null
}

type Indexed<T> = T & { _searchName: string; _searchParentName: string }

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
  const indexed: Indexed<T>[] = children.map((c) => ({
    ...c,
    _searchName: normalizeName(c.full_name),
    _searchParentName: normalizeName(c.parents?.full_name ?? ''),
  }))
  const fuse = new Fuse(indexed, {
    keys: ['_searchName', '_searchParentName'],
    threshold: 0.35,
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
 * Splits results into "exact" (accent-insensitive substring match — normal
 * search behavior) and "suggestions" (everything else Fuse considers close
 * enough). "jose" already finds "José" via `exact` since normalization
 * strips the accent; `suggestions` surfaces near-misses like "Josue" that a
 * plain substring search would miss entirely.
 */
export function searchChildrenSplit<T extends SearchableChild>(
  searcher: ChildSearcher<T>,
  term: string
): SplitSearchResults<T> {
  const q = normalizeName(term)
  if (!q) return { exact: [], suggestions: [] }
  const exact = searcher.indexed.filter((c) => c._searchName.includes(q) || c._searchParentName.includes(q))
  const exactSet = new Set<Indexed<T>>(exact)
  const suggestions = searcher.fuse.search(q).map((r) => r.item).filter((item) => !exactSet.has(item))
  return { exact, suggestions }
}
