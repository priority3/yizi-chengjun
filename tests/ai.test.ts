import { describe, expect, it } from 'vitest';
import { aiThink, chooseAction } from '../src/core/ai.ts';
import { SLOT_COUNT } from '../src/core/board.ts';
import { createMatch } from '../src/core/match.ts';
import { emptyMatch, put } from './helpers.ts';

describe('六耳猕猴 AI', () => {
  it('awakens heroes before anything else', () => {
    const m = emptyMatch();
    put(m, 1, 0, '八');
    put(m, 1, 5, '棍');
    put(m, 1, 6, '棍');
    put(m, 1, 9, '戒');
    const a = chooseAction(m.sides[1]);
    expect(a?.t).toBe('drop');
    if (a?.t === 'drop') expect(new Set([a.from, a.to])).toEqual(new Set([0, 9]));
  });

  it('puts 神 on its strongest attacker', () => {
    const m = emptyMatch();
    put(m, 1, 0, '神');
    put(m, 1, 1, '棍');
    put(m, 1, 2, '雷', 3);
    put(m, 1, 3, '速', 4);
    expect(chooseAction(m.sides[1])).toEqual({ t: 'drop', from: 0, to: 2 });
  });

  it('merges before spending on new draws', () => {
    const m = emptyMatch();
    put(m, 1, 0, '冰');
    put(m, 1, 7, '冰');
    const a = chooseAction(m.sides[1]);
    expect(a?.t).toBe('drop');
  });

  it('recruits when it can afford to and has room', () => {
    const m = emptyMatch();
    expect(chooseAction(m.sides[1])).toEqual({ t: 'recruit' });
  });

  /** Fills every slot with a distinct (unit, level) pair so nothing can merge. */
  function fillUnmergeable(m: ReturnType<typeof emptyMatch>, skip: number): void {
    const ids = ['棍', '箭', '火', '冰', '雷', '速', '钱', '疗'] as const;
    for (let i = 0; i < SLOT_COUNT; i++) if (i !== skip) put(m, 1, i, ids[i % 8], 2 + Math.floor(i / 8));
  }

  it('never sells while a slot is still empty', () => {
    const m = emptyMatch();
    m.sides[1].gongde = 0;
    fillUnmergeable(m, 4);
    const a = chooseAction(m.sides[1]);
    expect(a === null || a.t !== 'drop' || a.to !== 'sell').toBe(true);
  });

  it('sells its weakest cheap tile when the board is full and the refund pays for a draw', () => {
    const m = emptyMatch();
    const side = m.sides[1];
    fillUnmergeable(m, 4);
    put(m, 1, 4, '疗'); // the only level-1 tile, invested 10 -> refund 5
    side.gongde = 5;
    expect(chooseAction(side)).toEqual({ t: 'drop', from: 4, to: 'sell' });
  });

  it('only decides once per think interval', () => {
    const m = createMatch({ seed: 3, level: 1, ai: [null, { think: 2, mistake: 0, bonus: 0 }] });
    const ai = m.ai[1];
    if (!ai) throw new Error('missing AI');
    expect(aiThink(m, 1, ai)).not.toBeNull();
    const next = ai.next;
    expect(next).toBeGreaterThanOrEqual(Math.round(60 * 2 * 0.8));
    m.tick = next - 1;
    expect(aiThink(m, 1, ai)).toBeNull();
  });
});
