/**
 * Normalizes an array index to a number.
 * Handles both numeric and string indices.
 */
export function normalizeIndex(idx: number | string): number {
  return typeof idx === 'number' ? idx : Number.parseInt(idx, 10);
}

