import { describe, expect, it } from 'vitest';
import { HASTE_CAP, SLOW_CAP } from '../src/config/units.ts';
import { computeHaste, findTarget, stepCombat } from '../src/core/combat.ts';
import { tileInterval } from '../src/core/stats.ts';
import { battle, emptyGame, enemy, put } from './helpers.ts';

// Test map (helpers.ts): the road runs straight down x = 216 from y = 72 (dist 0). Slot 0 is on the road's
// axis at (216, 24); slot 1 is at (120, 120), 96 px beside the road. An enemy at dist d stands at (216, 72 + d).

function runTicks(g: ReturnType<typeof emptyGame>, n: number): void {
  for (let i = 0; i < n; i++) stepCombat(g);
}

describe('targeting', () => {
  it('shoots the enemy in range that is furthest down the road', () => {
    const g = battle(emptyGame());
    const t = put(g, 1, '箭');
    enemy(g, '妖', 20);
    const lead = enemy(g, '妖', 60);
    enemy(g, '妖', 340); // 300+ px away: out of range
    expect(findTarget(g, t, 1)).toBe(lead);
  });

  it('does not bank cooldown while idle', () => {
    const g = battle(emptyGame());
    const t = put(g, 1, '雷');
    runTicks(g, 200);
    expect(t.cd).toBe(0);
    enemy(g, '妖', 48);
    runTicks(g, 2);
    // Exactly one bolt: the idle time was not saved up into a burst.
    expect(g.events.filter((e) => e.t === 'shot')).toHaveLength(1);
    expect(t.cd).toBeGreaterThan(tileInterval(t) - 0.1);
  });
});

describe('projectiles', () => {
  it('deal damage only when they arrive', () => {
    const g = battle(emptyGame());
    put(g, 1, '箭');
    const e = enemy(g, '妖', 48);
    stepCombat(g);
    expect(g.projectiles).toHaveLength(1);
    expect(e.hp).toBe(e.maxHp);
    runTicks(g, 15);
    expect(g.projectiles).toHaveLength(0);
    expect(e.maxHp - e.hp).toBeCloseTo(8);
  });

  it('火 bursts on impact and splashes 60% onto neighbours', () => {
    const g = battle(emptyGame());
    put(g, 1, '火');
    const target = enemy(g, '妖', 90);
    const near = enemy(g, '妖', 70);
    const far = enemy(g, '妖', 0);
    runTicks(g, 40);
    expect(target.maxHp - target.hp).toBeCloseTo(9);
    expect(near.maxHp - near.hp).toBeCloseTo(5.4);
    expect(far.hp).toBe(far.maxHp);
  });

  it('冰 slows (capped), and 红孩儿 ignores it', () => {
    const g = battle(emptyGame());
    put(g, 1, '冰', 5, true);
    const imp = enemy(g, '妖', 48);
    runTicks(g, 20);
    expect(imp.slowPct).toBe(SLOW_CAP);
    const h = battle(emptyGame());
    put(h, 1, '冰');
    const boss = enemy(h, '红孩儿', 48);
    runTicks(h, 20);
    expect(boss.slowPct).toBe(0);
  });

  it('沙僧 executes weakened minions', () => {
    const g = battle(emptyGame());
    put(g, 1, '沙僧');
    const imp = enemy(g, '妖', 48, 200);
    imp.hp = 55; // 55 - 30 = 25, below 15% of 200
    runTicks(g, 30);
    expect(g.enemies).not.toContain(imp);
    expect(g.events.some((e) => e.t === 'execute')).toBe(true);
  });
});

describe('instant attacks', () => {
  it('八戒 slams the ground: area damage and stun, half as long on bosses', () => {
    const g = battle(emptyGame());
    put(g, 1, '八戒');
    const target = enemy(g, '妖', 60);
    const side = enemy(g, '妖', 30);
    const boss = enemy(g, '白骨精', 10);
    stepCombat(g);
    expect(target.maxHp - target.hp).toBeCloseTo(24);
    expect(side.maxHp - side.hp).toBeCloseTo(14.4);
    expect(target.stunT).toBeCloseTo(0.9);
    expect(boss.stunT).toBeCloseTo(0.45);
  });

  it('悟空 hits up to four enemies along the staff', () => {
    const g = battle(emptyGame());
    put(g, 0, '悟空');
    const line = [100, 80, 60, 40, 20].map((d) => enemy(g, '妖', d));
    stepCombat(g);
    const hit = line.filter((e) => e.hp < e.maxHp);
    expect(hit).toHaveLength(4);
    expect(g.events.some((e) => e.t === 'shot' && e.kind === 'beam')).toBe(true);
  });

  it('白龙 hits every enemy on the field', () => {
    const g = battle(emptyGame());
    put(g, 1, '白龙');
    const es = [enemy(g, '妖', 0), enemy(g, '妖', 200), enemy(g, '狼', 380)];
    stepCombat(g);
    for (const e of es) expect(e.maxHp - e.hp).toBe(6);
  });

  it('棍 knocks minions back along the road but not bosses', () => {
    const g = battle(emptyGame());
    put(g, 0, '棍');
    const imp = enemy(g, '妖', 40);
    stepCombat(g);
    expect(imp.dist).toBeCloseTo(36);
    expect(imp.y).toBeCloseTo(108);
    const h = battle(emptyGame());
    put(h, 0, '棍');
    const boss = enemy(h, '黄风怪', 40);
    stepCombat(h);
    expect(boss.dist).toBe(40);
  });
});

// On the test map a flyer's flight line runs straight down the road, so a bat at dist d hovers over (216, 72 + d) too.
describe('flying monsters', () => {
  it('are out of reach of 棍 and 八戒, but not of 箭', () => {
    const g = battle(emptyGame(6));
    const club = put(g, 0, '棍');
    const pig = put(g, 1, '八戒');
    const arrow = put(g, 3, '箭');
    const bat = enemy(g, '蝠', 60);
    expect(findTarget(g, club, 0)).toBeNull();
    expect(findTarget(g, pig, 1)).toBeNull();
    expect(findTarget(g, arrow, 3)).toBe(bat);
    // Behind a walker or ahead of it, the ground fighters only ever pick the walker.
    const imp = enemy(g, '妖', 30);
    expect(findTarget(g, club, 0)).toBe(imp);
    expect(findTarget(g, pig, 1)).toBe(imp);
    expect(findTarget(g, arrow, 3)).toBe(bat);
  });

  it('take ×1.3 damage from 箭 and 雷, ×1 from the rest', () => {
    const g = battle(emptyGame(6));
    put(g, 1, '箭');
    const bat = enemy(g, '蝠', 48);
    runTicks(g, 15);
    expect(bat.maxHp - bat.hp).toBeCloseTo(8 * 1.3);
    const h = battle(emptyGame(6));
    put(h, 1, '雷');
    const roc = enemy(h, '鹏', 48);
    stepCombat(h);
    expect(roc.maxHp - roc.hp).toBeCloseTo(38 * 1.3);
    const k = battle(emptyGame(6));
    put(k, 1, '冰');
    const bat2 = enemy(k, '蝠', 48);
    runTicks(k, 20);
    expect(bat2.maxHp - bat2.hp).toBeCloseTo(4);
    expect(bat2.slowT).toBeGreaterThan(0);
  });

  it("are caught in 火's splash (its unit hits the air), never in 八戒's slam", () => {
    const g = battle(emptyGame(6));
    put(g, 1, '火');
    const target = enemy(g, '妖', 90);
    const bat = enemy(g, '蝠', 70);
    runTicks(g, 40);
    expect(target.maxHp - target.hp).toBeCloseTo(9);
    expect(bat.maxHp - bat.hp).toBeCloseTo(9 * 0.6);
    const h = battle(emptyGame(6));
    put(h, 1, '八戒');
    const imp = enemy(h, '妖', 60);
    const over = enemy(h, '蝠', 50);
    stepCombat(h);
    expect(imp.maxHp - imp.hp).toBeCloseTo(24);
    expect(imp.stunT).toBeCloseTo(0.9);
    expect(over.hp).toBe(over.maxHp);
    expect(over.stunT).toBe(0);
  });

  it("are hit by 悟空's staff and 白龙's sweep, which reach the air", () => {
    const g = battle(emptyGame(6));
    put(g, 0, '悟空');
    const line = [enemy(g, '蝠', 100), enemy(g, '妖', 80), enemy(g, '蝠', 60)];
    stepCombat(g);
    for (const e of line) expect(e.maxHp - e.hp).toBeCloseTo(55);
    // Hit, but not pushed back like the walker.
    expect(line[0].dist).toBe(100);
    expect(line[1].dist).toBeCloseTo(74);
    const h = battle(emptyGame(6));
    put(h, 1, '白龙');
    const bat = enemy(h, '蝠', 300);
    stepCombat(h);
    expect(bat.maxHp - bat.hp).toBe(6);
  });
});

describe('modifiers and supports', () => {
  it('速 hastes slots within reach up to the cap', () => {
    const g = emptyGame();
    put(g, 3, '箭');
    put(g, 1, '速');
    expect(computeHaste(g)[3]).toBeCloseTo(0.2);
    expect(computeHaste(g)[2]).toBe(0);
    put(g, 1, '速', 5);
    put(g, 5, '速', 5);
    expect(computeHaste(g)[3]).toBe(HASTE_CAP);
  });

  it('armour reduces every hit but never below 1', () => {
    const g = battle(emptyGame());
    put(g, 1, '冰');
    const boss = enemy(g, '黑熊精', 48);
    runTicks(g, 20);
    expect(boss.maxHp - boss.hp).toBe(1);
  });

  it('白骨精 revives once, 蜘蛛精 splits into spiders', () => {
    const g = battle(emptyGame());
    const bone = enemy(g, '白骨精', 100, 100);
    bone.hp = 0;
    stepCombat(g);
    expect(g.enemies).toContain(bone);
    expect(bone.hp).toBeCloseTo(40);
    bone.hp = 0;
    stepCombat(g);
    expect(g.enemies).not.toContain(bone);
    const spider = enemy(g, '蜘蛛精', 100, 100);
    spider.hp = 0;
    stepCombat(g);
    const babies = g.enemies.filter((e) => e.def === '蛛');
    expect(babies).toHaveLength(5);
    for (const b of babies) expect(b.dist).toBeLessThanOrEqual(100);
  });

  it('钱 pays out and 疗 only heals a hurt camp', () => {
    const g = battle(emptyGame());
    const money = put(g, 1, '钱');
    money.cd = 0.001;
    const before = g.gongde;
    stepCombat(g);
    expect(g.gongde).toBe(before + 3);
    const heal = put(g, 2, '疗');
    heal.cd = 0.001;
    stepCombat(g);
    expect(g.campHp).toBe(g.campMax);
    g.campHp = 50;
    heal.cd = 0.001;
    stepCombat(g);
    expect(g.campHp).toBe(56);
  });
});
