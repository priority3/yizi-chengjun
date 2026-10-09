// A rule-based player for the balance simulation and tests (the game itself has no AI opponent).
// It only uses the same actions a human can take, never puts a fighter in a 泥沼 and never switches 瞄准.
// In endless and daily runs it also plays a long game (see longGame); chapter runs never see that.
import { unlockCost } from '../config/chapters.ts';
import { heroFor } from '../config/combos.ts';
import { SLOT_BONUS } from '../config/maps.ts';
import { MAX_LEVEL, UNITS } from '../config/units.ts';
import { canBeDivine, canPlace, isStackable } from './board.ts';
import { drumValue, NET_VALUE, placedValue, poisonValue, SUPPORT_VALUE, wantsNet } from './bot-cards.ts';
import { drumMul } from './buffs.ts';
import { coverage } from './map.ts';
import { isOpenEnded } from './modes.ts';
import { rand, type RngHolder } from './rng.ts';
import { currentRefreshCost, offerPrice } from './shop.ts';
import { padRange, slotKindOf } from './slots.ts';
import { tileDps } from './stats.ts';
import type { Action, EncounterId, GameState, Tile, UnitId } from './types.ts';
import { hasAirRaids } from './waves.ts';

export interface BotKnobs {
  /** Chance that a purchase goes into a random empty cell instead of the best one. */
  mistake: number;
  maxRefreshes: number;
}

export const DEFAULT_BOT: BotKnobs = { mistake: 0.1, maxRefreshes: 2 };

const asTile = (id: UnitId, level = 1, divine = false): Tile => ({ uid: 0, id, level, divine, cd: 0, invested: 0, rage: 0 });

/** How much more the bot values an anti-air unit (箭, 雷) once air raids can come. */
const AIR_VALUE = 1.2;

/** Whether `id` counts as anti-air for the bot in `chapter`: its airMul only pays off in chapters with air raids. */
function antiAir(id: UnitId, chapter: number): boolean {
  return hasAirRaids(chapter) && (UNITS[id].airMul ?? 1) > 1;
}

/**
 * Rough usefulness of a tile in `chapter`: damage per second for fighters (a 毒's poison included), a flat value for a
 * 网 and everything else. Buying a 鼓 or 镜 is rated on the board instead (placedValue in bot-cards.ts).
 */
export function tileValue(t: Tile, chapter: number): number {
  const kind = UNITS[t.id].kind;
  if (UNITS[t.id].fx.t === 'root') return NET_VALUE * t.level;
  if (kind === 'attack' || kind === 'hero') {
    const dps = tileDps(t) + poisonValue(t);
    return dps * (kind === 'hero' ? 1.4 : 1) * (t.id === '白龙' ? 4 : 1) * (antiAir(t.id, chapter) ? AIR_VALUE : 1);
  }
  if (kind === 'support') return SUPPORT_VALUE * t.level;
  if (kind === 'divine') return 60;
  return 4;
}

/**
 * How well a cell suits a tile: lane coverage for fighters (a 高台 reaches further, a 法阵 hits harder),
 * out-of-the-way cells for the rest. Callers check canPlace first.
 */
function cellScore(g: GameState, cell: number, t: Tile): number {
  const kind = UNITS[t.id].kind;
  if (kind === 'attack' || kind === 'hero') {
    const pad = slotKindOf(g, cell);
    // A 鼓 beside the cell counts like a 法阵 (drumMul is 1 without one, so boards without drums score as before).
    return coverage(g.map, cell, padRange(t, pad, g.mods), antiAir(t.id, g.chapter)) * SLOT_BONUS[pad].dmgMul * drumMul(g, cell);
  }
  // 鼓 wants the strongest fighters within its reach.
  if (t.id === '鼓') return drumValue(g, cell, t.level);
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

/** The empty cells a tile of `id` may stand on. */
function emptyCellsFor(g: GameState, id: UnitId): number[] {
  return emptyCells(g).filter((c) => canPlace(g, c, id));
}

function bestEmptyCell(g: GameState, t: Tile): number {
  let best = -1;
  let score = -Infinity;
  for (const c of emptyCellsFor(g, t.id)) {
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
        // The result lands on the cell dropped onto, which must hold it (a hero can't be born in a 泥沼).
        const si = canPlace(g, i, result.id) ? cellScore(g, i, result) : -Infinity;
        const sj = canPlace(g, j, result.id) ? cellScore(g, j, result) : -Infinity;
        if (si > -Infinity || sj > -Infinity) return si >= sj ? { t: 'drop', from: j, to: i } : { t: 'drop', from: i, to: j };
        // Both halves wait in a 泥沼: walk one out to a pad where the hero can stand, then awaken next time.
        const out = bestEmptyCell(g, result);
        if (out >= 0) return { t: 'drop', from: i, to: out };
      }
    }
  }
  const god = s.findIndex((t) => t?.id === '神');
  if (god >= 0) {
    let best = -1;
    for (let i = 0; i < s.length; i++) {
      const t = s[i];
      if (t && canBeDivine(t) && (best < 0 || tileValue(t, g.chapter) > tileValue(s[best] as Tile, g.chapter))) best = i;
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
    // A 网 only for the boss and elite waves, and never a second one (nor a merge): see wantsNet.
    if (UNITS[o.id].fx.t === 'root' && !wantsNet(g, o.id)) return;
    const card = asTile(o.id);
    let cell = -1;
    let score = 0;
    for (let c = 0; c < g.slots.length; c++) {
      const t = g.slots[c];
      if (!t) continue;
      const hero = heroFor(o.id, t.id);
      if (t.id === o.id && t.level === 1 && isStackable(o.id)) {
        cell = c;
        score = 100 + tileValue(card, g.chapter);
      } else if (hero) {
        // Bought onto its other half, the hero awakens right there: never in a 泥沼.
        if (canPlace(g, c, hero)) {
          cell = c;
          score = 130;
        }
      } else if (o.id === '神' && canBeDivine(t) && tileValue(t, g.chapter) > 20) {
        cell = c;
        score = 110;
      }
      if (cell >= 0) break;
    }
    if (cell < 0 && empties > 0 && o.id !== '神') {
      const kind = UNITS[o.id].kind;
      // While the camp is under-gunned, fighters come first — and a 网, which barely hurts, doesn't count as one.
      if (weak && (kind !== 'attack' || UNITS[o.id].fx.t === 'root')) return;
      // Lone fragments wait for their partner; only worth a cell when there is room to spare.
      if (kind === 'fragment' && empties < 3) return;
      cell = bestEmptyCell(g, card);
      const value = cell < 0 ? 0 : (placedValue(g, card, cell) ?? tileValue(card, g.chapter));
      score = kind === 'fragment' ? 8 : (value / offerPrice(g, o)) * 10;
      // A 鼓 with no fighter beside it would add nothing: leave it in the shop.
      if (score <= 0) return;
    }
    if (cell >= 0 && (!pick || score > pick.score)) pick = { offer: i, cell, score };
  });
  const p = pick as { offer: number; cell: number; score: number } | null;
  return p ? { t: 'buy', offer: p.offer, cell: p.cell } : null;
}

/**
 * The locked slot that sees the most road, or -1 when everything is open. A special pad is rated for a fighter
 * on it (a 法阵 hits harder, a 高台 reaches further); a 泥沼, which can't hold one, comes after all the others.
 */
function bestLockedSlot(g: GameState): number {
  let best = -1;
  let bestCov = -Infinity;
  g.unlocked.forEach((open, i) => {
    if (open) return;
    const pad = SLOT_BONUS[slotKindOf(g, i)];
    const c = pad.fighters ? coverage(g.map, i, 180 + pad.range) * pad.dmgMul : coverage(g.map, i, 180) - 1;
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

/**
 * The long game of endless and daily runs: from this much 功德 on, a bot whose board is full keeps one cell for
 * building merges — it sells its weakest tile to free one, then refreshes (up to `refreshes` times per build phase)
 * for copies of the level-1 card it bought there.
 * Reason: otherwise a full board never changes again and 功德 piles up unspent (2000+ by wave 10), so the bot
 * stalled a couple of waves after its board filled, whatever the endless numbers were — a measure of the bot's
 * shopping rules rather than of the mode.
 */
const LONG_GAME = { gongde: 100, refreshes: 10 } as const;

/** Whether the bot plays the long game: an endless or daily run, with 功德 to spare. */
function longGame(g: GameState): boolean {
  return isOpenEnded(g.mode) && g.gongde >= LONG_GAME.gongde;
}

/**
 * Long game only, once no cell is left for a fighter and no level-1 fighter is waiting for a copy to merge with:
 * the cell of the weakest tile, to sell for room (-1 when there is nothing to do). Heroes and 神 tiles are never sold.
 */
function cellToFree(g: GameState): number {
  if (!longGame(g) || emptyCellsFor(g, '箭').length > 0) return -1;
  // Reason: a 网 never waits for a copy (the bot keeps one, unmerged: see wantsNet), so it must not hold up selling.
  if (g.slots.some((t) => t !== null && t.level === 1 && UNITS[t.id].kind === 'attack' && UNITS[t.id].fx.t !== 'root')) return -1;
  let cell = -1;
  let low = Infinity;
  g.slots.forEach((t, i) => {
    // A 泥沼 could not take the fighter that comes next anyway.
    if (!t || t.divine || t.id === '神' || UNITS[t.id].kind === 'hero' || !canPlace(g, i, '箭')) return;
    const v = tileValue(t, g.chapter);
    if (v < low) {
      low = v;
      cell = i;
    }
  });
  return cell;
}

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
    // Reason: only cells the card may stand on; on a map without 泥沼 that is every empty cell, as it always was.
    const empties = emptyCellsFor(g, g.shop[purchase.offer].id);
    // A blunder = a careless placement, never skipping the shop entirely.
    if (!g.slots[purchase.cell] && empties.length > 1 && rand(luck) < knobs.mistake) {
      return { ...purchase, cell: empties[Math.floor(rand(luck) * empties.length)] };
    }
    return purchase;
  }
  // Reason: an empty 泥沼 is no room for the fighters the bot mostly buys; a locked 泥沼 waits for a full camp.
  // Without 泥沼 on the map this is the old rule: unlock once every cell is taken.
  const empty = emptyCells(g);
  const locked = bestLockedSlot(g);
  const wanted = locked >= 0 && (SLOT_BONUS[slotKindOf(g, locked)].fighters ? emptyCellsFor(g, '箭').length === 0 : empty.length === 0);
  if (wanted && g.gongde >= unlockCost(g.unlockCount)) {
    return { t: 'unlock', cell: locked };
  }
  const free = cellToFree(g);
  if (free >= 0) return { t: 'drop', from: free, to: 'sell' };
  const reserve = boardDps(g) < dpsNeeded(g) ? 0 : 10;
  // Reason: in a chapter run (never the long game) these are exactly the old limits: knobs.maxRefreshes, and an empty cell.
  const long = longGame(g);
  const maxRefreshes = long ? LONG_GAME.refreshes : knobs.maxRefreshes;
  if (!purchase && g.refreshes < maxRefreshes && g.gongde >= currentRefreshCost(g) + reserve && (long || emptyCells(g).length > 0)) {
    return { t: 'refresh' };
  }
  return { t: 'start' };
}
