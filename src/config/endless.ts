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
   * Reason: 0.3 makes wave 5, the first boss, about as tough as chapter 10's first wave (1.8), so the first waves are
   * a warm-up. Past that, where the bot falls hardly depends on it: from about wave 12 its board is maxed out (level 5)
   * and the growth wins within a few waves. On `pnpm sim --endless 80`, 0.3 puts 96 % of the runs at waves 12-25
   * (median 15) and 0.4 85 % (median 14), while 0.9 left a third dead before wave 12 and chapter 10's own 1.8 most of
   * them by wave 5.
   */
  hpStart: 0.3,
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
