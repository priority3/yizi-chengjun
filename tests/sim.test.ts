// Headless AI-vs-AI matches with fixed seeds: robust balance guarantees, never flaky.
import { describe, expect, it } from 'vitest';
import { LEVELS } from '../src/config/levels.ts';
import { MAX_SIM_TICKS, runMatch } from '../src/core/sim.ts';

const SEEDS = Array.from({ length: 24 }, (_, i) => (i + 1) * 104729);
const easy = LEVELS[0].ai;
const hard = LEVELS[4].ai;

describe('headless simulation', () => {
  it('always ends within 12 simulated minutes', () => {
    for (const seed of SEEDS.slice(0, 8)) {
      for (let level = 1; level <= 5; level++) {
        const r = runMatch(seed, level, easy, easy);
        expect(r.winner, `seed ${seed} level ${level}`).not.toBeNull();
        expect(r.ticks).toBeLessThan(MAX_SIM_TICKS);
      }
    }
  });

  it('replays identically from the same seed', () => {
    expect(runMatch(SEEDS[3], 3, easy, hard).hash).toBe(runMatch(SEEDS[3], 3, easy, hard).hash);
  });

  it('level-5 AI beats level-1 AI at least 70% of the time', () => {
    let hardWins = 0;
    for (const seed of SEEDS) {
      if (runMatch(seed, 3, hard, easy).winner === 0) hardWins++;
      if (runMatch(seed, 3, easy, hard).winner === 1) hardWins++;
    }
    expect(hardWins / (SEEDS.length * 2)).toBeGreaterThanOrEqual(0.7);
  });
});
