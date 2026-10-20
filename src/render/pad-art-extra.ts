// Painted looks of the four later pads, drawn into the map image like pad-art.ts's: 聚宝台 is a stone drum ringed in
// gold with square-holed coins set into its side; 烽火台 has a cinnabar band and a fire basket on a stone post beside
// it (lit by pad-marks.ts while a card stands on it); a pair of 双生台 wear red cords tied in a knot and are joined by
// a red cord across the ground; 灵泉 stands in a pool of clear water with three sockets for the pearls of its layers.
// Everything a card could cover is kept to the pad's sides, the ground round it, or the post beside it.
import type { Pt } from '../core/map.ts';
import { drum, PAD_SIDE, PAD_TILT, plainPad } from './pad-art.ts';
import { AZURE, blobPts, CINNABAR, GILT, ink, INK, rng, smoothPath, wash } from './ink.ts';

/** A square-holed coin (方孔钱) of radius `r`, gold with an ink rim. */
export function squareCoin(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = GILT;
  ctx.fill();
  ctx.lineWidth = 0.9;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.fillRect(x - r * 0.3, y - r * 0.3, r * 0.6, r * 0.6);
}

/** A gold ingot (元宝) sitting on the ground at (x, y): a boat with raised ends and a dome in the middle. */
function ingot(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.beginPath();
  ctx.moveTo(x - 8, y - 4);
  ctx.quadraticCurveTo(x - 6, y + 3, x, y + 3);
  ctx.quadraticCurveTo(x + 6, y + 3, x + 8, y - 4);
  ctx.quadraticCurveTo(x + 4, y - 1.5, x, y - 1.5);
  ctx.quadraticCurveTo(x - 4, y - 1.5, x - 8, y - 4);
  ctx.closePath();
  ctx.fillStyle = GILT;
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1.1;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y - 2, 3.4, Math.PI, 0);
  ctx.fillStyle = '#e8c56a';
  ctx.fill();
  ctx.stroke();
}

/**
 * 聚宝台: a warm gold wash under it, a plain drum with a gold rim on its top and three coins set into its side, and a
 * gold ingot with a few coins on the ground at its foot.
 */
export function cofferPad(ctx: CanvasRenderingContext2D, p: Pt, r: number, seed: number): void {
  wash(ctx, p.x, p.y + 4, r * 1.6, '230,186,80', 0.38);
  plainPad(ctx, p, r, seed);
  // On the ground to the right of the pad's foot, where no card stands.
  ingot(ctx, p.x + r + 4, p.y + PAD_SIDE + 3);
  squareCoin(ctx, p.x + r - 3, p.y + PAD_SIDE + 8, 2.6);
  squareCoin(ctx, p.x + r + 11, p.y + PAD_SIDE + 6, 2.4);
  const ry = r * PAD_TILT;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, r * 0.86, ry * 0.86, 0, 0, Math.PI * 2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = GILT;
  ctx.stroke();
  for (const a of [0.3, 0.5, 0.7]) {
    const x = p.x + Math.cos(Math.PI * a) * r * 0.92;
    const y = p.y + Math.sin(Math.PI * a) * ry * 0.92 + PAD_SIDE * 0.55;
    squareCoin(ctx, x, y, 3.2);
  }
}

/** Where the 烽火台's fire basket sits, relative to the pad's centre (beside the pad, clear of any card on it). */
export const BASKET: readonly [number, number] = [31, -13];

/** 烽火台: a plain drum with a cinnabar band round its side, and a fire basket of cold coals on a stone post beside it. */
export function beaconPad(ctx: CanvasRenderingContext2D, p: Pt, r: number, seed: number): void {
  plainPad(ctx, p, r, seed);
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + PAD_SIDE * 0.5, r, r * PAD_TILT, 0, 0.15, Math.PI - 0.15);
  ctx.lineWidth = 3;
  ctx.strokeStyle = CINNABAR;
  ctx.stroke();
  const bx = p.x + BASKET[0];
  const by = p.y + BASKET[1];
  // The post: a short stone pillar standing on the ground to the pad's right.
  drum(ctx, bx, by + 6, 4.5, 15, 0.2);
  // The basket: an iron bowl with three straps, cold coals heaped in it.
  ctx.beginPath();
  ctx.moveTo(bx - 7, by - 1);
  ctx.quadraticCurveTo(bx, by + 9, bx + 7, by - 1);
  ctx.closePath();
  ctx.fillStyle = '#3a3638';
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(bx, by - 1, 7, 2.4, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#5a4a40';
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = ink(0.75);
  for (const [dx, dy] of [
    [-3, -1.6],
    [0.5, -2.2],
    [3.4, -1.2],
  ] as const) {
    ctx.beginPath();
    ctx.arc(bx + dx, by + dy, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * The red cord between a pair of 双生台 at `a` and `b`: from the foot of one pad's side to the other's, sagging
 * towards the viewer. Returns the curve as start, control and end points (pad-marks.ts lights it up along the same curve).
 */
export function cordCurve(a: Pt, b: Pt, r: number): [Pt, Pt, Pt] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const foot = PAD_SIDE * 0.7;
  const s = { x: a.x + ux * r * 0.8, y: a.y + uy * r * PAD_TILT * 0.8 + foot };
  const e = { x: b.x - ux * r * 0.8, y: b.y - uy * r * PAD_TILT * 0.8 + foot };
  return [s, { x: (s.x + e.x) / 2, y: (s.y + e.y) / 2 + 9 }, e];
}

/** The red cord lying on the ground between a pair of 双生台 (painted under both pads). */
export function twinCord(ctx: CanvasRenderingContext2D, a: Pt, b: Pt, r: number): void {
  const [s, c, e] = cordCurve(a, b, r);
  ctx.beginPath();
  ctx.moveTo(s.x, s.y);
  ctx.quadraticCurveTo(c.x, c.y, e.x, e.y);
  ctx.lineCap = 'round';
  ctx.lineWidth = 3.4;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.lineWidth = 1.9;
  ctx.strokeStyle = CINNABAR;
  ctx.stroke();
}

/** A small diamond knot with a tassel (a 中国结), the sign of the 双生台. */
function knot(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y - 4);
  ctx.lineTo(x + 4, y);
  ctx.lineTo(x, y + 4);
  ctx.lineTo(x - 4, y);
  ctx.closePath();
  ctx.fillStyle = CINNABAR;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y + 4);
  ctx.lineTo(x - 1.2, y + 9);
  ctx.moveTo(x, y + 4);
  ctx.lineTo(x + 1.2, y + 9);
  ctx.lineWidth = 1.1;
  ctx.strokeStyle = CINNABAR;
  ctx.stroke();
}

/** 双生台: a plain drum with a red cord wound round its side and tied in a knot at the front. */
export function twinPad(ctx: CanvasRenderingContext2D, p: Pt, r: number, seed: number): void {
  plainPad(ctx, p, r, seed);
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + PAD_SIDE * 0.45, r, r * PAD_TILT, 0, 0.12, Math.PI - 0.12);
  ctx.lineWidth = 2;
  ctx.strokeStyle = CINNABAR;
  ctx.stroke();
  knot(ctx, p.x, p.y + r * PAD_TILT + PAD_SIDE * 0.45);
}

/** Where the pearl of 灵泉 layer `i` (0-based) sits on the front of the drum, relative to the pad's centre. */
export function pearlAt(i: number, r: number): [number, number] {
  const a = Math.PI * (0.35 + 0.15 * i);
  return [Math.cos(a) * r * 0.9, Math.sin(a) * r * PAD_TILT * 0.9 + PAD_SIDE * 0.55];
}

/** 灵泉: a pool of clear water with an ink shore and two lily leaves, the drum standing in it with three empty sockets. */
export function springPad(ctx: CanvasRenderingContext2D, p: Pt, r: number, seed: number): void {
  const rand = rng(seed * 613 + 11);
  const ry = r * PAD_TILT;
  smoothPath(ctx, blobPts(p.x, p.y + PAD_SIDE, r + 11, ry + 9, rand, 12, 0.14));
  const water = ctx.createRadialGradient(p.x - 6, p.y + PAD_SIDE - 3, 2, p.x, p.y + PAD_SIDE, r + 11);
  water.addColorStop(0, '#bfe3e6');
  water.addColorStop(1, '#5f9fb2');
  ctx.fillStyle = water;
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = INK;
  ctx.stroke();
  // Ripples round the drum's foot.
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  for (const k of [1.08, 1.24]) {
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + PAD_SIDE + 1, r * k, ry * k, 0, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  }
  for (const [dx, dy, s] of [
    [-r - 4, PAD_SIDE + 4, 1],
    [r + 3, PAD_SIDE - 2, 0.8],
  ] as const) {
    ctx.beginPath();
    ctx.ellipse(p.x + dx, p.y + dy, 5 * s, 3 * s, 0, 0.35, Math.PI * 2 - 0.1);
    ctx.lineTo(p.x + dx, p.y + dy);
    ctx.closePath();
    ctx.fillStyle = '#6f9a5a';
    ctx.fill();
    ctx.lineWidth = 0.9;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }
  drum(ctx, p.x, p.y, r, PAD_SIDE, 0, ['#e6efe8', '#b9cbc4'], ['#9fb5b0', '#6d837e']);
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, r * 0.74, ry * 0.74, 0, 0, Math.PI * 2);
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = AZURE;
  ctx.stroke();
  for (let i = 0; i < 3; i++) {
    const [x, y] = pearlAt(i, r);
    ctx.beginPath();
    ctx.arc(p.x + x, p.y + y, 2.3, 0, Math.PI * 2);
    ctx.fillStyle = ink(0.45);
    ctx.fill();
  }
}
