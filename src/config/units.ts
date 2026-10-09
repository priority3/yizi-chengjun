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
/** 速 and 鼓 together: total attack-speed bonus a single cell can receive. */
export const HASTE_CAP = 1.5;
export const SLOW_CAP = 0.7;
/** Seconds between 疗 pulses at level 1 (divided by level). */
export const HEAL_EVERY = 8;
/** 鼓: most extra damage a single cell can get from the drums around it (+45 %, a level-3 drum). */
export const DRUM_DMG_CAP = 0.45;
/** Seconds between 镜 pulses. */
export const MIRROR_EVERY = 6;
/**
 * 镜 measures its reflection in a 小妖 of the wave being fought, but stops growing after this wave (no chapter has as
 * many, so only endless and daily runs reach it).
 * Reason: every other card's damage is fixed by its level, which is why every endless run ends; a few mirrors growing
 * with the waves forever, fed by a trickle of leaks that 疗 heals back, could hold an endless run for good. Monster HP
 * grows x1.55 a wave, so past this one such an engine fades out within a few waves. At 15 the bot's endless runs
 * (`pnpm sim --endless`), most of which end by then, lose 0.3 waves on average; at 12 they lost 0.7.
 */
export const MIRROR_TOP_WAVE = 15;
/**
 * 网: once a net lets go, the monster spends this many seconds shaking it off, and no net can catch it meanwhile.
 * Reason: a net holds a boss for its whole time (a stun only half); without this pause a few nets taking turns could
 * hold one for good, and a chapter wave never goes berserk to end that. Now however many nets wait, everyone gets
 * this long to walk between two catches (half the time against level-1 nets).
 */
export const ROOT_GUARD = 1;

const POISON_FX = { t: 'poison', dps: 2, dur: 4, max: 5 } as const;
const DRUM_FX = { t: 'drum', dmg: 0.15, speed: 0.1 } as const;
const pct = (v: number): number => Math.round(v * 100);

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
  毒: { id: '毒', kind: 'attack', label: '中毒', desc: `毒针叠毒，最多 ${POISON_FX.max} 层，Boss 也吃满`, price: 12, dmg: 5, range: 180, interval: 0.8, shot: 'needle', projSpeed: 480, knockback: 0, hitsAir: true, fx: POISON_FX, color: '#3f8f2a' },
  网: { id: '网', kind: 'attack', label: '定身', desc: '撒网定身，Boss 也网得住', price: 12, dmg: 2, range: 150, interval: 4, shot: 'net', projSpeed: 340, knockback: 0, hitsAir: true, fx: { t: 'root', dur: 1 }, color: '#8a5a24' },
  速: support('速', '加速', '周围 8 格的字攻速提高', 12, 0, { t: 'haste', pct: 0.2 }, '#0d7f73'),
  钱: support('钱', '生财', '战斗时每 4 秒产出功德', 15, 4, { t: 'income', amount: 3 }, '#a87400'),
  疗: support('疗', '回血', '阵地受伤时慢慢回血', 12, HEAL_EVERY, { t: 'heal', amount: 6 }, '#c93f73'),
  鼓: support('鼓', '鼓舞', `周围 8 格的字每级伤害 +${pct(DRUM_FX.dmg)}%、攻速 +${pct(DRUM_FX.speed)}%`, 12, 0, DRUM_FX, '#b8321f'),
  // Reason for k 0.006 and cap 30 (`pnpm sim`): at k 0.02 with no cap the mirror dealt two thirds of chapter 10's damage
  // and carried an endless run to wave 46; now a level-1 mirror sends 5-18 % of a 小妖's HP at everyone per pulse
  // when the camp bleeds, adding about 6 points on chapter 10 and nearly nothing where the bot rarely leaks.
  镜: support('镜', '反弹', `每 ${MIRROR_EVERY} 秒把阵地受的伤反弹全场`, 14, MIRROR_EVERY, { t: 'mirror', k: 0.006, cap: 30 }, '#6f86a6'),
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

/**
 * Shop weights (sum 100). 'frag' expands to one of the eight name fragments.
 * Reason: 毒 网 鼓 镜 took their 16 points from the older entries in proportion (x 0.84, rounded to whole numbers).
 */
export const SHOP_WEIGHTS: ReadonlyArray<readonly [UnitId | 'frag', number]> = [
  ['棍', 11], ['箭', 12], ['火', 9], ['冰', 8], ['雷', 8], ['毒', 6], ['网', 4],
  ['速', 7], ['钱', 6], ['疗', 5], ['鼓', 3], ['镜', 3], ['frag', 15], ['神', 3],
];
/** 神 only shows up in the shop from this wave on (0 = before wave 1). */
export const DIVINE_FROM_WAVE = 2;
/** Chance that a fragment offer is the missing partner of one already on the board. */
export const FRAG_PARTNER_CHANCE = 0.6;
/** Chance that an offer copies a level-1 unit already on the board (helps merging). */
export const OWNED_BIAS = 0.3;
