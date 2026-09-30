// Seeded RNG (mulberry32). The state is a plain int stored inside game state,
// so matches can be snapshotted and replayed exactly. Core code never uses Math.random.

export interface RngHolder {
  rng: number;
}

/** Returns a float in [0, 1) and advances `h.rng`. */
export function rand(h: RngHolder): number {
  h.rng = (h.rng + 0x6d2b79f5) | 0;
  let t = h.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Picks an entry by weight using an already-drawn uniform value `r` in [0, 1). */
export function pickWeighted<T>(r: number, entries: ReadonlyArray<readonly [T, number]>): T {
  let total = 0;
  for (const [, w] of entries) total += w;
  let x = r * total;
  for (const [item, w] of entries) {
    if (w <= 0) continue;
    if (x < w) return item;
    x -= w;
  }
  // Reason: float rounding can leave x marginally >= the last weight; fall back to the last positive entry.
  for (let i = entries.length - 1; i >= 0; i--) if (entries[i][1] > 0) return entries[i][0];
  throw new Error('pickWeighted: no positive weights');
}

/** Derives an independent, well-mixed 32-bit seed from a base seed and a salt. */
export function mixSeed(seed: number, salt: number): number {
  let h = (seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) | 0;
}
