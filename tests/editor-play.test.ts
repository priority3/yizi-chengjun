// The map editor's 试玩 inside a run (ui/game-scene.ts given a test map), on a stand-in canvas: it plays chapter 1 on
// the edited map without 法宝, never writes or clears the run save, earns nothing when won, ends on a panel with
// 再来一次 / 返回编辑 and no 分享 seal, and its pause menu leads back to the editor.
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { CHAPTERS } from '../src/config/chapters.ts';
import { MAPS } from '../src/config/maps.ts';
import { defaultMods } from '../src/core/treasures.ts';
import type { GameState } from '../src/core/types.ts';
import type { Stage } from '../src/platform/env.ts';
import { parseProgress } from '../src/platform/progress.ts';
import { RUN_KEY } from '../src/platform/save.ts';
import { L, MIN_H, setDesignHeight } from '../src/render/layout.ts';
import { draftOf, type Draft } from '../src/ui/editor-model.ts';
import { GameScene } from '../src/ui/game-scene.ts';
import type { Pointer } from '../src/ui/input.ts';
import type { Nav } from '../src/ui/scenes.ts';

/** Text drawn by the last frame, with where it was drawn. */
let texts: Array<{ s: string; x: number; y: number }>;
let storage: Map<string, string>;
let nav: Nav & { editor: Mock<() => void>; tryMap: Mock<(def: Draft) => void>; save: Mock<() => void>; chapters: Mock<() => void> };
let stage: Stage;

/** A 2D context that takes every call, keeps the text drawn and measures text at 7 px a character. */
function fakeContext(keep: boolean): CanvasRenderingContext2D {
  const gradient = { addColorStop: () => {} };
  const target: Record<string | symbol, unknown> = {
    fillText: (s: string, x: number, y: number) => void (keep && texts.push({ s, x, y })),
    measureText: (s: string) => ({ width: s.length * 7 }),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
  };
  return new Proxy(target, {
    get: (t, k) => (k in t ? t[k] : () => {}),
    set: (t, k, v) => {
      t[k] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

beforeEach(() => {
  setDesignHeight(MIN_H);
  texts = [];
  storage = new Map([[RUN_KEY, 'an unfinished chapter run']]);
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => void storage.set(k, v),
    removeItem: (k: string) => void storage.delete(k),
  });
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => fakeContext(false) }) });
  // A player with a 法宝 equipped: a 试玩 must leave it at home.
  const progress = parseProgress(JSON.stringify({ unlocked: 3, wins: [1, 1], vault: { stones: 5, treasures: [{ id: '金刚琢', tier: 1, count: 1 }], equipped: ['金刚琢'] } }), MAPS.length);
  if (!progress) throw new Error('progress did not parse');
  const none = () => {};
  nav = {
    progress,
    title: none,
    chapters: vi.fn<() => void>(),
    play: none,
    endless: none,
    daily: none,
    resume: () => false,
    treasures: none,
    save: vi.fn<() => void>(),
    editor: vi.fn<() => void>(),
    tryMap: vi.fn<(def: Draft) => void>(),
  };
  stage = { canvas: {} as HTMLCanvasElement, ctx: fakeContext(true), pixelRatio: 1, toDesign: (x, y) => ({ x, y }) };
});

afterEach(() => vi.unstubAllGlobals());

const runOf = (s: GameScene): GameState => (s as unknown as { g: GameState }).g;

function frame(s: GameScene): string[] {
  texts.length = 0;
  s.render(stage.ctx);
  return texts.map((t) => t.s);
}

/** Taps the button whose label the last frame drew. */
function tapLabel(s: GameScene, label: string): void {
  const t = texts.find((x) => x.s === label);
  if (!t) throw new Error(`no ${label} on screen`);
  const p: Pointer = { x: t.x, y: t.y, touch: false };
  s.press(p);
  s.tap(p);
}

describe('editor 试玩 run', () => {
  const map = draftOf(MAPS[4]);

  it('plays chapter 1 on the edited map, without 法宝 or the guide', () => {
    const g = runOf(new GameScene(stage, 1, nav, undefined, 'chapter', map));
    expect([g.chapter, g.mode, g.totalWaves, g.map.cols, g.map.rows]).toEqual([1, 'chapter', CHAPTERS[0].waves, 14, 18]);
    expect(g.mods).toEqual(defaultMods());
    // The same chapter run without a test map takes the 法宝 along: the vault above is really equipped.
    expect(runOf(new GameScene(stage, 1, nav)).mods).not.toEqual(defaultMods());
  });

  it('never writes or clears the run save', () => {
    const s = new GameScene(stage, 1, nav, undefined, 'chapter', map);
    s.pause();
    expect(storage.get(RUN_KEY)).toBe('an unfinished chapter run');
    runOf(s).phase = 'lost';
    s.update(0.016);
    expect(storage.get(RUN_KEY)).toBe('an unfinished chapter run');
    // A real run does save when paused (so the check above means something).
    new GameScene(stage, 1, nav).pause();
    expect(storage.get(RUN_KEY)).not.toBe('an unfinished chapter run');
  });

  it('earns nothing when won, and ends on 再来一次 / 返回编辑 without a 分享 seal', () => {
    const s = new GameScene(stage, 1, nav, undefined, 'chapter', map);
    const before = JSON.stringify(nav.progress);
    const g = runOf(s);
    g.phase = 'won';
    g.campHp = g.campMax;
    s.update(0.016);
    s.update(1.2);
    expect(JSON.stringify(nav.progress)).toBe(before);
    expect(nav.save).not.toHaveBeenCalled();
    const shown = frame(s);
    expect(shown).toEqual(expect.arrayContaining(['章节通关！', '再来一次', '返回编辑']));
    expect(shown).not.toContain('分享');
    expect(shown).not.toContain('下一章');
    tapLabel(s, '再来一次');
    expect(nav.tryMap).toHaveBeenCalledWith(map);
    tapLabel(s, '返回编辑');
    expect(nav.editor).toHaveBeenCalledTimes(1);
  });

  it('pauses into a menu whose way out is 返回编辑', () => {
    const s = new GameScene(stage, 1, nav, undefined, 'chapter', map);
    frame(s);
    const pause: Pointer = { x: L.btnPause.x + L.btnPause.w / 2, y: L.btnPause.y + L.btnPause.h / 2, touch: false };
    s.press(pause);
    s.tap(pause);
    const shown = frame(s);
    expect(shown).toContain('返回编辑');
    expect(shown).not.toContain('返回选章');
    tapLabel(s, '返回编辑');
    expect(nav.editor).toHaveBeenCalledTimes(1);
    expect(nav.chapters).not.toHaveBeenCalled();
    expect(storage.get(RUN_KEY)).toBe('an unfinished chapter run');
  });
});
