// 法宝 vault: what the player owns across runs, what is equipped, forging with 灵石 and three-into-one merging.
// Pure data + functions so the meta game is unit-testable; persistence lives in platform/web.ts.
import {
  EQUIP_SLOTS,
  FIRST_CLEAR_TREASURE,
  FORGE_COST,
  MAX_TIER,
  MERGE_COUNT,
  RARITY_WEIGHTS,
  stonesFor,
  TIER_MUL,
  TREASURE_IDS,
  TREASURES,
  type TreasureId,
} from '../config/treasures.ts';
import { pickWeighted } from './rng.ts';
import type { RunMods } from './types.ts';

export interface TreasureStack {
  id: TreasureId;
  tier: number;
  count: number;
}

export interface Vault {
  stones: number;
  treasures: TreasureStack[];
  /** Equipped treasure ids (distinct); the highest owned tier of each applies. */
  equipped: TreasureId[];
}

export function emptyVault(): Vault {
  return { stones: 0, treasures: [], equipped: [] };
}

export function defaultMods(): RunMods {
  return {
    dmgMul: 1,
    unitDmgMul: {},
    unitRangeMul: {},
    splashRadiusMul: 1,
    stunMul: 1,
    executeBonus: 0,
    rageMul: 1,
    campHpBonus: 0,
    healOnClear: 0,
    startGongde: 0,
    enemySpeedMul: 1,
  };
}

export function isTreasureId(id: string): id is TreasureId {
  return id in TREASURES;
}

/** Highest tier of a treasure the player owns, or 0. */
export function ownedTier(v: Vault, id: TreasureId): number {
  return v.treasures.reduce((best, s) => (s.id === id && s.count > 0 ? Math.max(best, s.tier) : best), 0);
}

export function effectValue(id: TreasureId, tier: number): number {
  return TREASURES[id].base * TIER_MUL[Math.min(MAX_TIER, Math.max(1, tier)) - 1];
}

export function effectText(id: TreasureId, tier: number): string {
  return TREASURES[id].text(effectValue(id, tier));
}

/** Run modifiers from the equipped treasures. */
export function buildMods(v: Vault): RunMods {
  const mods = defaultMods();
  for (const id of v.equipped) {
    const tier = ownedTier(v, id);
    if (tier > 0) TREASURES[id].apply(mods, effectValue(id, tier));
  }
  return mods;
}

export function addTreasure(v: Vault, id: TreasureId, tier = 1): void {
  const stack = v.treasures.find((s) => s.id === id && s.tier === tier);
  if (stack) stack.count++;
  else v.treasures.push({ id, tier, count: 1 });
}

/** Merges every three identical treasures into one of the next tier. Returns how many merges happened. */
export function mergeAll(v: Vault): number {
  let merges = 0;
  for (let tier = 1; tier < MAX_TIER; tier++) {
    for (const stack of [...v.treasures]) {
      if (stack.tier !== tier || stack.count < MERGE_COUNT) continue;
      const n = Math.floor(stack.count / MERGE_COUNT);
      stack.count -= n * MERGE_COUNT;
      for (let i = 0; i < n; i++) addTreasure(v, stack.id, tier + 1);
      merges += n;
    }
  }
  v.treasures = v.treasures.filter((s) => s.count > 0);
  return merges;
}

/** Picks a treasure from two uniform random numbers: rarity first, then one of that rarity. */
export function forgeRoll(r1: number, r2: number): TreasureId {
  const rarity = pickWeighted(r1, RARITY_WEIGHTS);
  const ids = TREASURE_IDS.filter((id) => TREASURES[id].rarity === rarity);
  return ids[Math.min(ids.length - 1, Math.floor(r2 * ids.length))];
}

/** Spends 灵石 to forge a random treasure; null when the player can't afford it. */
export function forge(v: Vault, r1: number, r2: number): TreasureId | null {
  if (v.stones < FORGE_COST) return null;
  v.stones -= FORGE_COST;
  const id = forgeRoll(r1, r2);
  addTreasure(v, id);
  return id;
}

/** Equips an owned treasure (if a slot is free) or unequips it. Returns whether it is equipped afterwards. */
export function toggleEquip(v: Vault, id: TreasureId): boolean {
  const i = v.equipped.indexOf(id);
  if (i >= 0) {
    v.equipped.splice(i, 1);
    return false;
  }
  if (ownedTier(v, id) === 0 || v.equipped.length >= EQUIP_SLOTS) return false;
  v.equipped.push(id);
  return true;
}

export interface ClearRewards {
  stones: number;
  treasure: TreasureId | null;
}

/** Applies the rewards for clearing a chapter and reports them. */
export function clearRewards(v: Vault, chapter: number, firstClear: boolean): ClearRewards {
  const stones = stonesFor(chapter, firstClear);
  v.stones += stones;
  const treasure = firstClear ? FIRST_CLEAR_TREASURE[chapter - 1] : null;
  if (treasure) addTreasure(v, treasure);
  return { stones, treasure };
}
