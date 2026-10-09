// Special build pads (特殊石台): what the pad under a tile adds to it, and who may stand on it.
// A 法阵 multiplies a fighter's damage, a 高台 extends its reach, a 泥沼 can't hold fighters at all.
// Combat, ultimates, the bot, the range ring and the card description all read tile stats through these.
import { SLOT_BONUS, type SlotKind } from '../config/maps.ts';
import { UNITS } from '../config/units.ts';
import { tileDamage, tileRange } from './stats.ts';
import type { GameState, RunMods, Tile, UnitId } from './types.ts';

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

/** Damage per hit of `t` standing on a pad of `kind` (a 法阵 boosts fighters). */
export function padDamage(t: Tile, kind: SlotKind, mods?: RunMods): number {
  const d = tileDamage(t, mods);
  return isFighter(t.id) ? d * SLOT_BONUS[kind].dmgMul : d;
}

/** Attack range of `t` standing on a pad of `kind` (a 高台 adds reach; 白龙's whole field stays whole). */
export function padRange(t: Tile, kind: SlotKind, mods?: RunMods): number {
  const r = tileRange(t, mods);
  return isFighter(t.id) ? r + SLOT_BONUS[kind].range : r;
}

/** tileDamage of `t` with the 法阵 bonus of the pad it stands on, run 法宝 included. */
export function slotDamage(g: GameState, t: Tile, cell: number): number {
  return padDamage(t, slotKindOf(g, cell), g.mods);
}

/** tileRange of `t` with the 高台 bonus of the pad it stands on, run 法宝 included. */
export function slotRange(g: GameState, t: Tile, cell: number): number {
  return padRange(t, slotKindOf(g, cell), g.mods);
}
