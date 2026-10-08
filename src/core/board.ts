// Tile combination rules and drag-and-drop between camp cells (merge, awaken, 神, move, swap, sell).
import { heroFor } from '../config/combos.ts';
import { SELL_REFUND } from '../config/chapters.ts';
import { MAX_LEVEL, UNITS } from '../config/units.ts';
import { tileInterval } from './stats.ts';
import type { ActionResult, GameState, Tile, UnitId } from './types.ts';

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

/** What dropping a card (id/level/divine) onto tile `b` would do — the same rules as combineInto, without side effects. */
export function previewDrop(a: Pick<Tile, 'id' | 'level' | 'divine'>, b: Tile | null): DropPreview {
  if (!b) return 'empty';
  if (a.id === b.id && a.level === b.level && isStackable(a.id)) return b.level >= MAX_LEVEL ? 'invalid' : 'merge';
  if (heroFor(a.id, b.id)) return 'hero';
  if (a.id === '神' || b.id === '神') {
    const target = a.id === '神' ? b : { ...a, uid: 0, cd: 0, invested: 0, rage: 0 };
    if (target.id === '神' || target.divine || !canBeDivine(target)) return 'invalid';
    return 'divine';
  }
  if (a.id === b.id && UNITS[a.id].kind === 'fragment') return 'invalid';
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
  g.slots[to] = a;
  g.slots[from] = b;
  return 'swap';
}
