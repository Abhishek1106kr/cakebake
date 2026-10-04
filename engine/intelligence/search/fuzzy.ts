// Typo tolerance: bounded Levenshtein distance and vocabulary correction.

/** Edit distance, giving up early (returns max + 1) once it can't be within `max`. */
export function levenshtein(a: string, b: string, max = Infinity): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      // Adjacent transposition ("chcoolate") counts as one edit.
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], prev2[j - 2] + 1);
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length];
}

/** Edits allowed for a word of this length: none for short words, so "tea" never becomes "ten". */
export function allowedEdits(length: number): number {
  if (length <= 3) return 0;
  if (length <= 5) return 1;
  return 2;
}

export type Correction = { from: string; to: string; distance: number };

/** Closest vocabulary word within the allowed distance, or null. Exact matches return null (nothing to correct). */
export function correct(token: string, vocabulary: Iterable<string>): Correction | null {
  const max = allowedEdits(token.length);
  if (max === 0) return null;
  let best: Correction | null = null;
  for (const word of vocabulary) {
    if (word === token) return null;
    if (Math.abs(word.length - token.length) > max) continue;
    const d = levenshtein(token, word, max);
    if (d <= max && (!best || d < best.distance || (d === best.distance && word < best.to))) best = { from: token, to: word, distance: d };
  }
  return best;
}
