// 六耳猕猴: a rule-based opponent. It uses exactly the same actions as the player (no cheating);
// difficulty comes only from how often it thinks, how often it blunders, and its starting 功德.
import { heroFor } from '../config/combos.ts';
import { recruitCost, SELL_REFUND } from '../config/levels.ts';
import { MAX_LEVEL, UNITS } from '../config/units.ts';
import { canBeDivine, coverage, isStackable, SLOT_COUNT } from './board.ts';
import { rand } from './rng.ts';
import { tileDps, tileRange } from './stats.ts';
import type { Action, AiState, MatchState, SideId, SideState, Tile } from './types.ts';

const TICKS_PER_SEC = 60;
/** Range used to rank slots for tiles whose placement doesn't matter much. */
const DEFAULT_RANGE = 2;

/** Rough usefulness of a tile, used to pick what to empower, keep or sell. */
export function tileValue(t: Tile): number {
  const kind = UNITS[t.id].kind;
  if (kind === 'attack' || kind === 'hero') return tileDps(t) * (kind === 'hero' ? 1.3 : 1);
  if (kind === 'support') return 14 * t.level;
  if (kind === 'divine') return 60;
  return 4;
}

function slotScore(slot: number, t: Tile): number {
  const kind = UNITS[t.id].kind;
  if (kind === 'attack' || kind === 'hero') return coverage(slot, tileRange(t));
  // Reason: supports and fragments don't shoot, so they prefer the slots attackers want least.
  return -coverage(slot, DEFAULT_RANGE);
}

/** Drop direction that lands the result in the better slot for the combined tile. */
function orient(i: number, j: number, result: Tile): Action {
  return slotScore(i, result) >= slotScore(j, result) ? { t: 'drop', from: j, to: i } : { t: 'drop', from: i, to: j };
}

function heroRecipe(side: SideState): Action | null {
  const s = side.slots;
  for (let i = 0; i < SLOT_COUNT; i++) {
    const a = s[i];
    if (!a || UNITS[a.id].kind !== 'fragment') continue;
    for (let j = i + 1; j < SLOT_COUNT; j++) {
      const b = s[j];
      if (!b) continue;
      const hero = heroFor(a.id, b.id);
      if (hero) return orient(i, j, { ...a, id: hero, level: 1 });
    }
  }
  return null;
}

function applyDivine(side: SideState): Action | null {
  const s = side.slots;
  const god = s.findIndex((t) => t?.id === '神');
  if (god < 0) return null;
  let best = -1;
  for (let i = 0; i < SLOT_COUNT; i++) {
    const t = s[i];
    if (!t || !canBeDivine(t)) continue;
    if (best < 0 || tileValue(t) > tileValue(s[best] as Tile)) best = i;
  }
  return best >= 0 ? { t: 'drop', from: god, to: best } : null;
}

function bestMerge(side: SideState): Action | null {
  const s = side.slots;
  let pick: { i: number; j: number; level: number } | null = null;
  for (let i = 0; i < SLOT_COUNT; i++) {
    const a = s[i];
    if (!a || !isStackable(a.id) || a.level >= MAX_LEVEL) continue;
    for (let j = i + 1; j < SLOT_COUNT; j++) {
      const b = s[j];
      if (!b || b.id !== a.id || b.level !== a.level) continue;
      if (!pick || a.level > pick.level) pick = { i, j, level: a.level };
    }
  }
  if (!pick) return null;
  const a = s[pick.i] as Tile;
  return orient(pick.i, pick.j, { ...a, level: a.level + 1 });
}

function hasEmpty(side: SideState): boolean {
  return side.slots.includes(null);
}

function recruitIfAffordable(side: SideState): Action | null {
  return hasEmpty(side) && side.gongde >= recruitCost(side.drawCount) ? { t: 'recruit' } : null;
}

/** Board full and nothing to combine: sell the weakest cheap tile if the refund pays for the next draw. */
function sellDeadweight(side: SideState): Action | null {
  if (hasEmpty(side)) return null;
  const cost = recruitCost(side.drawCount);
  let worst = -1;
  for (let i = 0; i < SLOT_COUNT; i++) {
    const t = side.slots[i] as Tile;
    if (t.level > 1 || UNITS[t.id].kind === 'hero' || t.divine) continue;
    if (worst < 0 || tileValue(t) < tileValue(side.slots[worst] as Tile)) worst = i;
  }
  if (worst < 0) return null;
  const refund = Math.floor((side.slots[worst] as Tile).invested * SELL_REFUND);
  return side.gongde + refund >= cost ? { t: 'drop', from: worst, to: 'sell' } : null;
}

/** Moves the strongest attacker to a clearly better slot (> 20% more road coverage). */
function reposition(side: SideState): Action | null {
  const s = side.slots;
  let top = -1;
  for (let i = 0; i < SLOT_COUNT; i++) {
    const t = s[i];
    if (!t) continue;
    const kind = UNITS[t.id].kind;
    if (kind !== 'attack' && kind !== 'hero') continue;
    if (top < 0 || tileValue(t) > tileValue(s[top] as Tile)) top = i;
  }
  if (top < 0) return null;
  const t = s[top] as Tile;
  const range = tileRange(t);
  if (!Number.isFinite(range)) return null;
  const here = coverage(top, range);
  let bestSlot = -1;
  let bestCov = here * 1.2;
  for (let j = 0; j < SLOT_COUNT; j++) {
    if (j === top) continue;
    const other = s[j];
    // Only move into empty slots or swap with something weaker that isn't a pending combo.
    if (other && (tileValue(other) >= tileValue(t) || other.id === t.id || other.id === '神')) continue;
    if (other && UNITS[other.id].kind === 'fragment') continue;
    const c = coverage(j, range);
    if (c > bestCov) {
      bestCov = c;
      bestSlot = j;
    }
  }
  return bestSlot >= 0 ? { t: 'drop', from: top, to: bestSlot } : null;
}

export function chooseAction(side: SideState): Action | null {
  return (
    heroRecipe(side) ??
    applyDivine(side) ??
    bestMerge(side) ??
    recruitIfAffordable(side) ??
    sellDeadweight(side) ??
    reposition(side)
  );
}

function blunder(side: SideState, ai: AiState): Action | null {
  if (rand(ai) < 0.5) return null;
  if (rand(ai) < 0.5) return recruitIfAffordable(side);
  const i = Math.floor(rand(ai) * SLOT_COUNT);
  const j = Math.floor(rand(ai) * SLOT_COUNT);
  return i !== j && side.slots[i] ? { t: 'drop', from: i, to: j } : null;
}

/** Returns at most one action per decision; decisions happen every `think` seconds (+-20% jitter). */
export function aiThink(m: MatchState, sid: SideId, ai: AiState): Action | null {
  if (m.tick < ai.next) return null;
  ai.next = m.tick + Math.max(1, Math.round(TICKS_PER_SEC * ai.knobs.think * (0.8 + 0.4 * rand(ai))));
  const side = m.sides[sid];
  if (rand(ai) < ai.knobs.mistake) return blunder(side, ai);
  return chooseAction(side);
}
