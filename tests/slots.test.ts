// 特殊石台: the A/H/M pad letters, the 法阵 / 高台 bonuses wherever a tile fights or is rated, and the 泥沼 rule
// (no fighters) at every way a tile can land on a pad — shop, drag, swap, awakening, 鎏金, encounters, chest, bot.
import { describe, expect, it } from 'vitest';
import { MAPS, SLOT_BONUS, type MapDef } from '../src/config/maps.ts';
import { UNITS } from '../src/config/units.ts';
import { canPlace, MIRE_MSG, previewDrop, resolveDrop } from '../src/core/board.ts';
import { botBuildAction, DEFAULT_BOT } from '../src/core/bot.ts';
import { findTarget, stepCombat } from '../src/core/combat.ts';
import { applyEncounter, openChest } from '../src/core/encounters.ts';
import { act, createGame, step } from '../src/core/game.ts';
import { bestOpenSlot, buildMap } from '../src/core/map.ts';
import { mixSeed } from '../src/core/rng.ts';
import { playChapter } from '../src/core/sim.ts';
import { padDamage, padRange, slotDamage, slotRange } from '../src/core/slots.ts';
import { restore, snapshot } from '../src/core/snapshot.ts';
import type { ActionResult, GameState, Tile, UnitId } from '../src/core/types.ts';
import { battle, emptyGame, enemy, put } from './helpers.ts';

/**
 * TEST_MAP's geometry (a straight road down x = 216, dist 0 at y = 72) with special pads: slot 0 (216, 24) is an
 * open 法阵, slot 1 (120, 120) an open 高台, slots 2 (312, 120) and 4 (312, 216) open 泥沼, slots 3/5/6 plain,
 * slot 7 a locked 法阵 and slot 8 a locked 泥沼.
 */
const PADS: MapDef = {
  theme: 'ridge',
  rows: ['....A....', '....1....', '..H.#.M..', '....#....', '..O.#.M..', '....#....', '..O.#.O..', '....#....', '..a.#.m..', '....E....'],
};
const ALTAR = 0;
const HIGH = 1;
const MIRE = 2;
const MIRE2 = 4;
const PLAIN = 3;
const PLAIN2 = 5;

const padGame = (seed = 1): GameState => emptyGame(1, seed, PADS);
/** True when no fighter stands in a 泥沼 anywhere on the board. */
const legal = (g: GameState): boolean => g.slots.every((t, i) => t === null || canPlace(g, i, t.id));
const isFighter = (id: UnitId): boolean => UNITS[id].kind === 'attack' || UNITS[id].kind === 'hero';

describe('pad letters', () => {
  it('parses A/a, H/h and M/m like O/o: the kind, and upper case = open', () => {
    const m = buildMap(PADS);
    expect(m.slotKind).toEqual(['altar', 'high', 'mire', 'plain', 'mire', 'plain', 'plain', 'altar', 'mire']);
    expect(m.open).toEqual([true, true, true, true, true, true, true, false, false]);
    expect(m.slots[ALTAR]).toEqual({ x: 216, y: 24 });
    const all = buildMap({ theme: 'ridge', rows: ['OoAaHhMm', '1######E'] });
    expect(all.slotKind).toEqual(['plain', 'plain', 'altar', 'altar', 'high', 'high', 'mire', 'mire']);
    expect(all.open).toEqual([true, false, true, false, true, false, true, false]);
  });

  it('never starts the free 箭 in a 泥沼, and lets a 高台 count its extra reach', () => {
    // The 泥沼 sits on the road's axis and sees the most road of all pads.
    const def: MapDef = { theme: 'ridge', rows: ['....M....', '....1....', '..O.#.O..', '....#....', '....E....'] };
    const m = buildMap(def);
    expect(m.slotKind[0]).toBe('mire');
    expect(bestOpenSlot(m)).not.toBe(0);
    expect(createGame({ seed: 1, chapter: 1, map: def }).slots[0]).toBeNull();
    const high = buildMap({ theme: 'ridge', rows: ['.........', '....1....', '..O.#.H..', '....#....', '....#....', '....#....', '....E....'] });
    expect(bestOpenSlot(high)).toBe(1);
  });

  it('keeps every chapter map within the rules: a 法阵 or 高台 each, 泥沼 from chapter 5, at most a third special', () => {
    MAPS.forEach((def, i) => {
      const m = buildMap(def);
      const kinds = m.slotKind;
      const special = kinds.filter((k) => k !== 'plain').length;
      expect(kinds.some((k) => k === 'altar' || k === 'high'), `chapter ${i + 1}`).toBe(true);
      expect(kinds.includes('mire'), `chapter ${i + 1}`).toBe(i + 1 >= 5);
      expect(special * 3, `chapter ${i + 1}`).toBeLessThanOrEqual(kinds.length);
      // The starter 箭 always has a pad to stand on.
      expect(kinds[bestOpenSlot(m)], `chapter ${i + 1}`).not.toBe('mire');
    });
  });
});

describe('pad bonuses', () => {
  it('a 法阵 multiplies a fighter\'s damage; a 高台 adds 30 px of reach', () => {
    const g = padGame();
    const arrow = put(g, ALTAR, '箭');
    expect(slotDamage(g, arrow, ALTAR)).toBeCloseTo(8 * 1.2);
    expect(slotDamage(g, arrow, PLAIN)).toBe(8);
    expect(slotRange(g, arrow, HIGH)).toBe(230);
    expect(slotRange(g, arrow, ALTAR)).toBe(200);
    expect(SLOT_BONUS.altar.dmgMul).toBe(1.2);
    expect(SLOT_BONUS.high.range).toBe(30);
  });

  it('only boosts fighters, and the whole field stays the whole field', () => {
    const money: Tile = { uid: 0, id: '钱', level: 1, divine: false, cd: 0, invested: 0, rage: 0 };
    expect(padRange(money, 'high')).toBe(0);
    expect(padDamage(money, 'altar')).toBe(0);
    const dragon: Tile = { ...money, id: '白龙' };
    expect(padRange(dragon, 'high')).toBe(Infinity);
    expect(padDamage(dragon, 'altar')).toBeCloseTo(6 * 1.2);
  });

  it('an arrow from a 法阵 lands for 8 x 1.2', () => {
    const g = battle(padGame());
    put(g, ALTAR, '箭');
    const e = enemy(g, '妖', 48);
    for (let i = 0; i < 30; i++) stepCombat(g);
    expect(e.maxHp - e.hp).toBeCloseTo(9.6);
  });

  it('a 箭 on a 高台 reaches 230 px: it shoots what the same 箭 on plain stone cannot', () => {
    // Slot 1 is 96 px beside the road at y = 120: an enemy at dist 253 is 226 px away, at dist 260 it is 233 px.
    const g = battle(padGame());
    const arrow = put(g, HIGH, '箭');
    const near = enemy(g, '妖', 253);
    expect(findTarget(g, arrow, HIGH)).toBe(near);
    near.hp = 0;
    enemy(g, '妖', 260);
    expect(findTarget(g, arrow, HIGH)).toBeNull();
    const plain = battle(emptyGame());
    const other = put(plain, 1, '箭');
    enemy(plain, '妖', 253);
    expect(findTarget(plain, other, 1)).toBeNull();
  });

  it('ultimates use the pad too: 沙僧 on a 高台 slashes further, 八戒 on a 法阵 hits harder', () => {
    // At dist 220 the enemy is 197 px from slot 1: out of 沙僧's 180, inside 180 + 30.
    const g = battle(padGame());
    const sha = put(g, HIGH, '沙僧');
    sha.rage = 1;
    const far = enemy(g, '妖', 220, 1000);
    stepCombat(g);
    expect(g.events.some((e) => e.t === 'ultimate')).toBe(true);
    expect(far.hp).toBeLessThan(far.maxHp);
    const h = battle(padGame());
    const pig = put(h, ALTAR, '八戒');
    pig.rage = 1;
    const target = enemy(h, '妖', 60, 1000);
    stepCombat(h);
    const plain = battle(emptyGame());
    const pig2 = put(plain, 0, '八戒');
    pig2.rage = 1;
    const target2 = enemy(plain, '妖', 60, 1000);
    stepCombat(plain);
    expect(target.maxHp - target.hp).toBeCloseTo((target2.maxHp - target2.hp) * 1.2);
  });
});

describe('泥沼 placement', () => {
  const shopOf = (g: GameState, id: UnitId) => {
    g.shop = [{ id, price: UNITS[id].price || 10, sold: false }];
  };
  const refused = (g: GameState, r: ActionResult) => {
    expect(r).toBe('invalid');
    expect(g.events.at(-1)).toMatchObject({ t: 'invalid', msg: MIRE_MSG });
  };

  it('refuses buying a fighter onto an empty 泥沼, without charging; supports, fragments and the 金 card may go there', () => {
    for (const id of ['棍', '箭', '火', '冰', '雷'] as UnitId[]) {
      const g = padGame();
      shopOf(g, id);
      const before = g.gongde;
      refused(g, act(g, { t: 'buy', offer: 0, cell: MIRE }));
      expect(g.slots[MIRE]).toBeNull();
      expect(g.gongde).toBe(before);
      expect(g.shop[0].sold).toBe(false);
    }
    for (const id of ['速', '钱', '疗', '悟', '神'] as UnitId[]) {
      const g = padGame();
      shopOf(g, id);
      expect(act(g, { t: 'buy', offer: 0, cell: MIRE }), id).toBe('ok');
      expect(g.slots[MIRE]?.id).toBe(id);
    }
  });

  it('judges a purchase by what it turns into: no hero awakens and no 金X forms in a 泥沼', () => {
    const g = padGame();
    put(g, MIRE, '悟');
    shopOf(g, '空');
    const before = g.gongde;
    refused(g, act(g, { t: 'buy', offer: 0, cell: MIRE }));
    expect(g.slots[MIRE]?.id).toBe('悟');
    expect(g.gongde).toBe(before);
    const h = padGame();
    put(h, MIRE, '神');
    shopOf(h, '箭');
    refused(h, act(h, { t: 'buy', offer: 0, cell: MIRE }));
    expect(h.slots[MIRE]?.id).toBe('神');
    // Two supports still merge in a 泥沼.
    const k = padGame();
    put(k, MIRE, '钱');
    shopOf(k, '钱');
    expect(act(k, { t: 'buy', offer: 0, cell: MIRE })).toBe('merge');
    expect(k.slots[MIRE]).toMatchObject({ id: '钱', level: 2 });
  });

  it('refuses moving a fighter into a 泥沼, but moves a support', () => {
    const g = padGame();
    const arrow = put(g, PLAIN, '箭');
    refused(g, resolveDrop(g, PLAIN, MIRE));
    expect(g.slots[PLAIN]).toBe(arrow);
    put(g, PLAIN2, '速');
    expect(resolveDrop(g, PLAIN2, MIRE)).toBe('move');
    expect(g.slots[MIRE]?.id).toBe('速');
  });

  it('refuses a swap that would put a fighter in a 泥沼, either way round', () => {
    const g = padGame();
    put(g, PLAIN, '箭');
    put(g, MIRE, '钱');
    refused(g, resolveDrop(g, PLAIN, MIRE));
    refused(g, resolveDrop(g, MIRE, PLAIN));
    expect(g.slots[PLAIN]?.id).toBe('箭');
    expect(g.slots[MIRE]?.id).toBe('钱');
    put(g, PLAIN2, '疗');
    expect(resolveDrop(g, MIRE, PLAIN2)).toBe('swap');
    expect(g.slots[MIRE]?.id).toBe('疗');
  });

  it('awakens a hero only outside the 泥沼, and gilds a fighter only outside it', () => {
    const g = padGame();
    put(g, MIRE, '悟');
    put(g, PLAIN, '空');
    refused(g, resolveDrop(g, PLAIN, MIRE));
    expect(resolveDrop(g, MIRE, PLAIN)).toBe('hero');
    expect(g.slots[PLAIN]?.id).toBe('悟空');
    expect(g.slots[MIRE]).toBeNull();
    const h = padGame();
    put(h, MIRE, '神');
    put(h, PLAIN, '箭');
    refused(h, resolveDrop(h, PLAIN, MIRE));
    expect(resolveDrop(h, MIRE, PLAIN)).toBe('divine');
    expect(h.slots[PLAIN]).toMatchObject({ id: '箭', divine: true });
  });

  it('the goldDrop (天降金字) may land its 金 card in a 泥沼', () => {
    const g = padGame();
    for (let i = 0; i < g.slots.length; i++) if (g.unlocked[i] && i !== MIRE) put(g, i, i === MIRE2 ? '钱' : '箭');
    applyEncounter(g, 'goldDrop');
    expect(g.slots[MIRE]?.id).toBe('神');
  });

  it('the 宝箱 skips the 泥沼 for a fighter, paying 铜钱 instead when nothing else is free', () => {
    let placed = 0;
    let paid = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const g = padGame(seed);
      for (let i = 0; i < g.slots.length; i++) if (g.unlocked[i] && i !== MIRE) put(g, i, i === MIRE2 ? '钱' : '箭');
      const before = g.gongde;
      openChest(g);
      const ev = g.events.find((e) => e.t === 'chest');
      expect(ev, `seed ${seed}`).toBeDefined();
      if (ev?.t !== 'chest') continue;
      expect(legal(g), `seed ${seed}`).toBe(true);
      if (ev.cell === MIRE) {
        placed++;
        expect(isFighter(ev.unit as UnitId)).toBe(false);
      } else {
        paid++;
        expect(ev.cell).toBe(-1);
        expect(g.gongde).toBe(before + 30);
      }
    }
    // Both outcomes happen over these seeds.
    expect(placed).toBeGreaterThan(0);
    expect(paid).toBeGreaterThan(0);
  });

  it('restoring a save never puts a fighter back in a 泥沼', () => {
    const g = padGame();
    put(g, MIRE, '钱');
    const s = JSON.parse(JSON.stringify(snapshot(g, PADS)));
    expect(restore(s, PADS)).not.toBeNull();
    s.state.slots[MIRE] = { ...s.state.slots[MIRE], id: '箭' };
    expect(restore(s, PADS)).toBeNull();
  });
});

describe('drop preview on special pads', () => {
  const card = (id: UnitId, level = 1, divine = false) => ({ id, level, divine });
  const tile = (id: UnitId): Tile => ({ uid: 9, id, level: 1, divine: false, cd: 0, invested: 0, rage: 0 });

  it('turns red over a 泥沼 for whatever would leave a fighter in it', () => {
    expect(previewDrop(card('箭'), null, 'mire')).toBe('invalid');
    expect(previewDrop(card('悟空'), null, 'mire')).toBe('invalid');
    expect(previewDrop(card('钱'), null, 'mire')).toBe('empty');
    expect(previewDrop(card('神'), null, 'mire')).toBe('empty');
    expect(previewDrop(card('空'), tile('悟'), 'mire')).toBe('invalid');
    expect(previewDrop(card('空'), tile('悟'), 'plain')).toBe('hero');
    expect(previewDrop(card('箭'), tile('神'), 'mire')).toBe('invalid');
    expect(previewDrop(card('神'), tile('箭'), 'altar')).toBe('divine');
    expect(previewDrop(card('钱'), tile('钱'), 'mire')).toBe('merge');
    // A swap sends the target tile back where the dragged card came from.
    expect(previewDrop(card('钱'), tile('箭'), 'plain', 'mire')).toBe('invalid');
    expect(previewDrop(card('钱'), tile('疗'), 'plain', 'mire')).toBe('swap');
    expect(previewDrop(card('箭'), tile('疗'), 'mire', 'plain')).toBe('invalid');
  });

  it('behaves as before on plain pads and without the new arguments', () => {
    expect(previewDrop(card('箭'), null)).toBe('empty');
    expect(previewDrop(card('箭'), tile('箭'))).toBe('merge');
    expect(previewDrop(card('箭'), tile('火'))).toBe('swap');
    expect(previewDrop(card('箭'), null, 'high')).toBe('empty');
  });
});

describe('the bot and special pads', () => {
  /** Fails the test (cheaply: this runs every tick) when a fighter stands in a 泥沼. */
  const check = (g: GameState, what: string) => {
    if (!legal(g)) throw new Error(`a fighter stands in a 泥沼: ${what}`);
  };

  /** Plays a run with the bot like core/sim.ts, checking the board after every action and every tick. */
  function playChecked(g: GameState, seed: number): GameState {
    const luck = { rng: mixSeed(seed, 99) };
    while (g.phase !== 'won' && g.phase !== 'lost' && g.tick < 20 * 60 * 60) {
      if (g.phase === 'build') {
        for (let k = 0; k < 60 && g.phase === 'build'; k++) {
          const a = botBuildAction(g, DEFAULT_BOT, luck);
          const r = act(g, a);
          check(g, `seed ${seed} after ${JSON.stringify(a)}`);
          expect(a.t).not.toBe('mode');
          if (a.t !== 'start' && !['ok', 'merge', 'hero', 'divine', 'move', 'swap'].includes(r)) break;
        }
        if (g.phase === 'build') {
          if (g.encounter) act(g, { t: 'choose', option: 0 });
          act(g, { t: 'start' });
        }
      }
      step(g);
      check(g, `seed ${seed} tick ${g.tick}`);
    }
    return g;
  }

  it('never puts a fighter in a 泥沼 on a map full of them', () => {
    // Half the pads are 泥沼, several of them right beside the road.
    const MIRES: MapDef = {
      theme: 'river',
      rows: ['1########', '.M.O.M.O#', '..MOM...#', '#########', '#.M.O.M..', '#.o.m.o..', '#######E.'],
    };
    for (const seed of [3, 17, 2024]) {
      const g = playChecked(createGame({ seed, chapter: 3, map: MIRES }), seed);
      expect(['won', 'lost']).toContain(g.phase);
      expect(g.slots.some((t) => t !== null && isFighter(t.id))).toBe(true);
    }
  });

  it('never puts a fighter in a 泥沼 in the chapters that have them, and never touches 瞄准', () => {
    for (let chapter = 5; chapter <= 10; chapter++) {
      for (const seed of [11, 104729]) {
        let modes = 0;
        const end = playChapter(seed, chapter, {}, {
          action(g, a) {
            check(g, `chapter ${chapter} seed ${seed} after ${JSON.stringify(a)}`);
            if (a.t === 'mode') modes++;
          },
          tick: (g) => check(g, `chapter ${chapter} seed ${seed} tick ${g.tick}`),
        });
        expect(modes).toBe(0);
        expect(end.slots.every((t) => t === null || t.target === undefined)).toBe(true);
      }
    }
  }, 60_000);

  it('values a 法阵 and a 高台 above plain stone for a fighter', () => {
    /** Where the bot buys its first 箭 on a long straight road with two mirror-image pads, X left and Y right. */
    const firstBuy = (x: string, y: string): number => {
      const rows = ['.........', '....1....', '....#....', `..${x}.#.${y}..`, '....#....', '....#....', '....#....', '....#....', '....E....'];
      const g = createGame({ seed: 1, chapter: 1, map: { theme: 'ridge', rows } });
      g.slots.fill(null);
      g.shop = [{ id: '箭', price: 10, sold: false }];
      const a = botBuildAction(g, { mistake: 0, maxRefreshes: 0 }, { rng: 1 });
      return a.t === 'buy' ? a.cell : -1;
    };
    expect(firstBuy('O', 'A')).toBe(1);
    expect(firstBuy('A', 'O')).toBe(0);
    expect(firstBuy('O', 'H')).toBe(1);
    expect(firstBuy('M', 'O')).toBe(1);
  });
});
