// Reusable UI widgets drawn on the canvas: buttons, panels, the trash bin, speech bubbles.
import type { Stage } from '../platform/web.ts';
import { paintBackground } from './background.ts';
import { COLORS, fitPx, roundRect, text } from './draw.ts';
import { brush, sans } from './fonts.ts';
import { L, W, type Rect } from './layout.ts';
import { sprites } from './sprites.ts';

/** The back button shared by every menu screen. */
export const BACK: Rect = { x: 12, y: 16, w: 66, h: 34 };

/** The painted battlefield, darkened, behind menus. */
export function backdrop(ctx: CanvasRenderingContext2D, stage: Stage, dim: number): void {
  const img = sprites.get(`bg:${stage.pixelRatio}:${L.H}`, W, L.H, (c) => paintBackground(c, L.H));
  ctx.drawImage(img, 0, 0, W, L.H);
  ctx.fillStyle = `rgba(28,14,6,${dim})`;
  ctx.fillRect(0, 0, W, L.H);
}

export type ButtonStyle = 'primary' | 'jade' | 'danger' | 'ghost' | 'disabled';

const STYLES: Record<ButtonStyle, { top: string; bottom: string; edge: string; text: string }> = {
  primary: { top: '#ffcf6a', bottom: '#e8912a', edge: '#8a4a0a', text: '#4a2204' },
  jade: { top: '#7fd9c4', bottom: '#2f9c86', edge: '#15564a', text: '#f2fffb' },
  danger: { top: '#ff8a7a', bottom: '#d23c30', edge: '#7a1a14', text: '#fff4ec' },
  ghost: { top: '#5a4638', bottom: '#3c2e26', edge: '#7a6450', text: '#f7ead0' },
  disabled: { top: '#8a8078', bottom: '#6a625c', edge: '#4a4440', text: '#e0d6cc' },
};

export function drawButton(ctx: CanvasRenderingContext2D, r: Rect, label: string, style: ButtonStyle, sub?: string, pressed = false): void {
  const s = STYLES[style];
  const dy = pressed ? 2 : 0;
  const radius = Math.min(12, r.h / 2);
  ctx.save();
  roundRect(ctx, r.x, r.y + 3, r.w, r.h, radius);
  ctx.fillStyle = 'rgba(30,15,5,0.35)';
  ctx.fill();
  const g = ctx.createLinearGradient(0, r.y + dy, 0, r.y + r.h + dy);
  g.addColorStop(0, s.top);
  g.addColorStop(1, s.bottom);
  roundRect(ctx, r.x, r.y + dy, r.w, r.h, radius);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = s.edge;
  ctx.stroke();
  // Glossy top edge.
  roundRect(ctx, r.x + 3, r.y + dy + 2, r.w - 6, r.h * 0.35, radius * 0.7);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fill();
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2 + dy;
  if (sub) {
    text(ctx, label, cx, cy - 7, brush(Math.min(22, Math.round(r.h * 0.46))), s.text);
    text(ctx, sub, cx, cy + 11, sans(10, 600), s.text);
  } else {
    text(ctx, label, cx, cy + 1, brush(Math.min(22, Math.round(r.h * 0.52))), s.text);
  }
  ctx.restore();
}

/** Small round HUD button with a drawn icon. */
export function drawIconButton(ctx: CanvasRenderingContext2D, r: Rect, icon: 'pause' | 'x1' | 'x2', pressed: boolean): void {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2 + (pressed ? 1 : 0);
  roundRect(ctx, r.x, r.y + (pressed ? 1 : 0), r.w, r.h, 9);
  ctx.fillStyle = icon === 'x2' ? '#e8912a' : 'rgba(255,245,225,0.16)';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255,230,190,0.55)';
  ctx.stroke();
  if (icon === 'pause') {
    ctx.fillStyle = COLORS.hudText;
    ctx.fillRect(cx - 5, cy - 6, 3.5, 12);
    ctx.fillRect(cx + 1.5, cy - 6, 3.5, 12);
  } else {
    text(ctx, icon === 'x2' ? '×2' : '×1', cx, cy + 0.5, sans(13, 800), icon === 'x2' ? '#4a2204' : COLORS.hudText);
  }
}

/** Dims the screen and draws a parchment panel for overlays. */
export function drawPanel(ctx: CanvasRenderingContext2D, r: Rect): void {
  ctx.fillStyle = 'rgba(15,8,4,0.6)';
  ctx.fillRect(0, 0, W, L.H);
  roundRect(ctx, r.x, r.y, r.w, r.h, 16);
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, '#fbf1d8');
  g.addColorStop(1, '#ecd8ae');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#b8862c';
  ctx.stroke();
  roundRect(ctx, r.x + 6, r.y + 6, r.w - 12, r.h - 12, 12);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(160,110,40,0.45)';
  ctx.stroke();
}

export function drawTrash(ctx: CanvasRenderingContext2D, r: Rect, hot: boolean): void {
  const cx = r.x + r.w / 2;
  const top = r.y + r.h * 0.22;
  const w = r.w * 0.52;
  const h = r.h * 0.6;
  ctx.save();
  if (hot) {
    ctx.beginPath();
    ctx.arc(cx, r.y + r.h / 2, r.w * 0.62, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(224,69,60,0.35)';
    ctx.fill();
  }
  ctx.fillStyle = hot ? '#e0453c' : '#8a6a4a';
  ctx.strokeStyle = '#3a2414';
  ctx.lineWidth = 1.5;
  roundRect(ctx, cx - w / 2, top + 4, w, h, 3);
  ctx.fill();
  ctx.stroke();
  roundRect(ctx, cx - w * 0.62, top, w * 1.24, 4, 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillRect(cx - 3, top - 3, 6, 3);
  ctx.strokeStyle = 'rgba(255,240,220,0.6)';
  for (const dx of [-w * 0.2, 0, w * 0.2]) {
    ctx.beginPath();
    ctx.moveTo(cx + dx, top + 8);
    ctx.lineTo(cx + dx, top + h);
    ctx.stroke();
  }
  ctx.restore();
}

/** Speech bubble whose tail points at (x, y) from below-left. */
export function drawBubble(ctx: CanvasRenderingContext2D, x: number, y: number, msg: string): void {
  const px = fitPx(ctx, msg, 200, 13);
  const w = Math.min(220, ctx.measureText(msg).width + 20);
  const h = 26;
  const bx = Math.min(W - w - 6, Math.max(6, x - w / 2));
  roundRect(ctx, bx, y - h, w, h, 12);
  ctx.fillStyle = '#fffaf0';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#8a6a3a';
  ctx.stroke();
  text(ctx, msg, bx + w / 2, y - h / 2 + 1, sans(px, 600), '#4a2a10');
}
