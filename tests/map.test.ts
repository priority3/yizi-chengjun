import { describe, expect, it } from 'vitest';
import { MAPS } from '../src/config/maps.ts';
import { bestOpenSlot, buildMap, coverage, LANE_SPREAD, pathDir, pathPoint, slotAt } from '../src/core/map.ts';
import { TEST_MAP, TWO_ROADS } from './helpers.ts';

describe('map building', () => {
  it('turns the ASCII layout into roads, slots and a camp', () => {
    const m = buildMap(TEST_MAP);
    expect([m.cols, m.rows, m.w, m.h]).toEqual([9, 10, 432, 480]);
    expect(m.paths).toHaveLength(1);
    expect(m.paths[0].length).toBeCloseTo(384);
    expect(m.spawns[0]).toEqual({ x: 216, y: 72 });
    expect(m.camp).toEqual({ x: 216, y: 456 });
    expect(m.slots).toHaveLength(9);
    expect(m.slots[0]).toEqual({ x: 216, y: 24 });
    expect(m.slots[7]).toEqual({ x: 120, y: 408 });
    expect(m.open).toEqual([true, true, true, true, true, true, true, false, false]);
    expect(m.hpScale).toBe(0.6);
    expect(m.road.filter(Boolean)).toHaveLength(9);
  });

  it('places monsters along the road with a sideways offset', () => {
    const p = buildMap(TEST_MAP).paths[0];
    expect(pathPoint(p, 0)).toEqual({ x: 216, y: 72 });
    expect(pathPoint(p, 100).y).toBeCloseTo(172);
    expect(pathPoint(p, 100, 1).x).toBeCloseTo(216 - LANE_SPREAD);
    expect(pathPoint(p, 9999)).toEqual({ x: 216, y: 456 });
    expect(pathDir(p, 50)).toBeCloseTo(Math.PI / 2);
  });

  it('rounds corners instead of walking square turns', () => {
    const m = buildMap({ theme: 'ridge', rows: ['1##', '..#', '..E'] });
    const len = m.paths[0].length;
    expect(len).toBeLessThan(4 * 48);
    expect(len).toBeGreaterThan(Math.hypot(96, 96));
  });

  it('finds slots under a point and rates their road coverage', () => {
    const m = buildMap(TEST_MAP);
    expect(slotAt(m, 216, 24)).toBe(0);
    expect(slotAt(m, 140, 130)).toBe(1);
    expect(slotAt(m, 216, 240)).toBe(-1);
    expect(coverage(m, 0, 200)).toBeGreaterThan(0.3);
    expect(coverage(m, 0, 200)).toBeLessThan(0.5);
    expect(coverage(m, 1, 100)).toBeGreaterThan(0);
    expect(coverage(m, 1, 100)).toBeLessThan(coverage(m, 0, 200));
    expect(coverage(m, 0, Infinity)).toBe(1);
    expect(bestOpenSlot(m)).toBe(3);
  });

  it('links slots within 速 range both ways', () => {
    const m = buildMap(TEST_MAP);
    expect(m.adj[1]).toContain(3);
    expect(m.adj[1]).not.toContain(2);
    m.adj.forEach((ns, i) => ns.forEach((j) => expect(m.adj[j]).toContain(i)));
  });

  it('supports several roads', () => {
    const m = buildMap(TWO_ROADS);
    expect(m.paths).toHaveLength(2);
    expect(m.spawns).toEqual([
      { x: 24, y: 72 },
      { x: 408, y: 72 },
    ]);
    expect(m.paths[0].length).toBeCloseTo(192);
    expect(m.paths[1].length).toBeCloseTo(192);
  });

  it('builds every chapter map with enough slots and a reachable camp', () => {
    MAPS.forEach((def, i) => {
      const m = buildMap(def);
      expect(m.paths.length, `chapter ${i + 1}`).toBeGreaterThan(0);
      for (const p of m.paths) expect(p.length, `chapter ${i + 1}`).toBeGreaterThan(400);
      expect(m.slots.length, `chapter ${i + 1}`).toBeGreaterThanOrEqual(12);
      expect(m.open.filter(Boolean).length, `chapter ${i + 1}`).toBeGreaterThanOrEqual(6);
      expect(m.open[bestOpenSlot(m)], `chapter ${i + 1}`).toBe(true);
      expect(m.hpScale, `chapter ${i + 1}`).toBeGreaterThan(0.5);
      expect(m.hpScale, `chapter ${i + 1}`).toBeLessThan(3);
    });
  });

  it('rejects a layout whose entrance cannot reach the camp', () => {
    expect(() => buildMap({ theme: 'ridge', rows: ['1#.', '...', '..E'] })).toThrow();
  });
});
