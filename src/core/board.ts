// Board geometry (road, slots, neighbours) plus the board actions: 化缘 draws, drag-drop and 卖出.
import { heroFor, partnerOf } from '../config/combos.ts';
import { recruitCost, SELL_REFUND } from '../config/levels.ts';
import { DIVINE_LOCK_DRAWS, DRAW_WEIGHTS, FRAG_PARTNER_CHANCE, FRAGMENTS, MAX_LEVEL, UNITS } from '../config/units.ts';
import { pickWeighted, rand } from './rng.ts';
import { tileInterval } from './stats.ts';
import type { DropResult, FragId, MatchState, RecruitResult, SideId, SideState, Tile, UnitId } from './types.ts';

export interface Pt {
  x: number;
  y: number;
}

export const COLS = 7;
export const ROWS = 5;

/** Road cells as [row, col] in walking order; row 0 touches the centre bar (妖洞). */
export const ROAD_CELLS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [2, 5], [3, 5], [3, 4], [3, 3], [3, 2], [3, 1], [4, 1],
];

/** Road polyline through cell centres as [x, y] in cell units (x = col + 0.5, y = row + 0.5). */
export const PATH_POINTS: ReadonlyArray<readonly [number, number]> = [
  [1.5, 0], [1.5, 1.5], [5.5, 1.5], [5.5, 3.5], [1.5, 3.5], [1.5, 5],
];

const SEG_START: number[] = [];
const SEG_LEN: number[] = [];
let pathTotal = 0;
for (let i = 0; i < PATH_POINTS.length - 1; i++) {
  const [x0, y0] = PATH_POINTS[i];
  const [x1, y1] = PATH_POINTS[i + 1];
  // Reason: every segment is axis-aligned, so |dx| + |dy| is its exact length.
  const len = Math.abs(x1 - x0) + Math.abs(y1 - y0);
  SEG_START.push(pathTotal);
  SEG_LEN.push(len);
  pathTotal += len;
}
/** Total road length in cells (13). */
export const PATH_LEN = pathTotal;

/** Writes the board position `dist` cells along the road into `out`. */
export function posAt(dist: number, out: Pt): Pt {
  const d = dist <= 0 ? 0 : dist >= PATH_LEN ? PATH_LEN : dist;
  let i = SEG_START.length - 1;
  while (i > 0 && SEG_START[i] > d) i--;
  const [x0, y0] = PATH_POINTS[i];
  const [x1, y1] = PATH_POINTS[i + 1];
  const t = (d - SEG_START[i]) / SEG_LEN[i];
  out.x = x0 + (x1 - x0) * t;
  out.y = y0 + (y1 - y0) * t;
  return out;
}

function buildSlotTables(): { cellSlot: number[]; slotCells: [number, number][] } {
  const road = new Set(ROAD_CELLS.map(([r, c]) => r * COLS + c));
  const cellSlot: number[] = [];
  const slotCells: [number, number][] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (road.has(r * COLS + c)) {
        cellSlot.push(-1);
      } else {
        cellSlot.push(slotCells.length);
        slotCells.push([r, c]);
      }
    }
  }
  return { cellSlot, slotCells };
}

const tables = buildSlotTables();
/** Cell index (row * COLS + col) -> slot index, or -1 for road cells. */
export const CELL_SLOT: readonly number[] = tables.cellSlot;
/** Slot index -> [row, col]. Slots are the non-road cells in row-major order. */
export const SLOT_CELLS: ReadonlyArray<readonly [number, number]> = tables.slotCells;
export const SLOT_COUNT = SLOT_CELLS.length;
/** Slot centres in board cell units. */
export const SLOT_POS: readonly Pt[] = SLOT_CELLS.map(([r, c]) => ({ x: c + 0.5, y: r + 0.5 }));

/** 8-neighbourhood between slots (used by 速). */
export const ADJ8: ReadonlyArray<readonly number[]> = SLOT_CELLS.map(([r, c]) => {
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr;
      const cc = c + dc;
      if ((dr === 0 && dc === 0) || rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) continue;
      const s = CELL_SLOT[rr * COLS + cc];
      if (s >= 0) out.push(s);
    }
  }
  return out;
});

const coverageCache = new Map<string, number>();

/** Road length (cells) within `range` of a slot centre, sampled every 0.05 cells. Used by the AI to rank slots. */
export function coverage(slot: number, range: number): number {
  if (!Number.isFinite(range)) return PATH_LEN;
  const key = `${slot}:${range}`;
  const cached = coverageCache.get(key);
  if (cached !== undefined) return cached;
  const p = SLOT_POS[slot];
  const r2 = range * range;
  const step = 0.05;
  const q: Pt = { x: 0, y: 0 };
  let n = 0;
  for (let d = step / 2; d < PATH_LEN; d += step) {
    posAt(d, q);
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    if (dx * dx + dy * dy <= r2) n++;
  }
  const v = n * step;
  coverageCache.set(key, v);
  return v;
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

function makeTile(m: MatchState, id: UnitId, invested: number): Tile {
  const t: Tile = { uid: m.nextUid++, id, level: 1, divine: false, cd: 0, invested };
  // Reason: attackers may fire at once, but pulsing supports (钱/疗) must wait a full cycle so they can't be spammed.
  if (UNITS[id].kind === 'support') t.cd = tileInterval(t);
  return t;
}

export function emptySlots(side: SideState): number[] {
  const out: number[] = [];
  for (let i = 0; i < side.slots.length; i++) if (!side.slots[i]) out.push(i);
  return out;
}

/** Partners of fragments on the board whose other half is still missing. */
function missingPartners(side: SideState): FragId[] {
  const present = new Set<UnitId>();
  for (const t of side.slots) if (t) present.add(t.id);
  const out: FragId[] = [];
  for (const f of FRAGMENTS) {
    if (!present.has(f)) continue;
    const p = partnerOf(f);
    if (!present.has(p) && !out.includes(p)) out.push(p);
  }
  return out;
}

/**
 * Picks the unit for the next draw.
 * Reason: always consumes exactly three random values, so both sides' draw streams stay aligned
 * even when their boards (and therefore the fragment branch) differ.
 */
export function drawUnit(side: SideState): UnitId {
  const r1 = rand(side);
  const r2 = rand(side);
  const r3 = rand(side);
  const weights = side.drawCount < DIVINE_LOCK_DRAWS ? DRAW_WEIGHTS.filter(([k]) => k !== '神') : DRAW_WEIGHTS;
  const pick = pickWeighted(r1, weights);
  if (pick !== 'frag') return pick;
  const wanted = missingPartners(side);
  if (wanted.length > 0 && r2 < FRAG_PARTNER_CHANCE) return wanted[Math.floor(r3 * wanted.length)];
  return FRAGMENTS[Math.floor(r3 * FRAGMENTS.length)];
}

export function recruitStatus(side: SideState): RecruitResult {
  if (!side.slots.includes(null)) return 'full';
  return side.gongde >= recruitCost(side.drawCount) ? 'ok' : 'poor';
}

/** 化缘: pay the current price, draw a tile and drop it into a random empty slot. */
export function recruit(m: MatchState, sid: SideId): RecruitResult {
  const side = m.sides[sid];
  const status = recruitStatus(side);
  if (status !== 'ok') return status;
  const cost = recruitCost(side.drawCount);
  const id = drawUnit(side);
  const empty = emptySlots(side);
  const slot = empty[Math.floor(rand(side) * empty.length)];
  side.gongde -= cost;
  side.drawCount++;
  side.slots[slot] = makeTile(m, id, cost);
  m.events.push({ t: 'recruit', side: sid, slot, unit: id });
  return 'ok';
}

function invalid(m: MatchState, sid: SideId, slot: number, msg: string): DropResult {
  m.events.push({ t: 'invalid', side: sid, slot, msg });
  return 'invalid';
}

/**
 * Resolves dragging the tile in `from` onto `to` (a slot or the sell zone).
 * Priority: merge same id+level > fragment recipe > 神 > move into empty > swap. Results land in `to`.
 */
export function resolveDrop(m: MatchState, sid: SideId, from: number, to: number | 'sell'): DropResult {
  const side = m.sides[sid];
  const a = side.slots[from];
  if (!a || from === to) return 'none';
  if (to === 'sell') {
    const amount = Math.floor(a.invested * SELL_REFUND);
    side.gongde += amount;
    side.slots[from] = null;
    m.events.push({ t: 'sell', side: sid, slot: from, amount });
    return 'sold';
  }
  const b = side.slots[to];
  if (!b) {
    side.slots[to] = a;
    side.slots[from] = null;
    return 'move';
  }
  if (a.id === b.id && a.level === b.level && isStackable(a.id)) {
    if (b.level >= MAX_LEVEL) return invalid(m, sid, to, '已经满级啦');
    b.level++;
    b.divine = b.divine || a.divine;
    b.invested += a.invested;
    side.slots[from] = null;
    m.events.push({ t: 'merge', side: sid, slot: to, level: b.level });
    return 'merge';
  }
  const hero = heroFor(a.id, b.id);
  if (hero) {
    side.slots[to] = makeTile(m, hero, a.invested + b.invested);
    side.slots[from] = null;
    m.events.push({ t: 'hero', side: sid, slot: to, unit: hero });
    return 'hero';
  }
  if (a.id === '神' || b.id === '神') {
    const god = a.id === '神' ? a : b;
    const target = god === a ? b : a;
    if (target.id === '神') return invalid(m, sid, to, '两个神字不能叠加');
    if (target.divine) return invalid(m, sid, to, '它已经是神了');
    if (!canBeDivine(target)) return invalid(m, sid, to, '神只能附在兵字或英雄上');
    target.divine = true;
    target.invested += god.invested;
    side.slots[to] = target;
    side.slots[from] = null;
    m.events.push({ t: 'divine', side: sid, slot: to });
    return 'divine';
  }
  if (a.id === b.id && UNITS[a.id].kind === 'fragment') return invalid(m, sid, to, '碎片要和另一半组合');
  side.slots[to] = a;
  side.slots[from] = b;
  return 'swap';
}
