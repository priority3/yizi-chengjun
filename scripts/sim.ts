// Balance helper: the bot plays every chapter with many seeds; prints win rates and how far it got.
// Usage: pnpm sim [seedsPerChapter] [法宝,法宝:阶,...]   (default 40 seeds, no treasures)
//   e.g. pnpm sim 40 金刚琢,照妖镜:2,定风珠
import { CHAPTERS } from '../src/config/chapters.ts';
import { DEFAULT_BOT } from '../src/core/bot.ts';
import { runChapter } from '../src/core/sim.ts';
import { addTreasure, buildMods, emptyVault, isTreasureId } from '../src/core/treasures.ts';

const seeds = Number(process.argv[2] ?? 40);
const vault = emptyVault();
for (const raw of (process.argv[3] ?? '').split(',').filter(Boolean)) {
  const [id, tier] = raw.split(':');
  if (!isTreasureId(id)) throw new Error(`unknown treasure: ${id}`);
  addTreasure(vault, id, Number(tier ?? 1));
  vault.equipped.push(id);
}
const mods = buildMods(vault);

const rows = CHAPTERS.map((ch) => {
  const runs = Array.from({ length: seeds }, (_, s) => runChapter((s + 1) * 7919, ch.id, { knobs: DEFAULT_BOT, mods }));
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

console.log(`bot: ${JSON.stringify(DEFAULT_BOT)} · seeds per chapter: ${seeds} · treasures: ${vault.equipped.join(' ') || 'none'}`);
console.table(rows);
