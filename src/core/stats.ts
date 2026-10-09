// Effective tile stats after level, 鎏金 and (optionally) the run's 法宝 modifiers. Shared by combat, board and AI.
import { DIVINE, HEAL_EVERY, LEVEL_FX, LEVEL_MUL, UNITS } from '../config/units.ts';
import { poisonDps } from './status.ts';
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

/** Poison one hit of `t` leaves behind if its stack runs its full time; 0 for tiles without poison. */
export function poisonPerHit(t: Tile, mods?: RunMods): number {
  const fx = UNITS[t.id].fx;
  return fx.t === 'poison' ? poisonDps(t.id, tileDamage(t, mods)) * fx.dur : 0;
}

/**
 * Damage per second of the hits themselves, ignoring haste (a 毒's poison comes on top of it: poisonPerHit); 0 for
 * tiles that don't attack.
 */
export function tileDps(t: Tile, mods?: RunMods): number {
  const iv = tileInterval(t);
  return iv > 0 ? tileDamage(t, mods) / iv : 0;
}
