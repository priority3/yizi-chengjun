// What the B5 cards leave behind on the field: 毒's poison stacks and 网's net on a monster, and the leak damage a 镜
// has caught for its next pulse. Plain numbers on Enemy and Tile, ticked by monsters.ts, so runs stay JSON-safe and
// replay exactly. Nothing here imports the rest of the simulation (monsters.ts calls in, never the other way round).
import { ROOT_GUARD, UNITS } from '../config/units.ts';
import { DT } from './clock.ts';
import type { Enemy, GameState, UnitId } from './types.ts';

/**
 * Poison per stack per second that a hit of `dmg` from `unit` leaves (0 for units without poison).
 * Reason: scaled by the hit itself, so level, 鎏金, 法宝, a 法阵 and 鼓 raise the poison exactly as they raise the needle.
 */
export function poisonDps(unit: UnitId, dmg: number): number {
  const def = UNITS[unit];
  return def.fx.t === 'poison' && def.dmg > 0 ? (dmg * def.fx.dps) / def.dmg : 0;
}

/**
 * A poisoned needle of `unit` landed for `dmg`: one more stack (up to the unit's max), every stack's timer back to full,
 * and the strongest needle so far sets the damage of each stack. Bosses get no discount.
 */
export function applyPoison(e: Enemy, unit: UnitId, dmg: number): void {
  const fx = UNITS[unit].fx;
  if (fx.t !== 'poison' || e.hp <= 0) return;
  const dps = poisonDps(unit, dmg);
  const p = e.poison;
  if (p) {
    p.stacks = Math.min(fx.max, p.stacks + 1);
    p.t = fx.dur;
    p.dps = Math.max(p.dps, dps);
  } else {
    e.poison = { stacks: 1, t: fx.dur, dps };
  }
}

/**
 * One tick of poison on `e`. It bites straight into HP: no armour, no hit event every tick (the renderer draws the
 * bubbles from `e.poison`), and a monster it kills is credited by removeDead like any other kill, bounty included.
 */
export function tickPoison(e: Enemy): void {
  const p = e.poison;
  if (!p) return;
  e.hp -= p.stacks * p.dps * DT;
  p.t -= DT;
  if (p.t <= DT / 2) e.poison = null;
}

/** Whether `e` is caught in a net right now: held in place, though everything can still hit it. */
export function isRooted(e: Enemy): boolean {
  // Reason: half a tick of slack, so the summed-up timer can't hold a monster one tick longer than it should.
  return e.rootT > ROOT_GUARD + DT / 2;
}

/** Whether a net could catch `e`: it is neither caught nor still shaking off the last net. */
export function canRoot(e: Enemy): boolean {
  return e.rootT <= 0;
}

/**
 * A net lands on `e`: it is held for `dur` seconds, bosses as long as anyone (unlike a stun). Nothing happens while it
 * is caught or still shaking off the last one (see ROOT_GUARD).
 */
export function applyRoot(e: Enemy, dur: number): void {
  if (!canRoot(e) || dur <= 0) return;
  e.rootT = dur + ROOT_GUARD;
}

/** Counts the net on `e` down by one tick; returns whether it held `e` in place during this tick. */
export function tickRoot(e: Enemy): boolean {
  if (e.rootT <= 0) return false;
  const held = isRooted(e);
  // Reason: snapped to 0 at the last tick, so float drift never keeps a net off for one tick too many.
  e.rootT = e.rootT > DT * 1.5 ? e.rootT - DT : 0;
  return held;
}

/** A leak hurt the camp by `dmg`: every 镜 on the board catches it for its next pulse, up to what a mirror can hold. */
export function chargeMirrors(g: GameState, dmg: number): void {
  if (dmg <= 0) return;
  for (const t of g.slots) {
    const fx = t ? UNITS[t.id].fx : null;
    if (t && fx?.t === 'mirror') t.charge = Math.min(fx.cap, (t.charge ?? 0) + dmg);
  }
}
