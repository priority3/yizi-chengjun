// The bot plans for air raids only in the chapters that have them; chapters 1-5 see the bot exactly as before.
import { describe, expect, it } from 'vitest';
import type { MapDef } from '../src/config/maps.ts';
import { botBuildAction, tileValue } from '../src/core/bot.ts';
import { createGame } from '../src/core/game.ts';
import { tileDps } from '../src/core/stats.ts';
import { defaultMods } from '../src/core/treasures.ts';
import type { Tile, UnitId } from '../src/core/types.ts';

const tile = (id: UnitId): Tile => ({ uid: 0, id, level: 1, divine: false, cd: 0, invested: 0, rage: 0 });

/**
 * The road runs along the top, then down the right edge; the flight line cuts diagonally across the middle.
 * Slot 0 at (216, 72) sits beside the road, far from the flight line; slot 1 at (168, 168) sits on the flight line,
 * far from the road.
 */
const CROSSING: MapDef = {
  theme: 'ridge',
  rows: ['1#######.', '....O..#.', '.......#.', '...O...#.', '.......#.', '.......#.', '.......#.', '.......E.'],
};

describe('bot and air raids', () => {
  it('values 箭 and 雷 ×1.2 once a chapter has air raids, and nothing else changes', () => {
    for (const id of ['箭', '雷'] as const) {
      expect(tileValue(tile(id), 5)).toBeCloseTo(tileDps(tile(id)));
      expect(tileValue(tile(id), 6)).toBeCloseTo(tileDps(tile(id)) * 1.2);
    }
    for (const id of ['棍', '火', '冰', '悟空', '速', '神'] as const) expect(tileValue(tile(id), 6)).toBe(tileValue(tile(id), 5));
  });

  it('places 箭 to cover the flight lines too, but only from chapter 6 on', () => {
    const pick = (chapter: number) => {
      const mods = defaultMods();
      // A short reach, so each slot sees only the road or only the flight line.
      mods.unitRangeMul = { 箭: 0.4 };
      const g = createGame({ seed: 1, chapter, map: CROSSING, mods });
      g.slots.fill(null);
      g.shop = [{ id: '箭', price: 10, sold: false }];
      g.gongde = 100;
      return botBuildAction(g, { mistake: 0, maxRefreshes: 0 }, { rng: 1 });
    };
    expect(pick(5)).toEqual({ t: 'buy', offer: 0, cell: 0 });
    expect(pick(6)).toEqual({ t: 'buy', offer: 0, cell: 1 });
  });
});
