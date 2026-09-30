import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../src/config/enemies.ts';
import { TICKS_PER_SEC } from '../src/core/clock.ts';
import { spawnY, stopY } from '../src/core/grid.ts';
import { moveEnemies } from '../src/core/monsters.ts';
import { battle, emptyGame, enemy } from './helpers.ts';

function runSeconds(g: ReturnType<typeof emptyGame>, s: number): void {
  for (let i = 0; i < s * TICKS_PER_SEC; i++) moveEnemies(g);
}

describe('enemies', () => {
  it('walk from their gate and stop in front of the camp', () => {
    const g = battle(emptyGame());
    const top = enemy(g, '妖', 150, spawnY(0), 100, 0);
    const bottom = enemy(g, '妖', 150, spawnY(1), 100, 1);
    runSeconds(g, 1);
    expect(top.y).toBeCloseTo(spawnY(0) + ENEMIES['妖'].speed, 0);
    runSeconds(g, 10);
    expect(top.y).toBe(stopY(0, 12));
    expect(bottom.y).toBe(stopY(1, 12));
  });

  it('bite the camp on their attack interval, unless stunned', () => {
    const g = battle(emptyGame());
    enemy(g, '妖', 150, stopY(0, 12));
    // First bite lands half an interval (0.5 s) after arriving; allow a tick for float rounding.
    runSeconds(g, 0.55);
    expect(g.campHp).toBe(g.campMax - 3);
    runSeconds(g, 1);
    expect(g.campHp).toBe(g.campMax - 6);
    const h = battle(emptyGame());
    const e = enemy(h, '妖', 150, stopY(0, 12));
    e.stunT = 5;
    runSeconds(h, 2);
    expect(h.campHp).toBe(h.campMax);
  });

  it('黄风怪 dashes, 金角大王 summons, 灵感大王 regenerates', () => {
    const g = battle(emptyGame());
    const wind = enemy(g, '黄风怪', 150, -16, 100, 0);
    runSeconds(g, 4);
    const before = wind.y;
    runSeconds(g, 0.5);
    // Reason: during the dash it moves at 3x speed.
    expect(wind.y - before).toBeGreaterThan(ENEMIES['黄风怪'].speed * 0.5 * 2);

    const h = battle(emptyGame());
    enemy(h, '金角大王', 150, -16, 100, 0);
    runSeconds(h, 5.1);
    expect(h.enemies.filter((e) => e.def === '妖')).toHaveLength(2);

    const k = battle(emptyGame());
    const river = enemy(k, '灵感大王', 150, -16, 100, 0);
    river.hp = 50;
    runSeconds(k, 1);
    expect(river.hp).toBeCloseTo(52, 0);
  });
});
