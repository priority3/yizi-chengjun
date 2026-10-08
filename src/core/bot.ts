// A rule-based player for the balance simulation and tests (the game itself has no AI opponent).
// It only uses the same actions a human can take.
import { unlockCost } from '../config/chapters.ts';
import { heroFor } from '../config/combos.ts';
import { MAX_LEVEL, UNITS } from '../config/units.ts';
import { canBeDivine, isStackable } from './board.ts';
import { coverage } from './map.ts';
import { rand, type RngHolder } from './rng.ts';
import { currentRefreshCost, offerPrice } from './shop.ts';
import { tileDps, tileRange } from './stats.ts';
import type { Action, EncounterId, GameState, Tile, UnitId } from './types.ts';

export interface BotKnobs {
  /** Chance that a purchase goes into a random empty cell instead of the best one. */
  mistake: number;
  maxRefreshes: number;
}

export const DEFAULT_BOT: BotKnobs = { mistake: 0.1, maxRefreshes: 2 };

const asTile = (id: UnitId, level = 1, divine = false): Tile => ({ uid: 0, id, level, divine, cd: 0, invested: 0, rage: 0 });

/** Rough usefulness of a tile: damage per second for fighters, a flat value for everything else. */
export function tileValue(t: Tile): number {
  const kind = UNITS[t.id].kind;
  if (kind === 'attack' || kind === 'hero') return tileDps(t) * (kind === 'hero' ? 1.4 : 1) * (t.id === '白龙' ? 4 : 1);
  if (kind === 'support') return 12 * t.level;
  if (kind === 'divine') return 60;
  return 4;
}

/** How well a cell suits a tile: lane coverage for fighters, out-of-the-way cells for the rest. */
function cellScore(g: GameState, cell: number, t: Tile): number {
  const kind = UNITS[t.id].kind;
  if (kind === 'attack' || kind === 'hero') return coverage(g.map, cell, tileRange(t, g.mods));
  if (t.id === '速') {
    // 速 wants fighters within its reach.
    let n = 0;
    for (const j of g.map.adj[cell]) {
      const o = g.slots[j];
      if (!o) continue;
      const k = UNITS[o.id].kind;
      if (k === 'attack' || k === 'hero') n++;
    }
    return n;
  }
  return -coverage(g.map, cell, 160);
}

function emptyCells(g: GameState): number[] {
  const out: number[] = [];
  for (let i = 0; i < g.slots.length; i++) if (g.unlocked[i] && !g.slots[i]) out.push(i);
  return out;
}

function bestEmptyCell(g: GameState, t: Tile): number {
  let best = -1;
  let score = -Infinity;
  for (const c of emptyCells(g)) {
    const s = cellScore(g, c, t);
    if (s > score) {
      score = s;
      best = c;
    }
  }
  return best;
}

/** Merges, awakenings and 神 that are already possible on the board. */
function boardCombo(g: GameState): Action | null {
  const s = g.slots;
  for (let i = 0; i < s.length; i++) {
    const a = s[i];
    if (!a) continue;
    for (let j = i + 1; j < s.length; j++) {
      const b = s[j];
      if (!b) continue;
      const hero = heroFor(a.id, b.id);
      const merge = a.id === b.id && a.level === b.level && isStackable(a.id) && a.level < MAX_LEVEL;
      if (hero || merge) {
        const result = hero ? asTile(hero) : { ...a, level: a.level + 1 };
        return cellScore(g, i, result) >= cellScore(g, j, result) ? { t: 'drop', from: j, to: i } : { t: 'drop', from: i, to: j };
      }
    }
  }
  const god = s.findIndex((t) => t?.id === '神');
  if (god >= 0) {
    let best = -1;
    for (let i = 0; i < s.length; i++) {
      const t = s[i];
      if (t && canBeDivine(t) && (best < 0 || tileValue(t) > tileValue(s[best] as Tile))) best = i;
    }
    if (best >= 0) return { t: 'drop', from: god, to: best };
  }
  return null;
}

export function boardDps(g: GameState): number {
  return g.slots.reduce((s, t) => s + (t ? tileDps(t) : 0), 0);
}

/** Rough damage-per-second the next wave calls for; below it the bot only buys fighters. */
function dpsNeeded(g: GameState): number {
  return 25 + 30 * g.wave;
}

/** Best affordable shop card and where to put it, or null. */
function bestPurchase(g: GameState): Action | null {
  let pick: { offer: number; cell: number; score: number } | null = null;
  const empties = emptyCells(g).length;
  const weak = boardDps(g) < dpsNeeded(g);
  g.shop.forEach((o, i) => {
    if (o.sold || offerPrice(g, o) > g.gongde) return;
    const card = asTile(o.id);
    let cell = -1;
    let score = 0;
    for (let c = 0; c < g.slots.length; c++) {
      const t = g.slots[c];
      if (!t) continue;
      if (t.id === o.id && t.level === 1 && isStackable(o.id)) {
        cell = c;
        score = 100 + tileValue(card);
      } else if (heroFor(o.id, t.id)) {
        cell = c;
        score = 130;
      } else if (o.id === '神' && canBeDivine(t) && tileValue(t) > 20) {
        cell = c;
        score = 110;
      }
      if (cell >= 0) break;
    }
    if (cell < 0 && empties > 0 && o.id !== '神') {
      const kind = UNITS[o.id].kind;
      // While the camp is under-gunned, fighters come first.
      if (weak && kind !== 'attack') return;
      // Lone fragments wait for their partner; only worth a cell when there is room to spare.
      if (kind === 'fragment' && empties < 3) return;
      cell = bestEmptyCell(g, card);
      score = kind === 'fragment' ? 8 : (tileValue(card) / offerPrice(g, o)) * 10;
    }
    if (cell >= 0 && (!pick || score > pick.score)) pick = { offer: i, cell, score };
  });
  const p = pick as { offer: number; cell: number; score: number } | null;
  return p ? { t: 'buy', offer: p.offer, cell: p.cell } : null;
}

/** The locked slot that sees the most road, or -1 when everything is open. */
function bestLockedSlot(g: GameState): number {
  let best = -1;
  let bestCov = -1;
  g.unlocked.forEach((open, i) => {
    if (open) return;
    const c = coverage(g.map, i, 180);
    if (c > bestCov) {
      bestCov = c;
      best = i;
    }
  });
  return best;
}

/** Encounter cards the bot likes, best first: free value, then trades, then the mildest challenges. */
const ENCOUNTER_PRIORITY: EncounterId[] = [
  '天降神字', '财神到', '观音赐福', '土地公摆摊', '宝箱', '妖风大作', '盗宝妖', '狼群来袭', '月圆之夜', '妖王亲临',
];

/** Index of the pending encounter card the bot picks. */
export function botChoice(g: GameState): number {
  let best = 0;
  let bestRank = Infinity;
  (g.encounter ?? []).forEach((id, i) => {
    // A full camp makes 观音赐福 worthless; push it behind the trades.
    const rank = id === '观音赐福' && g.campHp >= g.campMax ? 5.5 : ENCOUNTER_PRIORITY.indexOf(id);
    if (rank < bestRank) {
      bestRank = rank;
      best = i;
    }
  });
  return best;
}

/** One build-phase decision; returns { t: 'start' } when the bot is done shopping. */
export function botBuildAction(g: GameState, knobs: BotKnobs, luck: RngHolder): Action {
  if (g.encounter) return { t: 'choose', option: botChoice(g) };
  const combo = boardCombo(g);
  if (combo) return combo;
  const purchase = bestPurchase(g);
  if (purchase?.t === 'buy') {
    const empties = emptyCells(g);
    // A blunder = a careless placement, never skipping the shop entirely.
    if (!g.slots[purchase.cell] && empties.length > 1 && rand(luck) < knobs.mistake) {
      return { ...purchase, cell: empties[Math.floor(rand(luck) * empties.length)] };
    }
    return purchase;
  }
  const locked = bestLockedSlot(g);
  if (emptyCells(g).length === 0 && locked >= 0 && g.gongde >= unlockCost(g.unlockCount)) {
    return { t: 'unlock', cell: locked };
  }
  const reserve = boardDps(g) < dpsNeeded(g) ? 0 : 10;
  if (!purchase && g.refreshes < knobs.maxRefreshes && g.gongde >= currentRefreshCost(g) + reserve && emptyCells(g).length > 0) {
    return { t: 'refresh' };
  }
  return { t: 'start' };
}
