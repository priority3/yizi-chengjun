// 镜: every MIRROR_EVERY seconds of battle a mirror throws the camp damage it caught since its last pulse back at every
// monster on the field. The charge comes from leaks (chargeMirrors in core/status.ts); combat.ts times the pulses.
import { UNITS } from '../config/units.ts';
import { damage } from './effects.ts';
import { runWaveHp } from './waves.ts';
import type { GameState, Tile } from './types.ts';

/**
 * HP of a 小妖 of the wave being fought (or the next one, in the build phase) on this map: the yardstick of the
 * reflection.
 * Reason: a leak costs the camp the same few points in chapter 1 and in endless wave 30, while monster HP grows a
 * hundredfold and more; measured in a 小妖's HP, a mirror hits as hard against its wave everywhere.
 */
export function minionHp(g: GameState): number {
  return runWaveHp(g, '妖', Math.max(1, g.wave)) * g.map.hpScale;
}

/** Damage a 镜 like `t` sends at every monster for each point of camp damage it caught (0 for any other tile). */
export function mirrorRate(g: GameState, t: Pick<Tile, 'id' | 'level'>): number {
  const fx = UNITS[t.id].fx;
  return fx.t === 'mirror' ? fx.k * t.level * minionHp(g) : 0;
}

/**
 * One pulse of the 镜 `t` on `cell`: the camp damage it caught times mirrorRate hits every living monster, flyers
 * included, and the charge starts over. With nobody on the field it keeps the charge for its next pulse.
 */
export function pulseMirror(g: GameState, t: Tile, cell: number): void {
  const charge = t.charge ?? 0;
  if (charge <= 0) return;
  const hit = g.enemies.filter((e) => e.hp > 0 && !e.gone);
  if (hit.length === 0) return;
  const dmg = charge * mirrorRate(g, t);
  t.charge = 0;
  const camp = g.map.camp;
  g.events.push({ t: 'mirror', cell, x: camp.x, y: camp.y, dmg, targets: hit.map((e) => ({ uid: e.uid, x: e.x, y: e.y })) });
  for (const e of hit) damage(g, e, dmg, t.id);
}
