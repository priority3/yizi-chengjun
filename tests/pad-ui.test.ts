// What the player is told about special pads and 瞄准: card descriptions with the pad's bonus, the label next to
// a pad while dragging, and the drag preview (red over a 泥沼 for a fighter, the combine hint taking priority).
import { describe as group, expect, it } from 'vitest';
import type { MapDef } from '../src/config/maps.ts';
import { MIRE_MSG } from '../src/core/board.ts';
import { act } from '../src/core/game.ts';
import { defaultMods } from '../src/core/treasures.ts';
import type { GameState, UnitId } from '../src/core/types.ts';
import { L } from '../src/render/layout.ts';
import { AIM_LABEL, describe, padLabel } from '../src/ui/describe.ts';
import type { Pointer } from '../src/ui/input.ts';
import { CardDrag, type SlotLocator } from '../src/ui/map-controls.ts';
import { emptyGame, put } from './helpers.ts';

/** TEST_MAP's geometry: slot 0 an open 法阵, 1 an open 高台, 2 and 4 open 泥沼, 3/5/6 plain, 7/8 locked. */
const PADS: MapDef = {
  theme: 'ridge',
  rows: ['....A....', '....1....', '..H.#.M..', '....#....', '..O.#.M..', '....#....', '..O.#.O..', '....#....', '..a.#.m..', '....E....'],
};
const ALTAR = 0;
const HIGH = 1;
const MIRE = 2;
const PLAIN = 3;
const PLAIN2 = 5;

const card = (id: UnitId, level = 1, divine = false) => ({ id, level, divine });

group('descriptions on special pads', () => {
  const mods = defaultMods();

  it('show a fighter\'s boosted numbers and name the pad', () => {
    expect(describe(card('箭'), mods)).toBe('箭 · 射程最远（伤害 8，射程 200）');
    expect(describe(card('箭'), mods, 'altar')).toBe('箭 · 射程最远（伤害 10，射程 200，法阵 +20%）');
    expect(describe(card('箭'), mods, 'high')).toBe('箭 · 射程最远（伤害 8，射程 230，高台 +30）');
    expect(describe(card('悟空'), mods, 'altar')).toContain('（伤害 66，法阵 +20%）');
    expect(describe(card('沙僧'), mods, 'high')).toContain('（伤害 30，高台射程 +30）');
  });

  it('never promises 白龙 more than the whole field, and only names the pad under the rest', () => {
    expect(describe(card('白龙'), mods, 'high')).not.toContain('高台');
    expect(describe(card('白龙'), mods, 'altar')).toContain('伤害 7，法阵 +20%');
    expect(describe(card('钱'), mods, 'mire')).toBe('钱 · 战斗时每 4 秒产出功德（泥沼）');
    expect(describe(card('钱'), mods)).toBe('钱 · 战斗时每 4 秒产出功德');
  });

  it('labels the three 瞄准 modes', () => {
    expect(AIM_LABEL).toEqual({ first: '打最前', strong: '打最强', weak: '打最弱' });
  });
});

group('pad labels while dragging', () => {
  it('say what the pad does for what would stand on it', () => {
    expect(padLabel('plain', '箭')).toBeNull();
    expect(padLabel('altar', '箭')).toBe('法阵：伤害 +20%');
    expect(padLabel('high', '悟空')).toBe('高台：射程 +30');
    expect(padLabel('mire', '雷')).toBe('泥沼：放不了兵字和英雄');
    expect(padLabel('mire', '钱')).toBe('泥沼：只能放辅助、碎片和神');
    expect(padLabel('altar', '速')).toBe('法阵：兵字和英雄伤害 +20%');
  });
});

group('the drag preview over special pads', () => {
  /** Pointers at (cell, 100): the locator below reads the cell straight from x (far from the shop and the trash). */
  const at = (cell: number): Pointer => ({ x: cell, y: 100, touch: false });
  const locator = (g: GameState): SlotLocator => (x) => (Number.isInteger(x) && x >= 0 && x < g.slots.length ? x : -1);

  /** Drags the tile on `from` over `to` and returns the drag state. */
  function hover(g: GameState, from: number, to: number): CardDrag {
    const drag = new CardDrag();
    expect(drag.begin(g, locator(g), at(from), at(from))).toBe(true);
    drag.move(g, locator(g), at(to));
    return drag;
  }

  it('turns red over a 泥沼 for a fighter and says why; a support may go there', () => {
    const g = emptyGame(1, 1, PADS);
    put(g, PLAIN, '箭');
    put(g, PLAIN2, '钱');
    const fighter = hover(g, PLAIN, MIRE);
    expect([fighter.hoverCell, fighter.hoverValid, fighter.hoverHint, fighter.hoverPad]).toEqual([MIRE, false, null, '泥沼：放不了兵字和英雄']);
    const support = hover(g, PLAIN2, MIRE);
    expect([support.hoverValid, support.hoverPad]).toEqual([true, '泥沼：只能放辅助、碎片和神']);
    const altar = hover(g, PLAIN, ALTAR);
    expect([altar.hoverValid, altar.hoverPad]).toEqual([true, '法阵：伤害 +20%']);
    const high = hover(g, PLAIN, HIGH);
    expect(high.hoverPad).toBe('高台：射程 +30');
  });

  it('lets the combine hint take priority, and judges an awakening by the hero it makes', () => {
    const g = emptyGame(1, 1, PADS);
    put(g, PLAIN, '箭');
    put(g, ALTAR, '箭');
    const merge = hover(g, PLAIN, ALTAR);
    expect([merge.hoverValid, merge.hoverHint]).toEqual([true, '松开合成 2 级']);
    const h = emptyGame(1, 1, PADS);
    put(h, MIRE, '悟');
    put(h, PLAIN, '空');
    const awaken = hover(h, PLAIN, MIRE);
    expect([awaken.hoverValid, awaken.hoverHint, awaken.hoverPad]).toEqual([false, null, '泥沼：放不了兵字和英雄']);
  });

  it('refuses a swap that would send a fighter into the 泥沼 the card came from', () => {
    const g = emptyGame(1, 1, PADS);
    put(g, MIRE, '钱');
    put(g, PLAIN, '箭');
    const swap = hover(g, MIRE, PLAIN);
    expect(swap.hoverValid).toBe(false);
    // Letting go still asks for the drop, which the run refuses with the 泥沼 message.
    const r = swap.finish(g);
    expect(r && 'action' in r ? r.action : null).toEqual({ t: 'drop', from: MIRE, to: PLAIN });
    if (r && 'action' in r) expect(act(g, r.action)).toBe('invalid');
    expect(g.events.at(-1)).toMatchObject({ t: 'invalid', msg: MIRE_MSG });
    expect(swap.hoverPad).toBeNull();
  });

  it('marks a shop card red over a 泥沼 it can\'t stand on', () => {
    const g = emptyGame(1, 1, PADS);
    g.shop = [{ id: '火', price: 14, sold: false }];
    const r = L.shopCards[0];
    const drag = new CardDrag();
    expect(drag.begin(g, locator(g), { x: r.x + r.w / 2, y: r.y + r.h / 2, touch: false }, at(MIRE))).toBe(true);
    expect([drag.hoverCell, drag.hoverValid, drag.hoverPad]).toEqual([MIRE, false, '泥沼：放不了兵字和英雄']);
    drag.move(g, locator(g), at(ALTAR));
    expect([drag.hoverValid, drag.hoverPad]).toEqual([true, '法阵：伤害 +20%']);
  });
});
