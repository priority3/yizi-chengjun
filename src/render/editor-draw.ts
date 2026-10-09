// The map editor's drawings in world space (plan.md D1): each legend character as a flat swatch (the raw squares of a
// draft, and the palette's brushes), the square grid, and the marks over the painted map — locked pads, the turning
// rune rings of open 法阵, entrance numbers, the five best-covering pads and the squares an error is about. The painted
// map itself is paintMap's, exactly as a run paints it, cached per layout by PaintedMap.
import { PAD_LETTERS, SLOT_NAME, TILE, type MapTheme, type SlotKind } from '../config/maps.ts';
import type { MapData } from '../core/map.ts';
import { offscreen } from '../platform/env.ts';
import { roundRect, text } from './draw.ts';
import { sans } from './fonts.ts';
import { paintMap, PAD_R } from './map-art.ts';
import { starPath } from './rating-art.ts';
import { THEMES } from './scenery.ts';
import { drawRuneRings, PAD_TAG_COLOR } from './slot-marks.ts';

/** A square of the grid (column, row). */
export interface Square {
  c: number;
  r: number;
}

/** Fill of a pad swatch's top face, by kind. */
const PAD_FACE: Readonly<Record<SlotKind, [string, string]>> = {
  plain: ['#e4d2ac', '#b59a6c'],
  altar: ['#f1dca6', '#c9a660'],
  high: ['#e4d2ac', '#b59a6c'],
  mire: ['#7a6a44', '#4f4428'],
};

/**
 * One legend character as a flat swatch filling the square at (x, y) with side `s`, in the colours of `theme`.
 * Plain ground (and anything unknown) is just the ground colour.
 */
export function drawSwatch(ctx: CanvasRenderingContext2D, ch: string, x: number, y: number, s: number, theme: MapTheme): void {
  const pal = THEMES[theme];
  const cx = x + s / 2;
  const cy = y + s / 2;
  ctx.fillStyle = pal.ground[0];
  ctx.fillRect(x, y, s, s);
  if (ch === '#') {
    ctx.fillStyle = pal.road;
    ctx.fillRect(x, y, s, s);
    ctx.fillStyle = 'rgba(255,240,210,0.16)';
    ctx.fillRect(x + s * 0.3, y + s * 0.3, s * 0.4, s * 0.4);
  } else if (Object.hasOwn(PAD_LETTERS, ch)) {
    padSwatch(ctx, ch, cx, cy, s);
  } else if (ch >= '1' && ch <= '4') {
    ctx.beginPath();
    ctx.ellipse(cx, cy + s * 0.04, s * 0.42, s * 0.34, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#6a6058';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx, cy + s * 0.08, s * 0.3, s * 0.24, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#1e1410';
    ctx.fill();
    text(ctx, ch, cx, cy + s * 0.07, sans(Math.round(s * 0.4), 800), '#ff9a7a');
  } else if (ch === 'E') {
    starPath(ctx, cx, cy, s * 0.4);
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1, s * 0.06);
    ctx.strokeStyle = 'rgba(70,35,5,0.9)';
    ctx.stroke();
    ctx.fillStyle = '#ffd23f';
    ctx.fill();
  } else if (ch === '~') {
    const g = ctx.createLinearGradient(x, y, x, y + s);
    g.addColorStop(0, pal.liquid[0]);
    g.addColorStop(1, pal.liquid[1]);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, s, s);
    ctx.strokeStyle = pal.lava ? 'rgba(255,240,160,0.6)' : 'rgba(255,255,255,0.55)';
    ctx.lineWidth = Math.max(1, s * 0.04);
    for (const k of [0.38, 0.68]) {
      ctx.beginPath();
      ctx.moveTo(x + s * 0.15, y + s * k);
      ctx.quadraticCurveTo(cx, y + s * (k - 0.1), x + s * 0.85, y + s * k);
      ctx.stroke();
    }
  } else if (ch === '^') {
    for (const [dx, dy, r, col] of [
      [-0.12, 0.06, 0.26, '#8c8478'],
      [0.16, 0.1, 0.2, '#7a7266'],
      [0.04, -0.12, 0.18, '#a39a8c'],
    ] as const) {
      ctx.beginPath();
      ctx.ellipse(cx + dx * s, cy + dy * s, r * s, r * s * 0.85, 0, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.lineWidth = Math.max(1, s * 0.03);
      ctx.strokeStyle = '#4a4238';
      ctx.stroke();
    }
  } else if (ch === 'T') {
    ctx.fillStyle = '#6b4a2a';
    ctx.fillRect(cx - s * 0.05, cy, s * 0.1, s * 0.36);
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.08, s * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = '#5f9c48';
    ctx.fill();
    ctx.lineWidth = Math.max(1, s * 0.03);
    ctx.strokeStyle = '#2f5a24';
    ctx.stroke();
  }
}

/** A pad as a disc of its kind with its letter on it; a pad bought with 铜钱 (lower case) is darkened. */
function padSwatch(ctx: CanvasRenderingContext2D, ch: string, cx: number, cy: number, s: number): void {
  const { kind, open } = PAD_LETTERS[ch];
  const r = s * 0.38;
  // A 高台 stands taller: its stone side shows under the top face.
  if (kind === 'high') {
    ctx.beginPath();
    ctx.arc(cx, cy + s * 0.1, r, 0, Math.PI * 2);
    ctx.fillStyle = '#7d6440';
    ctx.fill();
  }
  const face = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.15, cx, cy, r);
  face.addColorStop(0, PAD_FACE[kind][0]);
  face.addColorStop(1, PAD_FACE[kind][1]);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = face;
  ctx.fill();
  ctx.lineWidth = Math.max(1, s * 0.04);
  ctx.strokeStyle = kind === 'altar' ? '#c8901c' : kind === 'mire' ? '#3a3220' : '#7a5a30';
  ctx.stroke();
  if (kind === 'altar') {
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2);
    ctx.setLineDash([s * 0.08, s * 0.05]);
    ctx.strokeStyle = 'rgba(200,140,20,0.85)';
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (!open) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(45,28,12,0.55)';
    ctx.fill();
  }
  const ink = !open ? '#ffe9b0' : kind === 'mire' ? '#e8f2c8' : '#3b2a1e';
  text(ctx, ch, cx, cy + s * 0.02, sans(Math.round(s * 0.36), 800), ink);
}

/** Every square of the draft's rows as its swatch, in world units; with `only`, just the squares it picks. */
export function drawRawGrid(ctx: CanvasRenderingContext2D, rows: readonly string[], theme: MapTheme, only?: (c: number, r: number) => boolean): void {
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) if (!only || only(c, r)) drawSwatch(ctx, row[c], c * TILE, r * TILE, TILE, theme);
  });
}

/** Thin lines between the squares and a firmer edge round the map; `k` = 1 / zoom keeps them a screen pixel wide. */
export function drawGridLines(ctx: CanvasRenderingContext2D, cols: number, rows: number, k: number): void {
  const w = cols * TILE;
  const h = rows * TILE;
  ctx.beginPath();
  for (let c = 1; c < cols; c++) {
    ctx.moveTo(c * TILE, 0);
    ctx.lineTo(c * TILE, h);
  }
  for (let r = 1; r < rows; r++) {
    ctx.moveTo(0, r * TILE);
    ctx.lineTo(w, r * TILE);
  }
  ctx.lineWidth = k;
  ctx.strokeStyle = 'rgba(40,25,10,0.22)';
  ctx.stroke();
  ctx.lineWidth = 2 * k;
  ctx.strokeStyle = 'rgba(255,230,180,0.5)';
  ctx.strokeRect(0, 0, w, h);
}

/**
 * The live marks a run draws over its pads, minus the prices: the turning rune ring on every open 法阵, and each pad
 * bought with 铜钱 darkened with its "+" (or, for a special pad, its name). `time` turns the rings.
 */
export function drawPadMarks(ctx: CanvasRenderingContext2D, map: MapData, time: number, k: number): void {
  drawRuneRings(ctx, { map, unlocked: map.open }, PAD_R + 4, time);
  map.slots.forEach((p, i) => {
    if (map.open[i]) return;
    ctx.beginPath();
    ctx.arc(p.x, p.y, PAD_R - 1, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(45,28,12,0.6)';
    ctx.fill();
    const kind = map.slotKind[i];
    if (kind === 'plain') text(ctx, '+', p.x, p.y, sans(Math.round(18 * k), 800), PAD_TAG_COLOR.plain);
    else text(ctx, SLOT_NAME[kind], p.x, p.y, sans(Math.round(10 * k), 800), PAD_TAG_COLOR[kind]);
  });
}

/** Each entrance's number on its cave's shoulder, so the road lengths in the top bar can be told apart. */
export function drawEntranceTags(ctx: CanvasRenderingContext2D, gates: ReadonlyArray<Square & { n: string }>, k: number): void {
  for (const g of gates) {
    const x = g.c * TILE + TILE * 0.82;
    const y = g.r * TILE + TILE * 0.18;
    ctx.beginPath();
    ctx.arc(x, y, 8 * k, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(28,14,6,0.9)';
    ctx.fill();
    ctx.lineWidth = 1.5 * k;
    ctx.strokeStyle = '#ff9a7a';
    ctx.stroke();
    text(ctx, g.n, x, y + 0.5 * k, sans(Math.round(11 * k), 800), '#ffd0c0');
  }
}

/**
 * Gold rings round the pads that cover the most road (best first), each with its rank on a gold badge and the share of
 * all road it covers underneath. `time` makes the rings breathe.
 */
export function drawBestPads(ctx: CanvasRenderingContext2D, map: MapData, best: ReadonlyArray<{ slot: number; cover: number }>, time: number, k: number): void {
  best.forEach((b, rank) => {
    const p = map.slots[b.slot];
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, PAD_R + 5, 0, Math.PI * 2);
    ctx.lineWidth = 3 * k;
    ctx.strokeStyle = '#ffd166';
    ctx.shadowColor = 'rgba(255,200,60,0.9)';
    ctx.shadowBlur = (8 + Math.sin(time * 3 + rank) * 3) * k;
    ctx.stroke();
    ctx.restore();
    const bx = p.x + PAD_R * 0.78;
    const by = p.y - PAD_R * 0.78;
    ctx.beginPath();
    ctx.arc(bx, by, 8 * k, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd166';
    ctx.fill();
    ctx.lineWidth = 1.5 * k;
    ctx.strokeStyle = '#6a3a08';
    ctx.stroke();
    text(ctx, String(rank + 1), bx, by + 0.5 * k, sans(Math.round(11 * k), 800), '#4a2204');
    const label = `${Math.round(b.cover * 100)}%`;
    const font = sans(Math.round(9 * k), 800);
    ctx.font = font;
    const w = ctx.measureText(label).width + 8 * k;
    const ly = p.y + PAD_R + 8 * k;
    roundRect(ctx, p.x - w / 2, ly - 7 * k, w, 14 * k, 7 * k);
    ctx.fillStyle = 'rgba(28,14,6,0.85)';
    ctx.fill();
    text(ctx, label, p.x, ly + 0.5 * k, font, '#ffe9a8');
  });
}

/** Pulsing red frames round the squares an error is about (a stuck entrance, the camp). */
export function drawFaults(ctx: CanvasRenderingContext2D, faults: readonly Square[], time: number, k: number): void {
  if (faults.length === 0) return;
  ctx.save();
  ctx.lineWidth = (3 + Math.sin(time * 6)) * k;
  ctx.strokeStyle = '#ff4a3a';
  for (const f of faults) ctx.strokeRect(f.c * TILE + 2 * k, f.r * TILE + 2 * k, TILE - 4 * k, TILE - 4 * k);
  ctx.restore();
}

/** Most backing-store pixels one painted map may take (about 12 MB): a big map at a high zoom paints a little softer. */
const PIXEL_BUDGET = 3_000_000;
/** Resolutions of the current layout kept at once, so a pinch back and forth doesn't repaint. */
const KEEP_RES = 2;

/**
 * The map being edited, painted by paintMap exactly as a run paints it, into offscreen canvases kept for the current
 * layout only (at most KEEP_RES resolutions). Reason: not mapImage, which keeps three resolutions of every map at up
 * to 3x — tens of megabytes for an editor map that is replaced on every edit.
 */
export class PaintedMap {
  private map: MapData | null = null;
  private readonly byRes = new Map<number, HTMLCanvasElement>();

  /** Draws `map` at (0, 0) in world units, painting it first if this layout or resolution is new. */
  draw(ctx: CanvasRenderingContext2D, map: MapData, zoom: number, pixelRatio: number): void {
    if (map !== this.map) {
      this.map = map;
      this.byRes.clear();
    }
    // Quarter zoom steps, like mapImage, so a pinch doesn't repaint every frame.
    const want = pixelRatio * Math.min(1.5, Math.max(0.5, Math.round(zoom * 4) / 4));
    const res = Math.round(Math.min(want, Math.sqrt(PIXEL_BUDGET / (map.w * map.h))) * 100) / 100;
    let img = this.byRes.get(res);
    if (!img) {
      const { canvas, ctx: g } = offscreen(Math.ceil(map.w * res), Math.ceil(map.h * res));
      img = canvas;
      g.setTransform(res, 0, 0, res, 0, 0);
      paintMap(g, map);
      if (this.byRes.size >= KEEP_RES) this.byRes.delete(this.byRes.keys().next().value as number);
      this.byRes.set(res, img);
    }
    ctx.drawImage(img, 0, 0, map.w, map.h);
  }
}
