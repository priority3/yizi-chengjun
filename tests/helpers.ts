// Test helpers for building run states by hand, on a small map with a known geometry.
import { ENEMIES } from '../src/config/enemies.ts';
import type { MapDef } from '../src/config/maps.ts';
import { createGame } from '../src/core/game.ts';
import { makeEnemy } from '../src/core/monsters.ts';
import type { Enemy, GameState, Tile, UnitId } from '../src/core/types.ts';

/**
 * A straight road down x = 216 from y = 72 (dist 0) to the camp at y = 456 (dist 384).
 * Slot 0 sits on the road's axis at (216, 24); slots 1/3/5 are at x = 120 and 2/4/6 at x = 312,
 * 96 px from the road at y = 120 / 216 / 312; slots 7 and 8 (y = 408) start locked.
 */
export const TEST_MAP: MapDef = {
  theme: 'ridge',
  rows: [
    '....O....',
    '....1....',
    '..O.#.O..',
    '....#....',
    '..O.#.O..',
    '....#....',
    '..O.#.O..',
    '....#....',
    '..o.#.o..',
    '....E....',
  ],
};

/** Two roads, from the left and right edges, meeting at the camp. */
export const TWO_ROADS: MapDef = {
  theme: 'ridge',
  rows: ['....O....', '1###E###2', '....o....'],
};

export const ROAD_X = 216;
/** World y of a point `dist` px down the test road. */
export const roadY = (dist: number): number => 72 + dist;

/** A fresh run on the test map with the starter 箭 removed, so tests control the whole board. */
export function emptyGame(chapter = 1, seed = 1, map: MapDef = TEST_MAP): GameState {
  const g = createGame({ seed, chapter, map });
  g.slots.fill(null);
  return g;
}

export function put(g: GameState, cell: number, id: UnitId, level = 1, divine = false): Tile {
  const t: Tile = { uid: g.nextUid++, id, level, divine, cd: 0, invested: 10, rage: 0 };
  g.unlocked[cell] = true;
  g.slots[cell] = t;
  return t;
}

/** Adds an enemy `dist` px down road 0. */
export function enemy(g: GameState, def: string, dist: number, hp = 1000, side = 0): Enemy {
  const e = makeEnemy(g, def, 0, hp, ENEMIES[def].speed, 5, dist, side);
  g.enemies.push(e);
  return e;
}

/** Puts the run into its battle phase without spawning a wave. */
export function battle(g: GameState): GameState {
  g.phase = 'battle';
  g.wave = Math.max(1, g.wave);
  return g;
}
