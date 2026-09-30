import { describe, expect, it } from 'vitest';
import { LEVELS, OT_HP_GROWTH, SPAWN_GAP, WAVE_REST, BOSS_REST_EXTRA } from '../src/config/levels.ts';
import { buildOvertime, buildWave, minionType, TICKS_PER_SEC, waveHp } from '../src/core/waves.ts';

describe('regular waves', () => {
  it('grows by two enemies per wave and ends boss waves with the level boss', () => {
    expect(buildWave(1, 1, 0).spawns).toHaveLength(8);
    expect(buildWave(1, 4, 0).spawns).toHaveLength(14);
    const w5 = buildWave(2, 5, 0);
    expect(w5.spawns).toHaveLength(10);
    expect(w5.spawns.at(-1)?.def).toBe(LEVELS[1].boss5);
    expect(w5.boss).toBe(LEVELS[1].boss5);
    const w10 = buildWave(2, 10, 0);
    expect(w10.spawns.at(-1)?.def).toBe(LEVELS[1].boss10);
    expect(buildWave(1, 3, 0).boss).toBeNull();
  });

  it('introduces wolves from wave 3 and bears from wave 4', () => {
    expect(buildWave(1, 2, 0).spawns.every((s) => s.def === '妖')).toBe(true);
    expect(minionType(1, 3)).toBe('狼');
    expect(minionType(4, 3)).toBe('狼');
    expect(minionType(4, 4)).toBe('熊');
  });

  it('gets tougher every wave and every level', () => {
    for (let w = 2; w <= 10; w++) expect(waveHp('妖', 1, w)).toBeGreaterThan(waveHp('妖', 1, w - 1));
    for (let l = 2; l <= 5; l++) expect(waveHp('妖', l, 5)).toBeGreaterThan(waveHp('妖', l - 1, 5));
  });

  it('schedules the next wave after the last spawn plus a rest (longer after bosses)', () => {
    const gap = Math.round(SPAWN_GAP * TICKS_PER_SEC);
    const w1 = buildWave(1, 1, 100);
    expect(w1.spawns[0].at).toBe(100);
    expect(w1.next).toBe(100 + 8 * gap + WAVE_REST * TICKS_PER_SEC);
    const w5 = buildWave(1, 5, 0);
    expect(w5.next).toBe(10 * gap + (WAVE_REST + BOSS_REST_EXTRA) * TICKS_PER_SEC);
  });
});

describe('overtime', () => {
  it('escalates count, HP and heart damage, with the boss every fifth wave', () => {
    const ot1 = buildOvertime(1, 1, 0);
    const ot2 = buildOvertime(1, 2, 0);
    expect(ot1.spawns).toHaveLength(22);
    expect(ot2.spawns).toHaveLength(24);
    expect(ot2.spawns[0].hp).toBeCloseTo(ot1.spawns[0].hp * OT_HP_GROWTH, -1);
    expect(ot1.boss).toBeNull();
    const ot5 = buildOvertime(1, 5, 0);
    expect(ot5.boss).toBe(LEVELS[0].boss10);
    expect(ot5.spawns[0].leak).toBe(2);
    expect(ot5.spawns.at(-1)?.leak).toBe(3);
  });
});
