// 瞄准模式: each fighter's target priority (first / strong / weak), how a tap cycles it, what keeps it, and that
// it is hashed and saved.
import { describe, expect, it } from 'vitest';
import { resolveDrop, TARGET_MODES } from '../src/core/board.ts';
import { findTarget, stepCombat } from '../src/core/combat.ts';
import { act, hashState } from '../src/core/game.ts';
import { restore, snapshot } from '../src/core/snapshot.ts';
import type { GameState, Tile } from '../src/core/types.ts';
import { battle, emptyGame, enemy, put, TEST_MAP } from './helpers.ts';

// Test map (helpers.ts): the road runs straight down x = 216 from y = 72 (dist 0); slot 3 at (120, 216) sees
// the whole stretch from dist 0 to about 320 within a 箭's 200 px.

/** Three monsters in range of slot 3: the one furthest down the road, the toughest and the weakest. */
function crowd(g: GameState) {
  return {
    lead: enemy(g, '妖', 300, 50),
    tough: enemy(g, '妖', 150, 400),
    frail: enemy(g, '妖', 40, 20),
  };
}

describe('target priority', () => {
  it('first shoots the one closest to the camp, strong the most HP, weak the least', () => {
    const g = battle(emptyGame());
    const t = put(g, 3, '箭');
    const { lead, tough, frail } = crowd(g);
    expect(findTarget(g, t, 3)).toBe(lead);
    t.target = 'first';
    expect(findTarget(g, t, 3)).toBe(lead);
    t.target = 'strong';
    expect(findTarget(g, t, 3)).toBe(tough);
    t.target = 'weak';
    expect(findTarget(g, t, 3)).toBe(frail);
  });

  it('reads current HP, ignores the dead and the gone, and breaks ties by the lower uid', () => {
    const g = battle(emptyGame());
    const t = put(g, 3, '箭');
    const a = enemy(g, '妖', 100, 300);
    const b = enemy(g, '妖', 200, 300);
    t.target = 'strong';
    expect(findTarget(g, t, 3)).toBe(a);
    a.hp = 120;
    expect(findTarget(g, t, 3)).toBe(b);
    t.target = 'weak';
    expect(findTarget(g, t, 3)).toBe(a);
    a.hp = 0;
    expect(findTarget(g, t, 3)).toBe(b);
    b.gone = true;
    expect(findTarget(g, t, 3)).toBeNull();
  });

  it('never picks a monster out of range, whatever the mode', () => {
    const g = battle(emptyGame());
    const t = put(g, 1, '箭');
    enemy(g, '妖', 20, 10);
    const huge = enemy(g, '狼', 340, 5000); // more than 200 px from slot 1
    t.target = 'strong';
    expect(findTarget(g, t, 1)).not.toBe(huge);
  });

  it('aims the shot: a 火 set to strong throws its fireball at the toughest', () => {
    const g = battle(emptyGame());
    const fire = put(g, 3, '火');
    fire.target = 'strong';
    const { tough } = crowd(g);
    stepCombat(g);
    const shot = g.events.find((e) => e.t === 'shot');
    expect(shot).toMatchObject({ tx: tough.x, ty: tough.y });
  });
});

describe('switching modes', () => {
  it('cycles first -> strong -> weak -> first and says so', () => {
    const g = emptyGame();
    const t = put(g, 3, '箭');
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      expect(act(g, { t: 'mode', cell: 3 })).toBe('ok');
      expect(g.events.at(-1)).toEqual({ t: 'mode', cell: 3, mode: t.target });
      seen.push(t.target ?? 'first');
    }
    expect(seen).toEqual(['strong', 'weak', 'first', 'strong']);
    expect(TARGET_MODES).toEqual(['first', 'strong', 'weak']);
  });

  it('works for heroes and in battle too', () => {
    const g = battle(emptyGame());
    const hero = put(g, 2, '八戒');
    expect(act(g, { t: 'mode', cell: 2 })).toBe('ok');
    expect(hero.target).toBe('strong');
  });

  it('refuses supports, fragments and 神, ignores empty cells, and stops once the run is over', () => {
    const g = emptyGame();
    for (const [cell, id] of [
      [1, '速'],
      [2, '钱'],
      [3, '悟'],
      [4, '神'],
    ] as const) {
      const t = put(g, cell, id);
      expect(act(g, { t: 'mode', cell }), id).toBe('invalid');
      expect(t.target).toBeUndefined();
    }
    expect(g.events.filter((e) => e.t === 'mode')).toHaveLength(0);
    expect(act(g, { t: 'mode', cell: 5 })).toBe('none');
    expect(act(g, { t: 'mode', cell: 99 })).toBe('none');
    put(g, 6, '雷');
    g.phase = 'won';
    expect(act(g, { t: 'mode', cell: 6 })).toBe('phase');
  });
});

describe('what keeps a mode', () => {
  it('a merge keeps the mode of the tile dropped onto, bought or dragged', () => {
    const g = emptyGame();
    const target = put(g, 5, '箭');
    target.target = 'weak';
    const dragged = put(g, 6, '箭');
    dragged.target = 'strong';
    expect(resolveDrop(g, 6, 5)).toBe('merge');
    expect(g.slots[5]).toMatchObject({ level: 2, target: 'weak' });
    g.shop = [{ id: '火', price: 14, sold: false }];
    const fire = put(g, 1, '火');
    fire.target = 'strong';
    expect(act(g, { t: 'buy', offer: 0, cell: 1 })).toBe('merge');
    expect(g.slots[1]).toMatchObject({ level: 2, target: 'strong' });
  });

  it('moving and swapping keep each tile its mode; 神 keeps the fighter its mode', () => {
    const g = emptyGame();
    const a = put(g, 1, '雷');
    a.target = 'weak';
    expect(resolveDrop(g, 1, 2)).toBe('move');
    expect(g.slots[2]?.target).toBe('weak');
    const b = put(g, 3, '冰');
    b.target = 'strong';
    expect(resolveDrop(g, 2, 3)).toBe('swap');
    expect([g.slots[3]?.target, g.slots[2]?.target]).toEqual(['weak', 'strong']);
    put(g, 5, '神');
    expect(resolveDrop(g, 3, 5)).toBe('divine');
    expect(g.slots[5]).toMatchObject({ id: '雷', divine: true, target: 'weak' });
  });

  it('a freshly awakened hero starts at first', () => {
    const g = emptyGame();
    put(g, 1, '悟');
    put(g, 2, '空');
    expect(resolveDrop(g, 1, 2)).toBe('hero');
    expect(g.slots[2]?.target ?? 'first').toBe('first');
  });
});

describe('modes in the run state', () => {
  it('change the state hash', () => {
    const g = emptyGame();
    put(g, 3, '箭');
    const before = hashState(g);
    act(g, { t: 'mode', cell: 3 });
    const strong = hashState(g);
    expect(strong).not.toBe(before);
    act(g, { t: 'mode', cell: 3 });
    act(g, { t: 'mode', cell: 3 });
    // Back at first: the same as a tile that never switched.
    expect(hashState(g)).toBe(before);
  });

  it('survive a save and a restore, and a bad mode is refused', () => {
    const g = emptyGame();
    put(g, 1, '箭').target = 'strong';
    put(g, 2, '悟空').target = 'weak';
    put(g, 3, '火');
    const s = JSON.parse(JSON.stringify(snapshot(g, TEST_MAP)));
    const r = restore(s, TEST_MAP);
    expect(r).not.toBeNull();
    expect(r?.slots.map((t: Tile | null) => t?.target)).toEqual(g.slots.map((t) => t?.target));
    expect(r && hashState(r)).toBe(hashState(g));
    s.state.slots[1].target = 'loud';
    expect(restore(s, TEST_MAP)).toBeNull();
  });
});
