// Headless chapter runs played by the bot; shared by the balance tests and `pnpm sim`.
import { botBuildAction, DEFAULT_BOT, type BotKnobs } from './bot.ts';
import { act, createGame, hashState, step } from './game.ts';
import { mixSeed } from './rng.ts';
import type { RunMods } from './types.ts';

/** 20 simulated minutes; every chapter must end well before this. */
export const MAX_SIM_TICKS = 20 * 60 * 60;
/** Safety cap on bot actions per build phase. */
const MAX_BUILD_ACTIONS = 60;

export interface RunResult {
  won: boolean;
  wavesCleared: number;
  campHp: number;
  ticks: number;
  hash: number;
}

export interface SimOptions {
  knobs?: BotKnobs;
  /** 法宝 effects to play with (none by default). */
  mods?: RunMods;
  maxTicks?: number;
}

export function runChapter(seed: number, chapter: number, opts: SimOptions = {}): RunResult {
  const knobs = opts.knobs ?? DEFAULT_BOT;
  const maxTicks = opts.maxTicks ?? MAX_SIM_TICKS;
  const g = createGame({ seed, chapter, mods: opts.mods });
  const luck = { rng: mixSeed(seed, 99) };
  while (g.phase !== 'won' && g.phase !== 'lost' && g.tick < maxTicks) {
    if (g.phase === 'build') {
      for (let k = 0; k < MAX_BUILD_ACTIONS && g.phase === 'build'; k++) {
        const a = botBuildAction(g, knobs, luck);
        const r = act(g, a);
        // Reason: a rejected action would be chosen again forever; start the wave instead.
        if (a.t !== 'start' && r !== 'ok' && r !== 'merge' && r !== 'hero' && r !== 'divine' && r !== 'move' && r !== 'swap') break;
      }
      // An unanswered encounter would block 'start'; the bot always answers it first, so this only
      // fires when the action cap was hit mid-shopping.
      if (g.phase === 'build') {
        if (g.encounter) act(g, { t: 'choose', option: 0 });
        act(g, { t: 'start' });
      }
    }
    step(g);
  }
  const cleared = g.phase === 'won' ? g.wave : g.wave - 1;
  return { won: g.phase === 'won', wavesCleared: Math.max(0, cleared), campHp: g.campHp, ticks: g.tick, hash: hashState(g) };
}
