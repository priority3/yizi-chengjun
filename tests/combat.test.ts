import { describe, expect, it } from 'vitest';
import { HASTE_CAP, SLOW_CAP } from '../src/config/units.ts';
import { CELL_SLOT, COLS, PATH_LEN } from '../src/core/board.ts';
import { computeHaste, DT, findTarget, stepSide } from '../src/core/combat.ts';
import { tileInterval } from '../src/core/stats.ts';
import { emptyMatch, enemy, put } from './helpers.ts';

/** Slot index of a board cell. */
const at = (row: number, col: number) => CELL_SLOT[row * COLS + col];
/** Slot between the two horizontal road segments (row 2, col 3). */
const MID = at(2, 3);

describe('targeting', () => {
  it('shoots the enemy in range that has walked furthest', () => {
    const m = emptyMatch();
    const t = put(m, 0, MID, '箭');
    enemy(m, 0, '妖', 3); // row 1, x = 3.0
    const far = enemy(m, 0, '妖', 9); // row 3, x = 4.0
    enemy(m, 0, '妖', 0.2); // near the portal, out of range
    expect(findTarget(m.sides[0], t, MID)).toBe(far);
  });

  it('finds nothing out of range', () => {
    const m = emptyMatch();
    const t = put(m, 0, at(0, 6), '棍');
    enemy(m, 0, '妖', 11); // row 3, x = 2.0
    expect(findTarget(m.sides[0], t, at(0, 6))).toBeNull();
  });

  it('does not bank cooldown while idle', () => {
    const m = emptyMatch();
    const t = put(m, 0, MID, '雷');
    for (let i = 0; i < 300; i++) stepSide(m, 0);
    expect(t.cd).toBe(0);
    enemy(m, 0, '妖', 9);
    stepSide(m, 0);
    stepSide(m, 0);
    const hits = m.events.filter((e) => e.t === 'hit').length;
    expect(hits).toBeLessThanOrEqual(1);
    expect(t.cd).toBeGreaterThan(tileInterval(t) - 3 * DT);
  });
});

describe('effects', () => {
  it('火 splashes 60% onto neighbours of the target', () => {
    const m = emptyMatch();
    put(m, 0, MID, '火');
    const target = enemy(m, 0, '妖', 9);
    const near = enemy(m, 0, '妖', 8.5);
    const farAway = enemy(m, 0, '妖', 12.5);
    stepSide(m, 0);
    expect(target.maxHp - target.hp).toBeCloseTo(8);
    expect(near.maxHp - near.hp).toBeCloseTo(4.8);
    expect(farAway.hp).toBe(farAway.maxHp);
  });

  it('冰 slows, caps the slow, and 红孩儿 ignores it', () => {
    const m = emptyMatch();
    put(m, 0, MID, '冰', 5, true);
    const imp = enemy(m, 0, '妖', 9);
    stepSide(m, 0);
    expect(imp.slowPct).toBe(SLOW_CAP);

    const m2 = emptyMatch();
    put(m2, 0, MID, '冰');
    const boss = enemy(m2, 0, '红孩儿', 9);
    stepSide(m2, 0);
    expect(boss.slowPct).toBe(0);
  });

  it('八戒 stuns minions fully and bosses for half as long', () => {
    const m = emptyMatch();
    put(m, 0, MID, '八戒');
    const imp = enemy(m, 0, '妖', 9);
    const boss = enemy(m, 0, '黑熊精', 8.9);
    stepSide(m, 0);
    expect(imp.stunT).toBeCloseTo(0.8);
    expect(boss.stunT).toBeCloseTo(0.4);
  });

  it('悟空 pierces through at most two enemies behind the target', () => {
    const m = emptyMatch();
    put(m, 0, MID, '悟空');
    const lead = enemy(m, 0, '妖', 9.5);
    const b1 = enemy(m, 0, '妖', 9.0);
    const b2 = enemy(m, 0, '妖', 8.6);
    const b3 = enemy(m, 0, '妖', 8.4);
    stepSide(m, 0);
    for (const e of [lead, b1, b2]) expect(e.hp).toBeLessThan(e.maxHp);
    expect(b3.hp).toBe(b3.maxHp);
  });

  it('沙僧 executes weakened minions but needs bosses lower', () => {
    const m = emptyMatch();
    put(m, 0, MID, '沙僧');
    const imp = enemy(m, 0, '妖', 9, 200);
    imp.hp = 55; // 55 - 30 = 25 < 15% of 200
    stepSide(m, 0);
    expect(m.sides[0].enemies).not.toContain(imp);

    const m2 = emptyMatch();
    put(m2, 0, MID, '沙僧');
    const boss = enemy(m2, 0, '黑熊精', 9, 1000);
    boss.hp = 130; // 130 - 30 = 100: below 15% but above the 5% boss threshold
    stepSide(m2, 0);
    expect(boss.hp).toBeCloseTo(100);
  });

  it('白龙 hits every enemy on its side regardless of distance', () => {
    const m = emptyMatch();
    put(m, 0, at(0, 6), '白龙');
    const es = [enemy(m, 0, '妖', 0.5), enemy(m, 0, '妖', 6), enemy(m, 0, '妖', 12.5)];
    stepSide(m, 0);
    for (const e of es) expect(e.hp).toBe(e.maxHp - 6);
  });

  it('速 hastes its neighbours up to the cap', () => {
    const m = emptyMatch();
    put(m, 0, MID, '箭');
    put(m, 0, at(2, 2), '速');
    put(m, 0, at(2, 1), '速', 5); // two cells away: no effect on MID
    expect(computeHaste(m.sides[0])[MID]).toBeCloseTo(0.2);
    // Reason: MID's only neighbouring slots are (2,2) and (2,4) — rows 1 and 3 are road.
    put(m, 0, at(2, 2), '速', 5);
    put(m, 0, at(2, 4), '速', 5);
    expect(computeHaste(m.sides[0])[MID]).toBe(HASTE_CAP);
  });

  it('牛魔王 armour reduces every hit but never below 1', () => {
    const m = emptyMatch();
    put(m, 0, MID, '冰');
    const boss = enemy(m, 0, '牛魔王', 9);
    stepSide(m, 0);
    expect(boss.maxHp - boss.hp).toBe(1);
  });

  it('白骨精 revives twice before it finally dies', () => {
    const m = emptyMatch();
    const boss = enemy(m, 0, '白骨精', 9, 100);
    const side = m.sides[0];
    for (let i = 0; i < 2; i++) {
      boss.hp = 0;
      stepSide(m, 0);
      expect(side.enemies).toContain(boss);
      expect(boss.hp).toBeCloseTo(35, 0);
    }
    boss.hp = 0;
    stepSide(m, 0);
    expect(side.enemies).not.toContain(boss);
    expect(side.kills).toBe(1);
  });
});

describe('economy and hearts', () => {
  it('pays the bounty on kills', () => {
    const m = emptyMatch();
    put(m, 0, MID, '雷');
    enemy(m, 0, '妖', 9, 10);
    const before = m.sides[0].gongde;
    stepSide(m, 0);
    expect(m.sides[0].gongde).toBe(before + 5);
    expect(m.sides[0].kills).toBe(1);
  });

  it('takes hearts when an enemy reaches 唐僧', () => {
    const m = emptyMatch();
    enemy(m, 0, '妖', PATH_LEN - 0.001);
    enemy(m, 0, '黑熊精', PATH_LEN - 0.001);
    stepSide(m, 0);
    expect(m.sides[0].hearts).toBe(0);
    expect(m.sides[0].leaks).toBe(2);
    expect(m.sides[0].enemies).toHaveLength(0);
  });

  it('钱 pays out every cycle', () => {
    const m = emptyMatch();
    const t = put(m, 0, 0, '钱');
    t.cd = DT / 2;
    const before = m.sides[0].gongde;
    stepSide(m, 0);
    expect(m.sides[0].gongde).toBe(before + 3);
  });

  it('疗 only heals while 唐僧 is hurt, and never in overtime', () => {
    const m = emptyMatch();
    const t = put(m, 0, 0, '疗');
    t.cd = DT / 2;
    stepSide(m, 0);
    expect(m.sides[0].hearts).toBe(3);
    expect(t.cd).toBeCloseTo(tileInterval(t));

    m.sides[0].hearts = 1;
    t.cd = DT / 2;
    stepSide(m, 0);
    expect(m.sides[0].hearts).toBe(2);

    m.phase = 'overtime';
    t.cd = DT / 2;
    stepSide(m, 0);
    expect(m.sides[0].hearts).toBe(2);
  });
});
