// Endless mode and the daily challenge (plan.md B4): open-ended runs on chapter 10's rules that never win, a random
// chapter boss every 5th wave, the elite 2 waves before, HP that keeps growing, and a daily run that replays exactly.
import { describe, expect, it } from 'vitest';
import { CHAPTERS, startGongde } from '../src/config/chapters.ts';
import { AIR_RAID, ENEMIES, SPEED_GROWTH_CAP } from '../src/config/enemies.ts';
import { ENDLESS, ENDLESS_CHAPTER } from '../src/config/endless.ts';
import { MAPS } from '../src/config/maps.ts';
import { encounterDue } from '../src/core/encounters.ts';
import { act, createGame, hashState, step } from '../src/core/game.ts';
import { dailyMapIndex, dayLabel, modeMap, UNLIMITED } from '../src/core/modes.ts';
import { spawnMinions } from '../src/core/monsters.ts';
import { rand } from '../src/core/rng.ts';
import { mapKey } from '../src/core/snapshot.ts';
import { endlessOptions, playChapter, runEndless } from '../src/core/sim.ts';
import { defaultMods } from '../src/core/treasures.ts';
import type { GameState, Spawn } from '../src/core/types.ts';
import { airRaidPossible, buildWave, endlessHp, isBossWave, isEliteWave, runWaveHp } from '../src/core/waves.ts';
import { dayKey } from '../src/platform/today.ts';
import { enemy } from './helpers.ts';

const BOSSES = new Set(CHAPTERS.map((c) => c.boss));
const isFlyer = (s: Spawn) => ENEMIES[s.def].flying === true;

/** Builds wave `w` and returns it with the number of random numbers it drew. */
function measured(g: GameState, w: number) {
  const before = { rng: g.rng };
  const plan = buildWave(g, w);
  let draws = 0;
  while (before.rng !== g.rng && draws < 1000) {
    rand(before);
    draws++;
  }
  return { ...plan, draws };
}

describe('run modes', () => {
  it('play endless on chapter 10: its map, economy and camp, 法宝 allowed, no last wave', () => {
    const mods = defaultMods();
    mods.startGongde = 25;
    // Whatever chapter is passed, endless plays chapter 10.
    const g = createGame({ seed: 4, chapter: 3, mode: 'endless', mods });
    expect([g.mode, g.chapter, g.totalWaves]).toEqual(['endless', ENDLESS_CHAPTER, UNLIMITED]);
    expect(g.map.slots.length).toBe(createGame({ seed: 4, chapter: ENDLESS_CHAPTER }).map.slots.length);
    expect(mapKey(modeMap('endless', 3, 4))).toBe(mapKey(MAPS[ENDLESS_CHAPTER - 1]));
    expect(g.gongde).toBe(startGongde(ENDLESS_CHAPTER) + 25);
  });

  it('play the daily challenge on the map of its day, with chapter 10 economy and never any 法宝', () => {
    const mods = defaultMods();
    mods.dmgMul = 2;
    mods.campHpBonus = 50;
    const day = 20261008;
    const g = createGame({ seed: day, chapter: 1, mode: 'daily', mods });
    expect([g.mode, g.chapter, g.totalWaves, g.seed]).toEqual(['daily', ENDLESS_CHAPTER, UNLIMITED, day]);
    expect(dailyMapIndex(day)).toBe(8);
    expect(mapKey(modeMap('daily', 1, day))).toBe(mapKey(MAPS[8]));
    expect(g.mods).toEqual(defaultMods());
    expect(g.campMax).toBe(120);
    // The ten maps take turns, day by day.
    const week = Array.from({ length: 10 }, (_, i) => dailyMapIndex(20261001 + i));
    expect([...week].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('leave chapter runs as they were', () => {
    const g = createGame({ seed: 4, chapter: 3 });
    expect([g.mode, g.chapter, g.totalWaves]).toEqual(['chapter', 3, CHAPTERS[2].waves]);
  });

  it('turn the local date into the daily key and back into a label', () => {
    expect(dayKey(new Date(2026, 9, 8, 23, 59))).toBe(20261008);
    expect(dayKey(new Date(2027, 0, 1, 0, 0))).toBe(20270101);
    expect(dayLabel(20261008)).toBe('10月8日');
    expect(dayLabel(20270101)).toBe('1月1日');
  });
});

describe('endless waves', () => {
  it('never win and keep spawning, with an encounter after every second cleared wave', () => {
    const g = createGame({ seed: 7, chapter: ENDLESS_CHAPTER, mode: 'endless' });
    for (let w = 1; w <= 40; w++) {
      if (g.encounter) act(g, { t: 'choose', option: 0 });
      act(g, { t: 'start' });
      expect(g.wave).toBe(w);
      expect(g.spawns.length, `wave ${w}`).toBeGreaterThan(0);
      g.spawns = [];
      step(g);
      expect(g.phase, `wave ${w}`).toBe('build');
      expect(g.events.some((e) => e.t === 'won')).toBe(false);
      expect(g.encounter !== null, `wave ${w}`).toBe(w % 2 === 0);
    }
    expect(encounterDue(40, UNLIMITED)).toBe(true);
    expect(encounterDue(41, UNLIMITED)).toBe(false);
  });

  it('end every 5th wave with a random chapter boss at full HP, and the elite 2 waves before each', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      const g = createGame({ seed, chapter: ENDLESS_CHAPTER, mode: 'endless' });
      for (let w = 1; w <= 30; w++) {
        const plan = buildWave(g, w);
        expect(plan.boss !== null, `wave ${w}`).toBe(w % ENDLESS.bossEvery === 0);
        expect(plan.elite, `wave ${w}`).toBe(w % ENDLESS.bossEvery === ENDLESS.bossEvery - ENDLESS.eliteBefore);
        expect(isBossWave(g, w)).toBe(plan.boss !== null);
        expect(isEliteWave(g, w)).toBe(plan.elite);
        if (!plan.boss) continue;
        seen.add(plan.boss);
        expect(BOSSES.has(plan.boss)).toBe(true);
        const boss = plan.spawns.filter((s) => s.def === plan.boss);
        expect(boss).toHaveLength(1);
        expect(boss[0].hp).toBe(Math.round(endlessHp(plan.boss, w) * g.map.hpScale));
        // The boss closes the wave on the ground (an air raid never comes on a boss wave).
        expect(plan.spawns.filter((s) => !isFlyer(s)).at(-1)?.def).toBe(plan.boss);
      }
    }
    // Drawn with the run RNG: across 12 runs x 6 boss waves, plenty of different bosses.
    expect(seen.size).toBeGreaterThanOrEqual(6);
  });

  it('grow monster HP by chapter 10\'s hpGrowth every wave, with no end, and cap the speed-up at +60 %', () => {
    const growth = CHAPTERS[ENDLESS_CHAPTER - 1].hpGrowth;
    for (let w = 2; w <= 60; w++) {
      expect(endlessHp('妖', w)).toBeGreaterThan(endlessHp('妖', w - 1));
      // Reason: from wave 8 the HP is big enough that rounding to whole points can't blur the ratio.
      if (w >= 8) expect(Math.abs(endlessHp('熊', w) / endlessHp('熊', w - 1) / growth - 1)).toBeLessThan(0.002);
    }
    expect(Number.isFinite(endlessHp('黑熊精', 200))).toBe(true);
    const g = createGame({ seed: 3, chapter: ENDLESS_CHAPTER, mode: 'endless' });
    expect(runWaveHp(g, '妖', 9)).toBe(endlessHp('妖', 9));
    expect(runWaveHp(createGame({ seed: 3, chapter: 10 }), '妖', 9)).not.toBe(endlessHp('妖', 9));
    const speed = (w: number) => buildWave(g, w).spawns.find((s) => s.def === '妖')?.speed ?? 0;
    expect(speed(41)).toBeCloseTo(ENEMIES['妖'].speed * (1 + SPEED_GROWTH_CAP));
    expect(speed(90)).toBeCloseTo(speed(41));
    expect(speed(20)).toBeLessThan(speed(41));
  });

  it('send summons and split-offs at the endless strength of the wave', () => {
    const g = createGame({ seed: 5, chapter: ENDLESS_CHAPTER, mode: 'endless' });
    act(g, { t: 'start' });
    g.wave = 12;
    spawnMinions(g, '蛛', 3, enemy(g, '蜘蛛精', 300));
    const spiders = g.enemies.filter((e) => e.def === '蛛');
    expect(spiders).toHaveLength(3);
    for (const s of spiders) expect(s.hp).toBe(Math.round(endlessHp('蛛', 12) * g.map.hpScale));
  });

  it('bring air raids by chapter 10\'s rules (鹏雏 included) from wave 3, never on a boss wave', () => {
    let raids = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const g = createGame({ seed, chapter: ENDLESS_CHAPTER, mode: 'endless' });
      for (let w = 1; w <= 25; w++) {
        const { spawns, boss, draws } = measured(g, w);
        const possible = w >= AIR_RAID.fromWave && w % ENDLESS.bossEvery !== 0;
        expect(airRaidPossible(g.chapter, w, boss !== null)).toBe(possible);
        // Two draws per monster, one for the boss pick, one for the raid roll.
        expect(draws).toBe(2 * spawns.length + (boss ? 1 : 0) + (possible ? 1 : 0));
        const fly = spawns.filter(isFlyer);
        if (!possible) expect(fly).toEqual([]);
        if (fly.length === 0) continue;
        raids++;
        expect(fly.map((s) => s.def)).toEqual(fly.map((_, i) => (i % 2 === 1 ? '鹏' : '蝠')));
      }
    }
    expect(raids).toBeGreaterThan(0);
  });
});

describe('bot runs', () => {
  it('play endless until the camp falls, never winning', () => {
    const g = playChapter(7919, ENDLESS_CHAPTER, endlessOptions());
    expect(g.phase).toBe('lost');
    expect(g.wave).toBeGreaterThan(CHAPTERS[ENDLESS_CHAPTER - 1].waves);
    expect(g.mode).toBe('endless');
  });

  it('stop at the wave cap of the sim, in the build phase', () => {
    const r = runEndless(7919, { maxWaves: 4 });
    expect(r.won).toBe(false);
    expect(r.wavesCleared).toBe(4);
    expect(r.campHp).toBeGreaterThan(0);
  });

  it('replay the daily challenge exactly from its day, and another day differently', () => {
    const opts = { ...endlessOptions({ maxWaves: 7 }), mode: 'daily' as const };
    const a = playChapter(20261009, 1, opts);
    const b = playChapter(20261009, 7, opts);
    expect(a.wave).toBe(7);
    expect(hashState(b)).toBe(hashState(a));
    expect(b.tick).toBe(a.tick);
    const c = playChapter(20261019, 1, opts);
    expect(hashState(c)).not.toBe(hashState(a));
  });

  it('replay a daily challenge on a map with 泥沼 exactly', () => {
    const day = 20261005;
    expect(MAPS[dailyMapIndex(day)].rows.some((row) => /[Mm]/.test(row))).toBe(true);
    const opts = { ...endlessOptions({ maxWaves: 8 }), mode: 'daily' as const };
    const a = playChapter(day, 1, opts);
    const b = playChapter(day, 1, opts);
    expect(a.map.slotKind).toContain('mire');
    expect(a.wave).toBeGreaterThan(5);
    expect(hashState(b)).toBe(hashState(a));
  });
});
