// Headless chapter runs played by the bot; shared by the balance tests and `pnpm sim`.
// One loop (playChapter) serves both plain runs (runChapter) and per-wave traces (sim-trace.ts) through an optional observer.
import { botBuildAction, DEFAULT_BOT, type BotKnobs } from './bot.ts';
import { act, createGame, hashState, step } from './game.ts';
import { mixSeed } from './rng.ts';
import type { Action, ActionResult, GameState, RunMods, SimEvent } from './types.ts';

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

/**
 * Watches a bot run. Observers only read: they must never change `g` or draw random numbers,
 * so an observed run stays bit-identical to an unobserved one.
 */
export interface RunObserver {
  /** Before every act(), while the board still shows what the action is about to change (e.g. the tile being sold). */
  beforeAction?(g: GameState, a: Action): void;
  /** After every act(): its result and exactly the events that action appended. */
  action?(g: GameState, a: Action, result: ActionResult, events: readonly SimEvent[]): void;
  /** After every step(); `g.events` then holds exactly that tick's events. */
  tick?(g: GameState): void;
}

function observedAct(g: GameState, a: Action, observer: RunObserver | undefined): ActionResult {
  if (!observer) return act(g, a);
  observer.beforeAction?.(g, a);
  // Reason: act() only appends to g.events (step() is what clears them), so this action's events are the tail it added.
  const from = g.events.length;
  const r = act(g, a);
  observer.action?.(g, a, r, g.events.slice(from));
  return r;
}

/** The bot loop behind runChapter and traceChapter; returns the run's final state (won, lost or out of time). */
export function playChapter(seed: number, chapter: number, opts: SimOptions = {}, observer?: RunObserver): GameState {
  const knobs = opts.knobs ?? DEFAULT_BOT;
  const maxTicks = opts.maxTicks ?? MAX_SIM_TICKS;
  const g = createGame({ seed, chapter, mods: opts.mods });
  const luck = { rng: mixSeed(seed, 99) };
  while (g.phase !== 'won' && g.phase !== 'lost' && g.tick < maxTicks) {
    if (g.phase === 'build') {
      for (let k = 0; k < MAX_BUILD_ACTIONS && g.phase === 'build'; k++) {
        const a = botBuildAction(g, knobs, luck);
        const r = observedAct(g, a, observer);
        // Reason: a rejected action would be chosen again forever; start the wave instead.
        if (a.t !== 'start' && r !== 'ok' && r !== 'merge' && r !== 'hero' && r !== 'divine' && r !== 'move' && r !== 'swap') break;
      }
      // An unanswered encounter would block 'start'; the bot always answers it first, so this only
      // fires when the action cap was hit mid-shopping.
      if (g.phase === 'build') {
        if (g.encounter) observedAct(g, { t: 'choose', option: 0 }, observer);
        observedAct(g, { t: 'start' }, observer);
      }
    }
    step(g);
    observer?.tick?.(g);
  }
  return g;
}

/** The result of a finished (or time-capped) run. */
export function summarize(g: GameState): RunResult {
  const cleared = g.phase === 'won' ? g.wave : g.wave - 1;
  return { won: g.phase === 'won', wavesCleared: Math.max(0, cleared), campHp: g.campHp, ticks: g.tick, hash: hashState(g) };
}

export function runChapter(seed: number, chapter: number, opts: SimOptions = {}): RunResult {
  return summarize(playChapter(seed, chapter, opts));
}
