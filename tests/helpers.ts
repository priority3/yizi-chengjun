// Test helpers for building run states by hand.
import { ENEMIES } from '../src/config/enemies.ts';
import { createGame } from '../src/core/game.ts';
import { GRID_Y } from '../src/core/grid.ts';
import { makeEnemy } from '../src/core/monsters.ts';
import type { Enemy, GameState, Lane, Tile, UnitId } from '../src/core/types.ts';

/** A fresh run with the starter 箭 removed, so tests control the whole board. */
export function emptyGame(chapter = 1, seed = 1): GameState {
  const g = createGame({ seed, chapter });
  g.slots.fill(null);
  return g;
}

export function put(g: GameState, cell: number, id: UnitId, level = 1, divine = false): Tile {
  const t: Tile = { uid: g.nextUid++, id, level, divine, cd: 0, invested: 10 };
  g.unlocked[cell] = true;
  g.slots[cell] = t;
  return t;
}

export function enemy(g: GameState, def: string, x: number, y: number, hp = 1000, lane?: Lane): Enemy {
  const l: Lane = lane ?? (y < GRID_Y ? 0 : 1);
  const e = makeEnemy(g, def, l, x, hp, ENEMIES[def].speed, 5, y);
  g.enemies.push(e);
  return e;
}

/** Puts the run into its battle phase without spawning a wave. */
export function battle(g: GameState): GameState {
  g.phase = 'battle';
  g.wave = Math.max(1, g.wave);
  return g;
}
