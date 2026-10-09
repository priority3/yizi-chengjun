// Chapter map thumbnails for the chapter screen: each chapter's painted map shrunk into a small offscreen canvas,
// with a red dot on every entrance and a gold star on the camp so the route reads at a glance. Painted lazily
// (a couple per frame, see warmThumbs) and cached, one per chapter.
import { MAPS } from '../config/maps.ts';
import { buildMap, type MapData, type Pt } from '../core/map.ts';
import { offscreen } from '../platform/env.ts';
import { paintMap } from './map-art.ts';
import { starPath } from './rating-art.ts';
import { THEMES } from './scenery.ts';

/**
 * Most thumbnails painted in one frame.
 * Reason: each is a full map paint (scenery, roads, pads); all ten in one frame would freeze the screen's opening.
 */
export const THUMBS_PER_FRAME = 2;

/** A painted thumbnail and the backing-store size it was painted for. */
interface Thumb {
  key: string;
  img: HTMLCanvasElement;
}

/** At most one thumbnail per chapter (index = chapter - 1): painting another size replaces it. */
const thumbs: Array<Thumb | undefined> = [];
/** Built maps, kept so a resize doesn't trace the roads again. */
const maps: Array<MapData | undefined> = [];

function mapOf(chapter: number): MapData {
  return (maps[chapter - 1] ??= buildMap(MAPS[chapter - 1]));
}

/** Cache key: the thumbnail's size in backing-store pixels. */
function sizeKey(w: number, h: number, pixelRatio: number): string {
  return `${Math.ceil(w * pixelRatio)}x${Math.ceil(h * pixelRatio)}`;
}

/** The chapter's thumbnail if it is already painted at this size, else null. Never paints. */
export function peekThumb(chapter: number, w: number, h: number, pixelRatio: number): HTMLCanvasElement | null {
  const t = thumbs[chapter - 1];
  return t?.key === sizeKey(w, h, pixelRatio) ? t.img : null;
}

/**
 * The chapter's whole map fitted into w x h design units (letterboxed on its ground colour) with the entrances and
 * the camp marked; painted on first use, then cached.
 * Reason: a small canvas of its own instead of mapImage, which would keep full-size copies of all ten maps.
 */
export function mapThumb(chapter: number, w: number, h: number, pixelRatio: number): HTMLCanvasElement {
  const key = sizeKey(w, h, pixelRatio);
  const hit = thumbs[chapter - 1];
  if (hit?.key === key) return hit.img;
  const { canvas: img, ctx } = offscreen(Math.ceil(w * pixelRatio), Math.ceil(h * pixelRatio));
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  paintThumb(ctx, mapOf(chapter), w, h);
  thumbs[chapter - 1] = { key, img };
  return img;
}

/**
 * Paints up to `max` of the listed chapters' missing thumbnails (in list order) and returns the chapters it painted.
 * Call once per frame while thumbnails are on screen: they fill in over a few frames instead of all at once.
 */
export function warmThumbs(chapters: readonly number[], w: number, h: number, pixelRatio: number, max = THUMBS_PER_FRAME): number[] {
  const painted: number[] = [];
  for (const ch of chapters) {
    if (painted.length >= max) break;
    if (peekThumb(ch, w, h, pixelRatio)) continue;
    mapThumb(ch, w, h, pixelRatio);
    painted.push(ch);
  }
  return painted;
}

/** The map scaled to fit and centred in w x h (design units), on its ground colour, then the markers on top. */
function paintThumb(ctx: CanvasRenderingContext2D, map: MapData, w: number, h: number): void {
  const pal = THEMES[map.theme];
  const ground = ctx.createLinearGradient(0, 0, w, h);
  ground.addColorStop(0, pal.ground[0]);
  ground.addColorStop(1, pal.ground[1]);
  ctx.fillStyle = ground;
  // Reason: one unit wider and taller, so the backing store's rounded-up last pixel row and column are covered too.
  ctx.fillRect(0, 0, w + 1, h + 1);
  const s = Math.min(w / map.w, h / map.h);
  const ox = (w - map.w * s) / 2;
  const oy = (h - map.h * s) / 2;
  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(s, s);
  paintMap(ctx, map);
  ctx.restore();
  markers(ctx, map, (p) => ({ x: ox + p.x * s, y: oy + p.y * s }), w, h);
}

/** Keeps a marker of radius `r` fully inside the w x h thumbnail (entrances sit on the map's very edge). */
function inside(p: Pt, r: number, w: number, h: number): Pt {
  return { x: Math.min(w - r, Math.max(r, p.x)), y: Math.min(h - r, Math.max(r, p.y)) };
}

/** Red entrance dots and the gold camp star, sized to the thumbnail rather than the map so they stay visible. */
function markers(ctx: CanvasRenderingContext2D, map: MapData, at: (p: Pt) => Pt, w: number, h: number): void {
  const unit = Math.min(w, h);
  const dot = Math.max(2.5, unit * 0.055);
  for (const spawn of map.spawns) {
    const p = inside(at(spawn), dot + 1.5, w, h);
    ctx.beginPath();
    ctx.arc(p.x, p.y, dot, 0, Math.PI * 2);
    ctx.fillStyle = '#e8322a';
    ctx.fill();
    ctx.lineWidth = Math.max(1, dot * 0.38);
    ctx.strokeStyle = '#fff3dc';
    ctx.stroke();
  }
  const r = Math.max(4, unit * 0.1);
  const c = inside(at(map.camp), r + 1.5, w, h);
  starPath(ctx, c.x, c.y, r);
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1.5, r * 0.32);
  ctx.strokeStyle = 'rgba(70,35,5,0.9)';
  ctx.stroke();
  ctx.fillStyle = '#ffd23f';
  ctx.fill();
}
