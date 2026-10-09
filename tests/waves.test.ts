import { describe, expect, it } from 'vitest';
import { CHAPTERS, MIN_SPAWN_GAP, SPAWN_GAP } from '../src/config/chapters.ts';
import { AIR_RAID, ENEMIES } from '../src/config/enemies.ts';
import { createGame } from '../src/core/game.ts';
import { mixSeed, rand } from '../src/core/rng.ts';
import type { GameState, Spawn, WaveMods } from '../src/core/types.ts';
import { airRaidPossible, buildWave, eliteWave, hasAirRaids, minionType, raiderType, waveHp, waveSize } from '../src/core/waves.ts';
import { TWO_ROADS } from './helpers.ts';

const flyers = (spawns: readonly Spawn[]): Spawn[] => spawns.filter((s) => ENEMIES[s.def].flying === true);

/** Builds wave `w` and returns it with the number of random numbers it drew. */
function measured(g: GameState, w: number): { spawns: Spawn[]; draws: number } {
  const before = { rng: g.rng };
  const { spawns } = buildWave(g, w);
  let draws = 0;
  while (before.rng !== g.rng && draws < 1000) {
    rand(before);
    draws++;
  }
  return { spawns, draws };
}

/**
 * FNV-1a over everything random in the waves of chapters 1-5 (monster, road, sideways offset, spawn time, and the
 * RNG state after each wave), for 12 seeds and four encounter setups. HP is left out on purpose, so retuning
 * monster HP doesn't touch it.
 */
function wavePrint(): number {
  let h = 0x811c9dc5;
  const mix = (s: string) => {
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
  };
  const setups: Array<Partial<WaveMods>> = [{}, { wolves: true }, { thief: true }, { miniBoss: '白骨精' }];
  for (let ch = 1; ch <= 5; ch++) {
    for (let seed = 1; seed <= 12; seed++) {
      setups.forEach((setup, k) => {
        const g = createGame({ seed, chapter: ch });
        g.rng = mixSeed(seed, ch * 10 + k);
        for (let w = 1; w <= CHAPTERS[ch - 1].waves; w++) {
          Object.assign(g.waveMods, setup);
          for (const s of buildWave(g, w).spawns) mix(`${s.def}|${s.path}|${s.side.toFixed(6)}|${s.at.toFixed(3)};`);
          mix(`#${g.rng}`);
        }
      });
    }
  }
  return h >>> 0;
}

describe('waves', () => {
  it('grows by two enemies per wave, plus a little per chapter', () => {
    expect(waveSize(1, 1)).toBe(8);
    expect(waveSize(1, 2)).toBe(10);
    expect(waveSize(4, 1)).toBe(10);
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

  it('sends enemies down every road, spread across its width', () => {
    const g = createGame({ seed: 11, chapter: 3, map: TWO_ROADS });
    const spawns = buildWave(g, 4).spawns;
    expect(new Set(spawns.map((s) => s.path))).toEqual(new Set([0, 1]));
    for (const s of spawns) {
      expect(s.side).toBeGreaterThanOrEqual(-1);
      expect(s.side).toBeLessThanOrEqual(1);
    }
  });
});

describe('air raids', () => {
  it('never come in chapters 1-5, whose waves draw exactly two random numbers per monster, as always', () => {
    for (let ch = 1; ch <= 5; ch++) {
      expect(hasAirRaids(ch)).toBe(false);
      for (let seed = 1; seed <= 30; seed++) {
        const g = createGame({ seed, chapter: ch });
        for (let w = 1; w <= CHAPTERS[ch - 1].waves; w++) {
          const { spawns, draws } = measured(g, w);
          expect(flyers(spawns), `chapter ${ch} seed ${seed} wave ${w}`).toEqual([]);
          expect(draws).toBe(2 * spawns.length);
        }
      }
    }
  });

  it('leave the waves of chapters 1-5 exactly as they were in v0.5.0', () => {
    // Recorded on v0.5.0, before air raids existed. Reason: chapters 1-5 must replay every run unchanged; if their
    // wave composition is ever changed on purpose, record the new value here.
    expect(wavePrint()).toBe(3489545859);
  });

  it('come in some chapter-6 waves from wave 3 on, never on the boss wave, for one extra random number', () => {
    const ch = 6;
    const total = CHAPTERS[ch - 1].waves;
    let raids = 0;
    let rolls = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const g = createGame({ seed, chapter: ch });
      for (let w = 1; w <= total; w++) {
        const { spawns, draws } = measured(g, w);
        const fly = flyers(spawns);
        const possible = w >= AIR_RAID.fromWave && w !== total;
        expect(airRaidPossible(ch, w)).toBe(possible);
        // The raid roll comes on top of the usual two draws per monster (bats included), whether or not the raid comes.
        expect(draws).toBe(2 * spawns.length + (possible ? 1 : 0));
        if (possible) rolls++;
        if (!possible) expect(fly).toEqual([]);
        if (fly.length === 0) continue;
        raids++;
        expect(fly).toHaveLength(AIR_RAID.size + Math.floor(w / 2));
        expect(fly.every((s) => s.def === '蝠')).toBe(true);
        // HP follows the wave's strength and the map, like any other minion.
        for (const s of fly) expect(s.hp).toBe(Math.round(waveHp('蝠', ch, w) * g.map.hpScale));
        // The flock takes off once about half of the ground monsters are out, one bat after the other.
        const gap = Math.max(MIN_SPAWN_GAP, SPAWN_GAP - 0.05 * (w - 1));
        const ground = spawns.filter((s) => !ENEMIES[s.def].flying);
        const half = Math.floor(waveSize(ch, w) / 2);
        expect(fly[0].at).toBeCloseTo(half * gap);
        expect(ground.filter((s) => s.at < fly[0].at)).toHaveLength(half);
        fly.forEach((s, i) => expect(s.at).toBeCloseTo(fly[0].at + i * AIR_RAID.spacing));
      }
    }
    expect(raids).toBeGreaterThan(0);
    // Roughly AIR_RAID.chance of the possible waves (a loose band: 60 seeds).
    expect(raids / rolls).toBeGreaterThan(AIR_RAID.chance * 0.6);
    expect(raids / rolls).toBeLessThan(AIR_RAID.chance * 1.4);
  });

  it('keep the spawn list sorted by time', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const g = createGame({ seed, chapter: 7 });
      for (let w = 1; w <= CHAPTERS[6].waves; w++) {
        const spawns = buildWave(g, w).spawns;
        for (let i = 1; i < spawns.length; i++) expect(spawns[i].at).toBeGreaterThanOrEqual(spawns[i - 1].at);
      }
    }
  });

  it('mix a 鹏雏 in for every second bat from chapter 9 on', () => {
    expect([0, 1, 2, 3, 4].map((i) => raiderType(i, 8))).toEqual(['蝠', '蝠', '蝠', '蝠', '蝠']);
    expect([0, 1, 2, 3, 4].map((i) => raiderType(i, 9))).toEqual(['蝠', '鹏', '蝠', '鹏', '蝠']);
    let seen = 0;
    for (let seed = 1; seed <= 40 && seen === 0; seed++) {
      const g = createGame({ seed, chapter: 9 });
      for (let w = 1; w <= CHAPTERS[8].waves; w++) {
        const fly = flyers(buildWave(g, w).spawns);
        if (fly.length === 0) continue;
        seen++;
        expect(fly.map((s) => s.def)).toEqual(fly.map((_, i) => (i % 2 === 1 ? '鹏' : '蝠')));
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});
