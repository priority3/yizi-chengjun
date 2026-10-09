// The platform interface's plumbing (platform/env.ts), on a fake platform with no browser behind it: installing it,
// offscreen canvases, and each shared module reaching the device only through it — saves, the brush font, the audio
// context, the clock, the version label, the share flow, the map editor's hand-off and the update banner.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHAPTERS } from '../src/config/chapters.ts';
import { createGame } from '../src/core/game.ts';
import { AudioEngine } from '../src/platform/audio.ts';
import { installPlatform, offscreen, platform } from '../src/platform/env.ts';
import { loadProgress, saveProgress } from '../src/platform/progress.ts';
import { clearRun, peekRun, RUN_KEY, saveRun } from '../src/platform/save.ts';
import { webPlatform } from '../src/platform/web.ts';
import { brush, loadFonts } from '../src/render/fonts.ts';
import { MIN_H, setDesignHeight } from '../src/render/layout.ts';
import { Sfx } from '../src/render/sfx.ts';
import { CARD_H, CARD_W } from '../src/render/share-card.ts';
import { updateBannerHit } from '../src/render/update-banner.ts';
import { SceneManager, type Scene } from '../src/ui/scenes.ts';
import { isSharing, sampleShareInfo, shareResult, shareText } from '../src/ui/share-result.ts';
import { versionLabel } from '../src/ui/version-label.ts';
import { fakePlatform, type FakePlatform } from './fake-platform.ts';

let env: FakePlatform;

/** Installs a fake platform with `over` replacing some of its members, and returns it. */
function use(over: Parameters<typeof fakePlatform>[0] = {}): FakePlatform {
  env = fakePlatform(over);
  installPlatform(env);
  return env;
}

beforeEach(() => {
  setDesignHeight(MIN_H);
  use();
});

// Reason: tests/setup.ts installed the web platform for this file; put it back for whatever runs next.
afterEach(() => installPlatform(webPlatform()));

describe('platform', () => {
  it('must be installed by the entry before anything uses it', async () => {
    vi.resetModules();
    const fresh = await import('../src/platform/env.ts');
    expect(() => fresh.platform()).toThrow('installPlatform');
    fresh.installPlatform(env);
    expect(fresh.platform()).toBe(env);
    expect(platform()).toBe(env);
  });

  it('makes offscreen canvases with their 2D context', () => {
    const { canvas, ctx } = offscreen(30, 20);
    expect(env.canvases).toEqual([[30, 20]]);
    expect([canvas.width, canvas.height]).toEqual([30, 20]);
    expect(typeof ctx.fillRect).toBe('function');
    use({ createCanvas: () => ({ width: 1, height: 1, getContext: () => null }) as unknown as HTMLCanvasElement });
    expect(() => offscreen(1, 1)).toThrow('Canvas 2D');
  });

  it('keeps the progress and the unfinished run in the platform storage', () => {
    const p = loadProgress(CHAPTERS.length);
    p.unlocked = 3;
    p.vault.stones = 42;
    saveProgress(p);
    expect([...env.store.keys()]).toEqual(['yzcj:v3']);
    expect(JSON.parse(env.store.get('yzcj:v3') ?? '{}')).toMatchObject({ unlocked: 3, vault: { stones: 42 } });
    expect(loadProgress(CHAPTERS.length)).toMatchObject({ unlocked: 3 });
    expect(saveRun(createGame({ seed: 8, chapter: 2 }), { x: 0, y: 0, zoom: 1 })).toBe(true);
    expect(env.store.has(RUN_KEY)).toBe(true);
    expect(peekRun()).toMatchObject({ chapter: 2, wave: 1 });
    clearRun();
    expect(env.store.has(RUN_KEY)).toBe(false);
  });

  it('plays on without storage: progress lasts the session, runs are not kept', () => {
    use({ storage: () => null });
    const p = loadProgress(CHAPTERS.length);
    p.unlocked = 5;
    saveProgress(p);
    expect(loadProgress(CHAPTERS.length).unlocked).toBe(5);
    expect(saveRun(createGame({ seed: 8, chapter: 1 }), { x: 0, y: 0, zoom: 1 })).toBe(false);
    expect(peekRun()).toBeNull();
  });

  it('draws brush text in the family the platform loaded the font under', async () => {
    use({ loadBrushFont: async (ms) => (env.fontLoads.push(ms), 'Ma Shan Zheng') });
    expect(await loadFonts(900)).toBe(true);
    expect(env.fontLoads).toEqual([900]);
    expect(brush(20)).toMatch(/^20px Ma Shan Zheng, "PingFang SC"/);
    // A failed load keeps the family brush text already had; the default wait is 2.5 s.
    use({ loadBrushFont: async (ms) => (env.fontLoads.push(ms), null) });
    expect(await loadFonts()).toBe(false);
    expect(env.fontLoads).toEqual([2500]);
    expect(brush(20)).toMatch(/^20px Ma Shan Zheng, /);
    use({ loadBrushFont: async () => 'YzcjBrush' });
    await loadFonts();
    expect(brush(20)).toMatch(/^20px YzcjBrush, /);
  });

  it('gets the audio context from the platform, and stays silent without one', () => {
    const silent = new AudioEngine();
    silent.unlock();
    expect(silent.ctx).toBeNull();
    expect(silent.running).toBe(false);
    let asked = 0;
    use({
      createAudioContext: () => {
        asked++;
        throw new Error('NotAllowedError');
      },
    });
    const refused = new AudioEngine();
    refused.unlock();
    refused.unlock();
    // Reason: a platform that failed to build the context once won't do better on the next tap.
    expect(asked).toBe(1);
    expect(refused.ctx).toBeNull();
  });

  it('times sounds on the platform clock', () => {
    const played: string[] = [];
    const sfx = new Sfx((id) => played.push(id));
    sfx.play('coin');
    env.clock += 20;
    sfx.play('coin');
    env.clock += 40;
    sfx.play('coin');
    expect(played).toEqual(['coin', 'coin']);
  });

  it('labels the version with where the platform says the game runs', () => {
    expect(versionLabel()).toBe(`v${__APP_VERSION__} · ${__APP_BUILD__} · mini.example`);
    use({ host: () => '' });
    expect(versionLabel()).toBe(`v${__APP_VERSION__} · ${__APP_BUILD__}`);
  });

  it('shares the painted card through the platform, after a short wait for the brush font', async () => {
    const info = sampleShareInfo(3, new Date(2026, 9, 9));
    use({ brushFontReady: () => false, shareUrl: () => 'https://game.example/' });
    const pending = shareResult(info);
    expect(isSharing()).toBe(true);
    expect(await shareResult(info)).toBeNull();
    expect(await pending).toBe('shared');
    expect(isSharing()).toBe(false);
    expect(env.fontLoads).toEqual([1500]);
    expect(env.shares).toHaveLength(1);
    expect(env.shares[0].text).toBe(shareText(info, 'https://game.example/'));
    expect([env.shares[0].canvas.width, env.shares[0].canvas.height]).toEqual([CARD_W, CARD_H]);
    expect(env.canvases[0]).toEqual([CARD_W, CARD_H]);
    // Ready font: nothing waits (the card is painted in the tap's own task).
    use();
    expect(await shareResult(info)).toBe('shared');
    expect(env.fontLoads).toEqual([]);
  });

  it('reports a share that failed as not shared', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    use({
      shareImage: async () => {
        throw new Error('share sheet broke');
      },
    });
    expect(await shareResult(sampleShareInfo(1, new Date(2026, 9, 9)))).toBeNull();
    expect(isSharing()).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('opens the map editor only when the entry hands one over', () => {
    const stage = env.createStage();
    const plain = new SceneManager(stage, { splash: false });
    const title = plain.current;
    plain.editor();
    expect(plain.current).toBe(title);
    expect(plain.inEditor()).toBe(false);

    const editorScene: Scene = { update: () => {}, render: () => {} };
    const make = vi.fn(() => editorScene);
    const web = new SceneManager(stage, { splash: false, editor: make });
    web.editor();
    expect(web.current).toBe(editorScene);
    expect(make).toHaveBeenCalledWith(web, stage);
    web.title();
    web.editor();
    // One editor per page: reopening it keeps its undo steps and view.
    expect(make).toHaveBeenCalledTimes(1);
    expect(web.inEditor()).toBe(true);
  });

  it('offers a waiting update on the title screen only where the platform delivers updates', () => {
    const tapBanner = (s: SceneManager) => {
      const r = updateBannerHit();
      s.current.tap?.({ x: r.x + r.w / 2, y: r.y + r.h / 2, touch: true });
    };
    const none = new SceneManager(env.createStage(), { splash: false });
    none.current.render(env.createStage().ctx);
    expect(env.screen.texts).not.toContain('有新版本，点此刷新');
    expect(() => tapBanner(none)).not.toThrow();

    const apply = vi.fn();
    use({ update: { ready: () => true, applying: () => false, apply } });
    const s = new SceneManager(env.createStage(), { splash: false });
    s.current.render(env.createStage().ctx);
    expect(env.screen.texts).toContain('有新版本，点此刷新');
    tapBanner(s);
    expect(apply).toHaveBeenCalledTimes(1);
  });
});
