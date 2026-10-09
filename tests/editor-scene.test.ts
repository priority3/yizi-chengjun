// The map editor scene driven the way ui/input.ts drives it (press, tap, drag, pinch, wheel) on a stand-in canvas:
// taps and strokes paint (a stroke is one undo step), a camp dragged along only lands where the finger stops, a pinch
// takes back a stray stroke, the check waits until painting rests, the buttons and panels do their jobs, 试玩 and
// 返回 leave as they should — and every state renders without throwing.
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { MAPS, TILE } from '../src/config/maps.ts';
import type { Stage } from '../src/platform/env.ts';
import { parseProgress } from '../src/platform/progress.ts';
import { Camera } from '../src/render/camera.ts';
import { MIN_H, setDesignHeight, type Rect } from '../src/render/layout.ts';
import { ACTIONS, actionRect, BACK_BTN, loadCard, mapView, paletteRect, PAN_TOOL, sizeButtons, type ActionId } from '../src/ui/editor-layout.ts';
import { BRUSHES, colsOf, draftOf, sameDraft, type Draft } from '../src/ui/editor-model.ts';
import { EditorScene } from '../src/ui/editor-scene.ts';
import { DRAFT_KEY, exportRows, parseDraft } from '../src/ui/editor-text.ts';
import type { Pointer } from '../src/ui/input.ts';
import type { Nav } from '../src/ui/scenes.ts';

/** A 2D context that takes every call: it keeps the text drawn and measures text at 7 px a character. */
function fakeContext(texts: string[]): CanvasRenderingContext2D {
  const gradient = { addColorStop: () => {} };
  const target: Record<string | symbol, unknown> = {
    fillText: (s: string) => void texts.push(s),
    measureText: (s: string) => ({ width: s.length * 7 }),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
  };
  return new Proxy(target, {
    get: (t, k) => (k in t ? t[k] : () => {}),
    set: (t, k, v) => {
      t[k] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

let texts: string[];
let storage: Map<string, string>;
let prompt: Mock<(message: string, initial?: string) => string | null>;
let nav: Nav & { title: Mock<() => void>; tryMap: Mock<(def: Draft) => void> };
let stage: Stage;

beforeEach(() => {
  setDesignHeight(MIN_H);
  texts = [];
  storage = new Map();
  prompt = vi.fn<(message: string, initial?: string) => string | null>(() => null);
  const location = { hash: '#editor', pathname: '/', search: '' };
  vi.stubGlobal('localStorage', { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => void storage.set(k, v) });
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => fakeContext([]) }) });
  vi.stubGlobal('location', location);
  vi.stubGlobal('history', { state: null, replaceState: () => (location.hash = '') });
  vi.stubGlobal('window', { prompt });
  vi.stubGlobal('navigator', {});
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
    tryMap: vi.fn<(def: Draft) => void>(),
  };
  stage = { canvas: {} as HTMLCanvasElement, ctx: fakeContext(texts), pixelRatio: 2, toDesign: (x, y) => ({ x, y }) };
});

afterEach(() => vi.unstubAllGlobals());

const centre = (r: Rect): Pointer => ({ x: r.x + r.w / 2, y: r.y + r.h / 2, touch: false });

/** Renders a frame and returns the text it drew. */
function frame(s: EditorScene): string[] {
  texts.length = 0;
  s.render(stage.ctx);
  return [...texts];
}

/** A tap the way input.ts reports one: press, then release on the same spot. */
function tap(s: EditorScene, p: Pointer): void {
  s.press(p);
  s.tap(p);
  frame(s);
}

const act = (s: EditorScene, id: ActionId) => tap(s, centre(actionRect(ACTIONS.findIndex((a) => a.id === id))));
const pick = (s: EditorScene, ch: string) => tap(s, centre(paletteRect(BRUSHES.findIndex((b) => b.ch === ch))));
/** The draft as kept in localStorage (written after every finished edit). */
const kept = (): Draft | null => parseDraft(storage.get(DRAFT_KEY) ?? null);
const mustKeep = (): Draft => {
  const d = kept();
  if (!d) throw new Error('no draft kept');
  return d;
};

/** Screen point of square (c, r) while the whole `cols` x `rows` map is shown (the zoom the editor opens at). */
function square(c: number, r: number, cols = 12, rows = 16): Pointer {
  const cam = new Camera({ w: cols * TILE, h: rows * TILE });
  cam.zoom = 0;
  cam.clamp(mapView());
  const p = cam.toScreen((c + 0.5) * TILE, (r + 0.5) * TILE, mapView());
  return { x: p.x, y: p.y, touch: true };
}

/** A one-finger drag through the given squares. */
function drag(s: EditorScene, cells: Array<[number, number]>): void {
  const pts = cells.map(([c, r]) => square(c, r));
  s.press(pts[0]);
  s.dragStart(pts[0], pts[1] ?? pts[0]);
  for (const p of pts.slice(1)) s.dragMove(p);
  s.dragEnd();
  frame(s);
}

describe('editor scene', () => {
  it('opens on chapter 1 the first time, and on the kept draft after that', () => {
    const s = new EditorScene(nav, stage);
    expect(frame(s)).toContain('12×16');
    expect(kept()).toBeNull();
    pick(s, '~');
    tap(s, square(0, 0));
    const d = mustKeep();
    expect(d.rows[0][0]).toBe('~');
    expect(sameDraft(d, draftOf(MAPS[0]))).toBe(false);
    // A new editor (a reload) comes back to it, its brush back on 路.
    const again = new EditorScene(nav, stage);
    tap(again, square(1, 0));
    expect(mustKeep().rows[0].slice(0, 2)).toBe('~#');
  });

  it('paints a stroke as one undo step, and takes steps back one at a time', () => {
    const s = new EditorScene(nav, stage);
    pick(s, '#');
    tap(s, square(0, 0));
    pick(s, '~');
    drag(s, [
      [0, 0],
      [1, 0],
      [3, 0],
    ]);
    expect(mustKeep().rows[0].slice(0, 5)).toBe('~~~~.');
    expect(frame(s)).toContain('2 步');
    act(s, 'undo');
    expect(mustKeep().rows[0].slice(0, 5)).toBe('#....');
    act(s, 'undo');
    expect(sameDraft(mustKeep(), draftOf(MAPS[0]))).toBe(true);
    act(s, 'undo');
    expect(frame(s)).toContain('0 步');
  });

  it('drags the camp along without wiping the squares it passes', () => {
    const s = new EditorScene(nav, stage);
    pick(s, 'E');
    // Chapter 1's camp sits at the road's end (6, 15); the road runs up through (6, 14) and (6, 13).
    drag(s, [
      [6, 15],
      [6, 14],
      [6, 13],
      [6, 12],
    ]);
    const d = mustKeep();
    expect(d.rows.map((row) => row[6]).slice(12).join('')).toBe('E##.');
    // Still a working map once checked; the two squares of road left past the camp get a warning.
    s.update(0.2);
    const shown = frame(s);
    expect(shown).not.toContain('地图有错，还不能试玩');
    expect(shown).toContain('注意：有 2 格路不在任何一条路线上');
  });

  it('takes back what one finger began to paint when a second finger makes it a pinch', () => {
    const s = new EditorScene(nav, stage);
    pick(s, '~');
    const a = square(0, 0);
    const b = square(2, 0);
    s.press(a);
    s.dragStart(a, b);
    // The fingers hold still, so the zoom (and the squares the taps below hit) stays as it was.
    s.pinchStart(b, 80);
    s.pinchMove(b, 80);
    s.pinchEnd();
    expect(frame(s)).toContain('0 步');
    // The next tap keeps the whole draft: only its own square changed.
    tap(s, square(5, 0));
    const d = mustKeep();
    expect(d.rows[0]).toBe('.....~......');
    expect(d.rows.slice(1)).toEqual(MAPS[0].rows.slice(1));
  });

  it('checks the map only once painting rests, then shows the red banner', () => {
    const s = new EditorScene(nav, stage);
    pick(s, '.');
    tap(s, square(6, 15));
    expect(frame(s)).not.toContain('地图有错，还不能试玩');
    s.update(0.05);
    expect(frame(s)).not.toContain('地图有错，还不能试玩');
    s.update(0.06);
    const shown = frame(s);
    expect(shown).toContain('地图有错，还不能试玩');
    expect(shown.some((t) => t.includes('还没有营地'))).toBe(true);
  });

  it('pans with the pan tool instead of painting', () => {
    const s = new EditorScene(nav, stage);
    tap(s, centre(paletteRect(PAN_TOOL)));
    for (let i = 0; i < 6; i++) s.wheel(square(5, 8), -1);
    drag(s, [
      [5, 8],
      [2, 8],
    ]);
    tap(s, square(4, 4));
    expect(kept()).toBeNull();
    expect(frame(s).some((t) => t.startsWith('平移'))).toBe(true);
  });

  it('clears, resizes, loads a chapter and imports, each undoable', () => {
    const s = new EditorScene(nav, stage);
    act(s, 'clear');
    expect(mustKeep().rows.join('')).toMatch(/^\.+$/);
    act(s, 'undo');
    act(s, 'size');
    const b = sizeButtons();
    for (const r of [b.cols[1], b.cols[1], b.rows[0]]) tap(s, centre(r));
    const resized = mustKeep();
    expect([colsOf(resized), resized.rows.length]).toEqual([14, 15]);
    expect(frame(s)).toContain('14×15');
    tap(s, centre(b.done));
    act(s, 'load');
    s.update(0.016);
    frame(s);
    tap(s, centre(loadCard(3)));
    expect(sameDraft(mustKeep(), draftOf(MAPS[3]))).toBe(true);
    prompt.mockReturnValueOnce(exportRows(draftOf(MAPS[5])));
    act(s, 'import');
    expect(mustKeep().rows).toEqual(MAPS[5].rows);
    // The import keeps the loaded chapter's theme and HP tuning; 撤销 goes back through every step.
    expect(mustKeep().theme).toBe(MAPS[3].theme);
    for (let i = 0; i < 6; i++) act(s, 'undo');
    expect(sameDraft(mustKeep(), draftOf(MAPS[0]))).toBe(true);
  });

  it('exports to the clipboard, or into a prompt where there is none', async () => {
    const s = new EditorScene(nav, stage);
    act(s, 'export');
    await vi.waitFor(() => expect(prompt).toHaveBeenCalledWith(expect.stringContaining('maps.ts'), exportRows(draftOf(MAPS[0]))));
    const writeText = vi.fn(async () => {});
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    act(s, 'export');
    await vi.waitFor(() => expect(frame(s).some((t) => t.startsWith('已复制'))).toBe(true));
    expect(writeText).toHaveBeenCalledWith(exportRows(draftOf(MAPS[0])));
    expect(prompt).toHaveBeenCalledTimes(1);
  });

  it('starts 试玩 on the draft, but not while the map has an error', () => {
    const s = new EditorScene(nav, stage);
    act(s, 'play');
    expect(nav.tryMap).toHaveBeenCalledTimes(1);
    expect(sameDraft(nav.tryMap.mock.calls[0][0], draftOf(MAPS[0]))).toBe(true);
    act(s, 'clear');
    act(s, 'play');
    expect(nav.tryMap).toHaveBeenCalledTimes(1);
    expect(frame(s).some((t) => t.startsWith('先把地图修好'))).toBe(true);
  });

  it('goes back to the title screen and drops #editor from the address', () => {
    const s = new EditorScene(nav, stage);
    tap(s, centre(BACK_BTN));
    expect(nav.title).toHaveBeenCalledTimes(1);
    expect((globalThis as unknown as { location: { hash: string } }).location.hash).toBe('');
  });
});
