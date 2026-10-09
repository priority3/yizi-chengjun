// Endless mode and the daily challenge (plan.md B4): open-ended runs without a last wave that play by chapter 10's
// rules (economy, HP growth, air raids) until the camp falls. Their balance lives here; check it with
// `pnpm sim --endless` (the bot should usually fall somewhere between wave 12 and 25).
import { CHAPTERS } from './chapters.ts';

/** The chapter whose rules the open-ended runs play by (and whose map endless uses): the last one. */
export const ENDLESS_CHAPTER = CHAPTERS.length;

export const ENDLESS = {
  /** Every `bossEvery`-th wave ends with one of the ten chapter bosses, picked at random, at full HP. */
  bossEvery: 5,
  /** The elite 魔将 ends the wave this many waves before each boss wave: waves 3, 8, 13, ... */
  eliteBefore: 2,
  /**
   * Monster HP multiplier of wave 1; every later wave multiplies it by chapter 10's hpGrowth, with no end.
   * Reason: 0.3 makes wave 5, the first boss, about as tough as chapter 10's first wave (1.8), so the first waves are
   * a warm-up. Where the bot falls hardly depends on it: from about wave 12 its board is maxed out (level 5) and the
   * growth wins within a few waves; 0.3-0.4 all put ~95 % of `pnpm sim --endless 80` runs at waves 12-25 (median 15),
   * while 0.9 left a third of them dead before wave 12 and chapter 10's own 1.8 most of them by wave 5.
   */
  hpStart: 0.3,
  /** 灵石 for every wave survived, paid all at once when the run ends. */
  stonesPerWave: 2,
} as const;

/** `pnpm sim --endless` stops a run once it has survived this many waves. */
export const MAX_SIM_WAVES = 200;
