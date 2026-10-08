import { describe, expect, it } from 'vitest';
import { CAMP_HP, START_GONGDE } from '../src/config/chapters.ts';
import { FORGE_COST, TREASURES, type TreasureId } from '../src/config/treasures.ts';
import { createGame } from '../src/core/game.ts';
import { tileDamage, tileRange } from '../src/core/stats.ts';
import { addTreasure, buildMods, clearRewards, defaultMods, emptyVault, forge, forgeRoll, mergeAll, ownedTier, toggleEquip } from '../src/core/treasures.ts';
import { put } from './helpers.ts';

describe('rewards', () => {
  it('pays 灵石 every clear and a fixed treasure on the first clear', () => {
    const v = emptyVault();
    expect(clearRewards(v, 1, true)).toEqual({ stones: 55, treasure: '金刚琢' });
    expect(clearRewards(v, 1, false)).toEqual({ stones: 20, treasure: null });
    expect(v.stones).toBe(75);
    expect(ownedTier(v, '金刚琢')).toBe(1);
  });
});

describe('vault', () => {
  it('merges three of a kind into the next tier, up to tier 3', () => {
    const v = emptyVault();
    for (let i = 0; i < 9; i++) addTreasure(v, '定风珠');
    expect(mergeAll(v)).toBe(4);
    expect(v.treasures).toEqual([{ id: '定风珠', tier: 3, count: 1 }]);
    addTreasure(v, '定风珠', 3);
    addTreasure(v, '定风珠', 3);
    expect(mergeAll(v)).toBe(0);
    expect(ownedTier(v, '定风珠')).toBe(3);
  });

  it('forges for 灵石 with rarity weights', () => {
    const v = emptyVault();
    expect(forge(v, 0.5, 0.5)).toBeNull();
    v.stones = FORGE_COST;
    const id = forge(v, 0.99, 0.5);
    expect(id).not.toBeNull();
    expect(TREASURES[id as TreasureId].rarity).toBe('epic');
    expect(v.stones).toBe(0);
    expect(forgeRoll(0.1, 0)).toBe('金刚琢');
    expect(TREASURES[forgeRoll(0.7, 0.5)].rarity).toBe('rare');
  });

  it('equips up to three owned treasures', () => {
    const v = emptyVault();
    expect(toggleEquip(v, '金刚琢')).toBe(false);
    for (const id of ['金刚琢', '定风珠', '照妖镜', '人参果'] as const) addTreasure(v, id);
    expect(toggleEquip(v, '金刚琢')).toBe(true);
    expect(toggleEquip(v, '定风珠')).toBe(true);
    expect(toggleEquip(v, '照妖镜')).toBe(true);
    expect(toggleEquip(v, '人参果')).toBe(false);
    expect(toggleEquip(v, '金刚琢')).toBe(false);
    expect(v.equipped).toEqual(['定风珠', '照妖镜']);
  });
});

describe('run modifiers', () => {
  it('scale with tier and reach the simulation', () => {
    const v = emptyVault();
    addTreasure(v, '金刚琢', 2);
    addTreasure(v, '照妖镜');
    addTreasure(v, '缩地符');
    addTreasure(v, '紫金红葫芦');
    v.equipped = ['金刚琢', '照妖镜', '缩地符'];
    const mods = buildMods(v);
    expect(mods.campHpBonus).toBe(48);
    expect(mods.dmgMul).toBeCloseTo(1.1);
    expect(mods.startGongde).toBe(0);
    const g = createGame({ seed: 1, chapter: 1, mods });
    expect(g.campMax).toBe(CAMP_HP + 48);
    expect(g.campHp).toBe(g.campMax);
    expect(g.gongde).toBe(START_GONGDE);
    const arrow = put(g, 5, '箭');
    expect(tileDamage(arrow, g.mods)).toBeCloseTo(8 * 1.1);
    expect(tileRange(arrow, g.mods)).toBeCloseTo(200 * 1.15);
    expect(tileDamage(arrow)).toBe(8);
  });

  it('are neutral with nothing equipped', () => {
    expect(buildMods(emptyVault())).toEqual(defaultMods());
    const g = createGame({ seed: 1, chapter: 1 });
    expect(g.campMax).toBe(CAMP_HP);
  });
});
