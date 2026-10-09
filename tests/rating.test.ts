// Star rating: the thresholds, the best-per-chapter record with its one-time three-star bonus, the stars in the
// progress save (old saves included), and the day-of-year rotation of the menu backdrop.
import { describe, expect, it } from 'vitest';
import { CAMP_HP, CHAPTERS } from '../src/config/chapters.ts';
import { stonesFor } from '../src/config/treasures.ts';
import { awardStars, STAR_BONUS, starRating, type StarRecord } from '../src/core/rating.ts';
import { playChapter } from '../src/core/sim.ts';
import { clearRewards, emptyVault } from '../src/core/treasures.ts';
import { loadProgress, parseProgress, saveProgress, type Progress } from '../src/platform/web.ts';
import { dayOfYear, menuMapIndex } from '../src/render/map-art.ts';

const N = CHAPTERS.length;

function emptyRecord(): StarRecord {
  return { stars: new Array<number>(N).fill(0), starBonus: new Array<boolean>(N).fill(false) };
}

/** A progress save string parsed, failing the test when it doesn't parse. */
function mustParse(raw: string): Progress {
  const p = parseProgress(raw, N);
  if (!p) throw new Error(`not a progress save: ${raw}`);
  return p;
}

describe('star rating', () => {
  it('gives three stars from 80 % of the camp left, two from 40 %, else one', () => {
    expect(starRating(80, 100)).toBe(3);
    expect(starRating(79, 100)).toBe(2);
    expect(starRating(40, 100)).toBe(2);
    expect(starRating(39, 100)).toBe(1);
    expect(starRating(100, 100)).toBe(3);
    expect(starRating(1, 100)).toBe(1);
  });

  it('holds exactly at the real camp sizes', () => {
    // The plain camp: 96 of 120 is exactly 80 %, 48 exactly 40 %.
    expect(CAMP_HP).toBe(120);
    expect([96, 95, 48, 47].map((hp) => starRating(hp, CAMP_HP))).toEqual([3, 2, 2, 1]);
    // 观音赐福 raises the max by 10 (104 = 80 % of 130); 金刚琢 tier 2 by 48 (134.4 of 168 = 80 %).
    expect([104, 103, 52, 51].map((hp) => starRating(hp, 130))).toEqual([3, 2, 2, 1]);
    expect(starRating(134.4, 168)).toBe(3);
    expect(starRating(134, 168)).toBe(2);
  });

  it('rates cleared bot runs by the share of the camp they kept', () => {
    // Reason: ties the rating to real end states (whole-number camp HP after leaks and heals), not just picked numbers.
    const won = [1, 2, 3, 4].map((seed) => playChapter(seed, 1)).filter((g) => g.phase === 'won');
    expect(won.length).toBeGreaterThan(0);
    for (const g of won) {
      const share = g.campHp / g.campMax;
      expect(starRating(g.campHp, g.campMax)).toBe(share >= 0.8 ? 3 : share >= 0.4 ? 2 : 1);
    }
  });
});

describe('three-star bonus', () => {
  it('keeps the best rating and pays the bonus only once per chapter', () => {
    const rec = emptyRecord();
    const v = emptyVault();
    expect(awardStars(rec, v, 2, 2)).toEqual({ stars: 2, best: 2, bonus: 0 });
    expect(awardStars(rec, v, 2, 3)).toEqual({ stars: 3, best: 3, bonus: STAR_BONUS });
    expect(v.stones).toBe(10);
    expect(awardStars(rec, v, 2, 3)).toEqual({ stars: 3, best: 3, bonus: 0 });
    expect(awardStars(rec, v, 2, 1)).toEqual({ stars: 1, best: 3, bonus: 0 });
    expect(v.stones).toBe(10);
    // Another chapter has its own bonus.
    expect(awardStars(rec, v, 5, 3)).toEqual({ stars: 3, best: 3, bonus: STAR_BONUS });
    expect(v.stones).toBe(20);
    expect(rec.stars.slice(0, 5)).toEqual([0, 3, 0, 0, 3]);
    expect(rec.starBonus.slice(0, 5)).toEqual([false, true, false, false, true]);
  });

  it('comes on top of the clear rewards', () => {
    const v = emptyVault();
    const rec = emptyRecord();
    const rewards = clearRewards(v, 1, true);
    awardStars(rec, v, 1, 3);
    expect(v.stones).toBe(stonesFor(1, true) + STAR_BONUS);
    expect(rewards.stones).toBe(stonesFor(1, true));
  });

  it('is not paid again after a reload', () => {
    // Chapter 4 just cleared for the first time, with three stars.
    const p = mustParse(JSON.stringify({ unlocked: 5, wins: [1, 1, 1, 1] }));
    expect(awardStars(p, p.vault, 4, 3).bonus).toBe(STAR_BONUS);
    const back = mustParse(JSON.stringify(p));
    expect(back.stars[3]).toBe(3);
    expect(back.starBonus[3]).toBe(true);
    expect(awardStars(back, back.vault, 4, 3).bonus).toBe(0);
    expect(back.vault.stones).toBe(STAR_BONUS);
  });
});

describe('stars in the progress save', () => {
  it('fill in defaults for a save from before stars existed', () => {
    const old = JSON.stringify({ unlocked: 3, wins: [2, 1], vault: { stones: 5, treasures: [], equipped: [] }, tutorialDone: true });
    const p = parseProgress(old, N);
    // No ratings yet, even for the two chapters cleared before they existed.
    expect(p?.stars).toEqual(new Array<number>(N).fill(0));
    expect(p?.wins.slice(0, 3)).toEqual([2, 1, 0]);
    expect(p?.starBonus).toEqual(new Array<boolean>(N).fill(false));
    expect(p?.unlocked).toBe(3);
    expect(p?.vault.stones).toBe(5);
  });

  it('keep saved stars and repair junk', () => {
    const saved = JSON.stringify({
      unlocked: 4,
      wins: [1, 0, 3, 2, 1, 1],
      stars: [3, 2, -1, 'x', 9, 2.7],
      starBonus: [true, 'yes', 1, true],
    });
    const p = parseProgress(saved, N);
    // Stars are whole numbers 0..3, and a chapter without a clear has none.
    expect(p?.stars).toEqual([3, 0, 0, 0, 3, 2, 0, 0, 0, 0]);
    expect(p?.starBonus).toEqual([true, false, false, true, false, false, false, false, false, false]);
    const junk = JSON.stringify({ unlocked: 1, wins: [], stars: 'lots', starBonus: { 0: true } });
    expect(parseProgress(junk, N)?.stars).toEqual(new Array<number>(N).fill(0));
    expect(parseProgress(junk, N)?.starBonus).toEqual(new Array<boolean>(N).fill(false));
  });

  it('survive a save and load as copies', () => {
    const p = loadProgress(N);
    p.wins[0] = 1;
    p.stars[0] = 2;
    p.starBonus[6] = true;
    saveProgress(p);
    p.stars[0] = 3;
    // Reason: no localStorage under Node, so this reads the in-memory copy saveProgress keeps.
    const back = loadProgress(N);
    expect(back.stars[0]).toBe(2);
    expect(back.starBonus[6]).toBe(true);
    expect(back.stars).toHaveLength(N);
  });
});

describe('menu backdrop rotation', () => {
  it('counts the day of the year from 1 on 1 January, in local time', () => {
    expect(dayOfYear(new Date(2026, 0, 1))).toBe(1);
    expect(dayOfYear(new Date(2026, 0, 1, 23, 59))).toBe(1);
    expect(dayOfYear(new Date(2026, 9, 8, 0, 1))).toBe(281);
    expect(dayOfYear(new Date(2026, 11, 31))).toBe(365);
    expect(dayOfYear(new Date(2024, 11, 31, 12))).toBe(366);
  });

  it('shows each of the ten maps in turn, one per day', () => {
    expect(menuMapIndex(new Date(2026, 9, 8))).toBe(1);
    const week = Array.from({ length: N }, (_, i) => menuMapIndex(new Date(2026, 4, 1 + i)));
    expect([...week].sort((a, b) => a - b)).toEqual(Array.from({ length: N }, (_, i) => i));
  });
});
