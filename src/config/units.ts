// Tile table: every character that can appear on the board, plus draw weights.
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
export const DIVINE = { dmg: 2.5, interval: 0.8, range: 0.5, fx: 1.5 } as const;
/** 速: total attack-speed bonus a single slot can receive. */
export const HASTE_CAP = 1.5;
export const SLOW_CAP = 0.7;
/** Seconds per heart restored by a level-1 疗 (divided by its level). */
export const HEAL_EVERY = 60;

const frag = (id: FragId): UnitDef => ({
  id,
  kind: 'fragment',
  label: '名字碎片',
  desc: '不能打怪，拖到另一半上觉醒英雄',
  dmg: 0,
  range: 0,
  interval: 0,
  fx: { t: 'none' },
  color: '#a8740c',
});

export const UNITS: Record<UnitId, UnitDef> = {
  棍: { id: '棍', kind: 'attack', label: '近战快攻', desc: '攻速快，射程短', dmg: 10, range: 1.5, interval: 0.4, fx: { t: 'none' }, color: '#8a4b1f' },
  箭: { id: '箭', kind: 'attack', label: '远程', desc: '射程远', dmg: 8, range: 2.5, interval: 0.8, fx: { t: 'none' }, color: '#2f7d32' },
  火: { id: '火', kind: 'attack', label: '溅射', desc: '伤害波及目标周围的妖怪', dmg: 8, range: 2, interval: 1.2, fx: { t: 'splash', radius: 0.9, pct: 0.6 }, color: '#d8431c' },
  冰: { id: '冰', kind: 'attack', label: '减速', desc: '命中的妖怪移动变慢', dmg: 4, range: 2, interval: 1, fx: { t: 'slow', pct: 0.35, dur: 1.5 }, color: '#1f8fbf' },
  雷: { id: '雷', kind: 'attack', label: '重击', desc: '伤害高，出手慢', dmg: 40, range: 2, interval: 2.5, fx: { t: 'none' }, color: '#7b3fc4' },
  速: { id: '速', kind: 'support', label: '加速', desc: '周围 8 格的字攻速提高', dmg: 0, range: 0, interval: 0, fx: { t: 'haste', pct: 0.2 }, color: '#0f8a7e' },
  钱: { id: '钱', kind: 'support', label: '生财', desc: '每 4 秒产出功德', dmg: 0, range: 0, interval: 4, fx: { t: 'income', amount: 3 }, color: '#b07d00' },
  疗: { id: '疗', kind: 'support', label: '回心', desc: '唐僧缺心时慢慢回心，加时赛无效', dmg: 0, range: 0, interval: HEAL_EVERY, fx: { t: 'heal' }, color: '#d6457a' },
  悟: frag('悟'),
  空: frag('空'),
  八: frag('八'),
  戒: frag('戒'),
  沙: frag('沙'),
  僧: frag('僧'),
  白: frag('白'),
  龙: frag('龙'),
  悟空: { id: '悟空', kind: 'hero', label: '穿透', desc: '一棒打穿目标和身后两只妖怪', dmg: 60, range: 2, interval: 1, fx: { t: 'pierce', count: 3, reach: 1.5 }, color: '#c0392b' },
  八戒: { id: '八戒', kind: 'hero', label: '群晕', desc: '钉耙砸地，周围妖怪受伤并眩晕', dmg: 25, range: 1.6, interval: 2, fx: { t: 'stun', radius: 1.2, dur: 0.8 }, color: '#6d4c9f' },
  沙僧: { id: '沙僧', kind: 'hero', label: '斩杀', desc: '残血妖怪直接斩杀', dmg: 30, range: 2.4, interval: 1.2, fx: { t: 'execute', pct: 0.15, bossPct: 0.05 }, color: '#2d6a8a' },
  白龙: { id: '白龙', kind: 'hero', label: '全屏', desc: '每秒攻击全场所有妖怪', dmg: 6, range: Infinity, interval: 1, fx: { t: 'global' }, color: '#3a7bd5' },
  神: { id: '神', kind: 'divine', label: '神', desc: '拖到兵字或英雄上，变成神X', dmg: 0, range: 0, interval: 0, fx: { t: 'none' }, color: '#d4002a' },
};

export const FRAGMENTS: readonly FragId[] = ['悟', '空', '八', '戒', '沙', '僧', '白', '龙'];

/** Draw weights (sum 100). 'frag' expands to one of the eight name fragments. */
export const DRAW_WEIGHTS: ReadonlyArray<readonly [UnitId | 'frag', number]> = [
  ['棍', 14], ['箭', 14], ['火', 12], ['冰', 10], ['雷', 10],
  ['速', 8], ['钱', 8], ['疗', 4], ['frag', 16], ['神', 4],
];
/** 神 cannot be drawn during the first N draws. */
export const DIVINE_LOCK_DRAWS = 6;
/** Chance that a drawn fragment is the missing partner of one already on the board. */
export const FRAG_PARTNER_CHANCE = 0.6;
