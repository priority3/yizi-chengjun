// Low-level drawing helpers shared by every art module: colours, text, shapes, icons.
import { brush, sans } from './fonts.ts';

export const COLORS = {
  ink: '#2a1a10',
  paper: '#f6ecd4',
  paperDark: '#e2cfa6',
  sand: '#e8d3a6',
  gold: '#f0b93a',
  goldDark: '#a8740c',
  red: '#c8322a',
  hudBg: 'rgba(42,26,16,0.82)',
  hudText: '#fbeed2',
  dim: '#b9a585',
  hp: '#e0453c',
  hpBack: 'rgba(0,0,0,0.35)',
  heal: '#4fd06a',
};

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function text(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  font: string,
  color: string,
  align: CanvasTextAlign = 'center',
): void {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}

/** Text with a dark outline so it reads on any background. */
export function outlined(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  font: string,
  color: string,
  outline = 'rgba(30,15,5,0.85)',
  width = 3,
  align: CanvasTextAlign = 'center',
): void {
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = width;
  ctx.strokeStyle = outline;
  ctx.strokeText(s, x, y);
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

/** Largest pixel size (<= maxPx) at which `s` fits in `maxWidth` using the given font builder. */
export function fitPx(
  ctx: CanvasRenderingContext2D,
  s: string,
  maxWidth: number,
  maxPx: number,
  build: (px: number) => string = sans,
  minPx = 9,
): number {
  for (let px = maxPx; px > minPx; px--) {
    ctx.font = build(px);
    if (ctx.measureText(s).width <= maxWidth) return px;
  }
  return minPx;
}

/** A 铜钱 (square-holed copper coin), the currency's icon. */
export function drawCoin(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.2, x, y, r);
  g.addColorStop(0, '#ffe39a');
  g.addColorStop(1, '#d09a2a');
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.18);
  ctx.strokeStyle = '#8a5a0a';
  ctx.stroke();
  const s = r * 0.42;
  ctx.fillStyle = '#6b4308';
  ctx.fillRect(x - s / 2, y - s / 2, s, s);
}

export function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/** A horizontal bar (HP, progress). */
export function drawBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, frac: number, color: string): void {
  const f = Math.max(0, Math.min(1, frac));
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = COLORS.hpBack;
  ctx.fill();
  if (f > 0) {
    roundRect(ctx, x, y, Math.max(h, w * f), h, h / 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
}

/** Deterministic pseudo-random in [0, 1) from an integer — for stable paper textures and decorations. */
export function hash01(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export { brush, sans };
