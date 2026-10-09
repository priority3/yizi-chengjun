// What a support pad gives the pads within its reach (map.adj, SUPPORT_RANGE): 速 makes them attack faster, 鼓 makes
// them hit harder and faster. computeBuffs covers the whole board for one combat step; drumMul is one cell, and every
// damage number goes through it via slotDamage (attacks, projectiles, ultimates, the bot, card descriptions).
import { DIVINE, DRUM_DMG_CAP, HASTE_CAP, UNITS } from '../config/units.ts';
import type { GameState, Tile } from './types.ts';

export interface Buffs {
  /** Attack-speed bonus per slot from 速 and 鼓 together (0.2 = 20 % faster), at most HASTE_CAP. */
  haste: Float64Array;
  /** Damage multiplier per slot from 鼓 (1 = none), at most 1 + DRUM_DMG_CAP. */
  dmg: Float64Array;
}

// Reason: reused every step to avoid per-frame allocation; resized when a map has a different slot count.
const buffs: Buffs = { haste: new Float64Array(0), dmg: new Float64Array(0) };

/** 鎏金 multiplies a support's effect like any other (supports can't be gilded today, so this is 1). */
const divineFx = (t: Tile): number => (t.divine ? DIVINE.fx : 1);

/** Attack-speed bonus `t` gives every slot within its reach, before the cap: 速 and 鼓 add up. */
function speedFrom(t: Tile): number {
  const fx = UNITS[t.id].fx;
  if (fx.t === 'haste') return fx.pct * t.level * divineFx(t);
  if (fx.t === 'drum') return fx.speed * t.level * divineFx(t);
  return 0;
}

/** Extra damage (0.15 = +15 %) the 鼓 within reach of `cell` give a fighter standing on it, at most DRUM_DMG_CAP. */
export function drumBonus(g: GameState, cell: number): number {
  let sum = 0;
  for (const j of g.map.adj[cell] ?? []) {
    const t = g.slots[j];
    if (!t) continue;
    const fx = UNITS[t.id].fx;
    if (fx.t === 'drum') sum += fx.dmg * t.level * divineFx(t);
  }
  return Math.min(DRUM_DMG_CAP, sum);
}

/** Damage multiplier the 鼓 around `cell` give a fighter on it: 1 without any. */
export function drumMul(g: GameState, cell: number): number {
  return 1 + drumBonus(g, cell);
}

/** Every slot's buffs from the 速 and 鼓 around it (a shared buffer: read it before the next call). */
export function computeBuffs(g: GameState): Buffs {
  const n = g.slots.length;
  if (buffs.haste.length !== n) {
    buffs.haste = new Float64Array(n);
    buffs.dmg = new Float64Array(n);
  }
  buffs.haste.fill(0);
  for (let i = 0; i < n; i++) {
    const t = g.slots[i];
    const bonus = t ? speedFrom(t) : 0;
    if (bonus > 0) for (const j of g.map.adj[i]) buffs.haste[j] += bonus;
  }
  for (let i = 0; i < n; i++) {
    buffs.haste[i] = Math.min(HASTE_CAP, buffs.haste[i]);
    buffs.dmg[i] = drumMul(g, i);
  }
  return buffs;
}
