import { describe, expect, it } from 'vitest';
import { ULTIMATES } from '../src/config/ultimates.ts';
import { stepCombat } from '../src/core/combat.ts';
import { defaultMods } from '../src/core/treasures.ts';
import { isUltimateReady, rageGain } from '../src/core/ultimates.ts';
import { battle, emptyGame, enemy, put } from './helpers.ts';

// Test map (helpers.ts): a straight road down x = 216 from y = 72; slot 1 is at (120, 120), 96 px beside it.

describe('rage', () => {
  it('builds by a tenth per normal attack, faster for 神 and with 紧箍咒', () => {
    const g = battle(emptyGame());
    const hero = put(g, 1, '悟空');
    enemy(g, '妖', 48);
    stepCombat(g);
    expect(hero.rage).toBeCloseTo(0.1);
    expect(isUltimateReady(hero)).toBe(false);
    expect(g.events.some((e) => e.t === 'ultimate')).toBe(false);
    const mods = defaultMods();
    mods.rageMul = 1.3;
    expect(rageGain({ ...hero, divine: true }, mods)).toBeCloseTo(0.195);
  });

  it('never builds on non-heroes', () => {
    const g = battle(emptyGame());
    const arrow = put(g, 1, '箭');
    enemy(g, '妖', 48);
    stepCombat(g);
    expect(arrow.rage).toBe(0);
  });
});

describe('ultimates', () => {
  it('悟空 sweeps a long stretch of the road around the target and resets rage', () => {
    const g = battle(emptyGame());
    const hero = put(g, 1, '悟空');
    hero.rage = 1;
    const target = enemy(g, '妖', 150);
    const behind = [enemy(g, '妖', 48), enemy(g, '妖', 10)];
    const tooFar = enemy(g, '妖', 340);
    stepCombat(g);
    const ult = g.events.find((e) => e.t === 'ultimate');
    expect(ult).toMatchObject({ hero: '悟空', cell: 1, path: 0 });
    for (const e of [target, ...behind]) expect(e.maxHp - e.hp).toBeCloseTo(55 * ULTIMATES['悟空'].dmgMul);
    expect(tooFar.hp).toBe(tooFar.maxHp);
    expect(hero.rage).toBe(0);
    expect(g.events.filter((e) => e.t === 'shot')).toHaveLength(0);
  });

  it('八戒 drops the rake: triple damage and a long stun around the target, half on bosses', () => {
    const g = battle(emptyGame());
    const hero = put(g, 1, '八戒');
    hero.rage = 1;
    const target = enemy(g, '妖', 60);
    const near = enemy(g, '妖', 30);
    const far = enemy(g, '妖', 170);
    const boss = enemy(g, '白骨精', 10);
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
    const hero = put(g, 1, '沙僧');
    hero.rage = 1;
    const es = [300, 60, 100, 150, 120, 500].map((hp, i) => enemy(g, '妖', 20 + i * 20, hp));
    stepCombat(g);
    expect(g.enemies).not.toContain(es[1]);
    expect(g.events.some((e) => e.t === 'execute')).toBe(true);
    expect(es[2].hp).toBeCloseTo(100 - 30 * ULTIMATES['沙僧'].dmgMul);
    expect(es[0].hp).toBeCloseTo(300 - 45);
    expect(es[5].hp).toBe(500);
  });

  it('白龙 roars: everyone takes double damage, is pushed back down the road and slowed', () => {
    const g = battle(emptyGame());
    const hero = put(g, 2, '白龙');
    hero.rage = 1;
    const a = enemy(g, '妖', 100);
    const b = enemy(g, '妖', 300);
    stepCombat(g);
    expect(a.maxHp - a.hp).toBe(6 * ULTIMATES['白龙'].dmgMul);
    expect(b.maxHp - b.hp).toBe(6 * ULTIMATES['白龙'].dmgMul);
    expect(a.dist).toBeCloseTo(100 - ULTIMATES['白龙'].knockback);
    expect(b.dist).toBeCloseTo(300 - ULTIMATES['白龙'].knockback);
    expect(a.slowPct).toBeCloseTo(ULTIMATES['白龙'].slowPct);
    expect(a.slowT).toBeCloseTo(ULTIMATES['白龙'].slowDur);
  });

  it('悟空 sweeps the road only: flyers overhead are neither its target nor swept', () => {
    const g = battle(emptyGame(6));
    const hero = put(g, 1, '悟空');
    hero.rage = 1;
    // The bat is furthest along, so a normal attack would pick it first.
    const bat = enemy(g, '蝠', 160);
    const target = enemy(g, '妖', 150);
    const behind = enemy(g, '妖', 48);
    stepCombat(g);
    expect(g.events.find((e) => e.t === 'ultimate')).toMatchObject({ hero: '悟空', tx: target.x, ty: target.y });
    for (const e of [target, behind]) expect(e.maxHp - e.hp).toBeCloseTo(55 * ULTIMATES['悟空'].dmgMul);
    expect(bat.hp).toBe(bat.maxHp);
    expect(bat.dist).toBe(160);
    expect(hero.rage).toBe(0);
  });

  it('a charged 悟空 keeps its sweep for the ground when only flyers are in range', () => {
    const g = battle(emptyGame(6));
    const hero = put(g, 1, '悟空');
    hero.rage = 1;
    const bat = enemy(g, '蝠', 100);
    stepCombat(g);
    expect(g.events.some((e) => e.t === 'ultimate')).toBe(false);
    expect(hero.rage).toBe(1);
    expect(bat.hp).toBe(bat.maxHp);
  });

  it("白龙's roar and 八戒's rake hit flyers too, without pushing them back", () => {
    const g = battle(emptyGame(6));
    const dragon = put(g, 2, '白龙');
    dragon.rage = 1;
    const bat = enemy(g, '蝠', 100);
    const imp = enemy(g, '妖', 300);
    stepCombat(g);
    expect(bat.maxHp - bat.hp).toBe(6 * ULTIMATES['白龙'].dmgMul);
    expect(bat.slowPct).toBeCloseTo(ULTIMATES['白龙'].slowPct);
    expect(bat.dist).toBe(100);
    expect(imp.dist).toBeCloseTo(300 - ULTIMATES['白龙'].knockback);
    const h = battle(emptyGame(6));
    const pig = put(h, 1, '八戒');
    pig.rage = 1;
    // 八戒 still aims at the ground, but the rake falls on the flyer above its target too.
    const walker = enemy(h, '妖', 60);
    const roc = enemy(h, '鹏', 30);
    stepCombat(h);
    expect(h.events.find((e) => e.t === 'ultimate')).toMatchObject({ hero: '八戒', tx: walker.x, ty: walker.y });
    expect(roc.maxHp - roc.hp).toBeCloseTo(24 * ULTIMATES['八戒'].dmgMul);
    expect(roc.stunT).toBeCloseTo(ULTIMATES['八戒'].stun);
    expect(roc.dist).toBe(30);
  });

  it('waits for a target instead of wasting the charge', () => {
    const g = battle(emptyGame());
    const hero = put(g, 1, '八戒');
    hero.rage = 1;
    stepCombat(g);
    expect(hero.rage).toBe(1);
    expect(g.events.some((e) => e.t === 'ultimate')).toBe(false);
  });
});
