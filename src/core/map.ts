// Maps: an ASCII layout becomes world geometry — the roads monsters follow, the build slots cards sit on,
// and the camp at the end of every road. Pure data and pure functions, so runs stay deterministic.
import { PAD_LETTERS, SLOT_BONUS, TILE, type MapDef, type MapTheme, type SlotKind } from '../config/maps.ts';

export interface Pt {
  x: number;
  y: number;
}

/** A road: smoothed centre line plus cumulative lengths for distance -> position lookups. */
export interface PathData {
  pts: Pt[];
  cum: number[];
  length: number;
}

export interface Decor {
  kind: 'water' | 'rock' | 'tree';
  x: number;
  y: number;
}

export interface MapData {
  w: number;
  h: number;
  cols: number;
  rows: number;
  theme: MapTheme;
  paths: PathData[];
  /** Flying monsters' routes: one straight line per entrance, from its road's start to the camp (same index as paths). */
  flights: PathData[];
  /** Where the roads end: 师父's camp. */
  camp: Pt;
  /** Road starts, one per path. */
  spawns: Pt[];
  slots: Pt[];
  /** Slots open from the start; the rest are bought with 铜钱. */
  open: boolean[];
  /** Kind of each slot's pad (法阵 / 高台 / 泥沼 or a plain stone), same index as `slots`. */
  slotKind: SlotKind[];
  /** Slots within SUPPORT_RANGE of each slot (速 reaches these). */
  adj: number[][];
  decor: Decor[];
  /** Row-major road mask of the squares, for painting. */
  road: boolean[];
  /** Monster HP multiplier for this map: longer roads give the towers more time, so monsters get tougher. */
  hpScale: number;
}

/** Pick / drop radius around a slot centre, in world px. */
export const SLOT_R = 27;
/** 速 hastes slots within this distance. */
export const SUPPORT_RANGE = 100;
/** Painted road width. */
export const ROAD_W = 36;
/** Monsters wander up to this far from the road's centre line, so a crowd doesn't walk in single file. */
export const LANE_SPREAD = 12;
/** Road length (px) at which hpScale is 1. */
export const REF_ROAD = 1400;

const isRoad = (ch: string): boolean => ch === '#' || ch === 'E' || (ch >= '1' && ch <= '4');

/** Chaikin corner cutting with fixed end points: turns the square-cornered cell chain into a soft curve. */
function smooth(pts: Pt[], iterations: number): Pt[] {
  let cur = pts;
  for (let it = 0; it < iterations; it++) {
    if (cur.length < 3) return cur;
    const out: Pt[] = [cur[0]];
    for (let i = 0; i < cur.length - 1; i++) {
      const a = cur[i];
      const b = cur[i + 1];
      out.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
      out.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    out.push(cur[cur.length - 1]);
    cur = out;
  }
  return cur;
}

function toPath(pts: Pt[]): PathData {
  const cum: number[] = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  return { pts, cum, length: cum[cum.length - 1] };
}

/** Shortest chain of road squares from `from` to `to` (4-neighbour BFS), as square indices. */
function trace(road: boolean[], cols: number, rows: number, from: number, to: number): number[] {
  const prev = new Int32Array(cols * rows).fill(-1);
  const queue = [from];
  prev[from] = from;
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    if (i === to) break;
    const c = i % cols;
    const r = Math.floor(i / cols);
    for (const [dc, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
      const j = nr * cols + nc;
      if (!road[j] || prev[j] >= 0) continue;
      prev[j] = i;
      queue.push(j);
    }
  }
  if (prev[to] < 0) throw new Error(`map: entrance ${from} cannot reach the camp`);
  const chain: number[] = [];
  for (let i = to; i !== from; i = prev[i]) chain.push(i);
  chain.push(from);
  return chain.reverse();
}

export function buildMap(def: MapDef): MapData {
  const rows = def.rows.length;
  const cols = Math.max(...def.rows.map((r) => r.length));
  const at = (c: number, r: number): string => def.rows[r]?.[c] ?? '.';
  const centre = (i: number): Pt => ({ x: (i % cols) * TILE + TILE / 2, y: Math.floor(i / cols) * TILE + TILE / 2 });
  const road: boolean[] = [];
  const slots: Pt[] = [];
  const open: boolean[] = [];
  const slotKind: SlotKind[] = [];
  const decor: Decor[] = [];
  const spawnCells: Array<{ n: number; i: number }> = [];
  let exit = -1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = at(c, r);
      const i = r * cols + c;
      road.push(isRoad(ch));
      if (ch === 'E') {
        if (exit >= 0) throw new Error('map: more than one camp (E)');
        exit = i;
      } else if (ch >= '1' && ch <= '4') spawnCells.push({ n: Number(ch), i });
      else if (Object.hasOwn(PAD_LETTERS, ch)) {
        slots.push(centre(i));
        open.push(PAD_LETTERS[ch].open);
        slotKind.push(PAD_LETTERS[ch].kind);
      } else if (ch === '~') decor.push({ kind: 'water', ...centre(i) });
      else if (ch === '^') decor.push({ kind: 'rock', ...centre(i) });
      else if (ch === 'T') decor.push({ kind: 'tree', ...centre(i) });
    }
  }
  if (exit < 0) throw new Error('map: no camp (E)');
  if (spawnCells.length === 0) throw new Error('map: no entrance (1-4)');
  spawnCells.sort((a, b) => a.n - b.n);
  const paths = spawnCells.map((s) => toPath(smooth(trace(road, cols, rows, s.i, exit).map(centre), 2)));
  const flights = spawnCells.map((s) => toPath([centre(s.i), centre(exit)]));
  const avgLen = paths.reduce((sum, p) => sum + p.length, 0) / paths.length;
  // Reason: a monster on a road twice as long is shot at twice as long; scale HP so every map fights fair.
  const hpScale = Math.min(2.2, Math.max(0.6, (avgLen / REF_ROAD) ** 0.85)) * (def.hp ?? 1);
  const adj = slots.map((p, i) =>
    slots.map((_, j) => j).filter((j) => j !== i && Math.hypot(slots[j].x - p.x, slots[j].y - p.y) <= SUPPORT_RANGE),
  );
  return {
    w: cols * TILE,
    h: rows * TILE,
    cols,
    rows,
    theme: def.theme,
    paths,
    flights,
    camp: centre(exit),
    spawns: spawnCells.map((s) => centre(s.i)),
    slots,
    open,
    slotKind,
    adj,
    decor,
    road,
    hpScale,
  };
}

/** Index of the last path point at or before `dist` (binary search over the cumulative lengths). */
function segmentAt(p: PathData, dist: number): number {
  let lo = 0;
  let hi = p.cum.length - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (p.cum[mid] <= dist) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Position `dist` px along the road, shifted sideways by `side` (-1..1) x LANE_SPREAD. */
export function pathPoint(p: PathData, dist: number, side = 0): Pt {
  const d = Math.min(p.length, Math.max(0, dist));
  const i = segmentAt(p, d);
  const a = p.pts[i];
  const b = p.pts[Math.min(i + 1, p.pts.length - 1)];
  const seg = p.cum[i + 1] - p.cum[i] || 1;
  const t = Math.min(1, (d - p.cum[i]) / seg);
  const x = a.x + (b.x - a.x) * t;
  const y = a.y + (b.y - a.y) * t;
  if (side === 0) return { x, y };
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  // Left-hand normal of the segment.
  return { x: x - ((b.y - a.y) / len) * side * LANE_SPREAD, y: y + ((b.x - a.x) / len) * side * LANE_SPREAD };
}

/** Direction of travel (radians) at `dist`. */
export function pathDir(p: PathData, dist: number): number {
  const i = segmentAt(p, Math.min(p.length, Math.max(0, dist)));
  const a = p.pts[i];
  const b = p.pts[Math.min(i + 1, p.pts.length - 1)];
  return Math.atan2(b.y - a.y, b.x - a.x);
}

/** Slot under a world point (within SLOT_R of its centre), or -1. */
export function slotAt(map: MapData, x: number, y: number): number {
  let best = -1;
  let bestD = SLOT_R * SLOT_R;
  map.slots.forEach((s, i) => {
    const d = (s.x - x) * (s.x - x) + (s.y - y) * (s.y - y);
    if (d <= bestD) {
      best = i;
      bestD = d;
    }
  });
  return best;
}

const SAMPLE_STEP = 12;
const coverageCache = new WeakMap<MapData, Map<string, number>>();

/**
 * Share (0..1) of all road length within `range` of a slot. Used by the bot to place tiles.
 * With `flights`, the flyers' straight lines count as road too.
 */
export function coverage(map: MapData, slot: number, range: number, flights = false): number {
  if (!Number.isFinite(range)) return 1;
  let cache = coverageCache.get(map);
  if (!cache) {
    cache = new Map();
    coverageCache.set(map, cache);
  }
  const key = flights ? `${slot}:${range}:air` : `${slot}:${range}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const s = map.slots[slot];
  const r2 = range * range;
  let hit = 0;
  let total = 0;
  for (const p of flights ? [...map.paths, ...map.flights] : map.paths) {
    for (let d = 0; d <= p.length; d += SAMPLE_STEP) {
      const q = pathPoint(p, d);
      total++;
      if ((q.x - s.x) * (q.x - s.x) + (q.y - s.y) * (q.y - s.y) <= r2) hit++;
    }
  }
  const v = total > 0 ? hit / total : 0;
  cache.set(key, v);
  return v;
}

/**
 * The open slot where a fighter sees the most road (a 高台 adds its reach) — where the free starter 箭 goes.
 * Never a 泥沼: the starter is a fighter.
 */
export function bestOpenSlot(map: MapData, range = 200): number {
  let best = -1;
  let bestCov = -1;
  map.slots.forEach((_, i) => {
    const pad = SLOT_BONUS[map.slotKind[i]];
    if (!map.open[i] || !pad.fighters) return;
    const c = coverage(map, i, range + pad.range);
    if (c > bestCov) {
      bestCov = c;
      best = i;
    }
  });
  return best;
}
