// Headless chapter runs played by the bot with fixed seeds: robust balance guarantees, never flaky.
import { beforeAll, describe, expect, it } from 'vitest';
import { CHAPTERS, startGongde } from '../src/config/chapters.ts';
import { traceChapter, type WaveTrace } from '../src/core/sim-trace.ts';
import { MAX_SIM_TICKS, playChapter, runChapter, type RunResult } from '../src/core/sim.ts';
import { addTreasure, buildMods, emptyVault } from '../src/core/treasures.ts';
import type { SimEvent } from '../src/core/types.ts';

const SEEDS = Array.from({ length: 20 }, (_, i) => (i + 1) * 104729);

/** Every chapter played once with every seed, shared by the whole file (index = chapter - 1). */
let runs: RunResult[][] = [];
/** Win % per chapter on SEEDS (index = chapter - 1); one seed is 5 points. */
let curve: number[] = [];
const winRate = (chapter: number) => curve[chapter - 1] / 100;

beforeAll(() => {
  runs = CHAPTERS.map((ch) => SEEDS.map((s) => runChapter(s, ch.id)));
  curve = runs.map((list) => (list.filter((r) => r.won).length * 100) / list.length);
  // Reason: 200 runs take a few seconds here but can take ~40 s on a slow machine.
}, 120_000);

describe('headless chapter runs', () => {
  it('always end well before the time cap', () => {
    runs.forEach((list, i) => {
      for (const r of list) expect(r.ticks, `chapter ${i + 1}`).toBeLessThan(MAX_SIM_TICKS);
    });
  });

  it('let the bot clear chapter 1 most of the time', () => {
    expect(winRate(1)).toBeGreaterThanOrEqual(0.8);
  });

  it('get harder toward the last chapter', () => {
    // On this seed family the gap measures 85 points today (95% -> 10%); 0.3 keeps the guarantee
    // meaningful without pinning it to one exact tuning pass.
    expect(winRate(CHAPTERS.length)).toBeLessThan(winRate(1) - 0.3);
  });
});

/**
 * Guard rails for later rebalancing (plan.md D2: win rates fall chapter by chapter, chapter 1 easy, chapter 10 hard).
 * Measured on SEEDS when written: 90 80 60 80 50 40 60 40 15 10. Twenty seeds are noisy: across 40 other
 * 20-seed families the same build averaged 97 89 79 81 51 52 58 41 25 11, so chapters 3/4 and 6/7 are about
 * equally hard and a reshuffle of outcomes alone can make one look 20-30 points easier than the one before.
 * - Chapter 1 ≥ 85: today 90, and under 85 in none of the 40 families.
 * - Chapter 10 ≤ 20: today 10; above 20 in 2 of the 40 families.
 * - Rise ≤ 30 points: today's biggest rises are +20 (3→4, 6→7). A +15 limit would trip on 40% of the families,
 *   +25 on 8%, +30 on none — so this flags real inversions without failing on noise. Finer checks: `pnpm sim 40`.
 * v0.6 (special pads, flyers, retuned maps) reads 95 70 60 50 70 35 55 60 25 10 here; on 200 seeds the curve is
 * 99 90 77 70 66 55 49 43 20 13. This family runs lucky on chapter 10: right after merging it read 35 while ten
 * other 20-seed families averaged 11, so judge a failure here against a bigger sample before retuning for it.
 */
const CHAPTER1_MIN = 85;
const LAST_MAX = 20;
const MAX_RISE = 30;

describe('win-rate curve', () => {
  it(`keeps chapter 1 at ${CHAPTER1_MIN}% or more`, () => {
    expect(curve[0]).toBeGreaterThanOrEqual(CHAPTER1_MIN);
  });

  it(`keeps the last chapter at ${LAST_MAX}% or less`, () => {
    expect(curve[CHAPTERS.length - 1]).toBeLessThanOrEqual(LAST_MAX);
  });

  it(`never lets a chapter be more than ${MAX_RISE} points easier than the one before`, () => {
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i], `chapter ${i + 1} (${curve.join(' ')})`).toBeLessThanOrEqual(curve[i - 1] + MAX_RISE);
    }
  });
});

/**
 * Runs spread over the chapters. On this build they include a 白骨精 revive and a loss in chapter 1; 金角大王's
 * summons, a coin-paying 宝箱 and monsters killed in the very tick they appeared in chapter 3; a 宝箱 card in
 * chapter 6 and a 蜘蛛精 split in chapter 7. Whatever later rebalancing does to them, the checks below hold for any run.
 */
const CASES: ReadonlyArray<readonly [chapter: number, seed: number]> = [
  [1, SEEDS[0]],
  [1, SEEDS[16]],
  [3, SEEDS[13]],
  [4, SEEDS[0]],
  [6, SEEDS[2]],
  [7, SEEDS[7]],
  [9, SEEDS[3]],
  [10, SEEDS[5]],
];

const total = (waves: WaveTrace[], key: 'spawned' | 'killed' | 'leaked') => waves.reduce((s, w) => s + w[key], 0);

/** Replays a run with independent bookkeeping of its own, to check the trace against. */
function observe(seed: number, chapter: number) {
  let leaks = 0;
  let thefts = 0;
  /** 功德 moved by the bot's own actions before each wave (key = the wave they lead up to). */
  const shopping = new Map<number, number>();
  let before = 0;
  const count = (events: readonly SimEvent[]) => {
    for (const e of events) {
      if (e.t === 'leak') leaks++;
      else if (e.t === 'steal') thefts++;
    }
  };
  const final = playChapter(seed, chapter, {}, {
    beforeAction: (g) => void (before = g.gongde),
    action(g, _a, _r, events) {
      count(events);
      // After 'start' the new wave is already under way; any other action prepares the next one.
      const wave = g.phase === 'battle' ? g.wave : g.wave + 1;
      shopping.set(wave, (shopping.get(wave) ?? 0) + g.gongde - before);
    },
    tick: (g) => count(g.events),
  });
  return { final, leaks, thefts, shopping };
}

describe('traceChapter', () => {
  /** Each case traced once, and replayed once with the independent bookkeeping above. */
  const traceAll = () =>
    CASES.map(([ch, seed]) => ({ name: `chapter ${ch} seed ${seed}`, ch, seed, ...traceChapter(seed, ch), seen: observe(seed, ch) }));
  let cases: ReturnType<typeof traceAll> = [];
  beforeAll(() => {
    cases = traceAll();
  }, 30_000);

  it('reports exactly the run runChapter plays, one entry per wave started', () => {
    for (const { name, ch, seed, waves, result } of cases) {
      expect(result, name).toEqual(runChapter(seed, ch));
      expect(waves.map((w) => w.wave), name).toEqual(waves.map((_, i) => i + 1));
      expect(waves, name).toHaveLength(result.won ? CHAPTERS[ch - 1].waves : result.wavesCleared + 1);
    }
    const vault = emptyVault();
    addTreasure(vault, '照妖镜', 2);
    vault.equipped.push('照妖镜');
    const opts = { mods: buildMods(vault), knobs: { mistake: 0.3, maxRefreshes: 4 }, maxTicks: 4000 };
    expect(traceChapter(SEEDS[0], 5, opts).result).toEqual(runChapter(SEEDS[0], 5, opts));
  }, 30_000);

  it('splits the leaks and kills of the run across its waves', () => {
    for (const { name, waves, seen } of cases) {
      expect(total(waves, 'leaked'), name).toBe(seen.leaks);
      expect(total(waves, 'killed'), name).toBe(seen.final.kills);
      expect(waves[waves.length - 1].campHpAfter, name).toBe(seen.final.campHp);
    }
  });

  it('counts every monster that entered the field, summons and split-offs included', () => {
    for (const { name, waves, seen } of cases) {
      // Each monster that came out was killed, bit the camp, ran off with 功德, or is still out there at the end.
      const left = total(waves, 'killed') + total(waves, 'leaked') + seen.thefts + seen.final.enemies.length;
      expect(total(waves, 'spawned'), name).toBe(left);
    }
  });

  it('reads 功德 when a wave starts (after shopping) and when it ends (after the clear bonus)', () => {
    for (const { name, ch, waves, seen } of cases) {
      // Between two waves no tick runs, so only the bot's build actions (buys, refreshes, unlocks, 奇遇 rewards)
      // separate one wave's closing 功德 from the next wave's opening 功德.
      waves.forEach((w, i) => {
        const closing = i === 0 ? startGongde(ch) : waves[i - 1].gongdeAfter;
        expect(w.gongdeBefore, `${name} wave ${w.wave}`).toBe(closing + (seen.shopping.get(w.wave) ?? 0));
      });
      expect(waves[waves.length - 1].gongdeAfter, name).toBe(seen.final.gongde);
    }
  });
});
