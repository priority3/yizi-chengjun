// The platform boundary (plan.md v1.0 step 1). Everything the game needs from the device goes through the PlatformEnv
// installed here: the screen canvas and offscreen canvases, the clock and frame loop, pointer input, the brush font,
// saves, sound, show / hide and sharing. The web version installs platform/web.ts (main.ts); a mini-game build installs
// its own (抖音 tt.*, 微信 wx.*) and simply leaves out the web-only parts: the map editor, offline play (pwa.ts) and the
// save-image overlay (share.ts). Only the web-only files touch the browser; tests/platform-boundary.test.ts holds that.

/**
 * The on-screen canvas the game draws every frame on. Canvases are typed as the DOM's: a mini-game's canvas objects
 * offer the same 2D API, so its platform hands them over under this type.
 */
export interface Stage {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** Backing-store pixels per design unit (CSS scale x devicePixelRatio). */
  pixelRatio: number;
  /** Converts a client (CSS pixel) point into design coordinates. */
  toDesign(clientX: number, clientY: number): { x: number; y: number };
}

/** The slice of the Web Storage API the saves use; getItem gives null for a key that was never set. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** One pointer (a finger, the mouse or a pen) as the platform reports it, already in design coordinates. */
export interface PointerSample {
  /** Tells pointers apart while they are down (web: the PointerEvent's pointerId; mini-games: the touch identifier). */
  id: number;
  x: number;
  y: number;
  /** A finger rather than a mouse or a pen. */
  touch: boolean;
  /** May start a gesture: the first finger down, or the mouse's main button (web: isPrimary and button 0). */
  primary: boolean;
}

/** Where the platform feeds pointer input: ui/input.ts turns it into taps, drags, pinches and wheel zooms. */
export interface PointerSink {
  /**
   * A pointer went down. Calls `claim` when the game takes it: the web then cancels the browser's default handling
   * and captures the pointer.
   */
  down(p: PointerSample, claim: () => void): void;
  move(p: PointerSample): void;
  /** Released at `p`. */
  up(p: PointerSample): void;
  /** Taken away by the system (cancelled, capture lost): a drag still drops where it last was. */
  cancel(p: PointerSample): void;
  /** Mouse wheel or trackpad over the canvas at `p`; a positive deltaY zooms out. */
  wheel(p: PointerSample, deltaY: number): void;
}

/** How a share ended: sent through the share sheet, the sheet closed by the player, or the picture shown to save by hand. */
export type ShareOutcome = 'shared' | 'cancelled' | 'saved';

/** A newer build of the game, installed and waiting for the player's go-ahead (the title screen's 有新版本 banner). */
export interface PendingUpdate {
  /** A newer build is installed and waiting. */
  ready(): boolean;
  /** The player asked for it and the game is about to restart on it. */
  applying(): boolean;
  /** Switches to the waiting build. */
  apply(): void;
}

/** What the game asks of the device it runs on. Every member is called after installPlatform, never at import time. */
export interface PlatformEnv {
  /**
   * Creates the on-screen canvas, fitted to the screen and refitted whenever the screen changes. Called once at boot,
   * before any offscreen canvas. Reason: on mini-games the first canvas created is the screen.
   */
  createStage(): Stage;
  /** A new offscreen canvas of `width` x `height` backing-store pixels (sprites, maps, thumbnails, the share card). */
  createCanvas(width: number, height: number): HTMLCanvasElement;
  /** Milliseconds on a monotonic clock, for animations and throttles; the clock requestFrame reports. */
  now(): number;
  /** Calls `frame` once, before the next repaint, with the time on the now() clock. */
  requestFrame(frame: (now: number) => void): void;
  /** Feeds the stage's pointer input (mouse, touch, pen) into `sink` from now on. */
  listenPointers(stage: Stage, sink: PointerSink): void;

  /**
   * Loads the brush font (the 马善政 subset), waiting at most `timeoutMs`. Resolves to the font family to draw it with,
   * or null when it isn't available (brush text then falls back to the system font). Never rejects.
   */
  loadBrushFont(timeoutMs: number): Promise<string | null>;
  /** Brush text can be drawn without waiting: the font is loaded, or there is no font loading to wait for. */
  brushFontReady(): boolean;

  /** The key-value storage the saves live in; null where there is none or it is blocked (saves then last a session). */
  storage(): KeyValueStore | null;

  /** A new WebAudio-compatible context for the synthesizer (platform/audio.ts); null where there is none (silence). */
  createAudioContext(): AudioContext | null;
  /**
   * Calls `unlock` on each user gesture that may start audio until it returns true (audio running). Calling it again
   * re-arms it, e.g. after the game comes back from the background. Reason: browsers only start audio inside a gesture.
   */
  armAudioUnlock(unlock: () => boolean): void;
  /** Calls `listener(false)` whenever the game goes to the background and `listener(true)` when it is back. */
  onVisibility(listener: (visible: boolean) => void): void;

  /** Hands the painted picture to the player with `text` (a share sheet, or a way to save it); never rejects. */
  shareImage(canvas: HTMLCanvasElement, text: string): Promise<ShareOutcome>;
  /** Where the game runs, for the version label and the share card's footer: the page's host on the web; '' if none. */
  host(): string;
  /** The address sent along with a shared picture (web: this page without query or hash); '' where there is none. */
  shareUrl(): string;

  /** Updates delivered while the game runs (web: the service worker); absent where the platform updates the game. */
  readonly update?: PendingUpdate;
}

/** The platform the game runs on; set once by the entry (main.ts on the web) before anything else runs. */
let current: PlatformEnv | null = null;

/** Makes `env` the platform every module reaches through platform(). */
export function installPlatform(env: PlatformEnv): void {
  current = env;
}

/** The installed platform. Throws when the entry hasn't installed one: the game can't run without it. */
export function platform(): PlatformEnv {
  if (!current) throw new Error('No platform installed: the entry must call installPlatform() first');
  return current;
}

/** A new offscreen canvas of `width` x `height` backing-store pixels and its 2D context. */
export function offscreen(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = platform().createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not supported in this browser');
  return { canvas, ctx };
}
