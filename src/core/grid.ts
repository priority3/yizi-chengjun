// World and camp geometry. The world is a fixed 360x520 logical field (independent of the screen),
// with the 4x4 camp grid in the middle and a gate at the top and bottom edges.
import type { Lane } from './types.ts';

export interface Pt {
  x: number;
  y: number;
}

export const WORLD_W = 360;
export const WORLD_H = 520;
export const COLS = 4;
export const ROWS = 4;
export const CELL = 58;
export const GRID_W = COLS * CELL;
export const GRID_H = ROWS * CELL;
export const GRID_X = (WORLD_W - GRID_W) / 2;
export const GRID_Y = (WORLD_H - GRID_H) / 2;
export const CELL_COUNT = COLS * ROWS;

export const cellRow = (i: number): number => Math.floor(i / COLS);
export const cellCol = (i: number): number => i % COLS;

/** Cell centres in world pixels. */
export const CELL_POS: readonly Pt[] = Array.from({ length: CELL_COUNT }, (_, i) => ({
  x: GRID_X + cellCol(i) * CELL + CELL / 2,
  y: GRID_Y + cellRow(i) * CELL + CELL / 2,
}));

/** Cells open at the start of a run: the two middle rows. The outer rows are bought with 功德. */
export function initialUnlocked(): boolean[] {
  return Array.from({ length: CELL_COUNT }, (_, i) => cellRow(i) === 1 || cellRow(i) === 2);
}

/** 8-neighbourhood between cells (used by 速). */
export const ADJ8: ReadonlyArray<readonly number[]> = Array.from({ length: CELL_COUNT }, (_, i) => {
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const r = cellRow(i) + dr;
      const c = cellCol(i) + dc;
      if ((dr === 0 && dc === 0) || r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
      out.push(r * COLS + c);
    }
  }
  return out;
});

/** Cell under a world point, or -1. */
export function cellAt(x: number, y: number): number {
  const c = Math.floor((x - GRID_X) / CELL);
  const r = Math.floor((y - GRID_Y) / CELL);
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return -1;
  return r * COLS + c;
}

/** Enemies spread across the camp's width, a little inside its edges. */
export const SPAWN_X_MIN = GRID_X + 18;
export const SPAWN_X_MAX = GRID_X + GRID_W - 18;

export function spawnY(lane: Lane): number {
  return lane === 0 ? -16 : WORLD_H + 16;
}

/** Where an enemy of the given radius stops to attack the camp. */
export function stopY(lane: Lane, radius: number): number {
  return lane === 0 ? GRID_Y - radius - 3 : GRID_Y + GRID_H + radius + 3;
}

interface Sample {
  x: number;
  y: number;
  w: number;
}

/**
 * Sample points along both lanes, weighted toward the camp.
 * Reason: enemies spend most of their time standing at the stop line, so covering it matters most.
 */
const LANE_SAMPLES: Sample[] = (() => {
  const out: Sample[] = [];
  for (const lane of [0, 1] as const) {
    const y0 = spawnY(lane);
    const y1 = stopY(lane, 12);
    for (let k = 0; k <= 14; k++) {
      const t = k / 14;
      for (const x of [90, 135, 180, 225, 270]) out.push({ x, y: y0 + (y1 - y0) * t, w: 1 + 3 * t * t });
    }
  }
  return out;
})();
const TOTAL_WEIGHT = LANE_SAMPLES.reduce((s, p) => s + p.w, 0);
const coverageCache = new Map<string, number>();

/** Weighted share (0..1) of both lanes within `range` of a cell centre. Used by the bot to place tiles. */
export function coverage(cell: number, range: number): number {
  if (!Number.isFinite(range)) return 1;
  const key = `${cell}:${range}`;
  const cached = coverageCache.get(key);
  if (cached !== undefined) return cached;
  const p = CELL_POS[cell];
  const r2 = range * range;
  let w = 0;
  for (const s of LANE_SAMPLES) {
    const dx = s.x - p.x;
    const dy = s.y - p.y;
    if (dx * dx + dy * dy <= r2) w += s.w;
  }
  const v = w / TOTAL_WEIGHT;
  coverageCache.set(key, v);
  return v;
}
