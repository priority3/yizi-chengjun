// Run modes (plan.md B4). A chapter run has a fixed number of waves and ends with its boss; the endless run and the
// daily challenge have no last wave and play by chapter 10's rules until the camp falls. Pure and clock-free: the
// daily challenge's day (YYYYMMDD) comes in from the UI as the run's seed.
import { ENDLESS, ENDLESS_CHAPTER } from '../config/endless.ts';
import { MAPS, type MapDef } from '../config/maps.ts';
import { DT } from './clock.ts';
import type { GameMode, GameState } from './types.ts';

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

/**
 * Whether the monsters of the wave being fought have gone berserk (狂暴): in an endless or daily run, once the wave has
 * lasted ENDLESS.enrageAfter seconds, stuns, slows and knockback no longer hold them (see ENDLESS.enrageAfter for why;
 * game.ts step shakes off stuns and slows, effects.ts knock refuses to push). Derived from the wave clock, so it needs
 * no state of its own; chapter runs never enrage.
 */
export function enraged(g: Pick<GameState, 'mode' | 'phase' | 'waveTime'>): boolean {
  // Reason: half a tick early, so the rounding of the summed-up wave clock can't move it to the next tick.
  return isOpenEnded(g.mode) && g.phase === 'battle' && g.waveTime >= ENDLESS.enrageAfter - DT / 2;
}

/** Whether the wave turns berserk on this very tick: true on exactly one tick of a wave that lasts long enough. */
export function enragedNow(g: Pick<GameState, 'mode' | 'phase' | 'waveTime'>): boolean {
  return enraged(g) && g.waveTime < ENDLESS.enrageAfter + DT / 2;
}

/** "10月9日" for the day 20261009. */
export function dayLabel(day: number): string {
  return `${Math.floor(day / 100) % 100}月${day % 100}日`;
}
