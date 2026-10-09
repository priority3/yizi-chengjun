// Endless mode and the daily challenge (plan.md B4): open-ended runs without a last wave that play by chapter 10's
// rules (economy, HP growth, air raids) until the camp falls. Their balance lives here; check it with
// `pnpm sim --endless` (the bot should usually fall somewhere between wave 12 and 25).
import { CHAPTERS } from './chapters.ts';

/** The chapter whose rules the open-ended runs play by (and whose map endless uses): the last one. */
export const ENDLESS_CHAPTER = CHAPTERS.length;

export const ENDLESS = {
  /** Every `bossEvery`-th wave ends with one of the ten chapter bosses, picked at random, at full HP. */
  bossEvery: 5,
  /** The elite 魔将 ends the wave this many waves after each boss wave ("every 5th wave, offset by 2"): 7, 12, 17, ... */
  eliteAfter: 2,
  /**
   * Monster HP multiplier of wave 1; every later wave multiplies it by chapter 10's hpGrowth, with no end.
   * Reason: low enough that the first waves are a warm-up (wave 5, the first boss, is about as tough as chapter 10's
   * first wave), not so low that they bore. Past that, where the bot falls hardly depends on it: from about wave 12 its
   * board is maxed out (level 5) and the growth wins within a few waves. v0.7 measured 0.3 at 96 % of the runs within
   * waves 12-25 (median 15); with the v0.8 cards (more card kinds spread the bot's merges) and chapter 10's map at hp
   * 1.75, `pnpm sim --endless 80` gives 0.3 → 80 % (mean 13.7), 0.25 → 89 % (mean 14.1), 0.2 → 92 % (mean 14.3).
   * 0.9 left a third dead before wave 12 and chapter 10's own 1.8 most of them by wave 5.
   */
  hpStart: 0.25,
  /** 灵石 for every wave survived, paid all at once when the run ends. */
  stonesPerWave: 2,
  /**
   * Seconds into a wave after which its monsters go berserk (狂暴): stuns, slows and knockback no longer hold them.
   * Reason: their HP keeps growing while the board can't, so a crowd held by 八戒's slams or a row of 棍 could neither
   * die nor walk on — bot waves stalled for up to 47 minutes. Normal waves end well before: half within 42 s, 90 %
   * within 100 s; only a boss slowed the whole length of the longest roads (火云洞, 火焰山) needs about 190 s.
   */
  enrageAfter: 150,
} as const;

/** `pnpm sim --endless` stops a run once it has survived this many waves. */
export const MAX_SIM_WAVES = 200;
