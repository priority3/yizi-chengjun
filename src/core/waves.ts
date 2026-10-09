// Wave composition per chapter: minions from both gates, an elite mid-chapter, the chapter boss last,
// plus whatever the last encounter queued (wolf packs, a thief, a visiting boss, speed/HP/bounty tweaks)
// and, in later chapters, now and then an air raid of bats flying straight at the camp.
import { CHAPTERS, incomeMul, MIN_SPAWN_GAP, SPAWN_GAP } from '../config/chapters.ts';
import { AIR_RAID, BASE_HP, ENEMIES, SPEED_GROWTH } from '../config/enemies.ts';
import { MAP_HP } from '../config/maps.ts';
import { defaultWaveMods } from './encounters.ts';
import { rand } from './rng.ts';
import type { GameState, Spawn, WaveMods } from './types.ts';

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
  return Math.round(BASE_HP * MAP_HP * ENEMIES[def].hpK * ch.hpStart * ch.hpGrowth ** (wave - 1));
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

/** Whether `chapter` brings air raids at all (the bot plans for them from then on). */
export function hasAirRaids(chapter: number): boolean {
  return chapter >= AIR_RAID.fromChapter;
}

/** Whether wave `w` of `chapter` may bring an air raid: a chapter with raids, late enough, and not the boss wave. */
export function airRaidPossible(chapter: number, w: number): boolean {
  return hasAirRaids(chapter) && w >= AIR_RAID.fromWave && w !== CHAPTERS[chapter - 1].waves;
}

/** Monster of the i-th flyer in an air raid: bats, and from AIR_RAID.rocFromChapter every second one a 鹏雏. */
export function raiderType(i: number, chapter: number): string {
  return chapter >= AIR_RAID.rocFromChapter && i % 2 === 1 ? '鹏' : '蝠';
}

interface SpawnOpts {
  hpMul?: number;
  /** Fixed bounty that ignores the wave's bounty multiplier. */
  bounty?: number;
}

/**
 * Builds wave `w` of the current chapter, consuming the queued encounter modifiers.
 * Roads and sideways offsets come from the run's seeded RNG.
 */
export function buildWave(g: GameState, w: number): WavePlan {
  const ch = CHAPTERS[g.chapter - 1];
  const mods = g.waveMods;
  const count = Math.round(waveSize(g.chapter, w) * (mods.wolves ? 1.5 : 1));
  const gap = Math.max(MIN_SPAWN_GAP, SPAWN_GAP - 0.05 * (w - 1));
  const spawns: Spawn[] = [];
  const add = (def: string, at: number, opts: SpawnOpts = {}) => {
    // Reason: always two random draws per spawn, so a seed replays identically whatever the map.
    const path = Math.floor(rand(g) * g.map.paths.length);
    const side = (rand(g) - 0.5) * 2;
    const d = ENEMIES[def];
    spawns.push({
      at,
      def,
      path,
      side,
      hp: Math.round(waveHp(def, g.chapter, w) * g.map.hpScale * mods.hpMul * (opts.hpMul ?? 1)),
      speed: d.speed * (1 + SPEED_GROWTH * (w - 1)) * mods.speedMul,
      bounty: opts.bounty ?? Math.round(d.bounty * incomeMul(g.chapter) * mods.bountyMul),
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
  // Air raid: a flock takes off once about half of the ground monsters are out.
  // Reason: the chapter and wave checks come before the draw, so chapters without raids (1-5) use exactly the random
  // numbers they always did; and the ground monsters above drew theirs first, so they stay the same in every chapter.
  if (airRaidPossible(g.chapter, w) && rand(g) < AIR_RAID.chance) {
    const launch = Math.floor(count / 2) * gap;
    const flock = AIR_RAID.size + Math.floor(w / 2);
    for (let i = 0; i < flock; i++) add(raiderType(i, g.chapter), launch + i * AIR_RAID.spacing);
  }
  // Reason: spawns must stay sorted by time for the spawner; the thief and the air raid were inserted mid-wave.
  spawns.sort((a, b) => a.at - b.at);
  g.activeMods = mods;
  g.waveMods = defaultWaveMods();
  return { spawns, boss, elite, mods };
}
