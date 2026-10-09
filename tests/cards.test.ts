// B5 attack cards: 毒 stacks poison that bites on its own (bosses take it in full, kills pay out as usual), 网 holds a
// monster in place for its full time, bosses included, then lets it shake the net off before it can be caught again.
import { describe, expect, it } from 'vitest';
import { ENDLESS } from '../src/config/endless.ts';
import { LEVEL_MUL, ROOT_GUARD, UNITS } from '../src/config/units.ts';
import { TICKS_PER_SEC } from '../src/core/clock.ts';
import { findTarget, stepCombat } from '../src/core/combat.ts';
import { applyStun } from '../src/core/effects.ts';
import { act, createGame, step } from '../src/core/game.ts';
import { moveEnemies } from '../src/core/monsters.ts';
import { isFighter, padAllows } from '../src/core/slots.ts';
import { applyPoison, applyRoot, canRoot, isRooted, poisonDps, tickPoison } from '../src/core/status.ts';
import type { GameState } from '../src/core/types.ts';
import { battle, emptyGame, enemy, put, TEST_MAP } from './helpers.ts';

// Test map (helpers.ts): the road runs straight down x = 216 from y = 72 (dist 0); slot 1 sits at (120, 120), 96 px
// beside it, so an enemy at dist 48 stands right abreast of it.

const POISON = UNITS['毒'].fx.t === 'poison' ? UNITS['毒'].fx : { dps: 0, dur: 0, max: 0 };
const NET = UNITS['网'].fx.t === 'root' ? UNITS['网'].fx : { dur: 0 };

function ticks(g: GameState, n: number, f: (g: GameState) => void = stepCombat): void {
  for (let i = 0; i < n; i++) f(g);
}

describe('毒 poison', () => {
  it('stacks one per hit up to the cap, each stack biting 2 a second for 4 s, every hit refreshing them all', () => {
    const g = battle(emptyGame());
    const imp = enemy(g, '妖', 0, 1000);
    expect(POISON).toEqual({ t: 'poison', dps: 2, dur: 4, max: 5 });
    applyPoison(imp, '毒', UNITS['毒'].dmg);
    expect(imp.poison).toEqual({ stacks: 1, t: 4, dps: 2 });
    // One stack runs its whole 4 s: 8 damage, then it is gone.
    ticks(g, 4 * TICKS_PER_SEC, () => tickPoison(imp));
    expect(1000 - imp.hp).toBeCloseTo(8, 6);
    expect(imp.poison).toBeNull();
    for (let i = 0; i < 7; i++) applyPoison(imp, '毒', UNITS['毒'].dmg);
    expect(imp.poison?.stacks).toBe(POISON.max);
    // Half-way through, one more hit sets the clock back to the full 4 s.
    ticks(g, 2 * TICKS_PER_SEC, () => tickPoison(imp));
    expect(imp.poison?.t).toBeCloseTo(2, 6);
    applyPoison(imp, '毒', UNITS['毒'].dmg);
    expect(imp.poison?.t).toBe(4);
    expect(imp.poison?.stacks).toBe(5);
  });

  it('bites harder with the level (LEVEL_MUL, like the needle), and the strongest needle sets every stack', () => {
    const g = battle(emptyGame());
    expect(poisonDps('毒', UNITS['毒'].dmg * LEVEL_MUL[2])).toBeCloseTo(2 * LEVEL_MUL[2]);
    expect(poisonDps('箭', 8)).toBe(0);
    const imp = enemy(g, '妖', 0, 1000);
    applyPoison(imp, '毒', UNITS['毒'].dmg * LEVEL_MUL[1]);
    applyPoison(imp, '毒', UNITS['毒'].dmg);
    expect(imp.poison).toEqual({ stacks: 2, t: 4, dps: 2 * LEVEL_MUL[1] });
  });

  it('lands with the needle: a real 毒 builds its stacks shot by shot', () => {
    const g = battle(emptyGame());
    put(g, 1, '毒');
    const imp = enemy(g, '妖', 48, 1e6);
    stepCombat(g);
    expect(g.projectiles.map((p) => p.kind)).toEqual(['needle']);
    // Nothing until the needle lands.
    expect(imp.poison).toBeNull();
    // 96 px at 480 px/s: it lands after 12 ticks, well before the next needle (0.8 s).
    ticks(g, 20);
    expect(g.events.filter((e) => e.t === 'shot' && e.kind === 'needle')).toHaveLength(1);
    expect(imp.poison?.stacks).toBe(1);
    expect(imp.maxHp - imp.hp).toBeCloseTo(UNITS['毒'].dmg);
    ticks(g, 6 * TICKS_PER_SEC);
    expect(imp.poison?.stacks).toBe(POISON.max);
  });

  it('eats through a boss in full: no armour, no discount', () => {
    const g = battle(emptyGame());
    const bear = enemy(g, '黑熊精', 0, 1000);
    for (let i = 0; i < 5; i++) applyPoison(bear, '毒', UNITS['毒'].dmg);
    ticks(g, TICKS_PER_SEC, moveEnemies);
    // 黑熊精's armour takes 5 off every hit, which would leave a per-tick poison at 1 a tick; the poison isn't a hit.
    expect(1000 - bear.hp).toBeCloseTo(5 * 2, 6);
  });

  it('kills like any other damage: bounty, kill count and the kill event, even with nobody shooting', () => {
    const g = battle(emptyGame());
    // 5 stacks bite 10 a second: 2.95 HP lasts 17 ticks and goes on the 18th.
    const imp = enemy(g, '妖', 0, 2.95);
    for (let i = 0; i < 5; i++) applyPoison(imp, '毒', UNITS['毒'].dmg);
    const gongde = g.gongde;
    let killed = 0;
    for (let i = 0; i < 30; i++) {
      step(g);
      killed += g.events.filter((e) => e.t === 'kill' && e.bounty === imp.bounty).length;
    }
    expect(killed).toBe(1);
    expect(g.kills).toBe(1);
    expect(g.gongde).toBeGreaterThanOrEqual(gongde + imp.bounty);
    expect(g.enemies).not.toContain(imp);
    // A 小妖 walks 1 px a tick: it walked 17 ticks and not in the one it fell.
    expect(imp.dist).toBeCloseTo(17, 6);
  });

  it('poisons flyers, and lets go of a revived 白骨精', () => {
    const g = battle(emptyGame(6));
    const bat = enemy(g, '蝠', 0, 1000);
    applyPoison(bat, '毒', UNITS['毒'].dmg);
    ticks(g, TICKS_PER_SEC, moveEnemies);
    expect(1000 - bat.hp).toBeCloseTo(2, 6);
    const bone = enemy(g, '白骨精', 100, 100);
    applyPoison(bone, '毒', UNITS['毒'].dmg);
    bone.hp = 0;
    stepCombat(g);
    expect(g.enemies).toContain(bone);
    expect(bone.poison).toBeNull();
  });
});

describe('网 nets', () => {
  it('hold a boss in place for the full second, where a stun holds it half as long', () => {
    const g = battle(emptyGame());
    const netted = enemy(g, '红孩儿', 0, 1e6);
    const stunned = enemy(g, '红孩儿', 0, 1e6);
    applyRoot(netted, NET.dur);
    applyStun(stunned, NET.dur);
    expect(isRooted(netted)).toBe(true);
    ticks(g, TICKS_PER_SEC - 1, moveEnemies);
    expect(netted.dist).toBe(0);
    expect(stunned.dist).toBeGreaterThan(0);
    ticks(g, 2, moveEnemies);
    expect(isRooted(netted)).toBe(false);
    expect(netted.dist).toBeGreaterThan(0);
  });

  it('let a monster shake the net off for ROOT_GUARD seconds before another can catch it', () => {
    const g = battle(emptyGame());
    const imp = enemy(g, '妖', 0, 1e6);
    applyRoot(imp, 1);
    ticks(g, TICKS_PER_SEC, moveEnemies);
    expect(isRooted(imp)).toBe(false);
    expect(canRoot(imp)).toBe(false);
    applyRoot(imp, 1);
    expect(isRooted(imp)).toBe(false);
    ticks(g, ROOT_GUARD * TICKS_PER_SEC, moveEnemies);
    expect(canRoot(imp)).toBe(true);
    applyRoot(imp, 1);
    expect(isRooted(imp)).toBe(true);
  });

  it('are thrown by 网: a slow net that barely hurts, and the next one goes for a monster it can still catch', () => {
    const g = battle(emptyGame());
    const net = put(g, 1, '网');
    const lead = enemy(g, '妖', 60, 1e6);
    const next = enemy(g, '妖', 30, 1e6);
    expect(findTarget(g, net, 1)).toBe(lead);
    ticks(g, 30);
    expect(g.events.filter((e) => e.t === 'shot').map((e) => e.t === 'shot' && e.kind)).toEqual(['net']);
    expect(isRooted(lead)).toBe(true);
    expect(lead.maxHp - lead.hp).toBeCloseTo(UNITS['网'].dmg);
    // The caught one is no target for a net any more; the one behind it is.
    expect(findTarget(g, net, 1)).toBe(next);
    // Everyone else still hits the caught one.
    const arrow = put(g, 3, '箭');
    expect(findTarget(g, arrow, 3)).toBe(lead);
  });

  it('hold longer with the level and 鎏金, and catch flyers too', () => {
    const g = battle(emptyGame(6));
    put(g, 1, '网', 5, true);
    const bat = enemy(g, '蝠', 48, 1e6);
    ticks(g, 40);
    expect(isRooted(bat)).toBe(true);
    // Held 1 s x (1 + 0.1 x 4) x 1.5, plus the shaking-off time (only moveEnemies counts it down).
    expect(bat.rootT).toBeCloseTo(1.4 * 1.5 + ROOT_GUARD);
  });

  it('stop holding once an endless wave goes berserk, like stuns and slows', () => {
    const g = createGame({ seed: 2, chapter: 10, mode: 'endless', map: TEST_MAP });
    g.slots.fill(null);
    act(g, { t: 'start' });
    g.spawns = [];
    const bear = enemy(g, '熊', 48, 1e9);
    applyRoot(bear, 5);
    step(g);
    expect(isRooted(bear)).toBe(true);
    g.waveTime = ENDLESS.enrageAfter;
    step(g);
    expect(bear.rootT).toBe(0);
    const before = bear.dist;
    step(g);
    expect(bear.dist).toBeGreaterThan(before);
  });
});

describe('the new cards on the board', () => {
  it('毒 and 网 are fighters (the 金 card takes them, a 泥沼 refuses them); 鼓 and 镜 are supports that may stand in one', () => {
    for (const id of ['毒', '网'] as const) {
      expect(isFighter(id)).toBe(true);
      expect(UNITS[id].hitsAir).toBe(true);
      expect(UNITS[id].airMul).toBeUndefined();
      expect(padAllows('mire', id)).toBe(false);
    }
    for (const id of ['鼓', '镜'] as const) {
      expect(isFighter(id)).toBe(false);
      expect(padAllows('mire', id)).toBe(true);
    }
    const g = emptyGame();
    put(g, 1, '毒');
    put(g, 3, '网');
    put(g, 5, '鼓');
    put(g, 2, '神');
    put(g, 4, '神');
    put(g, 6, '神');
    expect(act(g, { t: 'drop', from: 2, to: 1 })).toBe('divine');
    expect(act(g, { t: 'drop', from: 4, to: 3 })).toBe('divine');
    expect(act(g, { t: 'drop', from: 6, to: 5 })).toBe('invalid');
    expect(act(g, { t: 'mode', cell: 1 })).toBe('ok');
    expect(g.slots[1]?.target).toBe('strong');
  });
});
