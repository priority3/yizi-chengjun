// Balance helper: the bot plays every chapter with many seeds; prints win rates and how far it got.
// Usage: pnpm sim [seedsPerChapter]   (default 40)
import { CHAPTERS } from '../src/config/chapters.ts';
import { DEFAULT_BOT } from '../src/core/bot.ts';
import { runChapter } from '../src/core/sim.ts';

const seeds = Number(process.argv[2] ?? 40);

const rows = CHAPTERS.map((ch) => {
  const runs = Array.from({ length: seeds }, (_, s) => runChapter((s + 1) * 7919, ch.id, DEFAULT_BOT));
  const wins = runs.filter((r) => r.won);
  const avg = (f: (r: (typeof runs)[number]) => number, list = runs) => (list.length ? list.reduce((s, r) => s + f(r), 0) / list.length : 0);
  return {
    chapter: `${ch.id} ${ch.name}`,
    'win %': ((wins.length / runs.length) * 100).toFixed(0),
    'waves cleared': `${avg((r) => r.wavesCleared).toFixed(1)} / ${ch.waves}`,
    'camp hp left (wins)': avg((r) => r.campHp, wins).toFixed(0),
    'avg min': (avg((r) => r.ticks) / 3600).toFixed(1),
  };
});

console.log(`bot: ${JSON.stringify(DEFAULT_BOT)} · seeds per chapter: ${seeds}`);
console.table(rows);
