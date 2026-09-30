import { describe, expect, it } from 'vitest';
import { HUMAN_PROXY, OT_MAX, PREP_SECONDS } from '../src/config/levels.ts';
import { act, createMatch, hashState, step } from '../src/core/match.ts';
import { PATH_LEN } from '../src/core/board.ts';
import { TICKS_PER_SEC } from '../src/core/waves.ts';
import { emptyMatch, enemy } from './helpers.ts';

describe('match flow', () => {
  it('starts wave 1 after the preparation time and spawns into both boards', () => {
    const m = emptyMatch();
    const prep = PREP_SECONDS * TICKS_PER_SEC;
    while (m.tick < prep) step(m);
    expect(m.phase).toBe('prep');
    step(m);
    expect(m.phase).toBe('waves');
    expect(m.wave).toBe(1);
    expect(m.sides[0].enemies).toHaveLength(1);
    expect(m.sides[1].enemies).toHaveLength(1);
    expect(m.sides[0].enemies[0].def).toBe(m.sides[1].enemies[0].def);
  });

  it('declares a knockout when one 唐僧 runs out of hearts', () => {
    const m = emptyMatch();
    m.sides[1].hearts = 1;
    enemy(m, 1, '妖', PATH_LEN - 0.001);
    step(m);
    expect(m.winner).toBe(0);
    expect(m.endReason).toBe('ko');
    expect(act(m, 0, { t: 'recruit' })).toBe('none');
  });

  it('breaks a double knockout by kills, ties going to the player', () => {
    const m = emptyMatch();
    for (const sid of [0, 1] as const) {
      m.sides[sid].hearts = 1;
      enemy(m, sid, '妖', PATH_LEN - 0.001);
    }
    m.sides[1].kills = 3;
    step(m);
    expect(m.winner).toBe(1);
    expect(m.endReason).toBe('double_ko');

    const tie = emptyMatch();
    for (const sid of [0, 1] as const) {
      tie.sides[sid].hearts = 1;
      enemy(tie, sid, '妖', PATH_LEN - 0.001);
    }
    step(tie);
    expect(tie.winner).toBe(0);
  });

  it('decides on points once overtime runs out', () => {
    const m = emptyMatch();
    m.wave = 10;
    m.overtime = OT_MAX;
    m.nextWaveAt = 0;
    m.sides[0].hearts = 1;
    m.sides[1].hearts = 2;
    step(m);
    expect(m.winner).toBe(1);
    expect(m.endReason).toBe('tiebreak');
  });

  it('is deterministic for a given seed', () => {
    const run = (seed: number) => {
      const m = createMatch({ seed, level: 2, ai: [HUMAN_PROXY, HUMAN_PROXY] });
      for (let i = 0; i < 4000; i++) step(m);
      return hashState(m);
    };
    expect(run(7)).toBe(run(7));
    expect(run(7)).not.toBe(run(8));
  });
});
