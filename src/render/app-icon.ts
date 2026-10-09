// The app icon (home screen, install prompt, task switcher): a deep red seal stamped on rice paper, with 悟空 on a
// paper disc inside a gold ring (his 金箍), painted by code at any size. In dev, window.__yzcjIcon(size, maskable)
// exports it as a PNG data URL (see main.ts); the PNGs in public/icons/ are made that way.
import { hash01, roundRect } from './draw.ts';
import { drawPortrait } from './heroes-art.ts';

/** Where the parts of an icon `size` pixels square sit (all in pixels). */
export interface IconLayout {
  size: number;
  /** The seal, a rounded square on a transparent canvas; null when the red bleeds to every edge (maskable). */
  seal: { x: number; y: number; side: number; radius: number } | null;
  cx: number;
  cy: number;
  /** Centre-line radius and width of the gold ring. */
  ringR: number;
  ringW: number;
  /** The paper disc inside the ring, behind the portrait. */
  discR: number;
  /** Radius handed to drawPortrait; 悟空's ears reach about 1.25 times this from his centre. */
  faceR: number;
}

/** Maskable icons: launchers may crop anything outside this fraction of the size, measured from the centre. */
export const MASKABLE_SAFE_RADIUS = 0.4;

/**
 * Layout of the plain ("any") or maskable icon.
 * Reason: on a maskable icon the launcher's mask frames the emblem instead of our seal edge, so the emblem grows
 * a little, but its outer edge (0.38 of the size) stays inside the 0.4 safe circle every mask keeps.
 */
export function iconLayout(size: number, maskable: boolean): IconLayout {
  const k = maskable ? 1.05 : 1;
  return {
    size,
    seal: maskable ? null : { x: 0.04 * size, y: 0.04 * size, side: 0.92 * size, radius: 0.2 * size },
    cx: size / 2,
    cy: size / 2,
    ringR: 0.335 * k * size,
    ringW: 0.05 * k * size,
    discR: 0.32 * k * size,
    faceR: 0.245 * k * size,
  };
}

function disc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string | CanvasGradient): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

/**
 * Deep red seal ink with a rice-paper grain: darker pooling, pale specks where the ink skipped, a few fibres.
 * Positions are fractions of the size (hash01), so every size shows the same texture; small icons just get fewer specks.
 */
function paintSeal(ctx: CanvasRenderingContext2D, l: IconLayout): void {
  const u = l.size;
  ctx.save();
  if (l.seal) {
    roundRect(ctx, l.seal.x, l.seal.y, l.seal.side, l.seal.side, l.seal.radius);
    ctx.clip();
  }
  const base = ctx.createRadialGradient(l.cx - 0.14 * u, l.cy - 0.18 * u, 0.04 * u, l.cx, l.cy, 0.74 * u);
  base.addColorStop(0, '#c9271f');
  base.addColorStop(0.55, '#a8161a');
  base.addColorStop(1, '#7a0c12');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, u, u);
  for (let i = 0; i < 4; i++) {
    const x = hash01(i * 7 + 101) * u;
    const y = hash01(i * 7 + 102) * u;
    const r = (0.14 + hash01(i * 7 + 103) * 0.16) * u;
    const pool = ctx.createRadialGradient(x, y, 0, x, y, r);
    pool.addColorStop(0, 'rgba(80,0,8,0.2)');
    pool.addColorStop(1, 'rgba(80,0,8,0)');
    ctx.fillStyle = pool;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.lineCap = 'round';
  const fibres = Math.round(u / 5);
  for (let i = 0; i < fibres; i++) {
    const x = hash01(i * 5 + 1) * u;
    const y = hash01(i * 5 + 2) * u;
    const a = hash01(i * 5 + 3) * Math.PI * 2;
    const len = (0.03 + hash01(i * 5 + 4) * 0.06) * u;
    const bend = (hash01(i * 5 + 5) - 0.5) * len * 0.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * len * 0.5 - Math.sin(a) * bend, y + Math.sin(a) * len * 0.5 + Math.cos(a) * bend, x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.lineWidth = (0.0015 + hash01(i * 5 + 6) * 0.002) * u;
    ctx.strokeStyle = i % 3 === 0 ? 'rgba(60,0,4,0.18)' : 'rgba(255,214,176,0.1)';
    ctx.stroke();
  }
  const specks = Math.round((u * u) / 400);
  for (let i = 0; i < specks; i++) {
    const r = (0.0015 + hash01(i * 3 + 3) * 0.004) * u;
    disc(ctx, hash01(i * 3 + 1) * u, hash01(i * 3 + 2) * u, r, `rgba(255,218,180,${(0.08 + hash01(i * 3 + 4) * 0.16).toFixed(3)})`);
  }
  if (l.seal) {
    // The carved border line just inside the seal's edge, like the frame of a 朱文 seal.
    const inset = 0.05 * u;
    roundRect(ctx, l.seal.x + inset, l.seal.y + inset, l.seal.side - inset * 2, l.seal.side - inset * 2, l.seal.radius - inset * 0.6);
    ctx.lineWidth = 0.014 * u;
    ctx.strokeStyle = 'rgba(255,224,186,0.7)';
    ctx.stroke();
  }
  ctx.restore();
}

/** The medallion in the middle: a gold ring around a paper disc with 悟空's portrait. Nothing reaches past the ring. */
export function paintIconEmblem(ctx: CanvasRenderingContext2D, l: IconLayout): void {
  const { cx, cy, ringR, ringW, discR, faceR } = l;
  const outer = ringR + ringW / 2;
  ctx.save();
  // A soft shadow lifts the medallion off the seal.
  ctx.shadowColor = 'rgba(45,0,0,0.5)';
  ctx.shadowBlur = ringW * 0.8;
  ctx.shadowOffsetY = ringW * 0.25;
  disc(ctx, cx, cy, outer, '#6e4606');
  ctx.restore();
  const paper = ctx.createRadialGradient(cx - discR * 0.3, cy - discR * 0.35, discR * 0.1, cx, cy, discR);
  paper.addColorStop(0, '#fff8e6');
  paper.addColorStop(1, '#ead3a2');
  disc(ctx, cx, cy, discR, paper);
  ctx.save();
  const gold = ctx.createLinearGradient(cx - ringR, cy - ringR, cx + ringR, cy + ringR);
  gold.addColorStop(0, '#fff0b0');
  gold.addColorStop(0.35, '#f2b632');
  gold.addColorStop(0.7, '#c98a14');
  gold.addColorStop(1, '#8a5a0a');
  ctx.beginPath();
  ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
  ctx.lineWidth = ringW;
  ctx.strokeStyle = gold;
  ctx.stroke();
  // Dark rims on both edges of the ring, then a glint on its upper left.
  ctx.lineWidth = Math.max(1, ringW * 0.14);
  ctx.strokeStyle = '#6e4606';
  for (const r of [outer, ringR - ringW / 2]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, ringR, Math.PI * 1.08, Math.PI * 1.36);
  ctx.lineWidth = ringW * 0.28;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,253,235,0.85)';
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.shadowColor = 'rgba(70,35,0,0.35)';
  ctx.shadowBlur = faceR * 0.12;
  ctx.shadowOffsetY = faceR * 0.05;
  drawPortrait(ctx, '悟空', cx, cy + faceR * 0.04, faceR);
  ctx.restore();
}

/** Paints the whole icon on a `size` x `size` canvas (transparent corners unless `maskable`). */
export function paintAppIcon(ctx: CanvasRenderingContext2D, size: number, maskable: boolean): void {
  const l = iconLayout(size, maskable);
  ctx.clearRect(0, 0, size, size);
  paintSeal(ctx, l);
  paintIconEmblem(ctx, l);
}

/** The icon as a PNG data URL, `size` pixels square (16..2048); the dev hook window.__yzcjIcon. */
export function appIconDataUrl(size: number, maskable = false): string {
  const px = Math.round(size);
  if (!(px >= 16 && px <= 2048)) throw new RangeError(`icon size must be 16..2048 pixels, got ${size}`);
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not supported in this browser');
  paintAppIcon(ctx, px, maskable);
  return canvas.toDataURL('image/png');
}
