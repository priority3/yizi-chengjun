// Effective tile stats after level, 神 and (optionally) the run's 法宝 modifiers. Shared by combat, board and AI.
import { DIVINE, HEAL_EVERY, LEVEL_FX, LEVEL_MUL, UNITS } from '../config/units.ts';
import type { RunMods, Tile } from './types.ts';

export function tileDamage(t: Tile, mods?: RunMods): number {
  let d = UNITS[t.id].dmg * LEVEL_MUL[t.level - 1];
  if (t.divine) d *= DIVINE.dmg;
  if (mods) d *= mods.dmgMul * (mods.unitDmgMul[t.id] ?? 1);
  return d;
}

export function tileRange(t: Tile, mods?: RunMods): number {
  const r = UNITS[t.id].range + (t.divine ? DIVINE.range : 0);
  return mods ? r * (mods.unitRangeMul[t.id] ?? 1) : r;
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
export function tileDps(t: Tile, mods?: RunMods): number {
  const iv = tileInterval(t);
  return iv > 0 ? tileDamage(t, mods) / iv : 0;
}
