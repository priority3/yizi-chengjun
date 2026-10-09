// Chapter list and run-wide rules (economy, camp, shop prices). Each chapter is a fresh run.

export interface ChapterDef {
  id: number;
  name: string;
  boss: string;
  waves: number;
  /** Enemy HP multiplier on wave 1. */
  hpStart: number;
  /** Enemy HP growth per wave. Reason: later chapters ramp faster rather than starting brutal,
   * because every chapter restarts from the same small economy. */
  hpGrowth: number;
}

export const CHAPTERS: readonly ChapterDef[] = [
  { id: 1, name: '白虎岭', boss: '白骨精', waves: 5, hpStart: 1.05, hpGrowth: 1.19 },
  { id: 2, name: '黄风岭', boss: '黄风怪', waves: 5, hpStart: 1.2, hpGrowth: 1.245 },
  { id: 3, name: '平顶山', boss: '金角大王', waves: 6, hpStart: 1.35, hpGrowth: 1.28 },
  { id: 4, name: '火云洞', boss: '红孩儿', waves: 6, hpStart: 1.3, hpGrowth: 1.355 },
  { id: 5, name: '黑风山', boss: '黑熊精', waves: 6, hpStart: 1.3, hpGrowth: 1.41 },
  { id: 6, name: '通天河', boss: '灵感大王', waves: 7, hpStart: 1.65, hpGrowth: 1.385 },
  { id: 7, name: '盘丝洞', boss: '蜘蛛精', waves: 7, hpStart: 1.85, hpGrowth: 1.41 },
  { id: 8, name: '火焰山', boss: '牛魔王', waves: 7, hpStart: 1.6, hpGrowth: 1.49 },
  { id: 9, name: '狮驼岭', boss: '金翅大鹏', waves: 8, hpStart: 2.15, hpGrowth: 1.475 },
  { id: 10, name: '小雷音寺', boss: '黄眉大王', waves: 8, hpStart: 1.8, hpGrowth: 1.547 },
];

export const START_GONGDE = 70;
/**
 * Extra starting 功德 for each chapter after the first.
 * Reason: later chapters open against much tougher first waves; without more to spend before wave 1 the camp
 * used to lose most of its HP right away (`pnpm sim --leaks`).
 */
export const START_GROWTH = 6;

/** 功德 a fresh run of `chapter` starts with (before 法宝). */
export function startGongde(chapter: number): number {
  return START_GONGDE + START_GROWTH * (chapter - 1);
}
export const CAMP_HP = 120;
/** Camp damage per leaked monster = its atk x this. */
export const LEAK_MUL = 3;
export const SHOP_SIZE = 3;
/** Attack cards guaranteed in the very first shop, and in every later one. */
export const FIRST_SHOP_ATTACKERS = 2;
export const SHOP_ATTACKERS = 1;
/** A free 箭 already stands on this cell when a chapter starts (row 2, col 1). */
export const SELL_REFUND = 0.5;
/** Seconds between spawns inside a wave (shrinks a little each wave). */
export const SPAWN_GAP = 1.0;
export const MIN_SPAWN_GAP = 0.45;

/** 功德 paid out when wave `w` of `chapter` is cleared. */
export function waveBonus(w: number, chapter = 1): number {
  return Math.round((14 + 4 * w) * incomeMul(chapter));
}

/**
 * Income multiplier for a chapter.
 * Reason: every chapter restarts from the same small economy while enemy HP keeps climbing,
 * so kills and wave bonuses have to pay more later or the camp can never catch up.
 */
export function incomeMul(chapter: number): number {
  return 1 + INCOME_GROWTH * (chapter - 1);
}

/** Extra 功德 per chapter, on top of chapter 1's baseline. */
export const INCOME_GROWTH = 0.05;

/** Price of the next shop refresh in the current build phase. */
export function refreshCost(refreshesUsed: number): number {
  return 4 + 2 * refreshesUsed;
}

/** Price of unlocking one more cell, given how many were already bought. */
export function unlockCost(unlockCount: number): number {
  return 30 + 15 * unlockCount;
}
