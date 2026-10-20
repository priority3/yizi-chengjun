// Special build pads (特殊石台): what the pad under a tile adds to it, and who may stand on it.
// A 法阵 multiplies a fighter's damage, a 高台 extends its reach, a 泥沼 can't hold fighters at all; a 聚宝台 pays for
// the monsters its card finishes off, a lit 烽火台 makes the monsters around it take more from every hit, a pair of
// 双生台 holding the same fighter makes both faster, and a 灵泉 lets a card soak up layers of damage wave after wave.
// Combat, ultimates, the bot, the range ring and the card description all read tile stats through these.
import { BEACON, COFFER_BOUNTY, SLOT_BONUS, SPRING, TWIN_HASTE, type SlotKind } from '../config/maps.ts';
import { ENEMIES } from '../config/enemies.ts';
import { UNITS } from '../config/units.ts';
import { drumMul } from './buffs.ts';
import { tileDamage, tileRange } from './stats.ts';
import type { Enemy, GameState, RunMods, Tile, UnitId } from './types.ts';

/** Attack and hero cards: the tiles that fight, which pad bonuses apply to and a 泥沼 refuses. */
export function isFighter(id: UnitId): boolean {
  const k = UNITS[id].kind;
  return k === 'attack' || k === 'hero';
}

/** Whether a tile of `id` may stand on a pad of `kind`. */
export function padAllows(kind: SlotKind, id: UnitId): boolean {
  return SLOT_BONUS[kind].fighters || !isFighter(id);
}

/** Kind of the pad at `cell` ('plain' outside the map's slots). */
export function slotKindOf(g: GameState, cell: number): SlotKind {
  return g.map.slotKind[cell] ?? 'plain';
}

/** Damage multiplier of the 灵泉 layers `t` has soaked up: 1 without any. */
export function springMul(t: Pick<Tile, 'spring'>): number {
  return 1 + SPRING.dmg * (t.spring ?? 0);
}

/** Damage per hit of `t` standing on a pad of `kind` (a 法阵 boosts fighters, and so do a 灵泉's layers). */
export function padDamage(t: Tile, kind: SlotKind, mods?: RunMods): number {
  const d = tileDamage(t, mods);
  if (!isFighter(t.id)) return d;
  return d * SLOT_BONUS[kind].dmgMul * (kind === 'spring' ? springMul(t) : 1);
}

/** Attack range of `t` standing on a pad of `kind` (a 高台 adds reach; 白龙's whole field stays whole). */
export function padRange(t: Tile, kind: SlotKind, mods?: RunMods): number {
  const r = tileRange(t, mods);
  return isFighter(t.id) ? r + SLOT_BONUS[kind].range : r;
}

/**
 * tileDamage of `t` with the 法阵 bonus or 灵泉 layers of the pad it stands on and the 鼓 beating next to it (they
 * multiply), run 法宝 included.
 */
export function slotDamage(g: GameState, t: Tile, cell: number): number {
  const d = padDamage(t, slotKindOf(g, cell), g.mods);
  return isFighter(t.id) ? d * drumMul(g, cell) : d;
}

/** tileRange of `t` with the 高台 bonus of the pad it stands on, run 法宝 included. */
export function slotRange(g: GameState, t: Tile, cell: number): number {
  return padRange(t, slotKindOf(g, cell), g.mods);
}

/** Attack-speed bonus of the fighter on the 双生台 `cell`: TWIN_HASTE while the same fighter stands on its pair, else 0. */
export function twinHaste(g: GameState, cell: number): number {
  const pair = g.map.twin[cell] ?? -1;
  if (pair < 0) return 0;
  const a = g.slots[cell];
  const b = g.slots[pair];
  return a && b && a.id === b.id && isFighter(a.id) ? TWIN_HASTE : 0;
}

/** Whether the 烽火台 on `cell` is lit: some card stands on it. */
export function beaconLit(g: GameState, cell: number): boolean {
  return Boolean(g.slots[cell]);
}

/**
 * How much harder every hit on `e` lands: 1 + BEACON.amp within reach of a lit 烽火台, else 1. Two beacons over the
 * same monster don't add up.
 */
export function beaconMul(g: GameState, e: Pick<Enemy, 'x' | 'y'>): number {
  const r2 = BEACON.range * BEACON.range;
  for (const cell of g.map.beacons) {
    if (!beaconLit(g, cell)) continue;
    const p = g.map.slots[cell];
    if ((e.x - p.x) * (e.x - p.x) + (e.y - p.y) * (e.y - p.y) <= r2) return 1 + BEACON.amp;
  }
  return 1;
}

/** Extra 铜钱 the fallen `e` brings in: the 聚宝台's bounty when the card that hit it last stands on one, else 0. */
export function cofferBonus(g: GameState, e: Pick<Enemy, 'def' | 'hitBy'>): number {
  const cell = e.hitBy;
  if (cell < 0 || slotKindOf(g, cell) !== 'coffer' || !g.slots[cell]) return 0;
  return ENEMIES[e.def].boss ? COFFER_BOUNTY.boss : COFFER_BOUNTY.minion;
}

/** A wave was cleared: every card on a 灵泉 soaks up one more layer, up to SPRING.max. */
export function soakSprings(g: GameState): void {
  g.map.slotKind.forEach((kind, cell) => {
    const t = g.slots[cell];
    if (kind !== 'spring' || !t || (t.spring ?? 0) >= SPRING.max) return;
    t.spring = (t.spring ?? 0) + 1;
    g.events.push({ t: 'spring', cell, layers: t.spring });
  });
}
