// Screen layout in design units. Width is fixed at 360; height adapts to the phone (640..800)
// so the painted battlefield fills tall screens instead of leaving black bars.
import { WORLD_W } from '../core/grid.ts';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const W = WORLD_W;
export const MIN_H = 640;
export const MAX_H = 800;

export interface Layout {
  H: number;
  /** Screen y of the world's top edge (world x maps 1:1 to screen x). */
  worldY: number;
  hud: Rect;
  btnPause: Rect;
  btnSpeed: Rect;
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
  const worldY = 60 + Math.round((H - MIN_H) * 0.4);
  const shop: Rect = { x: 8, y: H - 190, w: W - 16, h: 184 };
  const cardW = 92;
  const gap = (shop.w - 3 * cardW) / 4;
  const shopCards = [0, 1, 2].map((k) => ({ x: shop.x + gap + k * (cardW + gap), y: shop.y + 30, w: cardW, h: 96 }));
  return {
    H,
    worldY,
    hud: { x: 0, y: 0, w: W, h: 58 },
    btnPause: { x: 6, y: 6, w: 30, h: 28 },
    btnSpeed: { x: 40, y: 6, w: 36, h: 28 },
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

/** World coordinates -> screen design coordinates. */
export function wx(x: number): number {
  return x;
}

export function wy(y: number): number {
  return L.worldY + y;
}

/** Screen design coordinates -> world coordinates. */
export function toWorld(sx: number, sy: number): { x: number; y: number } {
  return { x: sx, y: sy - L.worldY };
}

export function inRect(x: number, y: number, r: Rect): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}
