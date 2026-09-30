// Wave timetable. Waves start on a fixed schedule that ignores both boards,
// so a side that falls behind sees enemies pile up — that is the pressure of the versus mode.
import { BASE_HP, BOUNTY_GROWTH, ENEMIES, HP_GROWTH, SPEED_GROWTH } from '../config/enemies.ts';
import {
  BOSS_REST_EXTRA,
  BOSS_WAVES,
  LEVELS,
  OT_HP_GROWTH,
  OT_SPAWN_GAP,
  SPAWN_GAP,
  WAVE_REST,
  WAVES_PER_LEVEL,
} from '../config/levels.ts';
import type { Spawn } from './types.ts';

export const TICKS_PER_SEC = 60;

export interface WavePlan {
  spawns: Spawn[];
  /** Tick at which the following wave begins. */
  next: number;
  boss: string | null;
}

export function isBossWave(w: number): boolean {
  return BOSS_WAVES.includes(w);
}

/** Minion type for the i-th spawn of a wave: bears from wave 4, wolves from wave 3, imps otherwise. */
export function minionType(i: number, wave: number): string {
  if (wave >= 4 && i % 5 === 4) return '熊';
  if (wave >= 3 && i % 3 === 1) return '狼';
  return '妖';
}

export function waveHp(def: string, level: number, wave: number): number {
  return Math.round(BASE_HP * ENEMIES[def].hpK * HP_GROWTH ** (wave - 1) * LEVELS[level - 1].hpMul);
}

function makeSpawn(def: string, level: number, wave: number, at: number): Spawn {
  const d = ENEMIES[def];
  return {
    at,
    def,
    hp: waveHp(def, level, wave),
    speed: d.speed * (1 + SPEED_GROWTH * (wave - 1)),
    bounty: Math.round(d.bounty * (1 + BOUNTY_GROWTH * (wave - 1))),
    leak: d.leak,
  };
}

function restTicks(boss: boolean): number {
  return Math.round((WAVE_REST + (boss ? BOSS_REST_EXTRA : 0)) * TICKS_PER_SEC);
}

/** Regular wave `w` (1..10) starting at tick `start`. Boss waves have fewer escorts, then the boss last. */
export function buildWave(level: number, w: number, start: number): WavePlan {
  const lv = LEVELS[level - 1];
  const bossId = isBossWave(w) ? (w === WAVES_PER_LEVEL ? lv.boss10 : lv.boss5) : null;
  const minions = bossId ? 4 + w : 6 + 2 * w;
  const gap = Math.round(SPAWN_GAP * TICKS_PER_SEC);
  const spawns: Spawn[] = [];
  for (let i = 0; i < minions; i++) spawns.push(makeSpawn(minionType(i, w), level, w, start + i * gap));
  if (bossId) spawns.push(makeSpawn(bossId, level, w, start + minions * gap));
  return { spawns, next: start + spawns.length * gap + restTicks(bossId !== null), boss: bossId };
}

/**
 * Overtime wave k (1-based): more and tougher enemies that also cost more hearts,
 * with the level's final boss every 5th wave. Guarantees the match eventually ends.
 */
export function buildOvertime(level: number, k: number, start: number): WavePlan {
  const count = 20 + 2 * k;
  const gap = Math.round(OT_SPAWN_GAP * TICKS_PER_SEC);
  const hpMul = OT_HP_GROWTH ** k;
  const extraLeak = Math.floor(k / 5);
  const spawns: Spawn[] = [];
  const add = (def: string, at: number) => {
    const s = makeSpawn(def, level, WAVES_PER_LEVEL, at);
    s.hp = Math.round(s.hp * hpMul);
    s.leak += extraLeak;
    spawns.push(s);
  };
  for (let i = 0; i < count; i++) add(minionType(i, WAVES_PER_LEVEL), start + i * gap);
  const bossId = k % 5 === 0 ? LEVELS[level - 1].boss10 : null;
  if (bossId) add(bossId, start + count * gap);
  return { spawns, next: start + spawns.length * gap + restTicks(bossId !== null), boss: bossId };
}
