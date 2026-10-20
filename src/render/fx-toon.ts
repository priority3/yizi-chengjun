// The bright cartoon effects (明快卡通) laid over the 国潮 map: a white star popping where a blow lands, a puffy
// explosion for a fireball or a boss's fall, and a puff of smoke with three little stars where a monster is beaten.
// Every shape is outlined in ink, like the monsters and the troops. Pure functions of an effect and its progress k (0..1).
import type { Fx } from './fx-draw.ts';
import { INK } from './ink.ts';

/** A star of `n` points, outer radius `r` and inner radius `r * inner`, filled and outlined in ink `w` wide. */
export function inkStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, n: number, inner: number, fill: string, w: number, rot = -Math.PI / 2): void {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i * Math.PI) / n;
    const rr = i % 2 === 0 ? r : r * inner;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.lineWidth = w;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

/**
 * Circles merged into one outlined cloud: every circle is filled and stroked, then filled again a little smaller,
 * which paints over the strokes inside the cloud and leaves only its outer edge.
 */
function cloud(ctx: CanvasRenderingContext2D, pts: ReadonlyArray<readonly [number, number, number]>, fill: string, w: number): void {
  ctx.fillStyle = fill;
  ctx.strokeStyle = INK;
  // Reason: the outline thins with a shrinking puff, so a dwindling cloud never turns into a cluster of ink dots.
  for (const [x, y, r] of pts) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = Math.min(w, r * 0.3);
    ctx.stroke();
  }
  for (const [x, y, r] of pts) {
    ctx.beginPath();
    ctx.arc(x, y, r - Math.min(w, r * 0.3) * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** 'pow': the hit star, popping to full size in its first third, then fading; each one turned a little differently. */
export function drawPow(ctx: CanvasRenderingContext2D, f: Fx, k: number): void {
  const grow = k < 0.3 ? 0.5 + (k / 0.3) * 0.5 : 1;
  ctx.globalAlpha = k < 0.5 ? 1 : 1 - (k - 0.5) / 0.5;
  inkStar(ctx, f.x, f.y, f.size * grow, 8, 0.42, '#fff7d6', 1.6, f.seed * 0.7);
}

/**
 * 'boom': a ring of puffs in `color` round a yellow core with a white glint; it swells fast, holds, then shrinks away.
 * Reason: it shrinks instead of fading — a see-through cloud would show the outline of every puff inside it.
 */
export function drawBoom(ctx: CanvasRenderingContext2D, f: Fx, k: number): void {
  const r = f.size * (k < 0.25 ? 0.6 + (k / 0.25) * 0.45 : k < 0.55 ? 1.05 : 1.05 * (1 - (k - 0.55) / 0.45));
  if (r < 0.5) return;
  const pts: Array<[number, number, number]> = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + f.seed;
    pts.push([f.x + Math.cos(a) * r * 0.55, f.y + Math.sin(a) * r * 0.42, r * 0.45]);
  }
  cloud(ctx, pts, f.color, Math.max(1.4, f.size * 0.06));
  ctx.beginPath();
  ctx.arc(f.x, f.y, r * 0.48, 0, Math.PI * 2);
  ctx.fillStyle = '#ffe066';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(f.x - r * 0.12, f.y - r * 0.12, r * 0.2, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
}

const PUFFS = [
  [-7, 2, 8],
  [6, 0, 9],
  [0, -7, 8],
  [-1, 5, 7],
] as const;

/**
 * 'poof': a beaten monster vanishes in a puff of smoke that swells, then breaks up into shrinking puffs drifting apart,
 * while three little yellow stars fly up and out of it, fading. `size` is 10 for a 小妖.
 */
export function drawPoof(ctx: CanvasRenderingContext2D, f: Fx, k: number): void {
  const s = f.size / 10;
  const grow = (0.75 + 0.45 * Math.min(1, k / 0.3)) * s;
  const late = Math.max(0, (k - 0.45) / 0.55);
  const spread = grow * (1 + 0.7 * late);
  const shrink = grow * (1 - late);
  if (shrink > 0.05) {
    cloud(
      ctx,
      PUFFS.map(([dx, dy, r]) => [f.x + dx * spread, f.y + dy * spread, r * shrink] as const),
      '#f4f1ea',
      1.8,
    );
  }
  ctx.globalAlpha = 1 - late;
  for (let i = 0; i < 3; i++) {
    const sx = f.x + (i - 1) * 14 * s * (0.7 + 0.6 * k);
    const sy = f.y - (14 + (i % 2) * 6 + 16 * k) * s;
    inkStar(ctx, sx, sy, 3.8 * s, 5, 0.45, '#ffd65a', 1, -Math.PI / 2 + (i - 1) * k * 1.6);
  }
}
