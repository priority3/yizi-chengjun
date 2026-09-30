import { describe, expect, it } from 'vitest';
import { HERO_RECIPES } from '../src/config/combos.ts';
import { MAX_LEVEL } from '../src/config/units.ts';
import { resolveDrop } from '../src/core/board.ts';
import type { UnitId } from '../src/core/types.ts';
import { emptyGame, put } from './helpers.ts';

describe('drag and drop on the camp', () => {
  it('merges same unit + same level into the target cell', () => {
    const g = emptyGame();
    put(g, 5, '棍');
    put(g, 6, '棍');
    expect(resolveDrop(g, 5, 6)).toBe('merge');
    expect(g.slots[5]).toBeNull();
    expect(g.slots[6]).toMatchObject({ level: 2, invested: 20 });
    expect(g.events.at(-1)).toMatchObject({ t: 'merge', cell: 6, level: 2 });
  });

  it('swaps different levels and refuses to pass the max level', () => {
    const g = emptyGame();
    put(g, 5, '箭', 1);
    put(g, 6, '箭', 2);
    expect(resolveDrop(g, 5, 6)).toBe('swap');
    expect(g.slots[5]?.level).toBe(2);
    put(g, 8, '雷', MAX_LEVEL);
    put(g, 9, '雷', MAX_LEVEL);
    expect(resolveDrop(g, 8, 9)).toBe('invalid');
    expect(g.slots[8]).not.toBeNull();
  });

  it('keeps 神 through a merge from either tile', () => {
    const g = emptyGame();
    put(g, 5, '火', 1, true);
    put(g, 6, '火', 1, false);
    resolveDrop(g, 5, 6);
    expect(g.slots[6]).toMatchObject({ id: '火', level: 2, divine: true });
  });

  it('awakens every hero from its two fragments, in either order', () => {
    for (const r of HERO_RECIPES) {
      for (const [x, y] of [
        [r.a, r.b],
        [r.b, r.a],
      ] as const) {
        const g = emptyGame();
        put(g, 5, x);
        put(g, 10, y);
        expect(resolveDrop(g, 5, 10)).toBe('hero');
        expect(g.slots[5]).toBeNull();
        expect(g.slots[10]).toMatchObject({ id: r.hero, level: 1, invested: 20 });
        expect(g.events.at(-1)).toMatchObject({ t: 'hero', cell: 10, from: 5 });
      }
    }
  });

  it('applies 神 to fighters only', () => {
    const g = emptyGame();
    put(g, 5, '神');
    put(g, 6, '雷');
    expect(resolveDrop(g, 5, 6)).toBe('divine');
    expect(g.slots[6]).toMatchObject({ id: '雷', divine: true });
    const bad: Array<[UnitId, boolean]> = [
      ['速', false],
      ['悟', false],
      ['神', false],
      ['箭', true],
    ];
    for (const [id, divine] of bad) {
      const h = emptyGame();
      put(h, 5, '神');
      put(h, 6, id, 1, divine);
      expect(resolveDrop(h, 5, 6), id).toBe('invalid');
    }
  });

  it('refuses to stack identical fragments', () => {
    const g = emptyGame();
    put(g, 5, '八');
    put(g, 6, '八');
    expect(resolveDrop(g, 5, 6)).toBe('invalid');
  });

  it('moves into empty cells, refuses locked ones, and sells for half', () => {
    const g = emptyGame();
    const t = put(g, 5, '冰');
    t.invested = 25;
    expect(resolveDrop(g, 5, 0)).toBe('locked');
    expect(resolveDrop(g, 5, 7)).toBe('move');
    expect(g.slots[7]).toBe(t);
    const before = g.gongde;
    expect(resolveDrop(g, 7, 'sell')).toBe('sold');
    expect(g.gongde).toBe(before + 12);
    expect(g.slots[7]).toBeNull();
  });
});
