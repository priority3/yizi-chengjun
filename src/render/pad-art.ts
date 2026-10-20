// Painted looks of the build pads (石台), drawn into the map image by map-art.ts's pad(): a stone drum seen from above
// at an angle, its top face an ellipse centred on the slot, outlined in ink like the rest of the 国潮青绿 map.
// 高台 is much taller and stands on a wider base ring with a 石青 band, 法阵 has gold and cinnabar rings cut into its
// top, 泥沼 is a pool of mud with reeds instead of stone. A card covers the top face, so each look keeps something
// showing below the card: the drum's side, the base ring, the reeds.
import type { Pt } from '../core/map.ts';
import { hash01 } from './draw.ts';
import { AZURE, blobPts, CINNABAR, GILT, ink, INK, rng, smoothPath, wash } from './ink.ts';
import { reeds } from './scenery-props.ts';

/** How flat the pads' top faces look: their height over their width. */
export const PAD_TILT = 0.62;
/** Height of a plain pad's side below its top face. */
export const PAD_SIDE = 10;
/** How much taller a 高台's drum is than a plain pad's. */
const HIGH_EXTRA = 6;
/** Height of the base ring a 高台 stands on. */
const HIGH_BASE = 6;

type Shades = readonly [string, string];
const STONE_TOP: Shades = ['#ede2cb', '#c6b796'];
const STONE_SIDE: Shades = ['#ab9b7d', '#776a55'];

/**
 * A stone drum at (x, y), radius `r`: its side of height `h` below the top face, then the top face, both outlined in
 * ink. `shadow` is the opacity of the shadow it casts (0 for none). The camp's platform is one too (map-art.ts).
 */
export function drum(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, h: number, shadow: number, top = STONE_TOP, side = STONE_SIDE): void {
  const ry = r * PAD_TILT;
  if (shadow > 0) {
    ctx.beginPath();
    ctx.ellipse(x + 4, y + h + 4, r + 5, ry + 4, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(40,28,18,${shadow})`;
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(x - r, y);
  ctx.lineTo(x - r, y + h);
  ctx.ellipse(x, y + h, r, ry, 0, Math.PI, 0, true);
  ctx.lineTo(x + r, y);
  ctx.closePath();
  const g = ctx.createLinearGradient(x - r, 0, x + r, 0);
  g.addColorStop(0, side[0]);
  g.addColorStop(1, side[1]);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x, y, r, ry, 0, 0, Math.PI * 2);
  const t = ctx.createRadialGradient(x - r * 0.35, y - ry * 0.5, 1, x, y, r * 1.05);
  t.addColorStop(0, top[0]);
  t.addColorStop(1, top[1]);
  ctx.fillStyle = t;
  ctx.fill();
  ctx.stroke();
}

/** A few masonry joints down the front of a drum's side (only the front half shows). */
function joints(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, h: number, seed: number): void {
  ctx.lineWidth = 0.9;
  ctx.strokeStyle = ink(0.4);
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = Math.PI * (0.25 + 0.25 * i) + (hash01(seed * 5 + i) - 0.5) * 0.25;
    const jx = x + Math.cos(a) * r;
    const jy = y + Math.sin(a) * r * PAD_TILT;
    ctx.moveTo(jx, jy + 1);
    ctx.lineTo(jx, jy + h - 1);
  }
  ctx.stroke();
}

/** A plain 石台: a drum of pale stone with an inner ring and a hairline crack cut into its top. */
export function plainPad(ctx: CanvasRenderingContext2D, p: Pt, r: number, seed: number): void {
  drum(ctx, p.x, p.y, r, PAD_SIDE, 0.24);
  joints(ctx, p.x, p.y, r, PAD_SIDE, seed);
  const ry = r * PAD_TILT;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, r * 0.74, ry * 0.74, 0, 0, Math.PI * 2);
  ctx.lineWidth = 0.9;
  ctx.strokeStyle = ink(0.4);
  ctx.stroke();
  ctx.fillStyle = ink(0.22);
  for (let i = 0; i < 7; i++) {
    const sa = hash01(seed * 13 + i) * Math.PI * 2;
    const sd = 0.2 + hash01(seed * 17 + i) * 0.7;
    ctx.fillRect(p.x + Math.cos(sa) * r * sd, p.y + Math.sin(sa) * ry * sd, 1.2, 1.2);
  }
  const a = hash01(seed * 7 + 3) * Math.PI * 2;
  ctx.beginPath();
  ctx.moveTo(p.x + Math.cos(a) * r * 0.78, p.y + Math.sin(a) * ry * 0.78);
  ctx.quadraticCurveTo(p.x + Math.cos(a + 0.3) * r * 0.9, p.y + Math.sin(a + 0.3) * ry * 0.9, p.x + Math.cos(a + 0.2) * r * 0.98, p.y + Math.sin(a + 0.2) * ry * 0.98);
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = ink(0.5);
  ctx.stroke();
}

/** 高台: a long shadow, a wide base ring, then a drum much taller than a plain pad's with a 石青 band round it. */
export function highPlinth(ctx: CanvasRenderingContext2D, p: Pt, r: number, seed: number): void {
  const h = PAD_SIDE + HIGH_EXTRA;
  // Reason: a taller block throws a longer shadow, further down and to the right than a plain pad's.
  ctx.beginPath();
  ctx.ellipse(p.x + 9, p.y + h + HIGH_BASE + 7, r + 11, (r + 6) * PAD_TILT + 4, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(40,28,18,0.3)';
  ctx.fill();
  drum(ctx, p.x, p.y + h, r + 6, HIGH_BASE, 0);
  joints(ctx, p.x, p.y + h, r + 6, HIGH_BASE, seed + 3);
  drum(ctx, p.x, p.y, r, h, 0);
  joints(ctx, p.x, p.y, r, h, seed);
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + h * 0.45, r, r * PAD_TILT, 0, 0.12, Math.PI - 0.12);
  ctx.lineWidth = 3.2;
  ctx.strokeStyle = AZURE;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, r * 0.74, r * PAD_TILT * 0.74, 0, 0, Math.PI * 2);
  ctx.lineWidth = 0.9;
  ctx.strokeStyle = ink(0.4);
  ctx.stroke();
}

/** The gold glow on the ground under a 法阵 (call before the pad's stone is painted). */
export function altarGlow(ctx: CanvasRenderingContext2D, p: Pt, r: number): void {
  wash(ctx, p.x, p.y + 4, r * 1.7, '214,170,80', 0.42);
}

/** 法阵: gold and cinnabar rings with eight cinnabar marks cut into a plain pad's top (call after plainPad). */
export function altarRunes(ctx: CanvasRenderingContext2D, p: Pt, r: number): void {
  const ry = r * PAD_TILT;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, r * 0.82, ry * 0.82, 0, 0, Math.PI * 2);
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = GILT;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, r * 0.52, ry * 0.52, 0, 0, Math.PI * 2);
  ctx.lineWidth = 1.1;
  ctx.strokeStyle = CINNABAR;
  ctx.stroke();
  ctx.fillStyle = CINNABAR;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const mx = p.x + Math.cos(a) * r * 0.67;
    const my = p.y + Math.sin(a) * ry * 0.67;
    ctx.beginPath();
    ctx.moveTo(mx, my - 2);
    ctx.lineTo(mx + 2, my);
    ctx.lineTo(mx, my + 2);
    ctx.lineTo(mx - 2, my);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, r * 0.2, ry * 0.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#d9b55a';
  ctx.fill();
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

/** 泥沼: no stone at all, a pool of dark mud with an ink shore, a wet sheen, bubbles and two clumps of reeds. */
export function mirePad(ctx: CanvasRenderingContext2D, p: Pt, r: number, seed: number): void {
  const rand = rng(seed * 977 + 5);
  const ry = r * PAD_TILT;
  smoothPath(ctx, blobPts(p.x, p.y + 4, r + 6, ry + 6, rand, 12, 0.2));
  ctx.fillStyle = 'rgba(80,60,34,0.32)';
  ctx.fill();
  smoothPath(ctx, blobPts(p.x, p.y + 2, r, ry + 3, rand, 12, 0.12));
  const mud = ctx.createRadialGradient(p.x - 6, p.y - 3, 2, p.x, p.y + 2, r);
  mud.addColorStop(0, '#7a6242');
  mud.addColorStop(1, '#45351f');
  ctx.fillStyle = mud;
  ctx.fill();
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,240,210,0.32)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.ellipse(p.x - 3, p.y, r * 0.6, ry * 0.6, 0, Math.PI * 1.05, Math.PI * 1.45);
  ctx.stroke();
  for (let i = 0; i < 3; i++) {
    const a = rand() * Math.PI * 2;
    const d = 0.25 + rand() * 0.45;
    const bx = p.x + Math.cos(a) * r * d;
    const by = p.y + 2 + Math.sin(a) * ry * d;
    const br = 1.5 + rand() * 1.5;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(130,104,68,0.95)';
    ctx.fill();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = ink(0.7);
    ctx.stroke();
  }
  reeds(ctx, p.x - r * 0.86, p.y + ry * 0.75, rand, -0.8);
  reeds(ctx, p.x + r * 0.9, p.y + ry * 0.55, rand, 0.8);
}
