// Browser glue: fits the canvas to the screen (DPR-aware), blocks mobile browser gestures,
// and persists level progress. Everything platform-specific stays in this file.
import { H, W } from '../render/layout.ts';

export interface Stage {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** Backing-store pixels per design unit (CSS scale x devicePixelRatio). */
  pixelRatio: number;
  /** Converts a client (CSS pixel) point into design coordinates (the 360x640 space). */
  toDesign(clientX: number, clientY: number): { x: number; y: number };
}

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
    toDesign: (cx, cy) => ({ x: ((cx - rect.left) / rect.width) * W, y: ((cy - rect.top) / rect.height) * H }),
  };

  const fit = () => {
    const cs = getComputedStyle(container);
    const w = container.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const h = container.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    // Reason: fit by the smaller ratio so the whole 9:16 board is always visible (letterboxed on desktop).
    const scale = Math.max(0.2, Math.min(w / W, h / H));
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const cssW = Math.floor(W * scale);
    const cssH = Math.floor(H * scale);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    stage.pixelRatio = canvas.width / W;
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

export interface Progress {
  /** Highest level the player may start (1-based). */
  unlocked: number;
  /** Wins per level. */
  wins: number[];
}

const STORAGE_KEY = 'zdxy:v1';
let memoryCopy: Progress | null = null;

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Progress>;
      if (typeof p.unlocked === 'number' && Array.isArray(p.wins)) {
        return { unlocked: p.unlocked, wins: p.wins.map((n) => Number(n) || 0) };
      }
    }
  } catch {
    // Storage blocked (private mode / some in-app browsers): fall back to the in-memory copy below.
  }
  return memoryCopy ?? { unlocked: 1, wins: [0, 0, 0, 0, 0] };
}

export function saveProgress(p: Progress): void {
  memoryCopy = { unlocked: p.unlocked, wins: [...p.wins] };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryCopy));
  } catch {
    // Ignore: progress still lives in memory for this session.
  }
}
