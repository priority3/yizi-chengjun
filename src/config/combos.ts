// Name-fragment recipes: drop one half of a name onto the other to awaken the hero.
import type { FragId, HeroId, UnitId } from '../core/types.ts';

export const HERO_RECIPES: ReadonlyArray<{ a: FragId; b: FragId; hero: HeroId }> = [
  { a: '悟', b: '空', hero: '悟空' },
  { a: '八', b: '戒', hero: '八戒' },
  { a: '沙', b: '僧', hero: '沙僧' },
  { a: '白', b: '龙', hero: '白龙' },
];

/** Hero produced by combining two tiles (either order), or null. */
export function heroFor(x: UnitId, y: UnitId): HeroId | null {
  for (const r of HERO_RECIPES) {
    if ((r.a === x && r.b === y) || (r.a === y && r.b === x)) return r.hero;
  }
  return null;
}

export function partnerOf(f: FragId): FragId {
  for (const r of HERO_RECIPES) {
    if (r.a === f) return r.b;
    if (r.b === f) return r.a;
  }
  throw new Error(`no partner for ${f}`);
}
