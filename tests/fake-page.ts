// A minimal fake page for booting the web entry (src/main.ts) headless: Node's EventTarget stands in for the document,
// the window and the canvases, with just the DOM the web platform uses. Shared by tests/web-entry.test.ts (a browser
// that names no language) and tests/web-entry-en.test.ts (an English one).
import { vi } from 'vitest';
import { recordingContext, type Drawn } from './fake-platform.ts';

/** What the stage (the first canvas made) drew. */
export const screen: Drawn = { texts: [], fills: [] };
const offscreenDrawn: Drawn = { texts: [], fills: [] };
export const frames: Array<(now: number) => void> = [];
export const storage = new Map<string, string>();
export const location = { hash: '', host: 'localhost:5173', protocol: 'http:', origin: 'http://localhost:5173', pathname: '/', search: '' };

/** A DOM element with the members the game touches: style, attributes, children, focus. */
class FakeElement extends EventTarget {
  readonly style: Record<string, unknown> = { setProperty: (k: string, v: string) => void (this.style[k] = v) };
  readonly children: FakeElement[] = [];
  readonly tagName: string;
  constructor(tagName: string) {
    super();
    this.tagName = tagName;
  }
  readonly attributes = new Map<string, string>();
  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
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

export const canvases: FakeCanvas[] = [];

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
export const app = Object.assign(new FakeElement('DIV'), { clientWidth: 360, clientHeight: 640 });
export const body = new FakeElement('BODY');
export const doc = Object.assign(new EventTarget(), {
  title: '',
  documentElement: new FakeElement('HTML'),
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
export const win = Object.assign(new EventTarget(), { devicePixelRatio: 1 }) as EventTarget & Partial<Window>;

/** A DOM-like pointer event at client point (x, y). */
export function pointer(type: string, x: number, y: number): Event {
  return Object.assign(new Event(type, { cancelable: true }), { pointerId: 1, clientX: x, clientY: y, pointerType: 'touch', isPrimary: true, button: 0 });
}

/** Runs the frame the game asked for and returns the text the stage drew in it. */
export function frame(): string[] {
  screen.texts.length = 0;
  const next = frames.shift();
  if (!next) throw new Error('the game asked for no frame');
  next(performance.now());
  return [...screen.texts];
}

/**
 * Stubs the browser globals with the fake page (`navigator` as the browser describes itself) and boots the web entry
 * on it. Call once per test file, in beforeAll: the entry runs at import.
 */
export async function bootWebEntry(navigator: Record<string, unknown> = {}): Promise<void> {
  vi.stubGlobal('document', doc);
  vi.stubGlobal('window', win);
  vi.stubGlobal('location', location);
  vi.stubGlobal('history', { state: null, replaceState: () => void (location.hash = '') });
  vi.stubGlobal('navigator', navigator);
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
}
