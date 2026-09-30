// Level list, AI difficulty per level, and match-wide rules (economy, timing, overtime).
import type { AiKnobs } from '../core/types.ts';

export interface LevelDef {
  id: number;
  name: string;
  /** Enemy HP multiplier for this level. */
  hpMul: number;
  boss5: string;
  boss10: string;
  ai: AiKnobs;
}

export const LEVELS: readonly LevelDef[] = [
  { id: 1, name: '白虎岭', hpMul: 1.0, boss5: '黑熊精', boss10: '白骨精', ai: { think: 2.4, mistake: 0.35, bonus: -20 } },
  { id: 2, name: '黄风岭', hpMul: 1.2, boss5: '虎先锋', boss10: '黄风怪', ai: { think: 2.0, mistake: 0.28, bonus: -10 } },
  { id: 3, name: '火云洞', hpMul: 1.45, boss5: '银角', boss10: '红孩儿', ai: { think: 1.5, mistake: 0.18, bonus: 5 } },
  { id: 4, name: '火焰山', hpMul: 1.7, boss5: '铁扇公主', boss10: '牛魔王', ai: { think: 1.3, mistake: 0.14, bonus: 10 } },
  { id: 5, name: '狮驼岭', hpMul: 1.95, boss5: '青狮', boss10: '金翅大鹏', ai: { think: 1.05, mistake: 0.08, bonus: 30 } },
];

/** Stand-in for a reasonable human player in balance simulations. */
export const HUMAN_PROXY: AiKnobs = { think: 1.0, mistake: 0.12, bonus: 0 };

export const WAVES_PER_LEVEL = 10;
export const BOSS_WAVES: readonly number[] = [5, 10];
export const START_GONGDE = 120;
export const START_HEARTS = 3;
export const PREP_SECONDS = 8;
/** Seconds between spawns inside a regular wave. */
export const SPAWN_GAP = 0.8;
/** Seconds after a wave's last spawn before the next wave starts. */
export const WAVE_REST = 6;
export const BOSS_REST_EXTRA = 6;
export const OT_SPAWN_GAP = 0.5;
/** Overtime HP multiplier per overtime wave. */
export const OT_HP_GROWTH = 1.25;
/** After this many overtime waves the match is decided on points. */
export const OT_MAX = 15;
export const SELL_REFUND = 0.5;

/** Price of the next 化缘 given how many draws a side has already made. */
export function recruitCost(drawCount: number): number {
  return Math.min(10 + 4 * drawCount, 100);
}
