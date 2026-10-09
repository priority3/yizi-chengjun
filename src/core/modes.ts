// Run modes (plan.md B4). A chapter run has a fixed number of waves and ends with its boss; the endless run and the
// daily challenge have no last wave and play by chapter 10's rules until the camp falls. Pure and clock-free: the
// daily challenge's day (YYYYMMDD) comes in from the UI as the run's seed.
import { ENDLESS_CHAPTER } from '../config/endless.ts';
import { MAPS, type MapDef } from '../config/maps.ts';
import type { GameMode } from './types.ts';

/** Every run mode (save validation). */
export const MODES: readonly GameMode[] = ['chapter', 'endless', 'daily'];

/**
 * `totalWaves` of a run without a last wave.
 * Reason: 0 rather than Infinity, which JSON turns into null, so a saved endless run comes back exactly as it was.
 */
export const UNLIMITED = 0;

/** Whether runs of `mode` go on until the camp falls (endless, daily) instead of ending with a chapter's boss. */
export function isOpenEnded(mode: GameMode): boolean {
  return mode !== 'chapter';
}

/** Index into MAPS of the daily challenge of `day` (YYYYMMDD): the ten maps take turns by the day's last digit. */
export function dailyMapIndex(day: number): number {
  // Reason: truncated and wrapped, so any finite seed names a map (a negative remainder would index nothing).
  return ((Math.trunc(day) % MAPS.length) + MAPS.length) % MAPS.length;
}

/** The layout a run plays on: its chapter's map, chapter 10's for endless, the day's map for the daily challenge. */
export function modeMap(mode: GameMode, chapter: number, seed: number): MapDef {
  if (mode === 'daily') return MAPS[dailyMapIndex(seed)];
  return MAPS[(mode === 'endless' ? ENDLESS_CHAPTER : chapter) - 1];
}

/** "10月9日" for the day 20261009. */
export function dayLabel(day: number): string {
  return `${Math.floor(day / 100) % 100}月${day % 100}日`;
}
