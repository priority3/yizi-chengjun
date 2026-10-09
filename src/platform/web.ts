// The web platform (platform/env.ts): the game as a web page. Fits the canvas to the screen (DPR-aware, adaptive
// design height), blocks mobile browser gestures, and implements every PlatformEnv member with browser APIs. The
// pointer events are in web-input.ts, the share sheet and save-image overlay in share.ts, offline updates in pwa.ts.
import { GAME_NAME } from '../config/brand.ts';
import { BRUSH_FAMILY } from '../render/fonts.ts';
import { L, MAX_H, MIN_H, setDesignHeight, W } from '../render/layout.ts';
import { sprites } from '../render/sprites.ts';
import type { KeyValueStore, PlatformEnv, Stage } from './env.ts';
import { applyPwaUpdate, pwaUpdateReady, pwaUpdating } from './pwa.ts';
import { shareImage } from './share.ts';
import { listenPointers } from './web-input.ts';

/** Puts the game's canvas into `container` and keeps it fitted to the container (the web platform's createStage). */
export function createStage(container: HTMLElement): Stage {
  const canvas = document.createElement('canvas');
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not supported in this browser');
  let rect = canvas.getBoundingClientRect();

  const stage: Stage = {
    canvas,
    ctx,
    pixelRatio: 1,
    toDesign: (cx, cy) => ({ x: ((cx - rect.left) / rect.width) * W, y: ((cy - rect.top) / rect.height) * L.H }),
  };

  const fit = () => {
    const cs = getComputedStyle(container);
    const w = container.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const h = container.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    // Reason: match the design height to the screen's aspect ratio (within limits) so the art fills tall phones.
    const H = Math.round(Math.min(MAX_H, Math.max(MIN_H, (W * h) / Math.max(1, w))));
    setDesignHeight(H);
    const scale = Math.max(0.2, Math.min(w / W, h / H));
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const cssW = Math.floor(W * scale);
    const cssH = Math.floor(H * scale);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    stage.pixelRatio = canvas.width / W;
    sprites.setRatio(stage.pixelRatio);
    rect = canvas.getBoundingClientRect();
  };

  // Reason: in-app browsers (Douyin/WeChat) change the visible height without always firing window resize.
  new ResizeObserver(fit).observe(container);
  window.addEventListener('resize', fit);
  window.visualViewport?.addEventListener('resize', fit);
  fit();
  return stage;
}

/** Stops the browser from scrolling, zooming or opening menus while playing. */
export function installGuards(): void {
  const stop = (e: Event) => e.preventDefault();
  document.addEventListener('contextmenu', stop);
  document.addEventListener('gesturestart', stop);
  document.addEventListener('dblclick', stop);
  // Reason: iOS Safari ignores touch-action on some ancestors; a non-passive touchmove blocker stops rubber-banding.
  document.addEventListener('touchmove', stop, { passive: false });
}

/** Gestures that may start audio. Reason: a touch only counts as a user activation on release (touchend / pointerup). */
const UNLOCK_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'] as const;

/**
 * armAudioUnlock: listens on the window (capture phase, so nothing can swallow it) until a gesture has the audio
 * running. Idempotent: arming again re-adds the same listener, which the browser keeps only once.
 */
function audioUnlocker(): (unlock: () => boolean) => void {
  let unlock: (() => boolean) | null = null;
  const onGesture = (e: Event): void => {
    // Reason: Chrome logs a warning for audio started on a touch's pointerdown; its touchend follows anyway.
    if (e.type === 'pointerdown' && (e as PointerEvent).pointerType !== 'mouse') return;
    if (unlock?.()) for (const t of UNLOCK_EVENTS) window.removeEventListener(t, onGesture, true);
  };
  return (fn) => {
    unlock = fn;
    for (const t of UNLOCK_EVENTS) window.addEventListener(t, onGesture, true);
  };
}

type AudioCtor = new () => AudioContext;

/** A new AudioContext (webkit-prefixed on old iOS), or null without WebAudio. */
function createAudioContext(): AudioContext | null {
  const g = globalThis as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  const Ctor = g.AudioContext ?? g.webkitAudioContext;
  return Ctor ? new Ctor() : null;
}

/** localStorage, or null where there is none (Node) or it is blocked (private mode, some in-app browsers). */
function webStorage(): KeyValueStore | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // Reason: some browsers throw on merely touching localStorage when site data is disabled.
    return null;
  }
}

/** The brush font in canvas font syntax, under the family index.html's @font-face declares. */
const BRUSH_PROBE = `40px ${BRUSH_FAMILY}`;

/** No document (Node tests) or no CSS Font Loading API: there is no font loading to wait for. */
function noFontApi(): boolean {
  return typeof document === 'undefined' || !('fonts' in document);
}

/**
 * Waits for the brush font (declared in index.html) with a timeout.
 * Reason: canvas text only uses a web font once it has loaded; drawing earlier silently falls back.
 */
async function loadBrushFont(timeoutMs: number): Promise<string | null> {
  if (noFontApi()) return null;
  try {
    await Promise.race([document.fonts.load(BRUSH_PROBE, GAME_NAME), new Promise((resolve) => setTimeout(resolve, timeoutMs))]);
    return document.fonts.check(BRUSH_PROBE, '字') ? BRUSH_FAMILY : null;
  } catch {
    return null;
  }
}

/** The game's address for the share text: this page without query or hash; '' off the web (a file opened from disk). */
function shareUrl(): string {
  if (typeof location === 'undefined' || !location.protocol.startsWith('http')) return '';
  return `${location.origin}${location.pathname}`;
}

/** The browser platform. Touches nothing until its members are called, so tests install it without a page. */
export function webPlatform(): PlatformEnv {
  return {
    createStage() {
      const root = document.getElementById('app');
      if (!root) throw new Error('#app container is missing');
      return createStage(root);
    },
    createCanvas(width, height) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      return canvas;
    },
    now: () => performance.now(),
    requestFrame: (frame) => void requestAnimationFrame(frame),
    listenPointers,
    loadBrushFont,
    brushFontReady: () => noFontApi() || document.fonts.check(BRUSH_PROBE, '字'),
    storage: webStorage,
    createAudioContext,
    armAudioUnlock: audioUnlocker(),
    onVisibility: (listener) => document.addEventListener('visibilitychange', () => listener(!document.hidden)),
    shareImage: (canvas, text) => shareImage(canvas, text),
    // The page's host (e.g. zidou-xiyou.vercel.app, localhost:5173); '' where there is none (tests, a file from disk).
    host: () => (typeof location === 'undefined' ? '' : location.host),
    shareUrl,
    // Production builds only: in dev no service worker registers, so no update is ever ready (pwa.ts).
    update: { ready: pwaUpdateReady, applying: pwaUpdating, apply: applyPwaUpdate },
  };
}
