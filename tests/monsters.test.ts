import { describe, expect, it } from 'vitest';
import { LEAK_MUL } from '../src/config/chapters.ts';
import { ENEMIES } from '../src/config/enemies.ts';
import { MAP_SPEED } from '../src/config/maps.ts';
import { TICKS_PER_SEC } from '../src/core/clock.ts';
import { stepCombat } from '../src/core/combat.ts';
import { moveEnemies } from '../src/core/monsters.ts';
import { battle, emptyGame, enemy, ROAD_X, roadY } from './helpers.ts';

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
