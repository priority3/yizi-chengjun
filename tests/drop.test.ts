import { describe, expect, it } from 'vitest';
import { HERO_RECIPES } from '../src/config/combos.ts';
import { MAX_LEVEL } from '../src/config/units.ts';
import { resolveDrop } from '../src/core/board.ts';
import { emptyMatch, put } from './helpers.ts';

describe('drag and drop', () => {
  it('merges same unit + same level into the target slot', () => {
    const m = emptyMatch();
    put(m, 0, 0, '棍');
    put(m, 0, 1, '棍');
    expect(resolveDrop(m, 0, 0, 1)).toBe('merge');
    const s = m.sides[0].slots;
    expect(s[0]).toBeNull();
    expect(s[1]?.level).toBe(2);
    expect(s[1]?.invested).toBe(20);
    expect(m.events.at(-1)).toMatchObject({ t: 'merge', slot: 1, level: 2 });
  });

  it('swaps instead of merging different levels', () => {
    const m = emptyMatch();
    put(m, 0, 0, '棍', 1);
    put(m, 0, 1, '棍', 2);
    expect(resolveDrop(m, 0, 0, 1)).toBe('swap');
    expect(m.sides[0].slots[0]?.level).toBe(2);
    expect(m.sides[0].slots[1]?.level).toBe(1);
  });

  it('refuses to merge past the max level', () => {
    const m = emptyMatch();
    put(m, 0, 0, '箭', MAX_LEVEL);
    put(m, 0, 1, '箭', MAX_LEVEL);
    expect(resolveDrop(m, 0, 0, 1)).toBe('invalid');
    expect(m.sides[0].slots[0]).not.toBeNull();
    expect(m.events.at(-1)).toMatchObject({ t: 'invalid', slot: 1 });
  });

  it('keeps 神 through a merge from either tile', () => {
    const m = emptyMatch();
    put(m, 0, 0, '火', 1, true);
    put(m, 0, 1, '火', 1, false);
    resolveDrop(m, 0, 0, 1);
    expect(m.sides[0].slots[1]).toMatchObject({ id: '火', level: 2, divine: true });
  });

  it('awakens every hero from its two fragments, in either order', () => {
    for (const r of HERO_RECIPES) {
      for (const [x, y] of [
        [r.a, r.b],
        [r.b, r.a],
      ] as const) {
        const m = emptyMatch();
        put(m, 0, 3, x);
        put(m, 0, 4, y);
        expect(resolveDrop(m, 0, 3, 4)).toBe('hero');
        expect(m.sides[0].slots[3]).toBeNull();
        expect(m.sides[0].slots[4]).toMatchObject({ id: r.hero, level: 1, invested: 20 });
      }
    }
  });

  it('refuses to stack identical fragments', () => {
    const m = emptyMatch();
    put(m, 0, 0, '悟');
    put(m, 0, 1, '悟');
    expect(resolveDrop(m, 0, 0, 1)).toBe('invalid');
  });

  it('applies 神 to attackers and heroes, landing in the target slot', () => {
    const m = emptyMatch();
    put(m, 0, 0, '神');
    put(m, 0, 1, '箭');
    expect(resolveDrop(m, 0, 0, 1)).toBe('divine');
    expect(m.sides[0].slots[0]).toBeNull();
    expect(m.sides[0].slots[1]).toMatchObject({ id: '箭', divine: true });

    const m2 = emptyMatch();
    put(m2, 0, 0, '悟空');
    put(m2, 0, 1, '神');
    expect(resolveDrop(m2, 0, 0, 1)).toBe('divine');
    expect(m2.sides[0].slots[1]).toMatchObject({ id: '悟空', divine: true });
    expect(m2.sides[0].slots[0]).toBeNull();
  });

  it('rejects invalid 神 targets', () => {
    const cases: Array<[Parameters<typeof put>[3], boolean]> = [
      ['速', false],
      ['悟', false],
      ['神', false],
      ['雷', true],
    ];
    for (const [id, divine] of cases) {
      const m = emptyMatch();
      put(m, 0, 0, '神');
      put(m, 0, 1, id, 1, divine);
      expect(resolveDrop(m, 0, 0, 1), id).toBe('invalid');
      expect(m.sides[0].slots[0]?.id).toBe('神');
    }
  });

  it('moves into empty slots and sells for half the investment', () => {
    const m = emptyMatch();
    const t = put(m, 0, 0, '冰');
    t.invested = 25;
    expect(resolveDrop(m, 0, 0, 5)).toBe('move');
    expect(m.sides[0].slots[5]).toBe(t);
    const before = m.sides[0].gongde;
    expect(resolveDrop(m, 0, 5, 'sell')).toBe('sold');
    expect(m.sides[0].gongde).toBe(before + 12);
    expect(m.sides[0].slots[5]).toBeNull();
  });

  it('ignores drops from empty slots or onto themselves', () => {
    const m = emptyMatch();
    put(m, 0, 0, '棍');
    expect(resolveDrop(m, 0, 3, 0)).toBe('none');
    expect(resolveDrop(m, 0, 0, 0)).toBe('none');
  });
});
