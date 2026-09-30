import { describe, expect, it } from 'vitest';
import { refreshCost, START_GONGDE, unlockCost } from '../src/config/chapters.ts';
import { UNITS } from '../src/config/units.ts';
import { createGame } from '../src/core/game.ts';
import { buy, refresh, restock, rollOffer, unlock } from '../src/core/shop.ts';
import { emptyGame, put } from './helpers.ts';

const attackers = (ids: string[]) => ids.filter((id) => UNITS[id as keyof typeof UNITS].kind === 'attack').length;

describe('shop offers', () => {
  it('always opens a chapter with at least two attack cards, and later shops with one', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const g = createGame({ seed, chapter: 1 });
      expect(g.shop).toHaveLength(3);
      expect(attackers(g.shop.map((o) => o.id))).toBeGreaterThanOrEqual(2);
      restock(g);
      expect(attackers(g.shop.map((o) => o.id))).toBeGreaterThanOrEqual(1);
    }
  });

  it('keeps 神 out of the shop before wave 2', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const g = createGame({ seed, chapter: 1 });
      for (let i = 0; i < 5; i++) expect(rollOffer(g)).not.toBe('神');
    }
  });

  it('prices offers from the unit table', () => {
    const g = createGame({ seed: 5, chapter: 1 });
    for (const o of g.shop) expect(o.price).toBe(UNITS[o.id].price);
  });
});

describe('buying', () => {
  it('places a card on an empty cell and charges its price', () => {
    const g = emptyGame();
    g.shop = [{ id: '火', price: 14, sold: false }];
    expect(buy(g, 0, 5)).toBe('ok');
    expect(g.slots[5]?.id).toBe('火');
    expect(g.gongde).toBe(START_GONGDE - 14);
    expect(g.shop[0].sold).toBe(true);
    expect(buy(g, 0, 6)).toBe('none');
  });

  it('merges straight into a matching tile', () => {
    const g = emptyGame();
    put(g, 5, '箭');
    g.shop = [{ id: '箭', price: 10, sold: false }];
    expect(buy(g, 0, 5)).toBe('merge');
    expect(g.slots[5]?.level).toBe(2);
    expect(g.gongde).toBe(START_GONGDE - 10);
  });

  it('awakens a hero when bought onto the missing half', () => {
    const g = emptyGame();
    put(g, 6, '悟');
    g.shop = [{ id: '空', price: 12, sold: false }];
    expect(buy(g, 0, 6)).toBe('hero');
    expect(g.slots[6]?.id).toBe('悟空');
  });

  it('refuses locked cells, empty wallets and cells it cannot combine with', () => {
    const g = emptyGame();
    g.shop = [
      { id: '雷', price: 16, sold: false },
      { id: '冰', price: 12, sold: false },
    ];
    expect(buy(g, 0, 0)).toBe('locked');
    put(g, 5, '火');
    expect(buy(g, 0, 5)).toBe('occupied');
    expect(g.slots[5]?.id).toBe('火');
    g.gongde = 5;
    expect(buy(g, 1, 6)).toBe('poor');
    expect(g.gongde).toBe(5);
  });
});

describe('refresh and unlock', () => {
  it('charges an escalating refresh price', () => {
    const g = emptyGame();
    expect(refresh(g)).toBe('ok');
    expect(refresh(g)).toBe('ok');
    expect(g.gongde).toBe(START_GONGDE - refreshCost(0) - refreshCost(1));
    g.gongde = 0;
    expect(refresh(g)).toBe('poor');
  });

  it('unlocks locked cells for an escalating price', () => {
    const g = emptyGame();
    g.gongde = 1000;
    expect(unlock(g, 0)).toBe('ok');
    expect(unlock(g, 1)).toBe('ok');
    expect(g.gongde).toBe(1000 - unlockCost(0) - unlockCost(1));
    expect(g.unlocked[0] && g.unlocked[1]).toBe(true);
    expect(unlock(g, 5)).toBe('none');
  });
});
