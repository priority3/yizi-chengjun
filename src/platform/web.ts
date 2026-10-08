// Browser glue: fits the canvas to the screen (DPR-aware, adaptive design height), blocks mobile browser
// gestures, and persists progress (chapters + the 法宝 vault). Everything platform-specific stays in this file.
import { EQUIP_SLOTS, MAX_TIER } from '../config/treasures.ts';
import { emptyVault, isTreasureId, type Vault } from '../core/treasures.ts';
import { L, MAX_H, MIN_H, setDesignHeight, W } from '../render/layout.ts';
import { sprites } from '../render/sprites.ts';

export interface Stage {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** Backing-store pixels per design unit (CSS scale x devicePixelRatio). */
  pixelRatio: number;
  /** Converts a client (CSS pixel) point into design coordinates. */
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

export interface Progress {
  /** Highest chapter the player may start (1-based). */
  unlocked: number;
  /** Clears per chapter. */
  wins: number[];
  vault: Vault;
}

const STORAGE_KEY = 'zdxy:v3';
/** The v2 save had no vault; it is upgraded on first load. */
const LEGACY_KEY = 'zdxy:v2';
let memoryCopy: Progress | null = null;

function parseVault(raw: unknown): Vault {
  const v = emptyVault();
  if (!raw || typeof raw !== 'object') return v;
  const r = raw as Partial<Vault>;
  v.stones = Math.max(0, Math.floor(Number(r.stones) || 0));
  for (const s of Array.isArray(r.treasures) ? r.treasures : []) {
    if (s && isTreasureId(String(s.id)) && Number(s.count) > 0) {
      v.treasures.push({ id: s.id, tier: Math.min(MAX_TIER, Math.max(1, Math.floor(Number(s.tier) || 1))), count: Math.floor(Number(s.count)) });
    }
  }
  for (const id of Array.isArray(r.equipped) ? r.equipped : []) {
    if (isTreasureId(String(id)) && !v.equipped.includes(id) && v.equipped.length < EQUIP_SLOTS) v.equipped.push(id);
  }
  return v;
}

function parseProgress(raw: string | null, chapters: number): Progress | null {
  if (!raw) return null;
  const p = JSON.parse(raw) as Partial<Progress>;
  if (typeof p.unlocked !== 'number' || !Array.isArray(p.wins)) return null;
  const wins = Array.from({ length: chapters }, (_, i) => Number(p.wins?.[i]) || 0);
  return { unlocked: Math.min(chapters, Math.max(1, p.unlocked)), wins, vault: parseVault(p.vault) };
}

export function loadProgress(chapters: number): Progress {
  try {
    const current = parseProgress(localStorage.getItem(STORAGE_KEY), chapters);
    if (current) return current;
    const legacy = parseProgress(localStorage.getItem(LEGACY_KEY), chapters);
    if (legacy) return legacy;
  } catch {
    // Storage blocked (private mode / some in-app browsers): fall back to the in-memory copy below.
  }
  return memoryCopy ?? { unlocked: 1, wins: new Array<number>(chapters).fill(0), vault: emptyVault() };
}

export function saveProgress(p: Progress): void {
  memoryCopy = {
    unlocked: p.unlocked,
    wins: [...p.wins],
    vault: { stones: p.vault.stones, treasures: p.vault.treasures.map((s) => ({ ...s })), equipped: [...p.vault.equipped] },
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryCopy));
  } catch {
    // Ignore: progress still lives in memory for this session.
  }
}
