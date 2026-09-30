import { describe, expect, it } from 'vitest';
import { recruitCost, START_GONGDE } from '../src/config/levels.ts';
import {
  ADJ8,
  CELL_SLOT,
  COLS,
  coverage,
  drawUnit,
  PATH_LEN,
  posAt,
  recruit,
  ROAD_CELLS,
  SLOT_CELLS,
  SLOT_COUNT,
} from '../src/core/board.ts';
import { emptyMatch, put } from './helpers.ts';

describe('board geometry', () => {
  it('has a 13-cell road, a 13-cell path and 22 slots', () => {
    expect(ROAD_CELLS).toHaveLength(13);
    expect(PATH_LEN).toBe(13);
    expect(SLOT_COUNT).toBe(22);
  });

  it('maps road distance onto the corners of the S path', () => {
    const p = { x: 0, y: 0 };
    expect(posAt(0, p)).toEqual({ x: 1.5, y: 0 });
    expect(posAt(1.5, p)).toEqual({ x: 1.5, y: 1.5 });
    expect(posAt(5.5, p)).toEqual({ x: 5.5, y: 1.5 });
    expect(posAt(7.5, p)).toEqual({ x: 5.5, y: 3.5 });
    expect(posAt(11.5, p)).toEqual({ x: 1.5, y: 3.5 });
    expect(posAt(13, p)).toEqual({ x: 1.5, y: 5 });
    expect(posAt(99, p)).toEqual({ x: 1.5, y: 5 });
  });

  it('walks through the centre of every road cell', () => {
    const p = { x: 0, y: 0 };
    for (const [r, c] of ROAD_CELLS) {
      let found = false;
      for (let d = 0; d <= PATH_LEN; d += 0.05) {
        posAt(d, p);
        if (Math.abs(p.x - (c + 0.5)) < 0.03 && Math.abs(p.y - (r + 0.5)) < 0.03) found = true;
      }
      expect(found, `road cell ${r},${c}`).toBe(true);
    }
  });

  it('keeps the slot tables consistent', () => {
    SLOT_CELLS.forEach(([r, c], i) => expect(CELL_SLOT[r * COLS + c]).toBe(i));
    for (const [r, c] of ROAD_CELLS) expect(CELL_SLOT[r * COLS + c]).toBe(-1);
  });

  it('has a symmetric neighbour table', () => {
    ADJ8.forEach((ns, i) => ns.forEach((j) => expect(ADJ8[j]).toContain(i)));
  });

  it('ranks slots between two road segments above corner slots', () => {
    const middle = CELL_SLOT[2 * COLS + 3];
    const corner = CELL_SLOT[0 * COLS + 6];
    expect(coverage(middle, 1.5)).toBeGreaterThan(2 * coverage(corner, 1.5));
    expect(coverage(middle, Infinity)).toBe(PATH_LEN);
  });
});

describe('化缘 (recruit)', () => {
  it('charges an escalating price and places a level-1 tile', () => {
    const m = emptyMatch();
    const side = m.sides[0];
    expect(recruit(m, 0)).toBe('ok');
    expect(recruit(m, 0)).toBe('ok');
    expect(side.gongde).toBe(START_GONGDE - recruitCost(0) - recruitCost(1));
    const tiles = side.slots.filter((t) => t !== null);
    expect(tiles).toHaveLength(2);
    expect(tiles.every((t) => t.level === 1 && !t.divine)).toBe(true);
    expect(side.drawCount).toBe(2);
  });

  it('rejects when too poor or when the board is full', () => {
    const m = emptyMatch();
    m.sides[0].gongde = 5;
    expect(recruit(m, 0)).toBe('poor');
    m.sides[0].gongde = 1000;
    for (let i = 0; i < SLOT_COUNT; i++) put(m, 0, i, '棍');
    expect(recruit(m, 0)).toBe('full');
    expect(m.sides[0].gongde).toBe(1000);
  });

  it('gives both sides identical draws from the same seed', () => {
    const m = emptyMatch(1, 42);
    for (let i = 0; i < 5; i++) {
      recruit(m, 0);
      recruit(m, 1);
    }
    expect(m.sides[0].slots.map((t) => t?.id ?? null)).toEqual(m.sides[1].slots.map((t) => t?.id ?? null));
  });

  it('never draws 神 during the first six draws', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const side = emptyMatch(1, seed).sides[0];
      for (let n = 0; n < 6; n++) {
        expect(drawUnit(side)).not.toBe('神');
        side.drawCount++;
      }
    }
  });

  it('prefers the missing partner of a fragment already on the board', () => {
    let partner = 0;
    let fragments = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const m = emptyMatch(1, seed);
      put(m, 0, 0, '悟');
      const side = m.sides[0];
      side.drawCount = 10;
      const id = drawUnit(side);
      if (['悟', '空', '八', '戒', '沙', '僧', '白', '龙'].includes(id)) fragments++;
      if (id === '空') partner++;
    }
    // Reason: 60% partner chance plus the 1/8 uniform share -> roughly 65% of fragment draws are 空.
    expect(partner / fragments).toBeGreaterThan(0.5);
  });
});
