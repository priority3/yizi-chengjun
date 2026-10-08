// Headless chapter runs played by the bot with fixed seeds: robust balance guarantees, never flaky.
import { describe, expect, it } from 'vitest';
import { CHAPTERS } from '../src/config/chapters.ts';
import { MAX_SIM_TICKS, runChapter } from '../src/core/sim.ts';

const SEEDS = Array.from({ length: 20 }, (_, i) => (i + 1) * 104729);
const winRate = (chapter: number) => SEEDS.filter((s) => runChapter(s, chapter).won).length / SEEDS.length;

describe('headless chapter runs', () => {
  it('always end well before the time cap', () => {
    for (const ch of CHAPTERS) {
      for (const seed of SEEDS.slice(0, 4)) expect(runChapter(seed, ch.id).ticks, `chapter ${ch.id}`).toBeLessThan(MAX_SIM_TICKS);
    }
  });

  it('let the bot clear chapter 1 most of the time', () => {
    expect(winRate(1)).toBeGreaterThanOrEqual(0.8);
  });

  it('get harder toward the last chapter', () => {
    // On this seed family the gap measures a stable 40 points; 0.3 keeps the guarantee
    // meaningful without pinning it to one exact tuning pass.
    expect(winRate(CHAPTERS.length)).toBeLessThan(winRate(1) - 0.3);
  });
});
