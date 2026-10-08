// Hero ultimates (大招): rage builds with every normal attack; at full rage the next attack becomes the ultimate.
import type { HeroId } from '../core/types.ts';

/** Rage gained per normal attack (10 attacks to charge). */
export const RAGE_PER_HIT = 0.1;
/** 神 heroes charge faster. */
export const RAGE_DIVINE_MUL = 1.5;

export interface UltimateDef {
  name: string;
  desc: string;
  /** Multiplier on the hero's normal damage. */
  dmgMul: number;
  knockback: number;
  /** Road distance, ahead and behind the target, that the sweep covers (悟空). */
  reach: number;
  /** Area radius around the target (八戒). */
  radius: number;
  /** Stun seconds (八戒). */
  stun: number;
  /** Number of targets (沙僧). */
  count: number;
  /** Execute threshold as a share of max HP (沙僧). */
  executePct: number;
  slowPct: number;
  slowDur: number;
}

const base: Omit<UltimateDef, 'name' | 'desc'> = {
  dmgMul: 1,
  knockback: 0,
  reach: 0,
  radius: 0,
  stun: 0,
  count: 0,
  executePct: 0,
  slowPct: 0,
  slowDur: 0,
};

export const ULTIMATES: Record<HeroId, UltimateDef> = {
  悟空: { ...base, name: '金箍棒·横扫', desc: '身前身后一大段路上的妖怪全挨一棒', dmgMul: 4, knockback: 40, reach: 160 },
  八戒: { ...base, name: '钉耙·天降', desc: '钉耙从天而降，砸晕一大片', dmgMul: 3, radius: 90, stun: 1.6, knockback: 20 },
  沙僧: { ...base, name: '宝杖·连斩', desc: '连斩五只，残血直接带走', dmgMul: 1.5, count: 5, executePct: 0.35 },
  白龙: { ...base, name: '龙吟', desc: '一声龙吟，妖怪全被推回城门', dmgMul: 2, knockback: 90, slowPct: 0.3, slowDur: 2 },
};
