// 法宝 (treasures): permanent rewards earned by clearing chapters, forged with 灵石, merged three-into-one.
// Equipped treasures become RunMods that the simulation reads at the start of a chapter.
import type { RunMods } from '../core/types.ts';

export type TreasureId =
  | '金刚琢'
  | '紫金红葫芦'
  | '人参果'
  | '缩地符'
  | '定风珠'
  | '芭蕉扇'
  | '避火罩'
  | '照妖镜'
  | '九齿钉耙'
  | '紧箍咒'
  | '降妖宝杖'
  | '定颜珠';

export type Rarity = 'common' | 'rare' | 'epic';

export interface TreasureDef {
  id: TreasureId;
  /** Two characters for the token art. */
  short: string;
  rarity: Rarity;
  /** Effect size at tier 1; tiers multiply it by TIER_MUL. */
  base: number;
  text(v: number): string;
  apply(m: RunMods, v: number): void;
}

export const MAX_TIER = 3;
/** Effect multiplier per tier (index = tier - 1). */
export const TIER_MUL: readonly number[] = [1, 1.6, 2.2];
/** Copies needed to merge into the next tier. */
export const MERGE_COUNT = 3;
export const EQUIP_SLOTS = 3;
export const FORGE_COST = 30;
export const RARITY_WEIGHTS: ReadonlyArray<readonly [Rarity, number]> = [
  ['common', 60],
  ['rare', 30],
  ['epic', 10],
];

const pct = (v: number) => `${Math.round(v * 100)}%`;
const mulUnit = (table: Partial<Record<string, number>>, key: string, v: number) => {
  table[key] = (table[key] ?? 1) * (1 + v);
};

export const TREASURES: Record<TreasureId, TreasureDef> = {
  金刚琢: { id: '金刚琢', short: '金刚', rarity: 'common', base: 30, text: (v) => `阵地血量 +${Math.round(v)}`, apply: (m, v) => void (m.campHpBonus += Math.round(v)) },
  紫金红葫芦: { id: '紫金红葫芦', short: '葫芦', rarity: 'common', base: 30, text: (v) => `开局功德 +${Math.round(v)}`, apply: (m, v) => void (m.startGongde += Math.round(v)) },
  人参果: { id: '人参果', short: '人参', rarity: 'common', base: 15, text: (v) => `每清一波阵地回 ${Math.round(v)} 血`, apply: (m, v) => void (m.healOnClear += Math.round(v)) },
  缩地符: { id: '缩地符', short: '缩地', rarity: 'common', base: 0.15, text: (v) => `箭的射程 +${pct(v)}`, apply: (m, v) => mulUnit(m.unitRangeMul, '箭', v) },
  定风珠: { id: '定风珠', short: '定风', rarity: 'common', base: 0.1, text: (v) => `妖怪移速 -${pct(v)}`, apply: (m, v) => void (m.enemySpeedMul *= 1 - v) },
  芭蕉扇: { id: '芭蕉扇', short: '蕉扇', rarity: 'rare', base: 0.3, text: (v) => `火的溅射范围 +${pct(v)}`, apply: (m, v) => void (m.splashRadiusMul *= 1 + v) },
  避火罩: { id: '避火罩', short: '避火', rarity: 'rare', base: 0.25, text: (v) => `火的伤害 +${pct(v)}`, apply: (m, v) => mulUnit(m.unitDmgMul, '火', v) },
  照妖镜: { id: '照妖镜', short: '照妖', rarity: 'rare', base: 0.1, text: (v) => `所有伤害 +${pct(v)}`, apply: (m, v) => void (m.dmgMul *= 1 + v) },
  九齿钉耙: { id: '九齿钉耙', short: '钉耙', rarity: 'rare', base: 0.4, text: (v) => `八戒眩晕时长 +${pct(v)}`, apply: (m, v) => void (m.stunMul *= 1 + v) },
  紧箍咒: { id: '紧箍咒', short: '紧箍', rarity: 'epic', base: 0.3, text: (v) => `英雄怒气积攒 +${pct(v)}`, apply: (m, v) => void (m.rageMul *= 1 + v) },
  降妖宝杖: { id: '降妖宝杖', short: '宝杖', rarity: 'epic', base: 0.08, text: (v) => `沙僧斩杀线 +${pct(v)}`, apply: (m, v) => void (m.executeBonus += v) },
  定颜珠: { id: '定颜珠', short: '定颜', rarity: 'epic', base: 0.3, text: (v) => `白龙伤害 +${pct(v)}`, apply: (m, v) => mulUnit(m.unitDmgMul, '白龙', v) },
};

export const TREASURE_IDS = Object.keys(TREASURES) as TreasureId[];

/** The treasure granted the first time each chapter is cleared (index = chapter - 1). */
export const FIRST_CLEAR_TREASURE: readonly TreasureId[] = [
  '金刚琢', '定风珠', '紫金红葫芦', '避火罩', '人参果', '缩地符', '芭蕉扇', '九齿钉耙', '照妖镜', '紧箍咒',
];

/** 灵石 awarded for clearing a chapter. */
export function stonesFor(chapter: number, firstClear: boolean): number {
  return firstClear ? 40 + 15 * chapter : 15 + 5 * chapter;
}

export const RARITY_LABEL: Record<Rarity, string> = { common: '普通', rare: '稀有', epic: '史诗' };
