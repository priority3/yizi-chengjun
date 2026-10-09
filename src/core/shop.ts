// The between-wave shop: rolling offers, buying a card straight onto a camp cell, refreshing, and unlocking cells.
import { partnerOf } from '../config/combos.ts';
import { refreshCost, SHOP_ATTACKERS, SHOP_SIZE, unlockCost } from '../config/chapters.ts';
import { DIVINE_FROM_WAVE, FRAG_PARTNER_CHANCE, FRAGMENTS, OWNED_BIAS, SHOP_WEIGHTS, UNITS } from '../config/units.ts';
import { canPlace, combineInto, isStackable, makeTile, MIRE_MSG } from './board.ts';
import { pickWeighted, rand } from './rng.ts';
import type { ActionResult, FragId, GameState, ShopOffer, UnitId } from './types.ts';

/** Partners of fragments on the board whose other half is still missing. */
export function missingPartners(g: GameState): FragId[] {
  const present = new Set<UnitId>();
  for (const t of g.slots) if (t) present.add(t.id);
  const out: FragId[] = [];
  for (const f of FRAGMENTS) {
    if (!present.has(f)) continue;
    const p = partnerOf(f);
    if (!present.has(p) && !out.includes(p)) out.push(p);
  }
  return out;
}

/**
 * Rolls one shop card.
 * Reason: always consumes exactly four random values, so a seed replays identically whatever the board holds.
 */
export function rollOffer(g: GameState): UnitId {
  const r1 = rand(g);
  const r2 = rand(g);
  const r3 = rand(g);
  const r4 = rand(g);
  // Reason: only cards the shop really sells qualify — a hero is awakened, never bought (its price is 0, which
  // used to put a 1-功德 copy on the shelf that merged straight into the hero).
  const owned = g.slots
    .filter((t) => t !== null && t.level === 1 && isStackable(t.id) && UNITS[t.id].price > 0)
    .map((t) => t!.id);
  if (owned.length > 0 && r1 < OWNED_BIAS) return owned[Math.floor(r2 * owned.length)];
  const weights = g.wave < DIVINE_FROM_WAVE ? SHOP_WEIGHTS.filter(([k]) => k !== '神') : SHOP_WEIGHTS;
  const pick = pickWeighted(r2, weights);
  if (pick !== 'frag') return pick;
  const wanted = missingPartners(g);
  if (wanted.length > 0 && r3 < FRAG_PARTNER_CHANCE) return wanted[Math.floor(r4 * wanted.length)];
  return FRAGMENTS[Math.floor(r4 * FRAGMENTS.length)];
}

const ATTACK_WEIGHTS = SHOP_WEIGHTS.filter(
  (e): e is readonly [UnitId, number] => e[0] !== 'frag' && UNITS[e[0]].kind === 'attack',
);

/** Fills the shop with fresh offers, guaranteeing at least `minAttackers` attack cards. */
export function restock(g: GameState, minAttackers = SHOP_ATTACKERS): void {
  const ids: UnitId[] = [];
  for (let i = 0; i < SHOP_SIZE; i++) ids.push(rollOffer(g));
  // Reason: a shop with no attack card at all can leave a fresh camp defenceless.
  let have = ids.filter((id) => UNITS[id].kind === 'attack').length;
  for (let i = ids.length - 1; i >= 0 && have < minAttackers; i--) {
    if (UNITS[ids[i]].kind === 'attack') continue;
    ids[i] = pickWeighted(rand(g), ATTACK_WEIGHTS);
    have++;
  }
  g.shop = ids.map((id): ShopOffer => ({ id, price: UNITS[id].price, sold: false }));
}

/** What an offer costs right now (土地公摆摊 halves prices for one build phase). */
export function offerPrice(g: GameState, o: ShopOffer): number {
  return Math.max(1, Math.round(o.price * g.shopDiscount));
}

/** What the next refresh costs right now (0 while 土地公摆摊 is active). */
export function currentRefreshCost(g: GameState): number {
  return g.freeRefresh ? 0 : refreshCost(g.refreshes);
}

/**
 * Buys shop card `offer` and puts it on `cell` — an empty cell, or a tile it combines with. Whatever ends up on
 * the cell must be allowed on its pad (combineInto checks a combined result; a fighter never lands in a 泥沼).
 */
export function buy(g: GameState, offer: number, cell: number): ActionResult {
  const o = g.shop[offer];
  if (!o || o.sold) return 'none';
  if (!g.unlocked[cell]) return 'locked';
  const price = offerPrice(g, o);
  if (g.gongde < price) return 'poor';
  if (!g.slots[cell] && !canPlace(g, cell, o.id)) {
    g.events.push({ t: 'invalid', cell, msg: MIRE_MSG });
    return 'invalid';
  }
  const card = makeTile(g, o.id, price);
  if (g.slots[cell]) {
    const r = combineInto(g, card, cell, -1);
    if (r === null) {
      g.events.push({ t: 'invalid', cell, msg: '这格有字了：放到空格，或放到能合成的字上' });
      return 'occupied';
    }
    if (r !== 'merge' && r !== 'hero' && r !== 'divine') return r;
    g.gongde -= price;
    o.sold = true;
    return r;
  }
  g.slots[cell] = card;
  g.gongde -= price;
  o.sold = true;
  g.events.push({ t: 'buy', cell, unit: o.id });
  return 'ok';
}

export function refresh(g: GameState): ActionResult {
  const cost = currentRefreshCost(g);
  if (g.gongde < cost) return 'poor';
  g.gongde -= cost;
  g.refreshes++;
  restock(g);
  g.events.push({ t: 'refresh' });
  return 'ok';
}

export function unlock(g: GameState, cell: number): ActionResult {
  if (cell < 0 || cell >= g.unlocked.length) return 'none';
  if (g.unlocked[cell]) return 'none';
  const cost = unlockCost(g.unlockCount);
  if (g.gongde < cost) return 'poor';
  g.gongde -= cost;
  g.unlocked[cell] = true;
  g.unlockCount++;
  g.events.push({ t: 'unlock', cell });
  return 'ok';
}
