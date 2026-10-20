// The 国潮青绿 look shared by the map painters: ink and the mineral pigments (石青, 石绿, 赭石, 朱砂) on warm paper,
// with soft washes, hand-drawn blobs, ink grass and a paper grain laid over everything. Everything here is seeded
// (hash01 / rng), so a map paints the same picture at every zoom level and on every device.
import { offscreen } from '../platform/env.ts';
import { hash01, roundRect } from './draw.ts';

/** Ink for outlines and strokes (a warm near-black, never pure black). */
export const INK = '#2b2420';
/** 石青: azurite blue, for water, bands and cool accents. */
export const AZURE = '#3d6a87';
/** 朱砂: cinnabar red, for seals, trim and the price strips. */
export const CINNABAR = '#b9362a';
/** Gold leaf, for the 法阵 and other precious trim. */
export const GILT = '#c9a04a';
/** Paper white, for strips and highlights. */
export const PAPER = '#f6ecd0';

/** Ink at opacity `a`. */
export function ink(a: number): string {
  return `rgba(43,36,32,${a})`;
}

/** A seeded random sequence in [0, 1) (mulberry32): the same seed always draws the same picture. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type BlobPts = Array<[number, number]>;

/**
 * Points around an ellipse at (x, y) with each radius jittered by up to ±j/2: the outline of a hand-drawn blob.
 * `rand` is a seeded sequence, so the same blob comes out every time.
 */
export function blobPts(x: number, y: number, rx: number, ry: number, rand: () => number, n = 10, j = 0.3): BlobPts {
  const pts: BlobPts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 - j / 2 + rand() * j;
    pts.push([x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k]);
  }
  return pts;
}

/** Traces a smooth closed curve through `pts` (quadratic curves between the midpoints), ready to fill or stroke. */
export function smoothPath(ctx: CanvasRenderingContext2D, pts: BlobPts): void {
  const n = pts.length;
  const mid = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = mid(pts[n - 1], pts[0]);
  ctx.beginPath();
  ctx.moveTo(start[0], start[1]);
  for (let i = 0; i < n; i++) {
    const q = mid(pts[i], pts[(i + 1) % n]);
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], q[0], q[1]);
  }
  ctx.closePath();
}

/** A soft round wash of colour `rgb` ("r,g,b"): opacity `a` at the centre, fading to nothing at radius `r`. */
export function wash(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rgb: string, a: number): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** The soft shadow a prop casts on the paper, an ellipse a little down and to the right of its foot. */
export function groundShadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, a = 0.22): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(40,28,18,${a})`;
  ctx.fill();
}

/** A tuft of ink grass: three to five thin curved blades rooted at (x, y), `s` scales their height. */
export function inkGrass(ctx: CanvasRenderingContext2D, x: number, y: number, rand: () => number, color: string, s = 1): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.1;
  ctx.lineCap = 'round';
  const n = 3 + Math.floor(rand() * 3);
  for (let j = 0; j < n; j++) {
    const dx = (j - n / 2) * 2.2;
    const h = (5 + rand() * 6) * s;
    const lean = (rand() - 0.5) * 5 * s;
    ctx.beginPath();
    ctx.moveTo(x + dx, y);
    ctx.quadraticCurveTo(x + dx + lean * 0.3, y - h * 0.6, x + dx + lean, y - h);
    ctx.stroke();
  }
}

/** Side of the square paper-grain tile, in world px. */
const GRAIN = 128;
let grainTile: HTMLCanvasElement | null = null;

/**
 * The paper grain tile: faint dark and light specks and a few short fibres on a transparent square.
 * Reason: specks drawn once into a small tile and stamped across the map with drawImage, instead of reading and
 * writing every pixel, which would cost a full-map pixel pass at each zoom level.
 */
function grain(): HTMLCanvasElement {
  if (grainTile) return grainTile;
  const { canvas, ctx } = offscreen(GRAIN, GRAIN);
  for (let i = 0; i < 2600; i++) {
    const x = Math.floor(hash01(i * 3 + 1) * GRAIN);
    const y = Math.floor(hash01(i * 5 + 2) * GRAIN);
    const dark = hash01(i * 7 + 3) < 0.62;
    const a = (dark ? 0.05 : 0.08) + hash01(i * 11 + 4) * 0.07;
    ctx.fillStyle = dark ? `rgba(70,48,24,${a.toFixed(3)})` : `rgba(255,251,240,${a.toFixed(3)})`;
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.lineWidth = 0.5;
  ctx.lineCap = 'round';
  for (let i = 0; i < 14; i++) {
    const x = hash01(i * 13 + 5) * GRAIN;
    const y = hash01(i * 17 + 6) * GRAIN;
    const a = hash01(i * 19 + 7) * Math.PI * 2;
    const len = 5 + hash01(i * 23 + 8) * 9;
    ctx.strokeStyle = 'rgba(110,86,56,0.09)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a + 0.7) * len * 0.5, y + Math.sin(a + 0.7) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  grainTile = canvas;
  return canvas;
}

/** Lays the paper grain over the area 0..w x 0..h (in the current transform's units). */
export function paperGrain(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const tile = grain();
  for (let y = 0; y < h; y += GRAIN) {
    for (let x = 0; x < w; x += GRAIN) ctx.drawImage(tile, x, y, GRAIN, GRAIN);
  }
}

/**
 * A bar in a groove with an ink rim (the HP bars over the monsters and the camp's in the HUD); `frac` 0..1 of it is
 * filled with `color`. The groove is paper unless `groove` says otherwise.
 */
export function inkBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, frac: number, color: string, groove = PAPER): void {
  const f = Math.max(0, Math.min(1, frac));
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = groove;
  ctx.fill();
  if (f > 0) {
    roundRect(ctx, x, y, Math.max(h, w * f), h, h / 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.lineWidth = 0.9;
  ctx.strokeStyle = INK;
  ctx.stroke();
}
