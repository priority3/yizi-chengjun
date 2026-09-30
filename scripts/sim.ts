// Balance helper: runs many headless AI-vs-AI matches and prints win rates and match lengths.
// Usage: pnpm sim [seedsPerRow]   (default 60)
import { HUMAN_PROXY, LEVELS } from '../src/config/levels.ts';
import { runMatch, type SimResult } from '../src/core/sim.ts';
import type { AiKnobs } from '../src/core/types.ts';

const seeds = Number(process.argv[2] ?? 60);

interface Row {
  label: string;
  winRate: number;
  avgMinutes: number;
  avgEndWave: string;
  reasons: string;
}

/** Plays `seeds` matches of a (side 0) vs b (side 1) and summarises them from side 0's point of view. */
function summarise(label: string, level: number, a: AiKnobs, b: AiKnobs): Row {
  const results: SimResult[] = [];
  for (let s = 1; s <= seeds; s++) results.push(runMatch(s * 7919, level, a, b));
  const wins = results.filter((r) => r.winner === 0).length;
  const ticks = results.reduce((sum, r) => sum + r.ticks, 0) / results.length;
  const endWave = results.reduce((sum, r) => sum + r.wave + r.overtime, 0) / results.length;
  const reasons = new Map<string, number>();
  for (const r of results) reasons.set(r.reason ?? 'timeout', (reasons.get(r.reason ?? 'timeout') ?? 0) + 1);
  return {
    label,
    winRate: wins / results.length,
    avgMinutes: ticks / 3600,
    avgEndWave: endWave.toFixed(1),
    reasons: [...reasons].map(([k, v]) => `${k}:${v}`).join(' '),
  };
}

const rows: Row[] = [];
for (const lv of LEVELS) rows.push(summarise(`proxy vs L${lv.id} ${lv.name}`, lv.id, HUMAN_PROXY, lv.ai));
rows.push(summarise('L5 AI vs L1 AI (at L3)', 3, LEVELS[4].ai, LEVELS[0].ai));
rows.push(summarise('L1 AI vs L5 AI (at L3)', 3, LEVELS[0].ai, LEVELS[4].ai));
rows.push(summarise('proxy vs proxy (at L3)', 3, HUMAN_PROXY, HUMAN_PROXY));

console.log(`seeds per row: ${seeds}`);
console.table(
  rows.map((r) => ({
    matchup: r.label,
    'side-0 win %': (r.winRate * 100).toFixed(0),
    'avg min': r.avgMinutes.toFixed(1),
    'end wave (10 + OT)': r.avgEndWave,
    reasons: r.reasons,
  })),
);
