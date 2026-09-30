// Wave composition per chapter: minions from both gates, an elite mid-chapter, and the chapter boss last.
import { CHAPTERS, incomeMul, MIN_SPAWN_GAP, SPAWN_GAP } from '../config/chapters.ts';
import { BASE_HP, ENEMIES, SPEED_GROWTH } from '../config/enemies.ts';
import { SPAWN_X_MAX, SPAWN_X_MIN } from './grid.ts';
import { rand } from './rng.ts';
import type { GameState, Lane, Spawn } from './types.ts';

export interface WavePlan {
  spawns: Spawn[];
  boss: string | null;
  elite: boolean;
}

export function waveHp(def: string, chapter: number, wave: number): number {
  const ch = CHAPTERS[chapter - 1];
  return Math.round(BASE_HP * ENEMIES[def].hpK * ch.hpStart * ch.hpGrowth ** (wave - 1));
}

/** Minion type for the i-th spawn of a wave: wolves from wave 2, bears from wave 3, imps otherwise. */
export function minionType(i: number, wave: number): string {
  if (wave >= 3 && i % 5 === 4) return '熊';
  if (wave >= 2 && i % 3 === 1) return '狼';
  return '妖';
}

/** The wave that ends with an elite 魔将 (the middle of the chapter). */
export function eliteWave(totalWaves: number): number {
  return Math.ceil(totalWaves / 2);
}

export function waveSize(chapter: number, wave: number): number {
  return 5 + 2 * wave + Math.floor(chapter / 2);
}

/** Builds wave `w` of the current chapter. Lanes and spawn positions come from the run's seeded RNG. */
export function buildWave(g: GameState, w: number): WavePlan {
  const ch = CHAPTERS[g.chapter - 1];
  const count = waveSize(g.chapter, w);
  const gap = Math.max(MIN_SPAWN_GAP, SPAWN_GAP - 0.05 * (w - 1));
  const spawns: Spawn[] = [];
  const add = (def: string, at: number) => {
    const lane: Lane = rand(g) < 0.5 ? 0 : 1;
    const x = SPAWN_X_MIN + rand(g) * (SPAWN_X_MAX - SPAWN_X_MIN);
    const d = ENEMIES[def];
    spawns.push({ at, def, lane, x, hp: waveHp(def, g.chapter, w), speed: d.speed * (1 + SPEED_GROWTH * (w - 1)), bounty: Math.round(d.bounty * incomeMul(g.chapter)) });
  };
  for (let i = 0; i < count; i++) add(minionType(i, w), i * gap);
  const elite = w === eliteWave(ch.waves) && w !== ch.waves;
  if (elite) add('魔', count * gap);
  const boss = w === ch.waves ? ch.boss : null;
  if (boss) add(boss, (count + 1) * gap);
  return { spawns, boss, elite };
}
