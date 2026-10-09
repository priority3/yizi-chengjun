// Star rating of a cleared chapter (1..3, by the camp HP left at the end) and the best-per-chapter record with
// its one-time three-star bonus. Pure data + functions; the record itself is kept in the progress save
// (platform/web.ts), the 灵石 go into the 法宝 vault.
import type { Vault } from './treasures.ts';

/** Most stars a chapter can earn. */
export const MAX_STARS = 3;
/** Camp HP left, in percent of its max, that a win needs for three stars. */
export const THREE_STAR_PCT = 80;
/** ...and for two stars (any win earns at least one). */
export const TWO_STAR_PCT = 40;
/** 灵石 paid the first time a chapter is cleared with three stars, on top of the normal clear rewards. */
export const STAR_BONUS = 10;

/** Stars for a won run: 3 with at least 80 % of the camp HP left, 2 with at least 40 %, else 1. */
export function starRating(campHp: number, campMax: number): number {
  // Reason: compare without dividing, so exactly 80 % (96 of 120, 104 of 130) can't slip under by a rounding error.
  if (campHp * 100 >= campMax * THREE_STAR_PCT) return 3;
  if (campHp * 100 >= campMax * TWO_STAR_PCT) return 2;
  return 1;
}

/** The star part of the progress save, one entry per chapter (index = chapter - 1). */
export interface StarRecord {
  /** Best stars so far: 0 until the chapter is cleared. */
  stars: number[];
  /** The three-star bonus has been paid for this chapter. */
  starBonus: boolean[];
}

/** What a clear earned, for the result panel. */
export interface StarAward {
  /** Stars this run earned. */
  stars: number;
  /** The chapter's best rating, this run included. */
  best: number;
  /** 灵石 paid for reaching three stars on this chapter for the first time (0 otherwise). */
  bonus: number;
}

/** Records a cleared run's stars (keeping the best) and pays the one-time three-star bonus into the vault. */
export function awardStars(rec: StarRecord, vault: Vault, chapter: number, stars: number): StarAward {
  const i = chapter - 1;
  rec.stars[i] = Math.max(rec.stars[i] ?? 0, stars);
  let bonus = 0;
  if (stars >= MAX_STARS && !rec.starBonus[i]) {
    rec.starBonus[i] = true;
    bonus = STAR_BONUS;
    vault.stones += bonus;
  }
  return { stars, best: rec.stars[i], bonus };
}
