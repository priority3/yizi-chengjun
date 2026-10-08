// Wave composition per chapter: minions from both gates, an elite mid-chapter, the chapter boss last,
// plus whatever the last encounter queued (wolf packs, a thief, a visiting boss, speed/HP/bounty tweaks).
import { CHAPTERS, MIN_SPAWN_GAP, SPAWN_GAP } from '../config/chapters.ts';
import { BASE_HP, ENEMIES, SPEED_GROWTH } from '../config/enemies.ts';
import { defaultWaveMods } from './encounters.ts';
import { SPAWN_X_MAX, SPAWN_X_MIN } from './grid.ts';
import { rand } from './rng.ts';
import type { GameState, Lane, Spawn, WaveMods } from './types.ts';

export interface WavePlan {
  spawns: Spawn[];
  boss: string | null;
  elite: boolean;
  mods: WaveMods;
}

/** Bounty of the thief when killed, and of a visiting mini-boss. */
export const THIEF_BOUNTY = 30;
export const MINI_BOSS_BOUNTY = 60;

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
  return 6 + 2 * wave + Math.floor(chapter / 2);
}

interface SpawnOpts {
  hpMul?: number;
  /** Fixed bounty that ignores the wave's bounty multiplier. */
  bounty?: number;
}

/**
 * Builds wave `w` of the current chapter, consuming the queued encounter modifiers.
 * Lanes and spawn positions come from the run's seeded RNG.
 */
export function buildWave(g: GameState, w: number): WavePlan {
  const ch = CHAPTERS[g.chapter - 1];
  const mods = g.waveMods;
  const count = Math.round(waveSize(g.chapter, w) * (mods.wolves ? 1.5 : 1));
  const gap = Math.max(MIN_SPAWN_GAP, SPAWN_GAP - 0.05 * (w - 1));
  const spawns: Spawn[] = [];
  const add = (def: string, at: number, opts: SpawnOpts = {}) => {
    const lane: Lane = rand(g) < 0.5 ? 0 : 1;
    const x = SPAWN_X_MIN + rand(g) * (SPAWN_X_MAX - SPAWN_X_MIN);
    const d = ENEMIES[def];
    spawns.push({
      at,
      def,
      lane,
      x,
      hp: Math.round(waveHp(def, g.chapter, w) * mods.hpMul * (opts.hpMul ?? 1)),
      speed: d.speed * (1 + SPEED_GROWTH * (w - 1)) * mods.speedMul,
      bounty: opts.bounty ?? Math.round(d.bounty * mods.bountyMul),
    });
  };
  for (let i = 0; i < count; i++) add(mods.wolves ? '狼' : minionType(i, w), i * gap);
  if (mods.thief) add('盗', (Math.floor(count * 0.4) + 0.5) * gap, { bounty: THIEF_BOUNTY });
  let tail = count * gap;
  const elite = w === eliteWave(ch.waves) && w !== ch.waves;
  if (elite) {
    add('魔', tail);
    tail += gap;
  }
  const boss = w === ch.waves ? ch.boss : null;
  if (boss) {
    add(boss, tail);
    tail += gap;
  }
  if (mods.miniBoss) add(mods.miniBoss, tail, { hpMul: 0.5, bounty: MINI_BOSS_BOUNTY });
  // Reason: spawns must stay sorted by time for the spawner; the thief was inserted mid-wave.
  spawns.sort((a, b) => a.at - b.at);
  g.activeMods = mods;
  g.waveMods = defaultWaveMods();
  return { spawns, boss, elite, mods };
}
