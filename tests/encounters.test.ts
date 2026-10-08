import { describe, expect, it } from 'vitest';
import { CAMP_HP, waveBonus } from '../src/config/chapters.ts';
import { ENEMIES } from '../src/config/enemies.ts';
import { stepCombat } from '../src/core/combat.ts';
import { applyEncounter, defaultWaveMods, encounterDue, modsLabel, rollEncounters } from '../src/core/encounters.ts';
import { act, createGame, step } from '../src/core/game.ts';
import { stopY } from '../src/core/grid.ts';
import { moveEnemies } from '../src/core/monsters.ts';
import { currentRefreshCost, offerPrice } from '../src/core/shop.ts';
import { MINI_BOSS_BOUNTY, THIEF_BOUNTY, waveHp, waveSize } from '../src/core/waves.ts';
import { battle, emptyGame, enemy, put } from './helpers.ts';

/** Clears wave `w` of a fresh run instantly (no spawns) and returns the run in its next build phase. */
function clearWave(w: number) {
  const g = emptyGame();
  g.wave = w - 1;
  act(g, { t: 'start' });
  g.spawns = [];
  step(g);
  return g;
}

describe('encounter timing', () => {
  it('opens after every second cleared wave, never after the last', () => {
    expect(encounterDue(1, 5)).toBe(false);
    expect(encounterDue(2, 5)).toBe(true);
    expect(encounterDue(4, 5)).toBe(true);
    expect(encounterDue(5, 5)).toBe(false);
    expect(encounterDue(6, 6)).toBe(false);
    expect(encounterDue(6, 7)).toBe(true);
  });

  it('offers three distinct cards and blocks the shop until one is chosen', () => {
    const g = clearWave(2);
    expect(g.phase).toBe('build');
    expect(g.encounter).toHaveLength(3);
    expect(new Set(g.encounter).size).toBe(3);
    expect(g.encounters).toBe(1);
    expect(g.events.some((e) => e.t === 'encounterOffer')).toBe(true);
    expect(act(g, { t: 'buy', offer: 0, cell: 5 })).toBe('phase');
    expect(act(g, { t: 'refresh' })).toBe('phase');
    expect(act(g, { t: 'start' })).toBe('phase');
    expect(act(g, { t: 'choose', option: 5 })).toBe('none');
    expect(act(g, { t: 'choose', option: 1 })).toBe('ok');
    expect(g.encounter).toBeNull();
    expect(act(g, { t: 'start' })).toBe('ok');
    expect(clearWave(1).encounter).toBeNull();
  });

  it('rolls with the run RNG', () => {
    const a = createGame({ seed: 5, chapter: 1 });
    const b = createGame({ seed: 5, chapter: 1 });
    expect(rollEncounters(a)).toEqual(rollEncounters(b));
  });
});

describe('boons and trades', () => {
  it('观音赐福 heals and raises the cap, 财神到 pays, 天降神字 drops a 神', () => {
    const g = emptyGame();
    g.campHp = 30;
    applyEncounter(g, '观音赐福');
    expect(g.campMax).toBe(CAMP_HP + 10);
    expect(g.campHp).toBe(g.campMax);
    const before = g.gongde;
    applyEncounter(g, '财神到');
    expect(g.gongde).toBe(before + 50);
    applyEncounter(g, '天降神字');
    expect(g.slots.filter((t) => t?.id === '神')).toHaveLength(1);
  });

  it('天降神字 pays 功德 instead when the camp is full', () => {
    const g = emptyGame();
    for (let i = 0; i < g.slots.length; i++) if (g.unlocked[i]) put(g, i, '箭');
    const before = g.gongde;
    applyEncounter(g, '天降神字');
    expect(g.gongde).toBe(before + 40);
  });

  it('土地公摆摊 halves prices and makes refreshing free for one build phase', () => {
    const g = emptyGame();
    g.shop = [{ id: '雷', price: 16, sold: false }];
    applyEncounter(g, '土地公摆摊');
    expect(offerPrice(g, g.shop[0])).toBe(8);
    expect(currentRefreshCost(g)).toBe(0);
    const before = g.gongde;
    expect(act(g, { t: 'refresh' })).toBe('ok');
    expect(g.gongde).toBe(before);
    act(g, { t: 'start' });
    expect(g.shopDiscount).toBe(1);
    expect(g.freeRefresh).toBe(false);
  });

  it('宝箱 opens after the next wave with a card on an empty cell', () => {
    const g = emptyGame();
    applyEncounter(g, '宝箱');
    expect(g.chest).toBe(true);
    act(g, { t: 'start' });
    g.spawns = [];
    step(g);
    expect(g.chest).toBe(false);
    expect(g.events.some((e) => e.t === 'chest' && e.cell >= 0)).toBe(true);
    expect(g.slots.filter((t) => t !== null)).toHaveLength(1);
  });
});

describe('challenges', () => {
  it('妖风大作 speeds the next wave up and doubles its rewards, then resets', () => {
    const g = emptyGame();
    applyEncounter(g, '妖风大作');
    act(g, { t: 'start' });
    for (const s of g.spawns) {
      expect(s.speed).toBeCloseTo(ENEMIES[s.def].speed * 1.4);
      expect(s.bounty).toBe(ENEMIES[s.def].bounty * 2);
    }
    expect(g.waveMods).toEqual(defaultWaveMods());
    expect(g.activeMods.bonusMul).toBe(2);
    g.spawns = [];
    const before = g.gongde;
    step(g);
    expect(g.gongde).toBe(before + waveBonus(1) * 2);
  });

  it('月圆之夜 adds half again to every HP bar', () => {
    const g = emptyGame();
    applyEncounter(g, '月圆之夜');
    act(g, { t: 'start' });
    for (const s of g.spawns) expect(s.hp).toBe(Math.round(waveHp(s.def, 1, 1) * 1.5));
  });

  it('狼群来袭 replaces the wave with half again as many wolves', () => {
    const g = emptyGame();
    applyEncounter(g, '狼群来袭');
    act(g, { t: 'start' });
    expect(g.spawns).toHaveLength(Math.round(waveSize(1, 1) * 1.5));
    expect(g.spawns.every((s) => s.def === '狼')).toBe(true);
  });

  it('盗宝妖 slips a thief into the middle of the wave', () => {
    const g = emptyGame();
    applyEncounter(g, '盗宝妖');
    act(g, { t: 'start' });
    const thieves = g.spawns.filter((s) => s.def === '盗');
    expect(thieves).toHaveLength(1);
    expect(thieves[0].bounty).toBe(THIEF_BOUNTY);
    const i = g.spawns.indexOf(thieves[0]);
    expect(i).toBeGreaterThan(0);
    expect(i).toBeLessThan(g.spawns.length - 1);
    for (let k = 1; k < g.spawns.length; k++) expect(g.spawns[k].at).toBeGreaterThanOrEqual(g.spawns[k - 1].at);
  });

  it('妖王亲临 brings an earlier boss at half HP (chapter 1 previews its own)', () => {
    const g = emptyGame(3);
    applyEncounter(g, '妖王亲临');
    const boss = g.waveMods.miniBoss as string;
    expect(['白骨精', '黄风怪']).toContain(boss);
    act(g, { t: 'start' });
    const last = g.spawns.at(-1);
    expect(last).toMatchObject({ def: boss, bounty: MINI_BOSS_BOUNTY, hp: Math.round(waveHp(boss, 3, 1) * 0.5) });
    const h = emptyGame(1);
    applyEncounter(h, '妖王亲临');
    expect(h.waveMods.miniBoss).toBe('白骨精');
  });

  it('the thief robs the camp and vanishes without bounty', () => {
    const g = battle(emptyGame());
    const thief = enemy(g, '盗', 150, stopY(0, ENEMIES['盗'].radius));
    g.gongde = 50;
    moveEnemies(g);
    expect(g.gongde).toBe(20);
    expect(thief.gone).toBe(true);
    expect(g.events.some((e) => e.t === 'steal' && e.amount === 30)).toBe(true);
    expect(g.campHp).toBe(g.campMax);
    stepCombat(g);
    expect(g.enemies).toHaveLength(0);
    expect(g.kills).toBe(0);
    expect(g.gongde).toBe(20);
  });

  it('describes the queued modifiers for the HUD', () => {
    expect(modsLabel(defaultWaveMods())).toBe('');
    const g = emptyGame();
    applyEncounter(g, '狼群来袭');
    expect(modsLabel(g.waveMods)).toContain('狼');
    expect(modsLabel(g.waveMods)).toContain('赏金 ×2');
  });
});
