// Effective tile stats after level and 神 modifiers. Shared by combat, board and AI.
import { DIVINE, HEAL_EVERY, LEVEL_FX, LEVEL_MUL, UNITS } from '../config/units.ts';
import type { Tile } from './types.ts';

export function tileDamage(t: Tile): number {
  const d = UNITS[t.id].dmg * LEVEL_MUL[t.level - 1];
  return t.divine ? d * DIVINE.dmg : d;
}

export function tileRange(t: Tile): number {
  const r = UNITS[t.id].range;
  return t.divine ? r + DIVINE.range : r;
}

export function tileInterval(t: Tile): number {
  // Reason: 疗 levels up by healing faster rather than harder, so its interval shrinks with level.
  const base = t.id === '疗' ? HEAL_EVERY / t.level : UNITS[t.id].interval;
  return t.divine ? base * DIVINE.interval : base;
}

/** Multiplier for effect magnitudes (slow %, stun time, splash %, haste, income...). */
export function fxScale(t: Tile): number {
  return (1 + LEVEL_FX * (t.level - 1)) * (t.divine ? DIVINE.fx : 1);
}

/** Damage per second ignoring haste; 0 for tiles that don't attack. */
export function tileDps(t: Tile): number {
  const iv = tileInterval(t);
  return iv > 0 ? tileDamage(t) / iv : 0;
}
