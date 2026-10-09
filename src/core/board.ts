// Tile combination rules and drag-and-drop between camp cells (merge, awaken, 神, move, swap, sell), which pads
// a tile may stand on (a 泥沼 refuses fighters), and each fighter's target priority (瞄准).
import { heroFor } from '../config/combos.ts';
import { SELL_REFUND } from '../config/chapters.ts';
import type { SlotKind } from '../config/maps.ts';
import { MAX_LEVEL, UNITS } from '../config/units.ts';
import { isFighter, padAllows, slotKindOf } from './slots.ts';
import { tileInterval } from './stats.ts';
import type { ActionResult, GameState, TargetMode, Tile, UnitId } from './types.ts';

/** Why a drop or purchase was refused when it would leave a fighter standing in a 泥沼. */
export const MIRE_MSG = '泥沼上放不了兵字和英雄';

/** Whether a tile of `id` may stand on pad `cell`: fighters (attack and hero cards) can't stand in a 泥沼. */
export function canPlace(g: GameState, cell: number, id: UnitId): boolean {
  return padAllows(slotKindOf(g, cell), id);
}

/** Same-id, same-level tiles can merge — except fragments and 神, which only combine by recipe. */
export function isStackable(id: UnitId): boolean {
  const k = UNITS[id].kind;
  return k !== 'fragment' && k !== 'divine';
}

export function canBeDivine(t: Tile): boolean {
  const k = UNITS[t.id].kind;
  return (k === 'attack' || k === 'hero') && !t.divine;
}

export function makeTile(g: GameState, id: UnitId, invested: number): Tile {
  const t: Tile = { uid: g.nextUid++, id, level: 1, divine: false, cd: 0, invested, rage: 0 };
  // Reason: attackers may fire at once, but pulsing supports (钱/疗) must wait a full cycle so they can't be spammed.
  if (UNITS[id].kind === 'support') t.cd = tileInterval(t);
  return t;
}

function invalid(g: GameState, cell: number, msg: string): ActionResult {
  g.events.push({ t: 'invalid', cell, msg });
  return 'invalid';
}

/**
 * Combines tile `a` (dragged from `from`, or bought from the shop when `from` is -1) into the tile at `to`.
 * Returns null when the two simply don't combine, so the caller can swap (board) or refuse (shop).
 */
export function combineInto(g: GameState, a: Tile, to: number, from: number): ActionResult | null {
  const b = g.slots[to];
  if (!b) return null;
  if (a.id === b.id && a.level === b.level && isStackable(a.id)) {
    if (b.level >= MAX_LEVEL) return invalid(g, to, '已经满级啦');
    b.level++;
    b.divine = b.divine || a.divine;
    b.invested += a.invested;
    b.rage = Math.max(a.rage, b.rage);
    g.events.push({ t: 'merge', cell: to, level: b.level });
    return 'merge';
  }
  const hero = heroFor(a.id, b.id);
  if (hero) {
    // Reason: the hero is born on `to`, so that pad must hold a fighter — buying 空 onto 悟 in a 泥沼 is refused.
    if (!canPlace(g, to, hero)) return invalid(g, to, MIRE_MSG);
    g.slots[to] = makeTile(g, hero, a.invested + b.invested);
    g.events.push({ t: 'hero', cell: to, unit: hero, from });
    return 'hero';
  }
  if (a.id === '神' || b.id === '神') {
    const god = a.id === '神' ? a : b;
    const target = god === a ? b : a;
    if (target.id === '神') return invalid(g, to, '两个神字不能叠加');
    if (target.divine) return invalid(g, to, '它已经是神了');
    if (!canBeDivine(target)) return invalid(g, to, '神只能附在兵字或英雄上');
    // The 神X ends up on `to`: a fighter dropped onto a 神 waiting in a 泥沼 can't follow it in.
    if (!canPlace(g, to, target.id)) return invalid(g, to, MIRE_MSG);
    target.divine = true;
    target.invested += god.invested;
    g.slots[to] = target;
    g.events.push({ t: 'divine', cell: to });
    return 'divine';
  }
  if (a.id === b.id && UNITS[a.id].kind === 'fragment') return invalid(g, to, '碎片要和另一半组合');
  return null;
}

export type DropPreview = 'empty' | 'merge' | 'hero' | 'divine' | 'swap' | 'invalid';

/**
 * What dropping a card (id/level/divine) onto tile `b` would do — the same rules as combineInto and resolveDrop,
 * without side effects. `pad` is the kind of the target pad and `from` the kind of the pad the card is dragged
 * from (null for a shop card); whatever would leave a fighter in a 泥沼 is 'invalid'.
 */
export function previewDrop(
  a: Pick<Tile, 'id' | 'level' | 'divine'>,
  b: Tile | null,
  pad: SlotKind = 'plain',
  from: SlotKind | null = null,
): DropPreview {
  if (!b) return padAllows(pad, a.id) ? 'empty' : 'invalid';
  if (a.id === b.id && a.level === b.level && isStackable(a.id)) return b.level >= MAX_LEVEL ? 'invalid' : 'merge';
  const hero = heroFor(a.id, b.id);
  if (hero) return padAllows(pad, hero) ? 'hero' : 'invalid';
  if (a.id === '神' || b.id === '神') {
    const target = a.id === '神' ? b : { ...a, uid: 0, cd: 0, invested: 0, rage: 0 };
    if (target.id === '神' || target.divine || !canBeDivine(target) || !padAllows(pad, target.id)) return 'invalid';
    return 'divine';
  }
  if (a.id === b.id && UNITS[a.id].kind === 'fragment') return 'invalid';
  // A swap sends `b` back to the pad the card came from.
  if (!padAllows(pad, a.id) || (from !== null && !padAllows(from, b.id))) return 'invalid';
  return 'swap';
}

/**
 * Drags the tile in `from` onto cell `to` (or the trash for 'sell').
 * Priority: merge / awaken / 神 > move into an empty cell > swap. Results land in `to`.
 */
export function resolveDrop(g: GameState, from: number, to: number | 'sell'): ActionResult {
  const a = g.slots[from];
  if (!a || from === to) return 'none';
  if (to === 'sell') {
    const amount = Math.floor(a.invested * SELL_REFUND);
    g.gongde += amount;
    g.slots[from] = null;
    g.events.push({ t: 'sell', cell: from, amount });
    return 'sold';
  }
  if (!g.unlocked[to]) return 'locked';
  const b = g.slots[to];
  if (!b) {
    if (!canPlace(g, to, a.id)) return invalid(g, to, MIRE_MSG);
    g.slots[to] = a;
    g.slots[from] = null;
    return 'move';
  }
  const combined = combineInto(g, a, to, from);
  if (combined === 'merge' || combined === 'hero' || combined === 'divine') {
    g.slots[from] = null;
    return combined;
  }
  if (combined) return combined;
  // A swap puts each tile on the other's pad: neither may land a fighter in a 泥沼.
  if (!canPlace(g, to, a.id)) return invalid(g, to, MIRE_MSG);
  if (!canPlace(g, from, b.id)) return invalid(g, from, MIRE_MSG);
  g.slots[to] = a;
  g.slots[from] = b;
  return 'swap';
}

/** The order a fighter's target priority cycles through; the first one is the default. */
export const TARGET_MODES: readonly TargetMode[] = ['first', 'strong', 'weak'];

/**
 * Switches the fighter on `cell` to its next target priority (first -> strong -> weak -> first). Allowed in the
 * build and the battle phase alike; supports, fragments and 神 never aim, so they are refused.
 */
export function cycleTarget(g: GameState, cell: number): ActionResult {
  const t = g.slots[cell];
  if (!t) return 'none';
  if (!isFighter(t.id)) return invalid(g, cell, '只有兵字和英雄能切换瞄准');
  const mode = TARGET_MODES[(TARGET_MODES.indexOf(t.target ?? 'first') + 1) % TARGET_MODES.length];
  t.target = mode;
  g.events.push({ t: 'mode', cell, mode });
  return 'ok';
}
