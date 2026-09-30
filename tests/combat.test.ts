import { describe, expect, it } from 'vitest';
import { HASTE_CAP, SLOW_CAP } from '../src/config/units.ts';
import { computeHaste, findTarget, stepCombat } from '../src/core/combat.ts';
import { CELL_POS } from '../src/core/grid.ts';
import { tileInterval } from '../src/core/stats.ts';
import { battle, emptyGame, enemy, put } from './helpers.ts';

/** Cell 5 is row 1, col 1: centre (151, 231). The top-lane stop line for a 妖 is y = 129. */
const C5 = CELL_POS[5];

function runTicks(g: ReturnType<typeof emptyGame>, n: number): void {
  for (let i = 0; i < n; i++) stepCombat(g);
}

describe('targeting', () => {
  it('shoots the enemy in range that is closest to biting the camp', () => {
    const g = battle(emptyGame());
    const t = put(g, 5, '箭');
    enemy(g, '妖', C5.x, 60);
    const near = enemy(g, '妖', C5.x, 120);
    enemy(g, '妖', C5.x, 470); // bottom lane, 239 px away: out of range
    expect(findTarget(g, t, 5)).toBe(near);
  });

  it('does not bank cooldown while idle', () => {
    const g = battle(emptyGame());
    const t = put(g, 5, '雷');
    runTicks(g, 200);
    expect(t.cd).toBe(0);
    enemy(g, '妖', C5.x, 120);
    runTicks(g, 2);
    // Exactly one bolt: the idle time was not saved up into a burst.
    expect(g.events.filter((e) => e.t === 'shot')).toHaveLength(1);
    expect(t.cd).toBeGreaterThan(tileInterval(t) - 0.1);
  });
});

describe('projectiles', () => {
  it('deal damage only when they arrive', () => {
    const g = battle(emptyGame());
    put(g, 5, '箭');
    const e = enemy(g, '妖', C5.x, 120);
    stepCombat(g);
    expect(g.projectiles).toHaveLength(1);
    expect(e.hp).toBe(e.maxHp);
    runTicks(g, 15);
    expect(g.projectiles).toHaveLength(0);
    expect(e.maxHp - e.hp).toBeCloseTo(8);
  });

  it('火 bursts on impact and splashes 60% onto neighbours', () => {
    const g = battle(emptyGame());
    put(g, 5, '火');
    const target = enemy(g, '妖', C5.x, 120);
    const near = enemy(g, '妖', C5.x + 20, 118);
    const far = enemy(g, '妖', C5.x + 110, 118);
    runTicks(g, 30);
    expect(target.maxHp - target.hp).toBeCloseTo(9);
    expect(near.maxHp - near.hp).toBeCloseTo(5.4);
    expect(far.hp).toBe(far.maxHp);
  });

  it('冰 slows (capped), and 红孩儿 ignores it', () => {
    const g = battle(emptyGame());
    put(g, 5, '冰', 5, true);
    const imp = enemy(g, '妖', C5.x, 120);
    runTicks(g, 20);
    expect(imp.slowPct).toBe(SLOW_CAP);
    const h = battle(emptyGame());
    put(h, 5, '冰');
    const boss = enemy(h, '红孩儿', C5.x, 110);
    runTicks(h, 20);
    expect(boss.slowPct).toBe(0);
  });

  it('沙僧 executes weakened minions', () => {
    const g = battle(emptyGame());
    put(g, 5, '沙僧');
    const imp = enemy(g, '妖', C5.x, 120, 200);
    imp.hp = 55; // 55 - 30 = 25, below 15% of 200
    runTicks(g, 30);
    expect(g.enemies).not.toContain(imp);
    expect(g.events.some((e) => e.t === 'execute')).toBe(true);
  });
});

describe('instant attacks', () => {
  it('八戒 slams the ground: area damage and stun, half as long on bosses', () => {
    const g = battle(emptyGame());
    put(g, 5, '八戒');
    const target = enemy(g, '妖', C5.x, 129);
    const side = enemy(g, '妖', C5.x + 40, 129);
    const boss = enemy(g, '白骨精', C5.x - 30, 119);
    stepCombat(g);
    expect(target.maxHp - target.hp).toBeCloseTo(24);
    expect(side.maxHp - side.hp).toBeCloseTo(14.4);
    expect(target.stunT).toBeCloseTo(0.9);
    expect(boss.stunT).toBeCloseTo(0.45);
  });

  it('悟空 hits up to four enemies along the staff and nothing off the line', () => {
    const g = battle(emptyGame());
    put(g, 5, '悟空');
    const line = [129, 112, 95, 78, 61].map((y) => enemy(g, '妖', C5.x, y));
    const off = enemy(g, '妖', C5.x + 70, 100);
    stepCombat(g);
    const hit = line.filter((e) => e.hp < e.maxHp);
    expect(hit).toHaveLength(4);
    expect(off.hp).toBe(off.maxHp);
  });

  it('白龙 hits every enemy on the field', () => {
    const g = battle(emptyGame());
    put(g, 0, '白龙');
    const es = [enemy(g, '妖', 90, -10), enemy(g, '妖', 270, 500), enemy(g, '狼', 180, 60)];
    stepCombat(g);
    for (const e of es) expect(e.maxHp - e.hp).toBe(6);
  });

  it('棍 knocks minions back but not bosses', () => {
    const g = battle(emptyGame());
    put(g, 1, '棍');
    const imp = enemy(g, '妖', CELL_POS[1].x, 129);
    stepCombat(g);
    expect(imp.y).toBeCloseTo(125);
    const h = battle(emptyGame());
    put(h, 1, '棍');
    const boss = enemy(h, '黄风怪', CELL_POS[1].x, 119);
    stepCombat(h);
    expect(boss.y).toBe(119);
  });
});

describe('modifiers and supports', () => {
  it('速 hastes neighbours up to the cap', () => {
    const g = emptyGame();
    put(g, 5, '箭');
    put(g, 4, '速');
    expect(computeHaste(g)[5]).toBeCloseTo(0.2);
    put(g, 4, '速', 5);
    put(g, 6, '速', 5);
    expect(computeHaste(g)[5]).toBe(HASTE_CAP);
  });

  it('armour reduces every hit but never below 1', () => {
    const g = battle(emptyGame());
    put(g, 5, '冰');
    const boss = enemy(g, '黑熊精', C5.x, 110);
    runTicks(g, 20);
    expect(boss.maxHp - boss.hp).toBe(1);
  });

  it('白骨精 revives once, 蜘蛛精 splits into spiders', () => {
    const g = battle(emptyGame());
    const bone = enemy(g, '白骨精', 150, 100, 100);
    bone.hp = 0;
    stepCombat(g);
    expect(g.enemies).toContain(bone);
    expect(bone.hp).toBeCloseTo(40);
    bone.hp = 0;
    stepCombat(g);
    expect(g.enemies).not.toContain(bone);
    const spider = enemy(g, '蜘蛛精', 150, 100, 100);
    spider.hp = 0;
    stepCombat(g);
    expect(g.enemies.filter((e) => e.def === '蛛')).toHaveLength(5);
  });

  it('钱 pays out and 疗 only heals a hurt camp', () => {
    const g = battle(emptyGame());
    const money = put(g, 4, '钱');
    money.cd = 0.001;
    const before = g.gongde;
    stepCombat(g);
    expect(g.gongde).toBe(before + 3);
    const heal = put(g, 7, '疗');
    heal.cd = 0.001;
    stepCombat(g);
    expect(g.campHp).toBe(g.campMax);
    g.campHp = 50;
    heal.cd = 0.001;
    stepCombat(g);
    expect(g.campHp).toBe(56);
  });
});
