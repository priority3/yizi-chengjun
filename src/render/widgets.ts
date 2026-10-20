// Reusable UI widgets drawn on the canvas in the 宣纸卷轴 style: ink-outlined button plates, paper scrolls on wooden
// rollers for the shop and the overlays, the ink-drawn bin and speech bubbles.
import { fitPx, PRESS_DY, R, roundRect, SHADOW, text } from './draw.ts';
import { AZURE, CINNABAR, GILT, ink, INK, PAPER } from './ink.ts';
import { brush, sans } from './fonts.ts';
import { L, W, type Rect } from './layout.ts';

/** The back button shared by every menu screen. */
export const BACK: Rect = { x: 12, y: 16, w: 66, h: 34 };

/** The painted first map, darkened, behind menus. */
export { menuBackdrop as backdrop } from './map-art.ts';

export type ButtonStyle = 'primary' | 'jade' | 'danger' | 'ghost' | 'disabled';

/**
 * The 宣纸卷轴 button plates: flat mineral colours outlined in ink, with a faint inner rule. 'primary' is cinnabar
 * with gold lettering (出战), 'jade' is 石青 azure (刷新, 法宝), 'ghost' is plain paper.
 */
const STYLES: Record<ButtonStyle, { fill: string; text: string; sub: string; rule: string }> = {
  primary: { fill: CINNABAR, text: '#ffe9a8', sub: '#fff1d6', rule: 'rgba(255,248,230,0.45)' },
  jade: { fill: AZURE, text: PAPER, sub: '#e3f0f6', rule: 'rgba(255,248,230,0.45)' },
  danger: { fill: '#7a2418', text: '#fff4ec', sub: '#f6d8cc', rule: 'rgba(255,248,230,0.35)' },
  ghost: { fill: PAPER, text: INK, sub: ink(0.7), rule: ink(0.25) },
  disabled: { fill: '#d8cfbd', text: ink(0.42), sub: ink(0.42), rule: ink(0.15) },
};

export function drawButton(ctx: CanvasRenderingContext2D, r: Rect, label: string, style: ButtonStyle, sub?: string, pressed = false): void {
  const s = STYLES[style];
  const dy = pressed ? PRESS_DY : 0;
  const radius = Math.min(6, r.h / 2);
  ctx.save();
  roundRect(ctx, r.x, r.y + SHADOW.y, r.w, r.h, radius);
  ctx.fillStyle = ink(0.28);
  ctx.fill();
  roundRect(ctx, r.x, r.y + dy, r.w, r.h, radius);
  ctx.fillStyle = s.fill;
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = INK;
  ctx.stroke();
  roundRect(ctx, r.x + 3, r.y + dy + 3, r.w - 6, r.h - 6, Math.max(1, radius - 2));
  ctx.lineWidth = 0.7;
  ctx.strokeStyle = s.rule;
  ctx.stroke();
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2 + dy;
  if (sub) {
    text(ctx, label, cx, cy - 7, brush(Math.min(22, Math.round(r.h * 0.46))), s.text);
    text(ctx, sub, cx, cy + 11, sans(10, 500), s.sub);
  } else {
    text(ctx, label, cx, cy + 1, brush(Math.min(22, Math.round(r.h * 0.52))), s.text);
  }
  ctx.restore();
}

/** The paper plate behind a HUD icon; `lit` fills it with cinnabar instead (the ×2 speed while it is on). */
export function drawIconPlate(ctx: CanvasRenderingContext2D, r: Rect, pressed: boolean, lit = false): void {
  roundRect(ctx, r.x, r.y + (pressed ? 1 : 0), r.w, r.h, 7);
  ctx.fillStyle = lit ? CINNABAR : PAPER;
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

/** Small HUD button with a drawn icon, in ink on a paper plate. */
export function drawIconButton(ctx: CanvasRenderingContext2D, r: Rect, icon: 'pause' | 'x1' | 'x2', pressed: boolean): void {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2 + (pressed ? 1 : 0);
  drawIconPlate(ctx, r, pressed, icon === 'x2');
  if (icon === 'pause') {
    ctx.fillStyle = INK;
    ctx.fillRect(cx - 5, cy - 6, 3.5, 12);
    ctx.fillRect(cx + 1.5, cy - 6, 3.5, 12);
  } else {
    text(ctx, icon === 'x2' ? '×2' : '×1', cx, cy + 0.5, sans(13, 800), icon === 'x2' ? '#ffe9a8' : INK);
  }
}

/** Paper with a soft top-to-bottom tint, outlined in ink, with a thin inner rule `inset` inside the edge. */
function paperSheet(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, inset: number): void {
  roundRect(ctx, x, y, w, h, 2);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#faf2de');
  g.addColorStop(1, '#efe1c0');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = INK;
  ctx.stroke();
  roundRect(ctx, x + inset, y + inset, w - inset * 2, h - inset * 2, 1);
  ctx.lineWidth = 0.7;
  ctx.strokeStyle = ink(0.35);
  ctx.stroke();
}

/** A wooden roller with gold caps, `w` thick, spanning (x, y)-(x + w, y + h) (upright when h > w). */
function roller(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const upright = h > w;
  roundRect(ctx, x, y, w, h, Math.min(w, h) / 2);
  const g = upright ? ctx.createLinearGradient(x, 0, x + w, 0) : ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#8a5a32');
  g.addColorStop(0.5, '#6b4024');
  g.addColorStop(1, '#3e2414');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = INK;
  ctx.stroke();
  const t = Math.min(w, h);
  const caps = upright
    ? [
        [x - 1.5, y - 5, t + 3, 6],
        [x - 1.5, y + h - 1, t + 3, 6],
      ]
    : [
        [x - 5, y - 1.5, 6, t + 3],
        [x + w - 1, y - 1.5, 6, t + 3],
      ];
  for (const [cx, cy, cw, ch] of caps) {
    roundRect(ctx, cx, cy, cw, ch, 2);
    ctx.fillStyle = GILT;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }
}

/** A handscroll (手卷) unrolled across `r`: a roller at each end, paper between them (the shop). */
export function drawHandscroll(ctx: CanvasRenderingContext2D, r: Rect): void {
  roundRect(ctx, r.x + 16, r.y + 3 + SHADOW.y, r.w - 32, r.h - 6, 2);
  ctx.fillStyle = ink(0.18);
  ctx.fill();
  for (const x of [r.x + 2, r.x + r.w - 16]) roller(ctx, x, r.y - 2, 14, r.h + 4);
  paperSheet(ctx, r.x + 16, r.y + 3, r.w - 32, r.h - 6, 5);
}

/** Dims the screen and hangs a scroll (立轴) over `r`: paper with a roller across its top and bottom edges (overlays). */
export function drawPanel(ctx: CanvasRenderingContext2D, r: Rect): void {
  ctx.fillStyle = 'rgba(15,8,4,0.6)';
  ctx.fillRect(0, 0, W, L.H);
  roundRect(ctx, r.x, r.y + SHADOW.y, r.w, r.h, 2);
  ctx.fillStyle = ink(0.3);
  ctx.fill();
  paperSheet(ctx, r.x, r.y, r.w, r.h, 6);
  for (const y of [r.y - 5, r.y + r.h - 5]) roller(ctx, r.x - 8, y, r.w + 16, 10);
}

/** The bin cards are dropped in to sell them: a paper bucket drawn in ink, turning cinnabar while a card hovers over it. */
export function drawTrash(ctx: CanvasRenderingContext2D, r: Rect, hot: boolean): void {
  const s = r.h / 30;
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2 - 0.5 * s;
  ctx.save();
  if (hot) {
    ctx.beginPath();
    ctx.arc(cx, cy, r.w * 0.62, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(185,54,42,0.3)';
    ctx.fill();
  }
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-8, -4);
  ctx.lineTo(8, -4);
  ctx.lineTo(6, 10);
  ctx.lineTo(-6, 10);
  ctx.closePath();
  ctx.fillStyle = hot ? CINNABAR : PAPER;
  ctx.fill();
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-10, -6);
  ctx.lineTo(10, -6);
  ctx.moveTo(-2.5, -9);
  ctx.lineTo(2.5, -9);
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.beginPath();
  for (const dx of [-3, 0, 3]) {
    ctx.moveTo(dx, -1);
    ctx.lineTo(dx * 0.8, 7);
  }
  ctx.lineWidth = 0.9;
  ctx.strokeStyle = hot ? PAPER : INK;
  ctx.stroke();
  ctx.restore();
}

/** Speech bubble whose tail points at (x, y) from below-left. */
export function drawBubble(ctx: CanvasRenderingContext2D, x: number, y: number, msg: string): void {
  const px = fitPx(ctx, msg, 200, 13);
  const w = Math.min(220, ctx.measureText(msg).width + 20);
  const h = 26;
  const bx = Math.min(W - w - 6, Math.max(6, x - w / 2));
  roundRect(ctx, bx, y - h, w, h, R.md);
  ctx.fillStyle = '#fffaf0';
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = INK;
  ctx.stroke();
  text(ctx, msg, bx + w / 2, y - h / 2 + 1, sans(px, 600), INK);
}
