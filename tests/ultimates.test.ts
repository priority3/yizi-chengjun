import { describe, expect, it } from 'vitest';
import { ULTIMATES } from '../src/config/ultimates.ts';
import { stepCombat } from '../src/core/combat.ts';
import { CELL_POS } from '../src/core/grid.ts';
import { defaultMods } from '../src/core/treasures.ts';
import { isUltimateReady, rageGain } from '../src/core/ultimates.ts';
import { battle, emptyGame, enemy, put } from './helpers.ts';

/** Cell 5 is row 1, col 1: centre (151, 231). The top-lane stop line for a 妖 is y = 129. */
const C5 = CELL_POS[5];

describe('rage', () => {
  it('builds by a tenth per normal attack, faster for 神 and with 紧箍咒', () => {
    const g = battle(emptyGame());
    const hero = put(g, 5, '悟空');
    enemy(g, '妖', C5.x, 120);
    stepCombat(g);
    expect(hero.rage).toBeCloseTo(0.1);
    expect(isUltimateReady(hero)).toBe(false);
    expect(g.events.some((e) => e.t === 'ultimate')).toBe(false);
    const mods = defaultMods();
    mods.rageMul = 1.3;
    expect(rageGain({ ...hero, divine: true }, mods)).toBeCloseTo(0.195);
  });

  it('never builds on non-heroes and survives a merge', () => {
    const g = battle(emptyGame());
    const arrow = put(g, 5, '箭');
    enemy(g, '妖', C5.x, 120);
    stepCombat(g);
    expect(arrow.rage).toBe(0);
  });
});

describe('ultimates', () => {
  it('悟空 sweeps the whole lane of the target and resets rage', () => {
    const g = battle(emptyGame());
    const hero = put(g, 5, '悟空');
    hero.rage = 1;
    const top = [enemy(g, '妖', C5.x, 120), enemy(g, '妖', C5.x + 100, 60), enemy(g, '妖', 100, 20)];
    const bottom = enemy(g, '妖', C5.x, 470);
    stepCombat(g);
    const ult = g.events.find((e) => e.t === 'ultimate');
    expect(ult).toMatchObject({ hero: '悟空', cell: 5, lane: 0 });
    for (const e of top) expect(e.maxHp - e.hp).toBeCloseTo(55 * ULTIMATES['悟空'].dmgMul);
    expect(bottom.hp).toBe(bottom.maxHp);
    expect(hero.rage).toBe(0);
    expect(g.events.filter((e) => e.t === 'shot')).toHaveLength(0);
  });

  it('八戒 drops the rake: triple damage and a long stun around the target, half on bosses', () => {
    const g = battle(emptyGame());
    const hero = put(g, 5, '八戒');
    hero.rage = 1;
    const target = enemy(g, '妖', C5.x, 129);
    const near = enemy(g, '妖', C5.x + 60, 110);
    const far = enemy(g, '妖', C5.x + 150, 100);
    const boss = enemy(g, '白骨精', C5.x + 30, 119);
    stepCombat(g);
    const dmg = 24 * ULTIMATES['八戒'].dmgMul;
    expect(target.maxHp - target.hp).toBeCloseTo(dmg);
    expect(near.maxHp - near.hp).toBeCloseTo(dmg);
    expect(far.hp).toBe(far.maxHp);
    expect(target.stunT).toBeCloseTo(1.6);
    expect(boss.stunT).toBeCloseTo(0.8);
  });

  it('沙僧 chain-slashes the five weakest in range and executes under 35%', () => {
    const g = battle(emptyGame());
    const hero = put(g, 5, '沙僧');
    hero.rage = 1;
    const es = [300, 60, 100, 150, 120, 500].map((hp, i) => enemy(g, '妖', C5.x - 50 + i * 20, 110, hp));
    stepCombat(g);
    expect(g.enemies).not.toContain(es[1]);
    expect(g.events.some((e) => e.t === 'execute')).toBe(true);
    expect(es[2].hp).toBeCloseTo(100 - 30 * ULTIMATES['沙僧'].dmgMul);
    expect(es[0].hp).toBeCloseTo(300 - 45);
    expect(es[5].hp).toBe(500);
  });

  it('白龙 roars: everyone takes double damage, is pushed back and slowed', () => {
    const g = battle(emptyGame());
    const hero = put(g, 0, '白龙');
    hero.rage = 1;
    const a = enemy(g, '妖', 90, 100);
    const b = enemy(g, '妖', 270, 420);
    stepCombat(g);
    expect(a.maxHp - a.hp).toBe(6 * ULTIMATES['白龙'].dmgMul);
    expect(b.maxHp - b.hp).toBe(6 * ULTIMATES['白龙'].dmgMul);
    expect(a.y).toBeCloseTo(100 - ULTIMATES['白龙'].knockback);
    expect(b.y).toBeCloseTo(420 + ULTIMATES['白龙'].knockback);
    expect(a.slowPct).toBeCloseTo(ULTIMATES['白龙'].slowPct);
    expect(a.slowT).toBeCloseTo(ULTIMATES['白龙'].slowDur);
  });

  it('waits for a target instead of wasting the charge', () => {
    const g = battle(emptyGame());
    const hero = put(g, 5, '八戒');
    hero.rage = 1;
    stepCombat(g);
    expect(hero.rage).toBe(1);
    expect(g.events.some((e) => e.t === 'ultimate')).toBe(false);
  });
});
