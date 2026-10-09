// Tile table: every character that can appear on the board, with shop prices and attack styles.
// Balance lives here — tweak numbers, re-run `pnpm sim`.
import type { FragId, UnitDef, UnitId } from '../core/types.ts';

export const MAX_LEVEL = 5;
/**
 * Damage / income multiplier by level (index = level - 1).
 * Reason: each step is > 2x, so merging two tiles into one is always a strict upgrade.
 */
export const LEVEL_MUL: readonly number[] = [1, 2.2, 4.84, 10.65, 23.4];
/** Effect magnitude bonus per level above 1 (slow %, stun time, splash %, ...). */
export const LEVEL_FX = 0.1;
/** Modifiers applied by 神. */
export const DIVINE = { dmg: 2.5, interval: 0.8, range: 30, fx: 1.5 } as const;
/** 速: total attack-speed bonus a single cell can receive. */
export const HASTE_CAP = 1.5;
export const SLOW_CAP = 0.7;
/** Seconds between 疗 pulses at level 1 (divided by level). */
export const HEAL_EVERY = 8;

const frag = (id: FragId): UnitDef => ({
  id,
  kind: 'fragment',
  label: '名字碎片',
  desc: '不能打怪；拖到另一半上觉醒英雄',
  price: 12,
  dmg: 0,
  range: 0,
  interval: 0,
  shot: 'none',
  projSpeed: 0,
  knockback: 0,
  hitsAir: true,
  fx: { t: 'none' },
  color: '#9a6a0c',
});

const support = (id: UnitId, label: string, desc: string, price: number, interval: number, fx: UnitDef['fx'], color: string): UnitDef => ({
  id,
  kind: 'support',
  label,
  desc,
  price,
  dmg: 0,
  range: 0,
  interval,
  shot: 'none',
  projSpeed: 0,
  knockback: 0,
  hitsAir: true,
  fx,
  color,
});

export const UNITS: Record<UnitId, UnitDef> = {
  棍: { id: '棍', kind: 'attack', label: '近战', desc: '攻速快，只打阵地边的地面妖怪', price: 10, dmg: 9, range: 115, interval: 0.45, shot: 'swing', projSpeed: 0, knockback: 4, hitsAir: false, fx: { t: 'none' }, color: '#7a3b12' },
  箭: { id: '箭', kind: 'attack', label: '远程', desc: '射程最远，对空伤害 ×1.3', price: 10, dmg: 8, range: 200, interval: 0.75, shot: 'arrow', projSpeed: 560, knockback: 0, hitsAir: true, airMul: 1.3, fx: { t: 'none' }, color: '#2c6e2f' },
  火: { id: '火', kind: 'attack', label: '溅射', desc: '火球炸开，伤到周围的妖怪', price: 14, dmg: 9, range: 160, interval: 1.2, shot: 'fire', projSpeed: 300, knockback: 0, hitsAir: true, fx: { t: 'splash', radius: 44, pct: 0.6 }, color: '#d23a12' },
  冰: { id: '冰', kind: 'attack', label: '减速', desc: '冰锥让妖怪变慢', price: 12, dmg: 4, range: 160, interval: 1, shot: 'ice', projSpeed: 440, knockback: 0, hitsAir: true, fx: { t: 'slow', pct: 0.35, dur: 1.6 }, color: '#1e84b8' },
  雷: { id: '雷', kind: 'attack', label: '重击', desc: '天雷劈下，出手慢，对空 ×1.3', price: 16, dmg: 38, range: 170, interval: 2.4, shot: 'bolt', projSpeed: 0, knockback: 0, hitsAir: true, airMul: 1.3, fx: { t: 'none' }, color: '#6a35b5' },
  速: support('速', '加速', '周围 8 格的字攻速提高', 12, 0, { t: 'haste', pct: 0.2 }, '#0d7f73'),
  钱: support('钱', '生财', '战斗时每 4 秒产出功德', 15, 4, { t: 'income', amount: 3 }, '#a87400'),
  疗: support('疗', '回血', '阵地受伤时慢慢回血', 12, HEAL_EVERY, { t: 'heal', amount: 6 }, '#c93f73'),
  悟: frag('悟'),
  空: frag('空'),
  八: frag('八'),
  戒: frag('戒'),
  沙: frag('沙'),
  僧: frag('僧'),
  白: frag('白'),
  龙: frag('龙'),
  悟空: { id: '悟空', kind: 'hero', label: '贯穿', desc: '金箍棒一伸，打穿一整排妖怪', price: 0, dmg: 55, range: 175, interval: 1.1, shot: 'beam', projSpeed: 0, knockback: 6, hitsAir: true, fx: { t: 'beam', width: 18, count: 4 }, color: '#b8321f' },
  八戒: { id: '八戒', kind: 'hero', label: '群晕', desc: '钉耙砸地，周围妖怪受伤并眩晕', price: 0, dmg: 24, range: 110, interval: 2, shot: 'slam', projSpeed: 0, knockback: 10, hitsAir: false, fx: { t: 'stun', radius: 58, dur: 0.9 }, color: '#7a4ea6' },
  沙僧: { id: '沙僧', kind: 'hero', label: '斩杀', desc: '月牙铲飞出，残血妖怪直接斩杀', price: 0, dmg: 30, range: 180, interval: 1.2, shot: 'crescent', projSpeed: 400, knockback: 0, hitsAir: true, fx: { t: 'execute', pct: 0.15, bossPct: 0.05 }, color: '#2b6585' },
  白龙: { id: '白龙', kind: 'hero', label: '全屏', desc: '白龙横扫，每次攻击全场妖怪', price: 0, dmg: 6, range: Infinity, interval: 1, shot: 'dragon', projSpeed: 0, knockback: 0, hitsAir: true, fx: { t: 'global' }, color: '#2f6fc0' },
  神: { id: '神', kind: 'divine', label: '神', desc: '拖到兵字或英雄上，变成神X', price: 30, dmg: 0, range: 0, interval: 0, shot: 'none', projSpeed: 0, knockback: 0, hitsAir: true, fx: { t: 'none' }, color: '#c8001f' },
};

export const FRAGMENTS: readonly FragId[] = ['悟', '空', '八', '戒', '沙', '僧', '白', '龙'];

/** Shop weights (sum 100). 'frag' expands to one of the eight name fragments. */
export const SHOP_WEIGHTS: ReadonlyArray<readonly [UnitId | 'frag', number]> = [
  ['棍', 13], ['箭', 14], ['火', 11], ['冰', 10], ['雷', 9],
  ['速', 8], ['钱', 7], ['疗', 6], ['frag', 18], ['神', 4],
];
/** 神 only shows up in the shop from this wave on (0 = before wave 1). */
export const DIVINE_FROM_WAVE = 2;
/** Chance that a fragment offer is the missing partner of one already on the board. */
export const FRAG_PARTNER_CHANCE = 0.6;
/** Chance that an offer copies a level-1 unit already on the board (helps merging). */
export const OWNED_BIAS = 0.3;
