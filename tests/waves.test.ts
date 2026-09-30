import { describe, expect, it } from 'vitest';
import { CHAPTERS } from '../src/config/chapters.ts';
import { createGame } from '../src/core/game.ts';
import { buildWave, eliteWave, minionType, waveHp, waveSize } from '../src/core/waves.ts';

describe('waves', () => {
  it('grows by two enemies per wave, plus a little per chapter', () => {
    expect(waveSize(1, 1)).toBe(7);
    expect(waveSize(1, 2)).toBe(9);
    expect(waveSize(4, 1)).toBe(9);
  });

  it('adds an elite mid-chapter and the boss on the last wave', () => {
    const g = createGame({ seed: 3, chapter: 1 });
    const total = CHAPTERS[0].waves;
    const mid = buildWave(g, eliteWave(total));
    expect(mid.elite).toBe(true);
    expect(mid.spawns.at(-1)?.def).toBe('魔');
    const last = buildWave(g, total);
    expect(last.boss).toBe(CHAPTERS[0].boss);
    expect(last.spawns.at(-1)?.def).toBe(CHAPTERS[0].boss);
    expect(buildWave(g, 1).boss).toBeNull();
  });

  it('introduces wolves from wave 2 and bears from wave 3', () => {
    expect(minionType(1, 1)).toBe('妖');
    expect(minionType(1, 2)).toBe('狼');
    expect(minionType(4, 3)).toBe('熊');
  });

  it('gets tougher every wave and in every later chapter', () => {
    for (let w = 2; w <= 8; w++) expect(waveHp('妖', 1, w)).toBeGreaterThan(waveHp('妖', 1, w - 1));
    for (let c = 2; c <= CHAPTERS.length; c++) expect(waveHp('妖', c, 5)).toBeGreaterThan(waveHp('妖', c - 1, 5));
  });

  it('sends enemies through both gates', () => {
    const g = createGame({ seed: 11, chapter: 3 });
    const lanes = new Set(buildWave(g, 4).spawns.map((s) => s.lane));
    expect(lanes).toEqual(new Set([0, 1]));
  });
});
