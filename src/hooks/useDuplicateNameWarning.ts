'use client';

import { useMemo } from 'react';

export interface DuplicateNameCandidate {
  id: string;
  name: string;
}

export interface DuplicateNameMatch<T> {
  item: T;
  /** True when the normalized names are identical (not just "close"). */
  exact: boolean;
}

/** Lowercase, trim, collapse whitespace, and drop punctuation so "Tomato Sauce",
 * "tomato-sauce" and "  Tomato   Sauce " all normalize the same. */
export function normalizeName(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Small edit distance (Levenshtein) — cheap for the short name strings these
 * entities use (suppliers/items/units/categories), so no need for anything fancier. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j - 1], prev[j], cur[j - 1]);
    }
    prev = cur;
  }
  return prev[n];
}

/** True when `a`/`b` look like the same thing typed slightly differently — an exact
 * match after normalizing, a simple plural ("Tomato" / "Tomatoes"), or a near-typo. */
function isCloseMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  // Plural / near-prefix forms (Tomato vs Tomatoes, Onion vs Onions): one is a
  // prefix of the other and the extra tail is short.
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  if (longer.startsWith(shorter) && longer.length - shorter.length <= 3) return true;
  // Typos: small edit distance relative to length (skip very short names, where a
  // distance-of-1 would match almost anything, e.g. "kg" vs "g").
  if (shorter.length >= 4 && editDistance(a, b) <= 2) return true;
  return false;
}

/**
 * Non-reactive matcher — pass the current list snapshot + a candidate name and get
 * back close/exact matches, ranked exact-first. Shared by the live inline-warning
 * hook below and by one-shot pre-submit checks (e.g. SupplierFormDialog, which
 * can't watch keystrokes because the name field lives in an external form).
 */
export function findDuplicateMatches<T extends DuplicateNameCandidate>(
  list: T[] | undefined,
  candidateName: string,
  opts?: { excludeId?: string; limit?: number },
): DuplicateNameMatch<T>[] {
  const trimmed = candidateName.trim();
  if (!trimmed || trimmed.length < 2 || !list?.length) return [];
  const normCandidate = normalizeName(trimmed);
  if (!normCandidate) return [];

  const matches: DuplicateNameMatch<T>[] = [];
  for (const item of list) {
    if (opts?.excludeId && item.id === opts.excludeId) continue;
    const normItem = normalizeName(item.name);
    if (!normItem) continue;
    if (!isCloseMatch(normCandidate, normItem)) continue;
    matches.push({ item, exact: normItem === normCandidate });
  }
  matches.sort((a, b) => Number(b.exact) - Number(a.exact));
  return matches.slice(0, opts?.limit ?? 5);
}

/**
 * Live inline "you might be creating a duplicate" check for a name field, against
 * an already-loaded list (suppliers/units/categories are small enough to hold
 * client-side; items use a server search instead — see ItemFormDialog). Debounce
 * upstream if the list itself comes from a search query.
 */
export function useDuplicateNameWarning<T extends DuplicateNameCandidate>(
  list: T[] | undefined,
  candidateName: string,
  opts?: { excludeId?: string; limit?: number },
): DuplicateNameMatch<T>[] {
  return useMemo(
    () => findDuplicateMatches(list, candidateName, opts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [list, candidateName, opts?.excludeId, opts?.limit],
  );
}
