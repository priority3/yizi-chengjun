// Offscreen sprite cache. Cards, monsters and portraits are drawn once per pixel ratio and then blitted,
// which keeps per-frame work low on phones (dozens of monsters, each built from many paths).
import { offscreen } from '../platform/env.ts';

export type Painter = (ctx: CanvasRenderingContext2D) => void;

export class SpriteCache {
  private readonly map = new Map<string, HTMLCanvasElement>();
  private ratio = 1;

  /** Drops every sprite when the backing-store resolution changes (resize, DPR change, font load). */
  setRatio(ratio: number): void {
    if (ratio === this.ratio) return;
    this.ratio = ratio;
    this.map.clear();
  }

  clear(): void {
    this.map.clear();
  }

  /** Returns a w x h (design units) sprite, painting it on first use. The painter draws in design units. */
  get(key: string, w: number, h: number, paint: Painter): HTMLCanvasElement {
    const cached = this.map.get(key);
    if (cached) return cached;
    const { canvas: c, ctx: g } = offscreen(Math.max(1, Math.ceil(w * this.ratio)), Math.max(1, Math.ceil(h * this.ratio)));
    g.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    paint(g);
    this.map.set(key, c);
    return c;
  }
}

/** Shared cache for all art modules. */
export const sprites = new SpriteCache();

/** Draws a cached sprite centred at (x, y) with an optional uniform scale. */
export function blit(ctx: CanvasRenderingContext2D, img: HTMLCanvasElement, x: number, y: number, w: number, h: number, scale = 1): void {
  const sw = w * scale;
  const sh = h * scale;
  ctx.drawImage(img, x - sw / 2, y - sh / 2, sw, sh);
}
