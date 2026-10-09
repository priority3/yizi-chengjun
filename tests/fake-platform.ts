// A platform with no browser behind it (platform/env.ts), shaped like a mini-game's: in-memory storage, canvases with
// a recording 2D context, a clock the test moves, and the frame, input, visibility and audio-unlock callbacks kept so
// the test can fire them. Used to check that the game reaches the device only through the platform.
import type { PlatformEnv, PointerSink, ShareOutcome, Stage } from '../src/platform/env.ts';

/** What the fake platform's contexts drew: text, and the fill colour of each fillRect. */
export interface Drawn {
  texts: string[];
  fills: string[];
}

/** A 2D context that takes every call, records text and fills, and measures text at 7 px a character. */
export function recordingContext(drawn: Drawn): CanvasRenderingContext2D {
  const gradient = { addColorStop: () => {} };
  const target: Record<string | symbol, unknown> = {
    fillStyle: '#000',
    fillText: (s: string) => void drawn.texts.push(s),
    fillRect: () => void drawn.fills.push(String(target.fillStyle)),
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

/** The fake platform, with everything it was asked for laid open. */
export interface FakePlatform extends PlatformEnv {
  /** The storage behind storage(). */
  readonly store: Map<string, string>;
  /** Drawing on the stage (the on-screen canvas). */
  readonly screen: Drawn;
  /** Sizes of the offscreen canvases made, in order. */
  readonly canvases: Array<[number, number]>;
  /** The clock now() reads (ms). */
  clock: number;
  /** Frames asked for and not run yet. */
  readonly frames: Array<(now: number) => void>;
  readonly sinks: PointerSink[];
  readonly visibility: Array<(visible: boolean) => void>;
  readonly unlocks: Array<() => boolean>;
  readonly fontLoads: number[];
  readonly shares: Array<{ canvas: HTMLCanvasElement; text: string }>;
}

/** A fresh fake platform; `over` replaces any of its members. */
export function fakePlatform(over: Partial<PlatformEnv> = {}): FakePlatform {
  const offscreenDrawn: Drawn = { texts: [], fills: [] };
  const env: FakePlatform = {
    store: new Map(),
    screen: { texts: [], fills: [] },
    canvases: [],
    clock: 1000,
    frames: [],
    sinks: [],
    visibility: [],
    unlocks: [],
    fontLoads: [],
    shares: [],
    createStage(): Stage {
      const canvas = { width: 720, height: 1280 } as HTMLCanvasElement;
      return { canvas, ctx: recordingContext(env.screen), pixelRatio: 2, toDesign: (x, y) => ({ x, y }) };
    },
    createCanvas(width, height) {
      env.canvases.push([width, height]);
      return { width, height, getContext: () => recordingContext(offscreenDrawn) } as unknown as HTMLCanvasElement;
    },
    now: () => env.clock,
    requestFrame: (frame) => void env.frames.push(frame),
    listenPointers: (_stage, sink) => void env.sinks.push(sink),
    loadBrushFont: async (timeoutMs) => {
      env.fontLoads.push(timeoutMs);
      return null;
    },
    brushFontReady: () => true,
    storage: () => ({
      getItem: (k) => env.store.get(k) ?? null,
      setItem: (k, v) => void env.store.set(k, v),
      removeItem: (k) => void env.store.delete(k),
    }),
    createAudioContext: () => null,
    armAudioUnlock: (unlock) => void env.unlocks.push(unlock),
    onVisibility: (listener) => void env.visibility.push(listener),
    shareImage: async (canvas, text): Promise<ShareOutcome> => {
      env.shares.push({ canvas, text });
      return 'shared';
    },
    host: () => 'mini.example',
    shareUrl: () => '',
    ...over,
  };
  return env;
}
