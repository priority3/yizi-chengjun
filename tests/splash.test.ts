// The launch splash: its timing (ui/splash-clock.ts) — a tap continues only once it has been up for 1 s (an earlier
// tap waits for that), it continues by itself after 3 s, fading in and out — the scene (ui/splash-scene.ts) that
// cross-fades into the next screen and hands it over once, and how the game opens on it (ui/scenes.ts): every launch
// starts on it, a page opened on the map editor skips it, and the console handle replaces it at any moment for good.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GAME_NAME } from '../src/config/brand.ts';
import { HEALTH_ADVICE } from '../src/config/legal.ts';
import type { Stage } from '../src/platform/env.ts';
import { MIN_H, setDesignHeight } from '../src/render/layout.ts';
import type { Pointer } from '../src/ui/input.ts';
import { SceneManager, type Scene } from '../src/ui/scenes.ts';
import { SPLASH, SplashClock } from '../src/ui/splash-clock.ts';
import { SplashScene } from '../src/ui/splash-scene.ts';

const FRAME = 1 / 60;

/** Runs `c` for `seconds` of 60 fps frames. */
function run(c: { update(dt: number): void }, seconds: number): void {
  for (let i = 0; i < Math.round(seconds / FRAME); i++) c.update(FRAME);
}

describe('splash timing', () => {
  it('fades in over its first moments, then holds', () => {
    const c = new SplashClock();
    expect([c.phase, c.alpha]).toEqual(['showing', 0]);
    run(c, SPLASH.fadeIn / 2);
    expect(c.alpha).toBeCloseTo(0.5, 1);
    run(c, 2.5);
    expect([c.phase, c.alpha]).toEqual(['showing', 1]);
  });

  it('keeps a tap that comes before 1 s waiting until then, so the advice always shows for a second', () => {
    const c = new SplashClock();
    run(c, 0.3);
    c.tap();
    run(c, 0.6);
    expect(c.phase).toBe('showing');
    run(c, 0.15);
    expect(c.phase).toBe('leaving');
    // The fade-out began at exactly 1 s and takes SPLASH.fadeOut.
    run(c, 1 + SPLASH.fadeOut - 1.05 - 0.05);
    expect(c.phase).toBe('leaving');
    run(c, 0.1);
    expect([c.phase, c.alpha]).toEqual(['done', 0]);
  });

  it('continues at once on a tap after 1 s, fading out smoothly', () => {
    const c = new SplashClock();
    run(c, 1.5);
    c.tap();
    expect([c.phase, c.alpha]).toEqual(['leaving', 1]);
    run(c, SPLASH.fadeOut / 2);
    expect(c.alpha).toBeCloseTo(0.5, 1);
    run(c, SPLASH.fadeOut / 2 + FRAME);
    expect(c.phase).toBe('done');
  });

  it('continues by itself after 3 s without a tap', () => {
    const c = new SplashClock();
    run(c, SPLASH.autoAfter - 0.05);
    expect(c.phase).toBe('showing');
    run(c, 0.1);
    expect(c.phase).toBe('leaving');
    run(c, SPLASH.fadeOut);
    expect(c.phase).toBe('done');
  });

  it('starts the fade-out on time across a long frame, and ignores taps once leaving', () => {
    const c = new SplashClock();
    // main.ts clamps a frame to 0.1 s at most.
    c.update(2.95);
    c.update(0.1);
    expect(c.alpha).toBeCloseTo(1 - 0.05 / SPLASH.fadeOut, 6);
    c.tap();
    expect(c.alpha).toBeCloseTo(1 - 0.05 / SPLASH.fadeOut, 6);
    c.update(SPLASH.fadeOut);
    expect(c.phase).toBe('done');
    c.update(-1);
    expect(c.phase).toBe('done');
  });

  it('shows the 点击任意处继续 hint only once a tap would continue', () => {
    const c = new SplashClock();
    run(c, SPLASH.tapAfter - 0.05);
    expect(c.hint).toBe(0);
    run(c, 0.05 + SPLASH.hintIn + FRAME);
    expect(c.hint).toBe(1);
  });
});

/** Text drawn by the last frame. */
let texts: string[];
let stage: Stage;

/** A 2D context that takes every call, keeps the text drawn and measures text at 7 px a character. */
function fakeContext(keep: boolean): CanvasRenderingContext2D {
  const gradient = { addColorStop: () => {} };
  const target: Record<string | symbol, unknown> = {
    fillText: (s: string) => void (keep && texts.push(s)),
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
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => void storage.set(k, v),
    removeItem: (k: string) => void storage.delete(k),
  });
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => fakeContext(false) }) });
  stage = { canvas: {} as HTMLCanvasElement, ctx: fakeContext(true), pixelRatio: 2, toDesign: (x, y) => ({ x, y }) };
});

afterEach(() => vi.unstubAllGlobals());

/** Renders a frame of `scene` and returns the text it drew. */
function frame(scene: Scene): string[] {
  texts.length = 0;
  scene.render(stage.ctx);
  return [...texts];
}

/** Runs the game loop for `seconds`: every frame updates whatever scene is current, as main.ts does. */
function loop(s: SceneManager, seconds: number): void {
  for (let i = 0; i < Math.round(seconds / FRAME); i++) s.current.update(FRAME);
}

const anywhere: Pointer = { x: 180, y: 300, touch: true };

describe('the splash scene', () => {
  it('draws the badge text, the name and the four lines of advice, fading in from the dark page', () => {
    const next: Scene = { update: vi.fn(), render: vi.fn() };
    const shown = frame(new SplashScene(next, () => {}));
    expect(shown).toEqual(expect.arrayContaining([GAME_NAME, '健康游戏忠告', ...HEALTH_ADVICE, '12+', '适龄提示']));
    expect(shown).not.toContain('点击任意处继续');
  });

  it('draws and updates the next screen only while fading out, and hands it over exactly once', () => {
    const update = vi.fn<(dt: number) => void>();
    const render = vi.fn<(ctx: CanvasRenderingContext2D) => void>();
    const done = vi.fn();
    const splash = new SplashScene({ update, render }, done);
    run(splash, 1.2);
    expect(frame(splash)).toContain('点击任意处继续');
    expect([update.mock.calls.length, render.mock.calls.length]).toEqual([0, 0]);
    splash.tap();
    splash.update(FRAME);
    expect(splash.phase).toBe('leaving');
    frame(splash);
    expect([update.mock.calls.length, render.mock.calls.length]).toEqual([1, 1]);
    run(splash, SPLASH.fadeOut);
    run(splash, 1);
    expect(done).toHaveBeenCalledTimes(1);
  });
});

describe('opening the game', () => {
  it('starts on the splash and fades into the title screen, which takes over', () => {
    const s = new SceneManager(stage);
    const splash = s.current;
    expect(splash).toBeInstanceOf(SplashScene);
    loop(s, 0.5);
    const advice = frame(s.current);
    expect(advice).toEqual(expect.arrayContaining([GAME_NAME, ...HEALTH_ADVICE]));
    expect(advice).not.toContain('开始游戏');
    // Fading out at 3 s: the title screen shows underneath.
    loop(s, SPLASH.autoAfter - 0.5 + 0.1);
    expect(s.current).toBe(splash);
    expect(frame(s.current)).toEqual(expect.arrayContaining(['开始游戏', '关于', ...HEALTH_ADVICE]));
    loop(s, SPLASH.fadeOut);
    expect(s.current).not.toBe(splash);
    const title = frame(s.current);
    expect(title).toEqual(expect.arrayContaining(['开始游戏', '关于']));
    expect(title).not.toContain(HEALTH_ADVICE[0]);
  });

  it('continues on a tap once the advice has been up for a second', () => {
    const s = new SceneManager(stage);
    loop(s, 0.4);
    s.current.tap?.(anywhere);
    loop(s, 0.5);
    expect(s.current).toBeInstanceOf(SplashScene);
    loop(s, 0.1 + SPLASH.fadeOut + 0.05);
    expect(s.current).not.toBeInstanceOf(SplashScene);
    expect(frame(s.current)).toContain('开始游戏');
  });

  it('lets title(), chapters(), play(n) and about() replace the splash at any moment, for good', () => {
    const calls: Array<(s: SceneManager) => void> = [(s) => s.title(), (s) => s.chapters(), (s) => s.play(1), (s) => s.about()];
    for (const go of calls) {
      const s = new SceneManager(stage);
      loop(s, 0.2);
      go(s);
      const replaced = s.current;
      expect(replaced).not.toBeInstanceOf(SplashScene);
      loop(s, SPLASH.autoAfter + SPLASH.fadeOut + 1);
      expect(s.current).toBe(replaced);
    }
  });

  it('opens straight on the title screen without the splash (a page opened on the map editor)', () => {
    const s = new SceneManager(stage, { splash: false });
    expect(s.current).not.toBeInstanceOf(SplashScene);
    expect(frame(s.current)).toContain('开始游戏');
  });
});
