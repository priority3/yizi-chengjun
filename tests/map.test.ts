import { describe, expect, it } from 'vitest';
import { MAPS, type MapDef } from '../src/config/maps.ts';
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

/** A road that runs right along the top, then down to the camp; the flight line cuts the corner diagonally. */
const BEND: MapDef = { theme: 'ridge', rows: ['1###', '.O.#', '...#', '...E'] };

describe('flight lines', () => {
  it('run straight from each entrance to the camp, shorter than the road', () => {
    const m = buildMap(BEND);
    expect(m.flights).toHaveLength(1);
    expect(m.flights[0].pts).toEqual([m.spawns[0], m.camp]);
    expect(m.flights[0].length).toBeCloseTo(Math.hypot(144, 144));
    expect(m.flights[0].length).toBeLessThan(m.paths[0].length);
    // Halfway along, a flyer is on the diagonal, nowhere near the road's corner.
    expect(pathPoint(m.flights[0], m.flights[0].length / 2)).toEqual({ x: 96, y: 96 });
    expect(pathDir(m.flights[0], 10)).toBeCloseTo(Math.PI / 4);
  });

  it('exist for every entrance of every chapter map, in road order', () => {
    MAPS.forEach((def, i) => {
      const m = buildMap(def);
      expect(m.flights, `chapter ${i + 1}`).toHaveLength(m.paths.length);
      m.flights.forEach((f, k) => {
        expect(f.pts[0], `chapter ${i + 1} entrance ${k + 1}`).toEqual(m.paths[k].pts[0]);
        expect(f.pts.at(-1)).toEqual(m.camp);
        expect(f.length).toBeCloseTo(Math.hypot(m.camp.x - m.spawns[k].x, m.camp.y - m.spawns[k].y));
        expect(f.length).toBeLessThanOrEqual(m.paths[k].length);
      });
    });
  });

  it("can count towards a slot's coverage, without changing the road-only figure", () => {
    const m = buildMap(BEND);
    // The slot at (72, 72) sits on the flight line but 48 px from the road.
    const road = coverage(m, 0, 60);
    const withFlights = coverage(m, 0, 60, true);
    expect(withFlights).toBeGreaterThan(road);
    expect(coverage(m, 0, 60)).toBe(road);
    expect(coverage(m, 0, Infinity, true)).toBe(1);
  });
});
