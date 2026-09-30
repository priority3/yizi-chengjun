// A chapter run: build phase (shop open) <-> battle phase (a wave attacks) until the boss falls or the camp does.
import { CAMP_HP, CHAPTERS, FIRST_SHOP_ATTACKERS, START_GONGDE, STARTER_CELL, waveBonus } from '../config/chapters.ts';
import { makeTile, resolveDrop } from './board.ts';
import { DT } from './clock.ts';
import { stepCombat } from './combat.ts';
import { CELL_COUNT, initialUnlocked } from './grid.ts';
import { makeEnemy, moveEnemies } from './monsters.ts';
import { mixSeed } from './rng.ts';
import { buy, refresh, restock, unlock } from './shop.ts';
import { buildWave } from './waves.ts';
import type { Action, ActionResult, GameState } from './types.ts';

export interface GameOptions {
  seed: number;
  chapter: number;
}

export function createGame(opts: GameOptions): GameState {
  const ch = CHAPTERS[opts.chapter - 1];
  const g: GameState = {
    seed: opts.seed,
    chapter: opts.chapter,
    tick: 0,
    phase: 'build',
    wave: 0,
    totalWaves: ch.waves,
    waveTime: 0,
    gongde: START_GONGDE,
    campHp: CAMP_HP,
    campMax: CAMP_HP,
    unlocked: initialUnlocked(),
    unlockCount: 0,
    slots: new Array<null>(CELL_COUNT).fill(null),
    enemies: [],
    projectiles: [],
    spawns: [],
    shop: [],
    refreshes: 0,
    rng: mixSeed(opts.seed, 7),
    kills: 0,
    events: [],
    nextUid: 1,
  };
  // Every chapter starts with one free 箭 on the camp and a shop with at least two attack cards.
  g.slots[STARTER_CELL] = makeTile(g, '箭', 0);
  restock(g, FIRST_SHOP_ATTACKERS);
  return g;
}

function startWave(g: GameState): ActionResult {
  g.wave++;
  const plan = buildWave(g, g.wave);
  g.spawns = plan.spawns;
  g.waveTime = 0;
  g.phase = 'battle';
  g.events.push({ t: 'waveStart', wave: g.wave, boss: plan.boss, elite: plan.elite });
  return 'ok';
}

/** Applies a player (or bot) action immediately. Events it produces are appended to `g.events`. */
export function act(g: GameState, a: Action): ActionResult {
  if (g.phase === 'won' || g.phase === 'lost') return 'phase';
  switch (a.t) {
    case 'buy':
      return g.phase === 'build' ? buy(g, a.offer, a.cell) : 'phase';
    case 'refresh':
      return g.phase === 'build' ? refresh(g) : 'phase';
    case 'start':
      return g.phase === 'build' ? startWave(g) : 'phase';
    case 'unlock':
      return unlock(g, a.cell);
    case 'drop':
      return resolveDrop(g, a.from, a.to);
  }
}

function endWave(g: GameState): void {
  g.projectiles.length = 0;
  if (g.wave >= g.totalWaves) {
    g.phase = 'won';
    g.events.push({ t: 'won' });
    return;
  }
  const bonus = waveBonus(g.wave, g.chapter);
  g.gongde += bonus;
  g.phase = 'build';
  g.refreshes = 0;
  restock(g);
  g.events.push({ t: 'waveClear', wave: g.wave, bonus });
}

/** Advances the run by one fixed tick (1/60 s). Nothing moves during the build phase. */
export function step(g: GameState): void {
  g.events.length = 0;
  g.tick++;
  if (g.phase !== 'battle') return;
  g.waveTime += DT;
  while (g.spawns.length > 0 && g.spawns[0].at <= g.waveTime) {
    const s = g.spawns.shift();
    if (s) g.enemies.push(makeEnemy(g, s.def, s.lane, s.x, s.hp, s.speed, s.bounty));
  }
  moveEnemies(g);
  stepCombat(g);
  if (g.campHp <= 0) {
    g.phase = 'lost';
    g.events.push({ t: 'lost' });
    return;
  }
  if (g.spawns.length === 0 && g.enemies.length === 0) endWave(g);
}

/** FNV-1a hash of the gameplay-relevant state; equal hashes mean identical runs. */
export function hashState(g: GameState): number {
  let h = 0x811c9dc5;
  const mix = (n: number) => {
    h ^= n | 0;
    h = Math.imul(h, 0x01000193);
  };
  mix(g.tick);
  mix(g.wave);
  mix(g.gongde);
  mix(Math.round(g.campHp * 100));
  mix(g.kills);
  mix(g.rng);
  mix(g.unlockCount);
  for (const t of g.slots) {
    if (!t) {
      mix(-1);
      continue;
    }
    for (const ch of t.id) mix(ch.charCodeAt(0));
    mix(t.level);
    mix(t.divine ? 1 : 0);
  }
  for (const e of g.enemies) {
    mix(e.uid);
    mix(Math.round(e.hp * 100));
    mix(Math.round(e.y * 100));
  }
  for (const o of g.shop) for (const ch of o.id) mix(ch.charCodeAt(0));
  return h >>> 0;
}
