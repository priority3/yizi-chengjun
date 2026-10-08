// Screen layout in design units. Width is fixed at 360; height adapts to the phone (640..800).
// The world (map) is shown through a viewport between the HUD and the bottom panel; the camera maps it.
import type { Phase } from '../core/types.ts';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const W = 360;
export const MIN_H = 640;
export const MAX_H = 800;

export interface Layout {
  H: number;
  hud: Rect;
  btnPause: Rect;
  btnSpeed: Rect;
  /** Mute toggle (speaker icon), right of the speed button. */
  btnSound: Rect;
  /** Build-phase shop panel. */
  shop: Rect;
  shopCards: Rect[];
  btnRefresh: Rect;
  btnStart: Rect;
  trash: Rect;
  /** Battle-phase bottom bar. */
  bar: Rect;
  barTrash: Rect;
}

export function computeLayout(H: number): Layout {
  const shop: Rect = { x: 8, y: H - 190, w: W - 16, h: 184 };
  const cardW = 92;
  const gap = (shop.w - 3 * cardW) / 4;
  const shopCards = [0, 1, 2].map((k) => ({ x: shop.x + gap + k * (cardW + gap), y: shop.y + 30, w: cardW, h: 96 }));
  return {
    H,
    hud: { x: 0, y: 0, w: W, h: 58 },
    btnPause: { x: 6, y: 6, w: 30, h: 28 },
    btnSpeed: { x: 40, y: 6, w: 36, h: 28 },
    btnSound: { x: 80, y: 6, w: 30, h: 28 },
    shop,
    shopCards,
    btnRefresh: { x: 20, y: shop.y + 134, w: 150, h: 40 },
    btnStart: { x: 190, y: shop.y + 134, w: 150, h: 40 },
    trash: { x: shop.x + shop.w - 42, y: shop.y + 2, w: 36, h: 30 },
    bar: { x: 0, y: H - 50, w: W, h: 50 },
    barTrash: { x: W - 54, y: H - 47, w: 44, h: 44 },
  };
}

/** Live layout for the current design height (reassigned on resize; ES module bindings stay live). */
export let L: Layout = computeLayout(MIN_H);

export function setDesignHeight(h: number): void {
  if (h !== L.H) L = computeLayout(h);
}

/** The part of the screen that shows the world: between the HUD and the bottom panel of the current phase. */
export function viewRect(phase: Phase): Rect {
  const top = L.hud.h;
  const bottom = phase === 'build' ? L.shop.y : L.bar.y;
  return { x: 0, y: top, w: W, h: bottom - top };
}

export function inRect(x: number, y: number, r: Rect): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}
