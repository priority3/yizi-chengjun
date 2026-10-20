// The four later pads: 聚宝台 (C/c) pays for the monsters its card finishes off, a lit 烽火台 (B/b) makes every hit
// around it land harder, a pair of 双生台 (D/d) holding the same fighter makes both faster, and a 灵泉 (S/s) lets a
// card soak up a layer of damage per wave it stays through — until it is moved.
import { describe, expect, it } from 'vitest';
import { BEACON, COFFER_BOUNTY, SPRING, TWIN_HASTE, type MapDef } from '../src/config/maps.ts';
import { resolveDrop } from '../src/core/board.ts';
import { botBuildAction } from '../src/core/bot.ts';
import { DT } from '../src/core/clock.ts';
import { stepCombat } from '../src/core/combat.ts';
import { damage } from '../src/core/effects.ts';
import { act, createGame, hashState, step } from '../src/core/game.ts';
import { buildMap } from '../src/core/map.ts';
import { beaconMul, cofferBonus, slotDamage, soakSprings, twinHaste } from '../src/core/slots.ts';
import { restore, snapshot } from '../src/core/snapshot.ts';
import type { GameState } from '../src/core/types.ts';
import { battle, emptyGame, enemy, put } from './helpers.ts';

/**
 * TEST_MAP's geometry (a straight road down x = 216, dist 0 at y = 72) with the new pads: slot 0 (216, 24) an open
 * 聚宝台 on the road's axis, slot 1 (120, 120) an open 烽火台, slots 2 (312, 120) and 4 (312, 216) a pair of open
 * 双生台, slot 3 (120, 216) an open 灵泉, slots 5 (120, 312) and 6 (312, 312) plain, slots 7 and 8 locked.
 */
const NEW_PADS: MapDef = {
  theme: 'ridge',
  rows: ['....C....', '....1....', '..B.#.D..', '....#....', '..S.#.D..', '....#....', '..O.#.O..', '....#....', '..o.#.o..', '....E....'],
};
const COFFER = 0;
const BEACON_CELL = 1;
const TWIN_A = 2;
const SPRING_CELL = 3;
const TWIN_B = 4;
const PLAIN = 5;
const PLAIN2 = 6;

const padGame = (seed = 1): GameState => emptyGame(1, seed, NEW_PADS);

/** Runs combat until `done` holds (at most 10 s of battle). */
function until(g: GameState, done: () => boolean): void {
  for (let i = 0; i < 600 && !done(); i++) stepCombat(g);
}

describe('new pad letters', () => {
  it('parses C/c, B/b, D/d and S/s like O/o: the kind, and upper case = open', () => {
    const m = buildMap(NEW_PADS);
    expect(m.slotKind).toEqual(['coffer', 'beacon', 'twin', 'spring', 'twin', 'plain', 'plain', 'plain', 'plain']);
    expect(m.open).toEqual([true, true, true, true, true, true, true, false, false]);
    const all = buildMap({ theme: 'ridge', rows: ['CcBbDdSs', '1######E'] });
    expect(all.slotKind).toEqual(['coffer', 'coffer', 'beacon', 'beacon', 'twin', 'twin', 'spring', 'spring']);
    expect(all.open).toEqual([true, false, true, false, true, false, true, false]);
  });

  it('pairs twin pads in reading order and lists the beacons; an odd twin is left without a partner', () => {
    const m = buildMap(NEW_PADS);
    expect(m.twin).toEqual([-1, -1, TWIN_B, -1, TWIN_A, -1, -1, -1, -1]);
    expect(m.beacons).toEqual([BEACON_CELL]);
    const odd = buildMap({ theme: 'ridge', rows: ['DdD.B', '1###E'] });
    expect(odd.twin).toEqual([1, 0, -1, -1]);
    expect(odd.beacons).toEqual([3]);
  });
});

describe('聚宝台', () => {
  it('pays COFFER_BOUNTY on top of the bounty when the card on it finishes a monster off', () => {
    const g = battle(padGame());
    put(g, COFFER, '箭');
    const e = enemy(g, '妖', 48, 1);
    const before = g.gongde;
    until(g, () => !g.enemies.includes(e));
    expect(g.gongde - before).toBe(e.bounty + COFFER_BOUNTY.minion);
    // The extra comes as its own event, for the coin over the pad.
    const h = battle(padGame());
    put(h, COFFER, '箭');
    const f = enemy(h, '妖', 48, 1);
    let seen = false;
    until(h, () => {
      seen ||= h.events.some((ev) => ev.t === 'coffer' && ev.cell === COFFER && ev.amount === COFFER_BOUNTY.minion);
      return !h.enemies.includes(f);
    });
    expect(seen).toBe(true);
  });

  it('pays the boss rate for a boss, and nothing for a monster another pad finished off', () => {
    const g = battle(padGame());
    put(g, COFFER, '箭');
    const boss = enemy(g, '黄风怪', 48, 1);
    const before = g.gongde;
    until(g, () => !g.enemies.includes(boss));
    expect(g.gongde - before).toBe(boss.bounty + COFFER_BOUNTY.boss);
    const h = battle(padGame());
    put(h, PLAIN, '箭');
    const e = enemy(h, '妖', 260, 1);
    const start = h.gongde;
    until(h, () => !h.enemies.includes(e));
    expect(h.gongde - start).toBe(e.bounty);
  });

  it('only counts the last hit, and only while a card stands on the 聚宝台', () => {
    const g = padGame();
    put(g, COFFER, '箭');
    expect(cofferBonus(g, { def: '妖', hitBy: COFFER })).toBe(COFFER_BOUNTY.minion);
    expect(cofferBonus(g, { def: '妖', hitBy: PLAIN })).toBe(0);
    expect(cofferBonus(g, { def: '妖', hitBy: -1 })).toBe(0);
    g.slots[COFFER] = null;
    expect(cofferBonus(g, { def: '妖', hitBy: COFFER })).toBe(0);
    // Every hit marks the pad it came from.
    const e = enemy(battle(g), '妖', 48);
    damage(g, e, 5, '箭', PLAIN2);
    expect(e.hitBy).toBe(PLAIN2);
  });
});

describe('烽火台', () => {
  it('makes every hit within its reach land BEACON.amp harder, once a card stands on it', () => {
    const g = battle(padGame());
    // Slot 1 sits 96 px beside the road at y = 120: dist 48 is 96 px away, dist 300 is far out of reach.
    const near = enemy(g, '妖', 48);
    const far = enemy(g, '妖', 300);
    expect(beaconMul(g, near)).toBe(1);
    put(g, BEACON_CELL, '钱');
    expect(beaconMul(g, near)).toBeCloseTo(1 + BEACON.amp);
    expect(beaconMul(g, far)).toBe(1);
    damage(g, near, 10, '箭', -1);
    damage(g, far, 10, '箭', -1);
    expect(near.maxHp - near.hp).toBeCloseTo(10 * (1 + BEACON.amp));
    expect(far.maxHp - far.hp).toBeCloseTo(10);
  });

  it("doesn't add up under two lit beacons", () => {
    const g = battle(emptyGame(1, 1, { theme: 'ridge', rows: ['B...B', '1###E'] }));
    put(g, 0, '钱');
    put(g, 1, '疗');
    const e = enemy(g, '妖', 96);
    expect(beaconMul(g, e)).toBeCloseTo(1 + BEACON.amp);
  });
});

describe('双生台', () => {
  it('speeds both fighters up by TWIN_HASTE while the same fighter stands on each of the pair', () => {
    const g = padGame();
    put(g, TWIN_A, '箭');
    expect(twinHaste(g, TWIN_A)).toBe(0);
    put(g, TWIN_B, '箭', 2);
    expect(twinHaste(g, TWIN_A)).toBe(TWIN_HASTE);
    expect(twinHaste(g, TWIN_B)).toBe(TWIN_HASTE);
    put(g, TWIN_B, '火');
    expect(twinHaste(g, TWIN_A)).toBe(0);
    put(g, TWIN_A, '钱');
    put(g, TWIN_B, '钱');
    expect(twinHaste(g, TWIN_A)).toBe(0);
    expect(twinHaste(g, PLAIN)).toBe(0);
  });

  it('runs the cooldown that much faster in battle', () => {
    const g = battle(padGame());
    const a = put(g, TWIN_A, '箭');
    put(g, TWIN_B, '箭');
    a.cd = 1;
    stepCombat(g);
    expect(a.cd).toBeCloseTo(1 - DT * (1 + TWIN_HASTE));
  });
});

describe('灵泉', () => {
  it('adds a layer per cleared wave up to SPRING.max, each SPRING.dmg more damage for a fighter', () => {
    const g = padGame();
    const arrow = put(g, SPRING_CELL, '箭');
    const money = put(g, PLAIN, '钱');
    for (let i = 0; i < SPRING.max + 2; i++) soakSprings(g);
    expect(arrow.spring).toBe(SPRING.max);
    expect(money.spring).toBeUndefined();
    expect(slotDamage(g, arrow, SPRING_CELL)).toBeCloseTo(8 * (1 + SPRING.dmg * SPRING.max));
    g.events.length = 0;
    soakSprings(g);
    // A full spring says nothing more.
    expect(g.events).toEqual([]);
  });

  it('soaks when a wave is cleared in a real run', () => {
    const g = createGame({ seed: 3, chapter: 1, map: NEW_PADS });
    g.slots.fill(null);
    const arrow = put(g, SPRING_CELL, '悟空');
    put(g, COFFER, '悟空');
    act(g, { t: 'start' });
    for (let i = 0; i < 60 * 120 && g.phase === 'battle'; i++) step(g);
    expect(g.phase).toBe('build');
    expect(arrow.spring).toBe(1);
  });

  it('keeps the layers through an upgrade or 鎏金 in place, and clears them when the card moves', () => {
    const g = padGame();
    const arrow = put(g, SPRING_CELL, '箭');
    arrow.spring = 2;
    put(g, PLAIN, '箭');
    expect(resolveDrop(g, PLAIN, SPRING_CELL)).toBe('merge');
    expect(g.slots[SPRING_CELL]?.spring).toBe(2);
    put(g, PLAIN, '神');
    expect(resolveDrop(g, PLAIN, SPRING_CELL)).toBe('divine');
    expect(g.slots[SPRING_CELL]?.spring).toBe(2);
    expect(resolveDrop(g, SPRING_CELL, PLAIN)).toBe('move');
    expect(g.slots[PLAIN]?.spring).toBeUndefined();
    // Back on the spring it starts over; a swap clears both cards.
    expect(resolveDrop(g, PLAIN, SPRING_CELL)).toBe('move');
    soakSprings(g);
    const other = put(g, PLAIN2, '火');
    expect(resolveDrop(g, SPRING_CELL, PLAIN2)).toBe('swap');
    expect(g.slots[PLAIN2]?.spring).toBeUndefined();
    expect(other.spring).toBeUndefined();
  });

  it('a fighter dropped onto a 金 card waiting on the spring arrives without layers', () => {
    const g = padGame();
    put(g, SPRING_CELL, '神').spring = 1;
    const arrow = put(g, PLAIN, '箭');
    expect(resolveDrop(g, PLAIN, SPRING_CELL)).toBe('divine');
    expect(g.slots[SPRING_CELL]).toBe(arrow);
    expect(arrow.spring).toBeUndefined();
  });

  it('saves the layers with the run, changes its hash, and refuses a save with layers off a spring', () => {
    const g = padGame();
    const arrow = put(g, SPRING_CELL, '箭');
    const plain = hashState(g);
    soakSprings(g);
    expect(hashState(g)).not.toBe(plain);
    const snap = snapshot(g, NEW_PADS);
    expect(snap).not.toBeNull();
    const back = snap && restore(JSON.parse(JSON.stringify(snap)), NEW_PADS);
    expect(back?.slots[SPRING_CELL]?.spring).toBe(1);
    expect(arrow.spring).toBe(1);
    const bad = JSON.parse(JSON.stringify(snap));
    bad.state.slots[PLAIN] = { ...bad.state.slots[SPRING_CELL], uid: 999 };
    expect(restore(bad, NEW_PADS)).toBeNull();
  });
});

describe('the bot and the new pads', () => {
  it('lights a dark 烽火台 with the support it buys, and leaves a lit one alone', () => {
    const g = padGame();
    // Two heroes, so the board is strong enough for the bot to shop for more than fighters (and has nothing to merge).
    put(g, PLAIN, '悟空');
    put(g, PLAIN2, '八戒');
    g.gongde = 100;
    g.shop = [{ id: '钱', price: 10, sold: false }];
    const knobs = { mistake: 0, maxRefreshes: 0 };
    expect(botBuildAction(g, knobs, { rng: 1 })).toEqual({ t: 'buy', offer: 0, cell: BEACON_CELL });
    put(g, BEACON_CELL, '疗');
    const next = botBuildAction(g, knobs, { rng: 1 });
    expect(next.t === 'buy' && next.cell).not.toBe(BEACON_CELL);
  });
});
