// B5 support cards and the cards in the run: 鼓 buffs the pads within reach (capped, alongside 速), 镜 reflects what
// the camp lost every 6 s, the shop sells all four, snapshots keep a 镜's charge, and runs with them replay exactly.
import { describe, expect, it } from 'vitest';
import { CHAPTERS, LEAK_MUL } from '../src/config/chapters.ts';
import { ENEMIES } from '../src/config/enemies.ts';
import type { MapDef } from '../src/config/maps.ts';
import { ULTIMATES } from '../src/config/ultimates.ts';
import { DRUM_DMG_CAP, HASTE_CAP, MIRROR_EVERY, MIRROR_TOP_WAVE, SHOP_WEIGHTS, UNITS } from '../src/config/units.ts';
import { botBuildAction, tileValue } from '../src/core/bot.ts';
import { NET_VALUE, POISON_SHARE } from '../src/core/bot-cards.ts';
import { computeBuffs, drumMul } from '../src/core/buffs.ts';
import { TICKS_PER_SEC } from '../src/core/clock.ts';
import { computeHaste, stepCombat } from '../src/core/combat.ts';
import { createGame, hashState } from '../src/core/game.ts';
import { minionHp, mirrorRate } from '../src/core/mirror.ts';
import { moveEnemies } from '../src/core/monsters.ts';
import { playChapter, runChapter } from '../src/core/sim.ts';
import { slotDamage } from '../src/core/slots.ts';
import { restock, rollOffer } from '../src/core/shop.ts';
import { restore, snapshot, type RunSnapshot } from '../src/core/snapshot.ts';
import { poisonPerHit, tileDps, tileInterval } from '../src/core/stats.ts';
import type { GameState, Tile, UnitId } from '../src/core/types.ts';
import { battle, emptyGame, enemy, put, TEST_MAP } from './helpers.ts';

// Test map (helpers.ts): slots 1/3/5 run down x = 120 and 2/4/6 down x = 312, 96 px apart, so each is within reach
// (SUPPORT_RANGE) of the one above and below it only; slot 0 sits alone at the top of the road.

const MIRROR = UNITS['镜'].fx.t === 'mirror' ? UNITS['镜'].fx : { k: 0, cap: 0 };
const NEW_CARDS: readonly UnitId[] = ['毒', '网', '鼓', '镜'];
const viaJson = (s: RunSnapshot | null): RunSnapshot => JSON.parse(JSON.stringify(s)) as RunSnapshot;
const tile = (id: UnitId, level = 1): Tile => ({ uid: 0, id, level, divine: false, cd: 0, invested: 0, rage: 0 });

describe('鼓 drums', () => {
  it('make the fighters within reach hit 15 % harder and attack 10 % faster per level, and nobody else', () => {
    const g = emptyGame();
    const arrow = put(g, 3, '箭');
    const far = put(g, 2, '箭');
    put(g, 1, '鼓');
    const b = computeBuffs(g);
    expect(b.dmg[3]).toBeCloseTo(1.15);
    expect(b.haste[3]).toBeCloseTo(0.1);
    expect([b.dmg[2], b.haste[2]]).toEqual([1, 0]);
    expect(slotDamage(g, arrow, 3)).toBeCloseTo(8 * 1.15);
    expect(slotDamage(g, far, 2)).toBe(8);
    // computeHaste (combat's attack clock) counts the drum's beat too.
    expect(computeHaste(g)[3]).toBeCloseTo(0.1);
    put(g, 1, '鼓', 2);
    expect(drumMul(g, 3)).toBeCloseTo(1.3);
  });

  it('cap the damage bonus at +45 %, and count their speed with 速 under HASTE_CAP', () => {
    const g = emptyGame();
    put(g, 3, '箭');
    put(g, 1, '鼓', 2);
    put(g, 5, '鼓', 2);
    expect(drumMul(g, 3)).toBeCloseTo(1 + DRUM_DMG_CAP);
    expect(computeBuffs(g).haste[3]).toBeCloseTo(0.4);
    put(g, 1, '速', 5);
    put(g, 5, '鼓', 5);
    expect(computeBuffs(g).haste[3]).toBeCloseTo(HASTE_CAP);
    put(g, 1, '速', 5, true);
    expect(computeBuffs(g).haste[3]).toBe(HASTE_CAP);
    expect(drumMul(g, 3)).toBeCloseTo(1 + DRUM_DMG_CAP);
  });

  it('beat into the shots, the ultimates, and on top of a 法阵', () => {
    const g = battle(emptyGame());
    put(g, 3, '箭');
    put(g, 1, '鼓');
    const imp = enemy(g, '妖', 144, 1000);
    for (let i = 0; i < 20; i++) stepCombat(g);
    expect(imp.maxHp - imp.hp).toBeCloseTo(8 * 1.15);
    const h = battle(emptyGame());
    const pig = put(h, 3, '八戒');
    pig.rage = 1;
    put(h, 1, '鼓');
    const target = enemy(h, '妖', 144, 1e6);
    stepCombat(h);
    expect(target.maxHp - target.hp).toBeCloseTo(UNITS['八戒'].dmg * 1.15 * ULTIMATES['八戒'].dmgMul);
    // A 法阵 with a 鼓 beside it: the two bonuses multiply.
    const ALTAR: MapDef = { theme: 'ridge', rows: ['AO..', '1##E'] };
    const k = createGame({ seed: 1, chapter: 1, map: ALTAR });
    k.slots.fill(null);
    const arrow = put(k, 0, '箭');
    put(k, 1, '鼓');
    expect(slotDamage(k, arrow, 0)).toBeCloseTo(8 * 1.2 * 1.15);
  });
});

describe('镜 mirrors', () => {
  /** A battle with a fresh 镜 on slot 5 (waiting a whole pulse, like a bought one) and a 小妖 about to reach the camp. */
  function leaking(level = 1) {
    const g = battle(emptyGame());
    const mirror = put(g, 5, '镜', level);
    mirror.cd = MIRROR_EVERY;
    const arrow = put(g, 1, '箭');
    const leaker = enemy(g, '妖', g.map.paths[0].length - 0.5, 1e6);
    moveEnemies(g);
    expect(leaker.gone).toBe(true);
    return { g, mirror, arrow };
  }

  it('catch what every leak costs the camp, up to what a mirror holds; other tiles catch nothing', () => {
    const { g, mirror, arrow } = leaking();
    const bite = ENEMIES['妖'].atk * LEAK_MUL;
    expect(g.campHp).toBe(g.campMax - bite);
    expect(mirror.charge).toBe(bite);
    expect(arrow.charge).toBeUndefined();
    for (let i = 0; i < 5; i++) {
      enemy(g, '熊', g.map.paths[0].length - 0.5, 1e6);
      moveEnemies(g);
    }
    expect(mirror.charge).toBe(MIRROR.cap);
  });

  it('reflect it every 6 s at every monster, flyers too: charge x k x level x a 小妖 of this wave', () => {
    const { g, mirror } = leaking(2);
    // Nobody else shoots: every scratch on the crowd is the mirror's.
    g.slots[1] = null;
    const crowd = [enemy(g, '妖', 10, 1e6), enemy(g, '熊', 60, 1e6), enemy(g, '蝠', 30, 1e6)];
    const hit = 9 * MIRROR.k * 2 * minionHp(g);
    expect(mirrorRate(g, mirror) * 9).toBeCloseTo(hit);
    expect(minionHp(g)).toBeCloseTo(Math.round(24 * 2.5 * 1.05) * g.map.hpScale, 0);
    let pulses = 0;
    for (let i = 0; i < 5.9 * TICKS_PER_SEC; i++) {
      stepCombat(g);
      pulses += g.events.filter((e) => e.t === 'mirror').length;
      g.events.length = 0;
    }
    expect(pulses).toBe(0);
    for (const e of crowd) expect(e.hp).toBe(e.maxHp);
    for (let i = 0; i < 0.2 * TICKS_PER_SEC; i++) stepCombat(g);
    const ev = g.events.filter((e) => e.t === 'mirror');
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ cell: 5, x: g.map.camp.x, y: g.map.camp.y });
    expect(ev[0].t === 'mirror' && ev[0].targets.map((t) => t.uid)).toEqual(crowd.map((e) => e.uid));
    for (const e of crowd) expect(e.maxHp - e.hp).toBeCloseTo(hit);
    expect(mirror.charge).toBe(0);
  });

  it('stop growing with the waves after MIRROR_TOP_WAVE, which only endless and daily runs reach', () => {
    expect(Math.max(...CHAPTERS.map((c) => c.waves))).toBeLessThan(MIRROR_TOP_WAVE);
    const g = battle(createGame({ seed: 1, chapter: 10, mode: 'endless', map: TEST_MAP }));
    g.wave = MIRROR_TOP_WAVE - 1;
    const below = minionHp(g);
    g.wave = MIRROR_TOP_WAVE;
    const top = minionHp(g);
    expect(top).toBeGreaterThan(below);
    g.wave = MIRROR_TOP_WAVE + 6;
    expect(minionHp(g)).toBe(top);
    // Between waves, the description quotes the wave coming next.
    g.phase = 'build';
    g.wave = MIRROR_TOP_WAVE - 1;
    expect(minionHp(g)).toBe(top);
  });

  it('keep the charge while nobody is on the field, and the clock running', () => {
    const { g, mirror } = leaking();
    for (let i = 0; i < 6.1 * TICKS_PER_SEC; i++) stepCombat(g);
    expect(mirror.charge).toBe(9);
    expect(mirror.cd).toBeGreaterThan(MIRROR_EVERY - 0.2);
    const imp = enemy(g, '妖', 10, 5);
    for (let i = 0; i < 6.1 * TICKS_PER_SEC; i++) stepCombat(g);
    // The reflection that killed it pays like any kill.
    expect(g.enemies).not.toContain(imp);
    expect(g.kills).toBe(1);
  });
});

describe('the shop', () => {
  it('keeps the weights at 100 and sells all four new cards', () => {
    expect(SHOP_WEIGHTS.reduce((s, [, w]) => s + w, 0)).toBe(100);
    const seen = new Set<UnitId>();
    for (let seed = 1; seed <= 300 && seen.size < NEW_CARDS.length; seed++) {
      const g = createGame({ seed, chapter: 3 });
      g.wave = 3;
      for (let i = 0; i < 10; i++) {
        const id = rollOffer(g);
        if (NEW_CARDS.includes(id)) seen.add(id);
      }
    }
    expect([...seen].sort()).toEqual([...NEW_CARDS].sort());
    for (const id of NEW_CARDS) expect(UNITS[id].price).toBeGreaterThanOrEqual(10);
  });

  it('never counts a 网 as the attack card a fresh shop must hold', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const g = createGame({ seed, chapter: 1 });
      expect(g.shop.filter((o) => UNITS[o.id].kind === 'attack' && o.id !== '网').length, `seed ${seed}`).toBeGreaterThanOrEqual(2);
      restock(g);
      expect(g.shop.some((o) => UNITS[o.id].kind === 'attack' && o.id !== '网')).toBe(true);
    }
  });
});

describe('runs with the new cards', () => {
  it('keep a 镜 charge and the new tiles through a snapshot, and refuse a broken charge', () => {
    const g = emptyGame();
    for (const [cell, id] of [[1, '毒'], [2, '网'], [3, '鼓'], [4, '镜']] as const) put(g, cell, id);
    (g.slots[4] as Tile).charge = 21;
    const r = restore(viaJson(snapshot(g, TEST_MAP)), TEST_MAP);
    expect(r?.slots.map((t) => t?.id ?? null)).toEqual(g.slots.map((t) => t?.id ?? null));
    expect(r?.slots[4]?.charge).toBe(21);
    expect(r && hashState(r)).toBe(hashState(g));
    for (const bad of [-1, Number.NaN, '9']) {
      const s = viaJson(snapshot(g, TEST_MAP));
      (s.state.slots[4] as unknown as Record<string, unknown>).charge = bad;
      expect(restore(JSON.parse(JSON.stringify(s)) as RunSnapshot, TEST_MAP), String(bad)).toBeNull();
    }
  });

  it('hash in poison, nets and a charge, but only once there is some', () => {
    const g = battle(emptyGame());
    const mirror = put(g, 5, '镜');
    const imp = enemy(g, '妖', 30, 100);
    const plain = hashState(g);
    mirror.charge = 0;
    expect(hashState(g)).toBe(plain);
    mirror.charge = 9;
    expect(hashState(g)).not.toBe(plain);
    mirror.charge = 0;
    imp.poison = { stacks: 2, t: 3, dps: 2 };
    const poisoned = hashState(g);
    expect(poisoned).not.toBe(plain);
    imp.rootT = 1.5;
    expect(hashState(g)).not.toBe(poisoned);
  });

  it('replay exactly from the seed when the bot plays them', () => {
    let used = 0;
    const seed = 7919 * 3;
    playChapter(seed, 4, {}, { action: (_g, _a, _r, events) => (used += events.filter((e) => e.t === 'buy' && NEW_CARDS.includes(e.unit)).length) });
    expect(used).toBeGreaterThan(0);
    expect(runChapter(seed, 4)).toEqual(runChapter(seed, 4));
  });
});

describe('the bot and the new cards', () => {
  /** A board well above the bot's "under-gunned" line (dpsNeeded) for the first waves, with 功德 to spend. */
  const strong = (chapter = 1): GameState => {
    const g = emptyGame(chapter);
    put(g, 3, '棍', 5);
    g.gongde = 100;
    return g;
  };
  const knobs = { mistake: 0, maxRefreshes: 0 };

  it('rates 毒 by its needle plus half its poison, and 网 as a flat utility', () => {
    const t = tile('毒');
    expect(tileValue(t, 1)).toBeCloseTo(tileDps(t) + (POISON_SHARE * poisonPerHit(t)) / tileInterval(t));
    expect(tileValue(tile('网', 2), 1)).toBe(NET_VALUE * 2);
  });

  it('puts a 鼓 beside its fighters, and leaves it in the shop when no fighter would hear it', () => {
    const g = strong();
    g.shop = [{ id: '鼓', price: 12, sold: false }];
    const a = botBuildAction(g, knobs, { rng: 1 });
    expect(a).toEqual({ t: 'buy', offer: 0, cell: 1 });
    const h = emptyGame();
    put(h, 0, '棍', 5);
    h.gongde = 100;
    h.shop = [{ id: '鼓', price: 12, sold: false }];
    expect(botBuildAction(h, knobs, { rng: 1 }).t).not.toBe('buy');
  });

  it('keeps its one 网 in the endless long game, and never lets that level-1 net hold up the selling', () => {
    const g = createGame({ seed: 1, chapter: 10, mode: 'endless', map: TEST_MAP });
    g.slots.fill(null);
    // A full board, every fighter but the net past level 1: the long game frees its weakest cell.
    const board: Array<[UnitId, number]> = [['棍', 2], ['网', 1], ['箭', 2], ['火', 2], ['冰', 2], ['雷', 2], ['疗', 1], ['毒', 2], ['钱', 2]];
    board.forEach(([id, level], cell) => put(g, cell, id, level));
    g.shop = [];
    g.gongde = 500;
    // The 冰 (8.8 a second) goes, not the 网 below it (NET_VALUE 8).
    expect(tileValue(tile('冰', 2), 10)).toBeGreaterThan(tileValue(tile('网'), 10));
    expect(botBuildAction(g, knobs, { rng: 1 })).toEqual({ t: 'drop', from: 4, to: 'sell' });
  });

  it('buys one 网 for the boss and elite waves only, and never a second', () => {
    const g = strong();
    g.shop = [{ id: '网', price: 12, sold: false }];
    // Chapter 1 has 5 waves: the elite ends wave 3, the boss wave 5.
    expect(botBuildAction(g, knobs, { rng: 1 }).t).not.toBe('buy');
    g.wave = 4;
    expect(botBuildAction(g, knobs, { rng: 1 }).t).toBe('buy');
    put(g, 6, '网');
    expect(botBuildAction(g, knobs, { rng: 1 }).t).not.toBe('buy');
  });
});
