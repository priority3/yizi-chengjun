import { describe, expect, it } from 'vitest';
import {
  ADJ8,
  CELL_COUNT,
  CELL_POS,
  cellAt,
  coverage,
  GRID_H,
  GRID_X,
  GRID_Y,
  initialUnlocked,
  spawnY,
  stopY,
  WORLD_H,
} from '../src/core/grid.ts';

describe('camp geometry', () => {
  it('centres a 4x4 camp in the 360x520 world', () => {
    expect(CELL_COUNT).toBe(16);
    expect(GRID_X).toBe(64);
    expect(GRID_Y).toBe(144);
    expect(CELL_POS[0]).toEqual({ x: 93, y: 173 });
    expect(CELL_POS[15]).toEqual({ x: 267, y: 347 });
  });

  it('opens only the two middle rows at the start', () => {
    const u = initialUnlocked();
    expect(u.filter(Boolean)).toHaveLength(8);
    expect(u.slice(0, 4).some(Boolean)).toBe(false);
    expect(u.slice(12).some(Boolean)).toBe(false);
  });

  it('maps points back to cells', () => {
    CELL_POS.forEach((p, i) => expect(cellAt(p.x, p.y)).toBe(i));
    expect(cellAt(10, 10)).toBe(-1);
  });

  it('has a symmetric neighbour table', () => {
    ADJ8.forEach((ns, i) => ns.forEach((j) => expect(ADJ8[j]).toContain(i)));
    expect(ADJ8[0]).toHaveLength(3);
    expect(ADJ8[5]).toHaveLength(8);
  });

  it('spawns enemies outside the gates and stops them in front of the camp', () => {
    expect(spawnY(0)).toBeLessThan(0);
    expect(spawnY(1)).toBeGreaterThan(WORLD_H);
    expect(stopY(0, 12)).toBe(GRID_Y - 15);
    expect(stopY(1, 12)).toBe(GRID_Y + GRID_H + 15);
  });

  it('rates edge cells higher for their own lane at short range', () => {
    // Cell 1 sits on the top edge, cell 13 on the bottom edge; a short range only reaches the nearer lane.
    expect(coverage(1, 80)).toBeGreaterThan(0);
    expect(coverage(1, 80)).toBeCloseTo(coverage(13, 80));
    expect(coverage(5, 80)).toBeLessThan(coverage(1, 80));
    expect(coverage(5, Infinity)).toBe(1);
  });
});
