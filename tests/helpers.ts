// Test helpers for building board states by hand.
import { ENEMIES } from '../src/config/enemies.ts';
import { posAt } from '../src/core/board.ts';
import { createMatch } from '../src/core/match.ts';
import type { Enemy, MatchState, SideId, Tile, UnitId } from '../src/core/types.ts';

export function emptyMatch(level = 1, seed = 1): MatchState {
  return createMatch({ seed, level, ai: [null, null] });
}

export function put(m: MatchState, side: SideId, slot: number, id: UnitId, level = 1, divine = false): Tile {
  const t: Tile = { uid: m.nextUid++, id, level, divine, cd: 0, invested: 10 };
  m.sides[side].slots[slot] = t;
  return t;
}

export function enemy(m: MatchState, side: SideId, def: string, dist: number, hp = 1000): Enemy {
  const tr = ENEMIES[def].trait;
  const e: Enemy = {
    uid: m.nextUid++,
    def,
    hp,
    maxHp: hp,
    speed: ENEMIES[def].speed,
    dist,
    x: 0,
    y: 0,
    slowPct: 0,
    slowT: 0,
    stunT: 0,
    revives: tr?.t === 'revive' ? tr.times : 0,
    traitT: tr?.t === 'dash' ? tr.every : 0,
    dashT: 0,
    bounty: 5,
    leak: ENEMIES[def].leak,
  };
  posAt(dist, e);
  m.sides[side].enemies.push(e);
  return e;
}
