import { describe, expect, it } from 'vitest';
import { START_GONGDE, STARTER_CELL, waveBonus } from '../src/config/chapters.ts';
import { act, createGame, hashState, step } from '../src/core/game.ts';
import { stopY } from '../src/core/grid.ts';
import { runChapter } from '../src/core/sim.ts';
import { emptyGame, enemy, put } from './helpers.ts';

describe('run flow', () => {
  it('starts in the build phase with a free 箭 and some 功德', () => {
    const g = createGame({ seed: 1, chapter: 1 });
    expect(g.phase).toBe('build');
    expect(g.slots[STARTER_CELL]?.id).toBe('箭');
    expect(g.gongde).toBe(START_GONGDE);
  });

  it('only shops during the build phase', () => {
    const g = createGame({ seed: 1, chapter: 1 });
    expect(act(g, { t: 'start' })).toBe('ok');
    expect(g.phase).toBe('battle');
    expect(g.wave).toBe(1);
    expect(g.spawns.length).toBeGreaterThan(0);
    expect(act(g, { t: 'buy', offer: 0, cell: 5 })).toBe('phase');
    expect(act(g, { t: 'refresh' })).toBe('phase');
    expect(act(g, { t: 'start' })).toBe('phase');
  });

  it('pays the wave bonus, restocks and reopens the shop when a wave is cleared', () => {
    const g = emptyGame();
    act(g, { t: 'start' });
    g.spawns = [];
    g.refreshes = 3;
    const before = g.gongde;
    step(g);
    expect(g.phase).toBe('build');
    expect(g.gongde).toBe(before + waveBonus(1));
    expect(g.refreshes).toBe(0);
    expect(g.shop.every((o) => !o.sold)).toBe(true);
  });

  it('is won after the last wave and lost when the camp falls', () => {
    const g = emptyGame();
    g.wave = g.totalWaves - 1;
    act(g, { t: 'start' });
    g.spawns = [];
    step(g);
    expect(g.phase).toBe('won');
    expect(act(g, { t: 'refresh' })).toBe('phase');

    const h = emptyGame();
    act(h, { t: 'start' });
    h.spawns = [];
    h.campHp = 2;
    const e = enemy(h, '妖', 150, stopY(0, 12));
    e.atkT = 0.001;
    step(h);
    expect(h.phase).toBe('lost');
  });

  it('keeps fighting tiles working through a wave', () => {
    const g = emptyGame();
    put(g, 5, '雷', 5, true);
    put(g, 10, '雷', 5, true);
    act(g, { t: 'start' });
    for (let i = 0; i < 60 * 60 && g.phase === 'battle'; i++) step(g);
    expect(g.phase).toBe('build');
    expect(g.kills).toBeGreaterThan(0);
  });

  it('replays identically from the same seed', () => {
    expect(runChapter(42, 3).hash).toBe(runChapter(42, 3).hash);
    expect(runChapter(42, 3).hash).not.toBe(runChapter(43, 3).hash);
    expect(hashState(createGame({ seed: 9, chapter: 2 }))).toBe(hashState(createGame({ seed: 9, chapter: 2 })));
  });
});
