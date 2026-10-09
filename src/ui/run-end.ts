// What a finished run earns, booked into the progress save (kept apart from the scene so game-scene.ts stays small):
// a cleared chapter unlocks the next one and pays its rewards and stars, an ended endless or daily run pays for the
// waves it survived and may set a record, and the map editor's 试玩 books nothing at all.
import { CHAPTERS } from '../config/chapters.ts';
import { awardStars, starRating, type StarAward } from '../core/rating.ts';
import { settleEndless, type EndlessAward } from '../core/records.ts';
import { clearRewards, type ClearRewards } from '../core/treasures.ts';
import type { GameState } from '../core/types.ts';
import type { Progress } from '../platform/web.ts';

/** What the result panel shows, and whether the progress save changed (then the caller writes it). */
export interface RunEnd {
  /** Rewards banked for a chapter clear. */
  rewards: ClearRewards | null;
  /** Stars of a won chapter run (and its three-star bonus). */
  award: StarAward | null;
  /** What an ended endless or daily run earned. */
  endless: EndlessAward | null;
  changed: boolean;
}

/**
 * Books the end of run `g` (played as `chapter`) into `p`. `test` marks the map editor's 试玩, on a map no chapter has:
 * it changes nothing, and a win only shows the stars it would have earned.
 */
export function settleRun(p: Progress, g: GameState, chapter: number, test: boolean): RunEnd {
  const none: RunEnd = { rewards: null, award: null, endless: null, changed: false };
  if (test) {
    const stars = starRating(g.campHp, g.campMax);
    return g.phase === 'won' ? { ...none, award: { stars, best: stars, bonus: 0 } } : none;
  }
  if (g.mode !== 'chapter') {
    // An endless or daily run always ends with the camp falling: it pays its 灵石 and may set a record.
    return { ...none, endless: settleEndless(p, p.vault, g), changed: true };
  }
  if (g.phase !== 'won') return none;
  p.tutorialDone = true;
  const firstClear = (p.wins[chapter - 1] ?? 0) === 0;
  p.unlocked = Math.max(p.unlocked, Math.min(CHAPTERS.length, chapter + 1));
  p.wins[chapter - 1] = (p.wins[chapter - 1] ?? 0) + 1;
  const rewards = clearRewards(p.vault, chapter, firstClear);
  return { rewards, award: awardStars(p, p.vault, chapter, starRating(g.campHp, g.campMax)), endless: null, changed: true };
}
