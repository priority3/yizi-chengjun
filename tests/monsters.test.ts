import { describe, expect, it } from 'vitest';
import { LEAK_MUL } from '../src/config/chapters.ts';
import { ENEMIES } from '../src/config/enemies.ts';
import { MAP_SPEED, type MapDef } from '../src/config/maps.ts';
import { TICKS_PER_SEC } from '../src/core/clock.ts';
import { stepCombat } from '../src/core/combat.ts';
import { applySlow, applyStun, knock } from '../src/core/effects.ts';
import { makeEnemy, moveEnemies, routeOf } from '../src/core/monsters.ts';
import { battle, emptyGame, enemy, ROAD_X, roadY } from './helpers.ts';

/** The road runs right along the top, then down to the camp at (168, 168); flyers cut the corner from (24, 24). */
const BEND: MapDef = { theme: 'ridge', rows: ['1###', '.O.#', '...#', '...E'] };

function runSeconds(g: ReturnType<typeof emptyGame>, s: number): void {
  for (let i = 0; i < s * TICKS_PER_SEC; i++) moveEnemies(g);
}

describe('enemies', () => {
  it('walk the road at their speed and leave the field when they reach the camp', () => {
    const g = battle(emptyGame());
    const imp = enemy(g, '妖', 0, 100);
    runSeconds(g, 1);
    expect(imp.dist).toBeCloseTo(ENEMIES['妖'].speed * MAP_SPEED, 0);
    expect(imp.x).toBe(ROAD_X);
    expect(imp.y).toBeCloseTo(roadY(imp.dist), 0);
    runSeconds(g, 10);
    expect(imp.gone).toBe(true);
    expect(imp.dist).toBe(g.map.paths[0].length);
    expect(g.campHp).toBe(g.campMax - ENEMIES['妖'].atk * LEAK_MUL);
    expect(g.events.filter((e) => e.t === 'leak')).toHaveLength(1);
    stepCombat(g);
    expect(g.enemies).toHaveLength(0);
    expect(g.kills).toBe(0);
  });

  it('stand still while stunned and crawl while slowed', () => {
    const g = battle(emptyGame());
    const stunned = enemy(g, '妖', 0);
    stunned.stunT = 5;
    const slowed = enemy(g, '妖', 0);
    slowed.slowPct = 0.5;
    slowed.slowT = 10;
    runSeconds(g, 1);
    expect(stunned.dist).toBe(0);
    expect(slowed.dist).toBeCloseTo(ENEMIES['妖'].speed * MAP_SPEED * 0.5, 0);
  });

  it('spread sideways across the road', () => {
    const g = battle(emptyGame());
    const left = enemy(g, '妖', 10, 100, 1);
    const right = enemy(g, '妖', 10, 100, -1);
    expect(left.x).toBeLessThan(ROAD_X);
    expect(right.x).toBeGreaterThan(ROAD_X);
    runSeconds(g, 1);
    expect(left.x).toBeLessThan(ROAD_X);
  });

  it('黄风怪 dashes, 金角大王 summons behind itself, 灵感大王 regenerates', () => {
    const g = battle(emptyGame());
    const wind = enemy(g, '黄风怪', 0, 100);
    runSeconds(g, 4);
    const before = wind.dist;
    runSeconds(g, 0.5);
    // Reason: during the dash it moves at 3x speed.
    expect(wind.dist - before).toBeGreaterThan(ENEMIES['黄风怪'].speed * MAP_SPEED * 0.5 * 2);

    const h = battle(emptyGame());
    const gold = enemy(h, '金角大王', 0, 100);
    runSeconds(h, 5.1);
    const imps = h.enemies.filter((e) => e.def === '妖');
    expect(imps).toHaveLength(2);
    for (const imp of imps) {
      expect(imp.path).toBe(0);
      expect(imp.dist).toBeLessThan(gold.dist);
    }

    const k = battle(emptyGame());
    const river = enemy(k, '灵感大王', 0, 100);
    river.hp = 50;
    runSeconds(k, 1);
    expect(river.hp).toBeCloseTo(52, 0);
  });
});

describe('flying monsters', () => {
  it('fly their straight flight line to the camp while walkers take the road, and bite it like anyone else', () => {
    const g = battle(emptyGame(6, 1, BEND));
    const bat = makeEnemy(g, '蝠', 0, 100, ENEMIES['蝠'].speed, 2);
    const imp = makeEnemy(g, '妖', 0, 100, ENEMIES['妖'].speed, 2);
    g.enemies.push(bat, imp);
    expect([bat.air, imp.air]).toEqual([true, false]);
    expect(routeOf(g, bat)).toBe(g.map.flights[0]);
    expect(routeOf(g, imp)).toBe(g.map.paths[0]);
    expect([bat.x, bat.y]).toEqual([24, 24]);
    runSeconds(g, 1);
    const flown = ENEMIES['蝠'].speed * MAP_SPEED;
    expect(bat.dist).toBeCloseTo(flown, 0);
    // On the diagonal, not on the road along the top.
    expect(bat.x).toBeCloseTo(24 + flown / Math.SQRT2, 0);
    expect(bat.y).toBeCloseTo(bat.x, 5);
    expect(imp.y).toBeCloseTo(24, 0);
    runSeconds(g, 2);
    expect(bat.gone).toBe(true);
    expect(bat.dist).toBe(g.map.flights[0].length);
    expect(imp.gone).toBe(false);
    expect(g.campHp).toBe(g.campMax - ENEMIES['蝠'].atk * LEAK_MUL);
    expect(g.events.filter((e) => e.t === 'leak')).toHaveLength(1);
    stepCombat(g);
    expect(g.enemies).toEqual([imp]);
  });

  it('shrug off knockback, but slows and stuns still work on them', () => {
    const g = battle(emptyGame(6, 1, BEND));
    const bat = makeEnemy(g, '蝠', 0, 100, ENEMIES['蝠'].speed, 2, 60);
    const roc = makeEnemy(g, '鹏', 0, 100, ENEMIES['鹏'].speed, 2, 60);
    g.enemies.push(bat, roc);
    const at = [bat.x, bat.y];
    knock(g, bat, 40);
    expect(bat.dist).toBe(60);
    expect([bat.x, bat.y]).toEqual(at);
    applyStun(bat, 1);
    applySlow(roc, 0.5, 10);
    runSeconds(g, 0.5);
    expect(bat.dist).toBe(60);
    expect(roc.dist).toBeCloseTo(60 + ENEMIES['鹏'].speed * MAP_SPEED * 0.5 * 0.5, 0);
  });
});
