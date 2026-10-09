// The 关于 screen. Its page (ui/about-layout.ts) holds the five sections in order, every line wrapped inside the panel's
// width, every legal paragraph in full, the version label and the email, and keeps plan.md's wording rules. The scene
// (ui/about-scene.ts), driven the way ui/input.ts drives it, scrolls with drags, flicks and the wheel without leaving
// the page, jumps to a section from the buttons at the top, draws only what shows, and 返回 goes back to the title
// screen — which opens it from its 关于 button.
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { AGE_NOTICE, CONTACT_EMAIL, HEALTH_ADVICE, PRIVACY_POLICY, USER_AGREEMENT, type LegalDoc } from '../src/config/legal.ts';
import { MAPS } from '../src/config/maps.ts';
import { parseProgress, type Stage } from '../src/platform/web.ts';
import { MAX_H, MIN_H, setDesignHeight, W, type Rect } from '../src/render/layout.ts';
import { BACK } from '../src/render/widgets.ts';
import {
  ABOUT_FONT,
  ABOUT_SECTIONS,
  aboutPanel,
  aboutView,
  JUMP_FONT,
  layoutAbout,
  TEXT_W,
  TEXT_X,
  type AboutPage,
  type FontMeasure,
} from '../src/ui/about-layout.ts';
import { AboutScene } from '../src/ui/about-scene.ts';
import type { Pointer } from '../src/ui/input.ts';
import { SceneManager, type Nav } from '../src/ui/scenes.ts';
import { ABOUT_BUTTON } from '../src/ui/title-layout.ts';
import { forbiddenIn } from './wording.ts';

const FRAME = 1 / 60;
const VERSION = 'v0.8.0 · abc1234 · zidou-xiyou.vercel.app';

/** Width of `s` in a CSS font string: full-width characters take the font size, the rest half of it. */
const measure: FontMeasure = (s, font) => {
  const px = Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 10);
  return Array.from(s).reduce((w, ch) => w + ((ch.codePointAt(0) ?? 0) >= 0x2e80 ? px : px / 2), 0);
};
const squeeze = (s: string) => s.replace(/\s+/g, '');
const paragraphs = (d: LegalDoc) => [d.title, ...d.intro, ...d.sections.flatMap((s) => [s.heading, ...s.paragraphs])];
const centre = (r: Rect): Pointer => ({ x: r.x + r.w / 2, y: r.y + r.h / 2, touch: true });
const textOf = (p: AboutPage) => p.items.flatMap((it) => (it.kind === 'text' ? [it.text] : it.kind === 'jump' ? [it.label] : []));

describe('about page layout', () => {
  const page = layoutAbout(measure, VERSION);

  it('holds the five sections in order, each reachable from a jump button at the top', () => {
    const tops = ABOUT_SECTIONS.map((s) => page.tops[s.id]);
    for (let i = 1; i < tops.length; i++) expect(tops[i]).toBeGreaterThan(tops[i - 1]);
    const jumps = page.items.filter((it) => it.kind === 'jump');
    expect(jumps.map((j) => j.id)).toEqual(ABOUT_SECTIONS.map((s) => s.id));
    for (const j of jumps) {
      expect(j.rect.y + j.rect.h).toBeLessThan(tops[0]);
      expect(j.rect.x >= TEXT_X && j.rect.x + j.rect.w <= TEXT_X + TEXT_W + 0.001).toBe(true);
      expect(measure(j.label, JUMP_FONT)).toBeLessThan(j.rect.w - 8);
    }
    // Each section opens with its title just below where a jump lands.
    const titles = [PRIVACY_POLICY.title, USER_AGREEMENT.title, '适龄提示', '健康游戏忠告', '版本与联系方式'];
    ABOUT_SECTIONS.forEach((s, i) => {
      const first = page.items.find((it) => it.kind === 'text' && it.y > page.tops[s.id]);
      expect(first?.kind === 'text' && first.text).toBe(titles[i]);
    });
    expect(page.items.filter((it) => it.kind === 'badge')).toHaveLength(1);
  });

  it('wraps every line inside the text width', () => {
    for (const it of page.items) {
      if (it.kind !== 'text') continue;
      const w = measure(it.text, ABOUT_FONT[it.style]);
      expect(w, it.text).toBeLessThanOrEqual(TEXT_W);
      const left = it.center ? it.x - w / 2 : it.x;
      expect(left).toBeGreaterThanOrEqual(TEXT_X - 0.001);
      expect(left + w).toBeLessThanOrEqual(TEXT_X + TEXT_W + 0.001);
    }
  });

  it('keeps every paragraph whole, plus the advice, the version label and the email', () => {
    const all = squeeze(textOf(page).join(''));
    for (const p of [...paragraphs(PRIVACY_POLICY), ...paragraphs(USER_AGREEMENT), ...AGE_NOTICE, ...HEALTH_ADVICE]) expect(all).toContain(squeeze(p));
    expect(textOf(page)).toEqual(expect.arrayContaining([...HEALTH_ADVICE, `联系邮箱：${CONTACT_EMAIL}`]));
    expect(all).toContain(squeeze(`版本：${VERSION}`));
    expect(all).toContain('生效日期：2026年10月9日');
  });

  it('keeps plan.md\'s wording rules', () => {
    expect(forbiddenIn(textOf(page).join('\n'))).toEqual([]);
  });

  it('is laid out top to bottom, longer than the view at every design height', () => {
    let last = 0;
    for (const it of page.items) {
      const y = it.kind === 'jump' ? it.rect.y : it.y;
      expect(y).toBeGreaterThanOrEqual(last - 0.001);
      last = y;
    }
    expect(page.height).toBeGreaterThan(last);
    setDesignHeight(MAX_H);
    expect(page.height).toBeGreaterThan(aboutView().h * 3);
    setDesignHeight(MIN_H);
  });
});

/** Text drawn by the last frame, with where it was drawn. */
let texts: Array<{ s: string; y: number }>;
let nav: Nav & { title: Mock<() => void> };
let stage: Stage;

/** A 2D context that takes every call, keeps the text drawn and measures text like `measure` in its current font. */
function fakeContext(keep: boolean): CanvasRenderingContext2D {
  const gradient = { addColorStop: () => {} };
  const target: Record<string | symbol, unknown> = {
    font: '10px sans-serif',
    fillText: (s: string, _x: number, y: number) => void (keep && texts.push({ s, y })),
    measureText: (s: string) => ({ width: measure(s, String(target.font)) }),
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
  const progress = parseProgress(JSON.stringify({ unlocked: 1, wins: [] }), MAPS.length);
  if (!progress) throw new Error('progress did not parse');
  const none = () => {};
  nav = {
    progress,
    title: vi.fn<() => void>(),
    chapters: none,
    play: none,
    endless: none,
    daily: none,
    resume: () => false,
    treasures: none,
    save: none,
    editor: none,
    tryMap: none,
  };
  stage = { canvas: {} as HTMLCanvasElement, ctx: fakeContext(true), pixelRatio: 2, toDesign: (x, y) => ({ x, y }) };
});

afterEach(() => {
  vi.unstubAllGlobals();
  setDesignHeight(MIN_H);
});

/** Renders a frame and returns the text it drew. */
function frame(s: { render(ctx: CanvasRenderingContext2D): void }): string[] {
  texts.length = 0;
  s.render(stage.ctx);
  return texts.map((t) => t.s);
}

function run(s: AboutScene, seconds: number): void {
  for (let i = 0; i < Math.round(seconds / FRAME); i++) s.update(FRAME);
}

/** A tap the way input.ts reports one: press, then release on the same spot. */
function tap(s: AboutScene, p: Pointer): void {
  s.press(p);
  s.tap(p);
}

/** A finger dragged from screen height `from` to `to` in `frames` frames, resting a moment before lifting. */
function drag(s: AboutScene, from: number, to: number, frames = 10): void {
  const at = (y: number): Pointer => ({ x: W / 2, y, touch: true });
  s.press(at(from));
  s.dragStart(at(from), at(from + (to - from) / frames));
  for (let i = 2; i <= frames; i++) {
    s.update(FRAME);
    s.dragMove(at(from + ((to - from) * i) / frames));
  }
  run(s, 0.2);
  s.dragEnd();
}

/** The screen rect of the jump button to `name`, where it is drawn now. */
function jumpRect(s: AboutScene, name: string): Rect {
  const j = s.content().items.find((it) => it.kind === 'jump' && it.label === name);
  if (j?.kind !== 'jump') throw new Error(`no jump button ${name}`);
  return { ...j.rect, y: j.rect.y + aboutView().y - s.scroll };
}

describe('about scene', () => {
  it('draws the title, 返回, the jump buttons and the top of the privacy policy, nothing past the view', () => {
    const s = new AboutScene(nav, stage);
    const shown = frame(s);
    expect(shown).toEqual(expect.arrayContaining(['关于', '返回', ...ABOUT_SECTIONS.map((x) => x.name), PRIVACY_POLICY.title]));
    expect(shown).not.toContain(`联系邮箱：${CONTACT_EMAIL}`);
    // Only lines reaching into the view are drawn (the clip hides the parts outside it).
    const view = aboutView();
    for (const t of texts) {
      if (t.s === '关于' || t.s === '返回') continue;
      expect(t.y, t.s).toBeGreaterThan(view.y - 15);
      expect(t.y, t.s).toBeLessThan(view.y + view.h + 15);
    }
  });

  it('scrolls with a drag and stays inside the page at both ends', () => {
    const s = new AboutScene(nav, stage);
    frame(s);
    drag(s, 500, 200);
    expect(s.scroll).toBeCloseTo(300, 6);
    drag(s, 200, 600);
    expect(s.scroll).toBe(0);
    for (let i = 0; i < 40; i++) drag(s, 560, 80);
    run(s, 2);
    const max = s.content().height - aboutView().h;
    expect(s.scroll).toBeCloseTo(max, 6);
    expect(frame(s)).toContain(`联系邮箱：${CONTACT_EMAIL}`);
  });

  it('coasts on after a flick and settles', () => {
    const s = new AboutScene(nav, stage);
    frame(s);
    const at = (y: number): Pointer => ({ x: W / 2, y, touch: true });
    s.press(at(500));
    s.dragStart(at(500), at(490));
    for (let i = 2; i <= 6; i++) {
      s.update(FRAME);
      s.dragMove(at(500 - 10 * i));
    }
    s.dragEnd();
    const lifted = s.scroll;
    run(s, 0.2);
    expect(s.scroll).toBeGreaterThan(lifted + 20);
    run(s, 3);
    const rest = s.scroll;
    run(s, 0.5);
    expect(s.scroll).toBe(rest);
  });

  it('scrolls with the mouse wheel, and a second finger only stops a drag', () => {
    const s = new AboutScene(nav, stage);
    frame(s);
    s.wheel({ x: W / 2, y: 300, touch: false }, 120);
    run(s, 1);
    expect(s.scroll).toBeCloseTo(120, 6);
    s.wheel({ x: W / 2, y: 300, touch: false }, -500);
    run(s, 1);
    expect(s.scroll).toBe(0);
    const at = (y: number): Pointer => ({ x: W / 2, y, touch: true });
    s.press(at(400));
    s.dragStart(at(400), at(380));
    s.pinchStart();
    s.dragMove(at(100));
    s.dragEnd();
    run(s, 1);
    expect(s.scroll).toBeCloseTo(20, 6);
  });

  it('jumps to a section from its button, and taps only hit buttons where they are drawn now', () => {
    const s = new AboutScene(nav, stage);
    frame(s);
    const page = s.content();
    tap(s, centre(jumpRect(s, '用户协议')));
    run(s, 1.5);
    expect(s.scroll).toBeCloseTo(page.tops.terms, 6);
    expect(frame(s)).toContain(USER_AGREEMENT.title);
    // The buttons scrolled away: a tap where they were does nothing.
    const before = s.scroll;
    tap(s, { x: W / 2, y: aboutView().y + 20, touch: true });
    run(s, 1);
    expect(s.scroll).toBe(before);
    // 版本与联系方式 is shorter than the view: its jump ends at the very bottom of the page.
    const again = new AboutScene(nav, stage);
    frame(again);
    tap(again, centre(jumpRect(again, '版本与联系方式')));
    run(again, 2);
    expect(again.scroll).toBeCloseTo(Math.min(page.tops.contact, page.height - aboutView().h), 6);
    expect(frame(again)).toEqual(expect.arrayContaining(['版本与联系方式', `联系邮箱：${CONTACT_EMAIL}`]));
  });

  it('fits the panel and keeps the page scrollable at every design height', () => {
    for (const h of [MIN_H, 720, MAX_H]) {
      setDesignHeight(h);
      const s = new AboutScene(nav, stage);
      frame(s);
      const p = aboutPanel();
      expect(p.y).toBeGreaterThan(BACK.y + BACK.h);
      expect(p.y + p.h).toBeLessThanOrEqual(h);
      s.wheel({ x: W / 2, y: 300, touch: false }, 200);
      run(s, 1);
      expect(s.scroll).toBeCloseTo(200, 6);
    }
  });

  it('goes back to the title screen with 返回', () => {
    const s = new AboutScene(nav, stage);
    frame(s);
    tap(s, centre(BACK));
    expect(nav.title).toHaveBeenCalledTimes(1);
  });

  it('opens from the title screen\'s 关于 button, and 返回 leads back there', () => {
    const scenes = new SceneManager(stage, { splash: false });
    frame(scenes.current);
    scenes.current.press?.(centre(ABOUT_BUTTON));
    scenes.current.tap?.(centre(ABOUT_BUTTON));
    expect(scenes.current).toBeInstanceOf(AboutScene);
    expect(frame(scenes.current)).toContain(PRIVACY_POLICY.title);
    scenes.current.tap?.(centre(BACK));
    expect(frame(scenes.current)).toEqual(expect.arrayContaining(['开始游戏', '关于']));
  });
});
