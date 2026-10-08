// Damage and status primitives shared by normal attacks and hero ultimates.
import { ENEMIES } from '../config/enemies.ts';
import { SLOW_CAP } from '../config/units.ts';
import { pathPoint } from './map.ts';
import type { Enemy, GameState, UnitId } from './types.ts';

export function damage(g: GameState, e: Enemy, amount: number, unit: UnitId): void {
  const tr = ENEMIES[e.def].trait;
  const dealt = tr?.t === 'armor' ? Math.max(1, amount - tr.flat) : amount;
  e.hp -= dealt;
  g.events.push({ t: 'hit', uid: e.uid, x: e.x, y: e.y, unit, dmg: dealt });
}

/** Pushes an enemy back along its road. Bosses are too heavy to move; elites move half as far. */
export function knock(g: GameState, e: Enemy, px: number): void {
  if (px <= 0 || ENEMIES[e.def].boss) return;
  const push = ENEMIES[e.def].elite ? px / 2 : px;
  e.dist = Math.max(0, e.dist - push);
  const p = pathPoint(g.map.paths[e.path], e.dist, e.side);
  e.x = p.x;
  e.y = p.y;
}

export function applySlow(e: Enemy, pct: number, dur: number): void {
  if (ENEMIES[e.def].trait?.t === 'immune') return;
  // Reason: the strongest slow wins and the duration refreshes, so stacking many 冰 never freezes a boss solid.
  e.slowPct = Math.max(e.slowPct, Math.min(SLOW_CAP, pct));
  e.slowT = Math.max(e.slowT, dur);
}

export function applyStun(e: Enemy, dur: number): void {
  const d = ENEMIES[e.def].boss ? dur * 0.5 : dur;
  e.stunT = Math.max(e.stunT, d);
}

export function dist2(e: Enemy, x: number, y: number): number {
  const dx = e.x - x;
  const dy = e.y - y;
  return dx * dx + dy * dy;
}
