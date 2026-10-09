// The web entry (src/main.ts) booted headless on a minimal fake page: Node's EventTarget stands in for the document,
// the window and the canvases, with just the DOM the web platform uses. Checks the console handle external screenshot
// scripts rely on (__yzcj: title / chapters / play / editor / about / current), the launch splash, taps from DOM
// pointer events, the #editor address, and a hidden page pausing and saving the run.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { HEALTH_ADVICE } from '../src/config/legal.ts';
import { RUN_KEY } from '../src/platform/save.ts';
import { startButton } from '../src/ui/title-layout.ts';
import { recordingContext, type Drawn } from './fake-platform.ts';

/** What the stage (the first canvas made) drew. */
const screen: Drawn = { texts: [], fills: [] };
const offscreenDrawn: Drawn = { texts: [], fills: [] };
const frames: Array<(now: number) => void> = [];
const storage = new Map<string, string>();
const location = { hash: '', host: 'localhost:5173', protocol: 'http:', origin: 'http://localhost:5173', pathname: '/', search: '' };

/** A DOM element with the members the game touches: style, attributes, children, focus. */
class FakeElement extends EventTarget {
  readonly style: Record<string, unknown> = { setProperty: (k: string, v: string) => void (this.style[k] = v) };
  readonly children: FakeElement[] = [];
  readonly tagName: string;
  constructor(tagName: string) {
    super();
    this.tagName = tagName;
  }
  setAttribute(): void {}
  append(...els: FakeElement[]): void {
    this.children.push(...els);
  }
  appendChild(el: FakeElement): FakeElement {
    this.children.push(el);
    return el;
  }
  remove(): void {}
  focus(): void {}
}

const canvases: FakeCanvas[] = [];

class FakeCanvas extends FakeElement {
  width = 300;
  height = 150;
  private readonly ctx: CanvasRenderingContext2D;
  constructor() {
    super('CANVAS');
    // Reason: the first canvas is the stage (createStage makes it before anything else is painted).
    this.ctx = recordingContext(canvases.length === 0 ? screen : offscreenDrawn);
    canvases.push(this);
  }
  getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, width: parseFloat(String(this.style.width)) || this.width, height: parseFloat(String(this.style.height)) || this.height };
  }
  setPointerCapture(): void {}
  toDataURL(): string {
    return 'data:image/png;base64,AAAA';
  }
}

/** The #app box: a 360 x 640 phone screen without safe-area padding. */
const app = Object.assign(new FakeElement('DIV'), { clientWidth: 360, clientHeight: 640 });
const body = new FakeElement('BODY');
const doc = Object.assign(new EventTarget(), {
  hidden: false,
  visibilityState: 'visible',
  readyState: 'complete',
  fonts: { load: async () => [], check: () => true },
  body,
  activeElement: null,
  getElementById: (id: string) => (id === 'app' ? app : null),
  createElement: (tag: string) => (tag === 'canvas' ? new FakeCanvas() : new FakeElement(tag.toUpperCase())),
  querySelectorAll: () => [...canvases],
});
const win = Object.assign(new EventTarget(), { devicePixelRatio: 1 }) as EventTarget & Partial<Window>;

/** A DOM-like pointer event at client point (x, y). */
function pointer(type: string, x: number, y: number): Event {
  return Object.assign(new Event(type, { cancelable: true }), { pointerId: 1, clientX: x, clientY: y, pointerType: 'touch', isPrimary: true, button: 0 });
}

/** Runs the frame the game asked for and returns the text the stage drew in it. */
function frame(): string[] {
  screen.texts.length = 0;
  const next = frames.shift();
  if (!next) throw new Error('the game asked for no frame');
  next(performance.now());
  return [...screen.texts];
}

beforeAll(async () => {
  vi.stubGlobal('document', doc);
  vi.stubGlobal('window', win);
  vi.stubGlobal('location', location);
  vi.stubGlobal('history', { state: null, replaceState: () => void (location.hash = '') });
  vi.stubGlobal('navigator', {});
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => void storage.set(k, v),
    removeItem: (k: string) => void storage.delete(k),
  });
  vi.stubGlobal('getComputedStyle', () => ({ paddingLeft: '0', paddingRight: '0', paddingTop: '0', paddingBottom: '0' }));
  vi.stubGlobal('ResizeObserver', class {
    observe(): void {}
  });
  vi.stubGlobal('requestAnimationFrame', (cb: (now: number) => void) => frames.push(cb));
  await import('../src/main.ts');
});

describe('web entry', () => {
  it('fits the stage into #app and opens on the 健康游戏忠告 splash', () => {
    expect(app.children[0]).toBe(canvases[0]);
    expect([canvases[0].width, canvases[0].height]).toEqual([360, 640]);
    expect(frames).toHaveLength(1);
    expect(frame()).toEqual(expect.arrayContaining([HEALTH_ADVICE[0]]));
  });

  it('keeps the __yzcj console handle working', () => {
    const handle = win.__yzcj;
    if (!handle) throw new Error('__yzcj is missing');
    handle.title();
    expect(frame()).toContain('开始游戏');
    handle.chapters();
    expect(frame()).toContain('选择章节');
    handle.about();
    expect(frame()).toContain('关于');
    handle.editor();
    expect(handle.inEditor()).toBe(true);
    handle.play(1);
    expect(handle.current).toBeDefined();
    frame();
    expect(typeof win.__yzcjIcon?.(32)).toBe('string');
  });

  it('turns DOM pointer events on the canvas into taps', () => {
    const handle = win.__yzcj;
    if (!handle) throw new Error('__yzcj is missing');
    handle.title();
    const b = startButton(false);
    const [x, y] = [b.x + b.w / 2, b.y + b.h / 2];
    canvases[0].dispatchEvent(pointer('pointerdown', x, y));
    canvases[0].dispatchEvent(pointer('pointerup', x, y));
    expect(frame()).toContain('选择章节');
  });

  it('follows the #editor address, and pauses and saves a run when the page is hidden', () => {
    const handle = win.__yzcj;
    if (!handle) throw new Error('__yzcj is missing');
    location.hash = '#editor';
    win.dispatchEvent(new Event('hashchange'));
    expect(handle.inEditor()).toBe(true);
    location.hash = '';
    win.dispatchEvent(new Event('hashchange'));
    expect(handle.inEditor()).toBe(false);
    expect(frame()).toContain('开始游戏');

    handle.play(1);
    storage.delete(RUN_KEY);
    doc.hidden = true;
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(storage.has(RUN_KEY)).toBe(true);
    doc.hidden = false;
    doc.dispatchEvent(new Event('visibilitychange'));
  });

  it('shows a painted result card through the dev hook __yzcjShare', () => {
    expect(win.__yzcjShare?.({ chapter: 2 })).toBe('data:image/png;base64,AAAA');
    expect(body.children).toHaveLength(1);
  });
});
