// The props of the 国潮青绿 maps, each an ink outline over flat mineral colours: boulders, trees and bushes, the
// flat-topped 平顶山 outcrops, glowing cracks, reeds, cobwebs, bones, stone lanterns, pebbles and blossoms.
// scenery.ts decides where they go; every function here draws one prop with its foot at (x, y).
import { blobPts, CINNABAR, groundShadow, ink, INK, PAPER, smoothPath, wash, type BlobPts } from './ink.ts';

/** A tree's canopy colours: shade, body and the lit top. */
export type Leaves = readonly [string, string, string];

/** Outlines every blob first, then fills them all, so the ink is left only on the outside of the group. */
function inkedGroup(ctx: CanvasRenderingContext2D, parts: BlobPts[], fills: readonly string[], lw: number): void {
  ctx.lineWidth = lw;
  ctx.strokeStyle = INK;
  ctx.lineJoin = 'round';
  for (const b of parts) {
    smoothPath(ctx, b);
    ctx.stroke();
  }
  parts.forEach((b, i) => {
    smoothPath(ctx, b);
    ctx.fillStyle = fills[i % fills.length];
    ctx.fill();
  });
}

/** Ink dots scattered over a canopy, the 点叶 that make a blob read as foliage. */
function leafDots(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, n: number, rand: () => number): void {
  ctx.fillStyle = ink(0.4);
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2;
    const d = rand() * r;
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7, r * 0.1, r * 0.06, a, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A boulder of blue-grey stone with a lit top facet, two hairline cracks and a smaller stone at its foot. */
export function boulder(ctx: CanvasRenderingContext2D, x: number, y: number, rand: () => number, s = 1): void {
  groundShadow(ctx, x + 4 * s, y + 3 * s, 24 * s, 6 * s, 0.2);
  const body = blobPts(x, y - 8 * s, 20 * s, 13 * s, rand, 8, 0.35);
  smoothPath(ctx, body);
  ctx.fillStyle = '#8a9ea8';
  ctx.fill();
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.save();
  smoothPath(ctx, body);
  ctx.clip();
  smoothPath(ctx, blobPts(x - 6 * s, y - 14 * s, 14 * s, 8 * s, rand, 8, 0.3));
  ctx.fillStyle = '#bccacf';
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(x - 6 * s, y - 10 * s);
  ctx.quadraticCurveTo(x - s, y - 4 * s, x + 5 * s, y - 3 * s);
  ctx.moveTo(x + 8 * s, y - 14 * s);
  ctx.quadraticCurveTo(x + 11 * s, y - 9 * s, x + 14 * s, y - 8 * s);
  ctx.lineWidth = 1.1;
  ctx.strokeStyle = ink(0.75);
  ctx.stroke();
  smoothPath(ctx, blobPts(x + 19 * s, y - 3 * s, 8 * s, 6 * s, rand, 7, 0.3));
  ctx.fillStyle = '#7b909a';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

/** A broad-leaved tree: an ink-drawn trunk under four overlapping canopy blobs, lit from the top left. */
export function tree(ctx: CanvasRenderingContext2D, x: number, y: number, rand: () => number, leaves: Leaves, s = 1): void {
  groundShadow(ctx, x + 6 * s, y + 3 * s, 20 * s, 6 * s, 0.22);
  ctx.beginPath();
  ctx.moveTo(x - 3 * s, y);
  ctx.quadraticCurveTo(x - 2 * s, y - 12 * s, x - 5 * s, y - 22 * s);
  ctx.lineTo(x + 3 * s, y - 22 * s);
  ctx.quadraticCurveTo(x + 2 * s, y - 10 * s, x + 4 * s, y);
  ctx.closePath();
  ctx.fillStyle = '#7a5a40';
  ctx.fill();
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = INK;
  ctx.stroke();
  const parts = (
    [
      [0, -34, 18, 14],
      [-11, -27, 12, 10],
      [11, -26, 13, 10],
      [2, -45, 12, 10],
    ] as const
  ).map(([dx, dy, rx, ry]) => blobPts(x + dx * s, y + dy * s, rx * s, ry * s, rand, 9, 0.25));
  inkedGroup(ctx, parts, [leaves[0], leaves[1], leaves[0], leaves[2]], 2.6);
  smoothPath(ctx, blobPts(x - 4 * s, y - 42 * s, 9 * s, 6 * s, rand, 8, 0.3));
  ctx.fillStyle = 'rgba(255,248,225,0.28)';
  ctx.fill();
  leafDots(ctx, x, y - 32 * s, 16 * s, 14, rand);
}

/** A low bush: three canopy blobs. */
export function bush(ctx: CanvasRenderingContext2D, x: number, y: number, rand: () => number, leaves: Leaves): void {
  groundShadow(ctx, x + 2, y + 6, 13, 4, 0.2);
  const parts = (
    [
      [-6, 1, 7, 6],
      [5, 0, 7, 6],
      [0, -4, 7, 6],
    ] as const
  ).map(([dx, dy, rx, ry]) => blobPts(x + dx, y + dy, rx, ry, rand, 8, 0.25));
  inkedGroup(ctx, parts, [leaves[1], leaves[1], leaves[2]], 2.2);
  leafDots(ctx, x, y - 1, 9, 6, rand);
}

/** The 平顶山 outcrop in unit coordinates: the front rim of its top, its foot, and the back rim. */
const BUTTE = {
  front: [[-54, -26], [-44, -33], [-24, -35], [-6, -33], [14, -36], [34, -34], [52, -27]],
  foot: [[58, 0], [34, 3], [4, 2], [-26, 3], [-58, 0]],
  back: [[-46, -36], [-30, -42], [-8, -44], [16, -44], [38, -40], [50, -30]],
} as const;

function trace(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, pts: ReadonlyArray<readonly [number, number]>, from: 'move' | 'line'): void {
  pts.forEach(([px, py], i) => (i === 0 && from === 'move' ? ctx.moveTo(x + px * s, y + py * s) : ctx.lineTo(x + px * s, y + py * s)));
}

/**
 * A flat-topped sandstone outcrop: an ochre cliff banded with strata, its right side in shade, a grassy top and
 * loose stones at the foot. Reason: the bands run across, never up and down, so a small one can't read as planks.
 */
export function butte(ctx: CanvasRenderingContext2D, x: number, y: number, rand: () => number, s = 1): void {
  groundShadow(ctx, x + 8 * s, y + 3 * s, 66 * s, 9 * s, 0.22);
  const face = (): void => {
    ctx.beginPath();
    trace(ctx, x, y, s, BUTTE.front, 'move');
    trace(ctx, x, y, s, BUTTE.foot, 'line');
    ctx.closePath();
  };
  face();
  const g = ctx.createLinearGradient(0, y - 36 * s, 0, y);
  g.addColorStop(0, '#d4a46c');
  g.addColorStop(1, '#a8774a');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  face();
  ctx.clip();
  ctx.fillStyle = 'rgba(110,64,32,0.26)';
  ctx.beginPath();
  ctx.moveTo(x + 16 * s, y - 40 * s);
  ctx.lineTo(x + 66 * s, y - 40 * s);
  ctx.lineTo(x + 66 * s, y + 6 * s);
  ctx.lineTo(x + 26 * s, y + 6 * s);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 1.1;
  ctx.strokeStyle = ink(0.38);
  for (const band of [-24, -14]) {
    ctx.beginPath();
    for (let t = 0; t <= 12; t++) {
      const bx = x + (-58 + t * 10) * s;
      const by = y + (band + Math.sin(t * 1.3 + band) * 1.4) * s;
      if (t === 0) ctx.moveTo(bx, by);
      else ctx.lineTo(bx, by);
    }
    ctx.stroke();
  }
  ctx.restore();
  face();
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.beginPath();
  trace(ctx, x, y, s, BUTTE.front, 'move');
  trace(ctx, x, y, s, [...BUTTE.back].reverse(), 'line');
  ctx.closePath();
  ctx.fillStyle = '#c3c38c';
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(98,150,110,0.6)';
  smoothPath(ctx, blobPts(x - 14 * s, y - 39 * s, 16 * s, 3 * s, rand, 9, 0.3));
  ctx.fill();
  smoothPath(ctx, blobPts(x + 20 * s, y - 39 * s, 11 * s, 2.4 * s, rand, 9, 0.3));
  ctx.fill();
  for (const [dx, dy, r] of [
    [-50, 1, 7],
    [60, 0, 6],
    [-30, 5, 4],
  ] as const) {
    smoothPath(ctx, blobPts(x + dx * s, y + (dy - r * 0.5) * s, r * s, r * 0.7 * s, rand, 7, 0.3));
    ctx.fillStyle = '#9aa7a8';
    ctx.fill();
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }
}

/** Glowing cracks in scorched ground, for the fire maps: ink fissures lined with ember light. */
export function ember(ctx: CanvasRenderingContext2D, x: number, y: number, rand: () => number): void {
  wash(ctx, x, y, 12, '255,140,60', 0.4);
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const a = rand() * Math.PI * 2;
    const len = 8 + rand() * 10;
    const ex = x + Math.cos(a) * len;
    const ey = y + Math.sin(a) * len * 0.6;
    const mx = (x + ex) / 2 + (rand() - 0.5) * 5;
    const my = (y + ey) / 2 + (rand() - 0.5) * 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(mx, my, ex, ey);
    ctx.lineWidth = 2;
    ctx.strokeStyle = ink(0.75);
    ctx.stroke();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = 'rgba(255,190,90,0.95)';
    ctx.stroke();
  }
}

/** A clump of reeds: thin ink stems with ochre cattail heads; `lean` tips them sideways. */
export function reeds(ctx: CanvasRenderingContext2D, x: number, y: number, rand: () => number, lean = 0.6): void {
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const dx = (i - 1.5) * 3.6;
    const h = 13 + rand() * 8;
    const tx = x + dx + lean * (2 + i);
    const ty = y - h;
    ctx.beginPath();
    ctx.moveTo(x + dx, y);
    ctx.quadraticCurveTo(x + dx + lean, y - h * 0.5, tx, ty);
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = 'rgba(52,84,62,0.9)';
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(tx, ty, 1.7, 3.8, lean * 0.12, 0, Math.PI * 2);
    ctx.fillStyle = '#8a5a2e';
    ctx.fill();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }
}

/** A cobweb drawn in thin ink: six spokes and three sagging rings. */
export function cobweb(ctx: CanvasRenderingContext2D, x: number, y: number, rand: () => number): void {
  const r = 14 + rand() * 6;
  ctx.strokeStyle = ink(0.3);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.75);
  }
  for (let k = 1; k <= 3; k++) {
    const rk = (r * k) / 3.2;
    for (let i = 0; i < 6; i++) {
      const a0 = (i / 6) * Math.PI * 2;
      const a1 = ((i + 1) / 6) * Math.PI * 2;
      const am = (a0 + a1) / 2;
      // Reason: each thread sags toward the centre between two spokes, which reads as silk rather than a target.
      ctx.moveTo(x + Math.cos(a0) * rk, y + Math.sin(a0) * rk * 0.75);
      ctx.quadraticCurveTo(x + Math.cos(am) * rk * 0.82, y + Math.sin(am) * rk * 0.62, x + Math.cos(a1) * rk, y + Math.sin(a1) * rk * 0.75);
    }
  }
  ctx.stroke();
}

/** An old bone lying in the dust: an inked shaft with two knobs at each end. */
export function bone(ctx: CanvasRenderingContext2D, x: number, y: number, rand: () => number): void {
  const a = rand() * Math.PI;
  const dx = Math.cos(a) * 9;
  const dy = Math.sin(a) * 5;
  const knobs: Array<[number, number]> = [];
  for (const end of [-1, 1]) {
    for (const t of [-1, 1]) knobs.push([x + end * dx - t * dy * 0.45, y + end * dy + t * dx * 0.28]);
  }
  ctx.lineCap = 'round';
  // Ink first, a little wider, then the bone on top, so only the outline stays.
  for (const [w, color] of [
    [6.4, INK],
    [4, '#f2ead8'],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(x - dx, y - dy);
    ctx.lineTo(x + dx, y + dy);
    ctx.lineWidth = w;
    ctx.strokeStyle = color;
    ctx.stroke();
    for (const [kx, ky] of knobs) {
      ctx.beginPath();
      ctx.arc(kx, ky, w === 4 ? 2.6 : 3.8, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
  }
}

/** A stone lantern: a stepped base, a post, a lit window under a curved roof. */
export function lantern(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  groundShadow(ctx, x + 2, y + 1, 10, 3.5, 0.22);
  wash(ctx, x, y - 14, 14, '255,200,110', 0.35);
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = INK;
  ctx.fillStyle = '#a9b1ad';
  ctx.fillRect(x - 7, y - 4, 14, 4);
  ctx.strokeRect(x - 7, y - 4, 14, 4);
  ctx.fillStyle = '#98a19c';
  ctx.fillRect(x - 3, y - 12, 6, 8);
  ctx.strokeRect(x - 3, y - 12, 6, 8);
  ctx.fillStyle = '#b8bfba';
  ctx.fillRect(x - 6, y - 20, 12, 8);
  ctx.strokeRect(x - 6, y - 20, 12, 8);
  ctx.fillStyle = 'rgba(255,206,110,0.95)';
  ctx.fillRect(x - 3.5, y - 18.5, 7, 5);
  ctx.beginPath();
  ctx.moveTo(x - 10, y - 20);
  ctx.quadraticCurveTo(x - 4, y - 22, x, y - 28);
  ctx.quadraticCurveTo(x + 4, y - 22, x + 10, y - 20);
  ctx.closePath();
  ctx.fillStyle = '#6f7975';
  ctx.fill();
  ctx.stroke();
}

/** Two or three small inked pebbles. */
export function pebbles(ctx: CanvasRenderingContext2D, x: number, y: number, rand: () => number): void {
  const n = 2 + Math.floor(rand() * 2);
  for (let i = 0; i < n; i++) {
    const px = x + (rand() - 0.5) * 16;
    const py = y + (rand() - 0.5) * 10;
    ctx.beginPath();
    ctx.ellipse(px, py, 2.4 + rand(), 1.7 + rand() * 0.6, rand() * 2, 0, Math.PI * 2);
    ctx.fillStyle = i % 2 ? '#a7b0b0' : '#8d989a';
    ctx.fill();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = ink(0.75);
    ctx.stroke();
  }
}

/** A few tiny five-petal blossoms in cinnabar and paper white, each with an ink heart. */
export function blossoms(ctx: CanvasRenderingContext2D, x: number, y: number, rand: () => number): void {
  for (let i = 0; i < 3; i++) {
    const fx = x + (rand() - 0.5) * 16;
    const fy = y + (rand() - 0.5) * 12;
    ctx.fillStyle = rand() < 0.5 ? CINNABAR : PAPER;
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + i;
      ctx.beginPath();
      ctx.arc(fx + Math.cos(a) * 1.6, fy + Math.sin(a) * 1.3, 1.25, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(fx, fy, 0.8, 0, Math.PI * 2);
    ctx.fillStyle = INK;
    ctx.fill();
  }
}
