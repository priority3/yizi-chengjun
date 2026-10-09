// The camera: which part of the world the viewport shows, and at what zoom. Pan and pinch move it;
// it never lets the player scroll off the map.
import type { MapData } from '../core/map.ts';
import type { Rect } from './layout.ts';

export const MAX_ZOOM = 2.2;

export class Camera {
  /** World coordinates of the viewport's top-left corner. */
  x = 0;
  y = 0;
  zoom = 1;
  /** Only the map's size is read: the map editor hands in a size it changes as the map is resized. */
  private readonly map: Pick<MapData, 'w' | 'h'>;

  constructor(map: Pick<MapData, 'w' | 'h'>) {
    this.map = map;
  }

  /** Smallest zoom: the whole map fits in the view (with a hair of margin). */
  minZoom(view: Rect): number {
    return Math.min(view.w / this.map.w, view.h / this.map.h) * 0.98;
  }

  /** Fits the map's width into the view and looks at its vertical middle. */
  fit(view: Rect): void {
    this.zoom = Math.min(MAX_ZOOM, view.w / this.map.w);
    this.x = 0;
    this.y = (this.map.h - view.h / this.zoom) / 2;
    this.clamp(view);
  }

  /** Centres the view on a world point at the given zoom. */
  lookAt(wx: number, wy: number, zoom: number, view: Rect): void {
    this.zoom = zoom;
    this.x = wx - view.w / (2 * zoom);
    this.y = wy - view.h / (2 * zoom);
    this.clamp(view);
  }

  /** Keeps the zoom in range and the view on the map (centred when the map is smaller than the view). */
  clamp(view: Rect): void {
    this.zoom = Math.max(this.minZoom(view), Math.min(MAX_ZOOM, this.zoom));
    const vw = view.w / this.zoom;
    const vh = view.h / this.zoom;
    this.x = this.map.w <= vw ? (this.map.w - vw) / 2 : Math.max(0, Math.min(this.map.w - vw, this.x));
    this.y = this.map.h <= vh ? (this.map.h - vh) / 2 : Math.max(0, Math.min(this.map.h - vh, this.y));
  }

  toScreen(wx: number, wy: number, view: Rect): { x: number; y: number } {
    return { x: view.x + (wx - this.x) * this.zoom, y: view.y + (wy - this.y) * this.zoom };
  }

  toWorld(sx: number, sy: number, view: Rect): { x: number; y: number } {
    return { x: this.x + (sx - view.x) / this.zoom, y: this.y + (sy - view.y) / this.zoom };
  }

  /** Zooms by `factor`, keeping the world point under screen point (sx, sy) where it is. */
  zoomAt(sx: number, sy: number, factor: number, view: Rect): void {
    const before = this.toWorld(sx, sy, view);
    this.zoom *= factor;
    this.clamp(view);
    const after = this.toWorld(sx, sy, view);
    this.x += before.x - after.x;
    this.y += before.y - after.y;
    this.clamp(view);
  }

  /** Applies the world -> screen transform to the context (draw in world units afterwards). */
  apply(ctx: CanvasRenderingContext2D, view: Rect): void {
    ctx.translate(view.x - this.x * this.zoom, view.y - this.y * this.zoom);
    ctx.scale(this.zoom, this.zoom);
  }
}
