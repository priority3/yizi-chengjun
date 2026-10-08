// Balance helper: the bot plays chapters with fixed seeds and prints win rates, per-wave leaks, or one run wave by wave.
// Usage: pnpm sim [seedsPerChapter] [法宝,法宝:阶,...] [--chapter N] [--leaks | --trace [--seed S]] [--help]
//   e.g. pnpm sim 40 金刚琢,照妖镜:2,定风珠   ·   pnpm sim 40 --leaks   ·   pnpm sim --chapter 3 --trace --seed 123
import { CHAPTERS, type ChapterDef } from '../src/config/chapters.ts';
import { MAX_TIER, TREASURE_IDS } from '../src/config/treasures.ts';
import { DEFAULT_BOT } from '../src/core/bot.ts';
import { createGame } from '../src/core/game.ts';
import { traceChapter, type WaveTrace } from '../src/core/sim-trace.ts';
import { runChapter } from '../src/core/sim.ts';
import { addTreasure, buildMods, emptyVault, isTreasureId } from '../src/core/treasures.ts';
import type { RunMods } from '../src/core/types.ts';

/** Seed of a chapter's i-th run (0-based): the family `pnpm sim` has always used, so tables stay comparable. */
const seedOf = (i: number): number => (i + 1) * 7919;
/** A wave whose average leaks exceed this is where the bot's defence starts to fall apart. */
const COLLAPSE_LEAKS = 2;

const USAGE = `用法：pnpm sim [每章局数] [法宝,法宝:阶,...] [选项]
  机器人用固定种子把每一章打很多局，打印胜率表（默认每章 40 局、不带法宝）。
  法宝写名字，可以加 :阶（1～${MAX_TIER}），例如 金刚琢,照妖镜:2,定风珠

选项（写在哪里都行）：
  --chapter N   只看第 N 章（1～${CHAPTERS.length}）
  --leaks       每章每波的平均漏怪数，并标出第一个平均超过 ${COLLAPSE_LEAKS} 只的波（首个崩盘波）
  --trace       重放一局，逐波打印出怪、击杀、漏怪、被偷、阵地血、功德、奇遇和机器人的操作（要配 --chapter）
  --seed S      --trace 重放的种子，默认 ${seedOf(0)}（胜率表里每章的第一局）
  --help        显示这段说明

例子：
  pnpm sim 40 金刚琢,照妖镜:2,定风珠
  pnpm sim 40 --leaks
  pnpm sim --chapter 3 --trace --seed 123`;

interface Args {
  seeds: number;
  treasures: string;
  chapter: number | null;
  seed: number | null;
  trace: boolean;
  leaks: boolean;
  help: boolean;
}

function fail(msg: string): never {
  console.error(`${msg}（pnpm sim --help 看用法）`);
  process.exit(1);
}

function int(raw: string | undefined, what: string): number {
  const n = Number(raw);
  if (raw === undefined || raw.trim() === '' || !Number.isInteger(n)) fail(`${what}应该是整数，收到「${raw ?? ''}」`);
  return n;
}

/** Flags without a value. */
const SWITCHES: Record<string, 'trace' | 'leaks' | 'help' | undefined> = { '--trace': 'trace', '--leaks': 'leaks', '--help': 'help', '-h': 'help' };

/** Flags may sit anywhere (`--chapter 3` or `--chapter=3`); what is left are the two classic positional arguments. */
function parseArgs(argv: readonly string[]): Args {
  const args: Args = { seeds: 40, treasures: '', chapter: null, seed: null, trace: false, leaks: false, help: false };
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    // Reason: `pnpm sim -- --leaks` hands the separator through to the script.
    if (arg === '--') continue;
    if (!arg.startsWith('-')) {
      positional.push(arg);
      continue;
    }
    const eq = arg.indexOf('=');
    const flag = eq < 0 ? arg : arg.slice(0, eq);
    const takesValue = flag === '--chapter' || flag === '--seed';
    // `--chapter=3` carries its value; `--chapter 3` consumes the next argument.
    const value = eq >= 0 ? arg.slice(eq + 1) : takesValue ? argv[++i] : undefined;
    const sw = SWITCHES[flag];
    if (flag === '--chapter') args.chapter = int(value, '--chapter 后面');
    else if (flag === '--seed') args.seed = int(value, '--seed 后面');
    else if (!sw) fail(`不认识的参数：${arg}`);
    else if (value !== undefined) fail(`${flag} 不带值`);
    else args[sw] = true;
  }
  if (args.help) return args;
  if (positional.length > 2) fail(`多余的参数：${positional.slice(2).join(' ')}`);
  if (positional[0] !== undefined) args.seeds = int(positional[0], '每章局数');
  args.treasures = positional[1] ?? '';
  if (args.seeds < 1) fail('每章局数至少是 1');
  if (args.chapter !== null && (args.chapter < 1 || args.chapter > CHAPTERS.length)) fail(`--chapter 要在 1～${CHAPTERS.length} 之间`);
  if (args.trace && args.leaks) fail('--trace 和 --leaks 只能选一个');
  if (args.trace && args.chapter === null) fail('--trace 要配 --chapter N，指定重放哪一章');
  if (args.seed !== null && !args.trace) fail('--seed 只给 --trace 用');
  return args;
}

/** Equips the listed 法宝 (name or name:tier) and returns their run modifiers. */
function loadTreasures(list: string): { equipped: string; mods: RunMods } {
  const vault = emptyVault();
  for (const raw of list.split(',').filter(Boolean)) {
    const [id, tier] = raw.split(':');
    if (!isTreasureId(id)) fail(`没有这件法宝：${id}（可选：${TREASURE_IDS.join('、')}）`);
    const t = tier === undefined ? 1 : int(tier, `${id}的阶`);
    if (t < 1 || t > MAX_TIER) fail(`${id}的阶要在 1～${MAX_TIER} 之间`);
    addTreasure(vault, id, t);
    vault.equipped.push(id);
  }
  return { equipped: vault.equipped.join(' ') || 'none', mods: buildMods(vault) };
}

/** The classic table: win rate, waves cleared, camp HP left and run length per chapter. */
function printWinRates(chapters: readonly ChapterDef[], seeds: number, mods: RunMods): void {
  const rows = chapters.map((ch) => {
    const runs = Array.from({ length: seeds }, (_, s) => runChapter(seedOf(s), ch.id, { knobs: DEFAULT_BOT, mods }));
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
  console.table(rows);
}

/** Average leaks per wave and the first wave where they pass COLLAPSE_LEAKS. */
function printLeaks(chapters: readonly ChapterDef[], seeds: number, mods: RunMods): void {
  const maxWaves = Math.max(...chapters.map((c) => c.waves));
  const rows = chapters.map((ch) => {
    const runs = Array.from({ length: seeds }, (_, s) => traceChapter(seedOf(s), ch.id, { knobs: DEFAULT_BOT, mods }).waves);
    const row: Record<string, string> = { chapter: `${ch.id} ${ch.name}` };
    let collapse = '无';
    for (let w = 1; w <= maxWaves; w++) {
      const col = `第${w}波`;
      // Reason: average only over the runs that got to this wave; runs already lost would pull it towards 0.
      const reached = runs.filter((waves) => waves.length >= w);
      if (w > ch.waves || reached.length === 0) {
        row[col] = w > ch.waves ? '' : '—';
        continue;
      }
      const avg = reached.reduce((sum, waves) => sum + waves[w - 1].leaked, 0) / reached.length;
      row[col] = reached.length < seeds ? `${avg.toFixed(1)} (${reached.length})` : avg.toFixed(1);
      if (collapse === '无' && avg > COLLAPSE_LEAKS) collapse = col;
    }
    row['首个崩盘波'] = collapse;
    return row;
  });
  console.log(`每格：打到这一波的局里平均漏几只妖怪（只算扣阵地血的）；括号里是打到这一波的局数，全部局都打到时不写。首个崩盘波：第一个平均超过 ${COLLAPSE_LEAKS} 只的波。`);
  console.table(rows);
}

const pad = (n: number, width: number): string => String(n).padStart(width);

function traceLine(w: WaveTrace): string {
  const parts = [
    `第${pad(w.wave, 2)}波`,
    `出怪 ${pad(w.spawned, 3)} 击杀 ${pad(w.killed, 3)} 漏 ${pad(w.leaked, 2)} 被偷 ${pad(w.stolen, 2)}`,
    `阵地 ${pad(w.campHpAfter, 3)}`,
    `功德 ${pad(w.gongdeBefore, 3)}→${pad(w.gongdeAfter, 3)}`,
  ];
  if (w.encounter) parts.push(`奇遇 ${w.encounter}`);
  parts.push(`波前 ${w.bought.join('、') || '（没动）'}`);
  return parts.join(' │ ');
}

/** Replays one run and prints it wave by wave, then its result. */
function printTrace(ch: ChapterDef, seed: number, mods: RunMods): void {
  const start = createGame({ seed, chapter: ch.id, mods });
  const { result, waves } = traceChapter(seed, ch.id, { knobs: DEFAULT_BOT, mods });
  console.log(`第 ${ch.id} 章 ${ch.name} · 种子 ${seed} · 开局功德 ${start.gongde} · 阵地 ${start.campHp}/${start.campMax}`);
  console.log('每行：出怪/击杀/漏怪/被偷功德 │ 波末阵地血 │ 功德 开波→收波 │ 奇遇 候选 → 选择 │ 波前 机器人在构筑期的操作（石台按地图从上到下、从左到右编号）');
  for (const w of waves) console.log(traceLine(w));
  // Reason: a lost run always ends at 0 camp HP, so a run that is neither won nor at 0 ran into the time cap.
  const verdict = result.won ? '胜利' : result.campHp <= 0 ? '失败' : '超时';
  const minutes = (result.ticks / 3600).toFixed(1);
  console.log(`结果 ${verdict} · 清 ${result.wavesCleared}/${ch.waves} 波 · 阵地 ${result.campHp} · ${result.ticks} 帧（${minutes} 分钟） · hash ${result.hash}`);
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(USAGE);
  process.exit(0);
}
const { equipped, mods } = loadTreasures(args.treasures);
const chapters = args.chapter === null ? CHAPTERS : [CHAPTERS[args.chapter - 1]];
const bot = `bot: ${JSON.stringify(DEFAULT_BOT)}`;
if (args.trace) {
  console.log(`${bot} · treasures: ${equipped}`);
  printTrace(chapters[0], args.seed ?? seedOf(0), mods);
} else {
  console.log(`${bot} · seeds per chapter: ${args.seeds} · treasures: ${equipped}`);
  if (args.leaks) printLeaks(chapters, args.seeds, mods);
  else printWinRates(chapters, args.seeds, mods);
}
