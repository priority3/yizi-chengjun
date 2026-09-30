// Reusable HUD widgets: buttons, overlay panels, toasts and the AI's speech bubble.
import { fitPx, roundRect, text } from '../render/draw.ts';
import { H, W, type Rect } from '../render/layout.ts';

export type ButtonStyle = 'primary' | 'danger' | 'ghost' | 'disabled';

const STYLES: Record<ButtonStyle, { top: string; bottom: string; edge: string; text: string }> = {
  primary: { top: '#ffd978', bottom: '#e8a93a', edge: '#8a5a12', text: '#4a2a06' },
  danger: { top: '#ff8a7a', bottom: '#d9453c', edge: '#7a1a14', text: '#fff4ec' },
  ghost: { top: '#4d3e35', bottom: '#3a2e28', edge: '#6e5a4c', text: '#f3e6c8' },
  disabled: { top: '#6a625c', bottom: '#56504b', edge: '#3d3834', text: '#c9bfb4' },
};

export function drawButton(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  label: string,
  style: ButtonStyle,
  sub?: string,
  pressed = false,
): void {
  const s = STYLES[style];
  const dy = pressed ? 2 : 0;
  const radius = Math.min(10, r.h / 2);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  roundRect(ctx, r.x, r.y + 3, r.w, r.h, radius);
  ctx.fill();
  const g = ctx.createLinearGradient(0, r.y + dy, 0, r.y + r.h + dy);
  g.addColorStop(0, s.top);
  g.addColorStop(1, s.bottom);
  ctx.fillStyle = g;
  roundRect(ctx, r.x, r.y + dy, r.w, r.h, radius);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = s.edge;
  ctx.stroke();
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2 + dy;
  if (sub) {
    text(ctx, label, cx, cy - 7, Math.min(20, Math.round(r.h * 0.4)), s.text);
    text(ctx, sub, cx, cy + 12, 11, s.text, 'center', 500);
  } else {
    text(ctx, label, cx, cy + 1, Math.min(18, Math.round(r.h * 0.5)), s.text);
  }
  ctx.restore();
}

/** Dims the whole screen and draws a parchment panel. */
export function drawPanel(ctx: CanvasRenderingContext2D, r: Rect): void {
  ctx.fillStyle = 'rgba(10,5,3,0.62)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#f3e7cc';
  roundRect(ctx, r.x, r.y, r.w, r.h, 16);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#b8862c';
  ctx.stroke();
}

/** Speech bubble whose right edge sits at `right`, pointing right at the AI avatar. */
export function drawBubble(ctx: CanvasRenderingContext2D, right: number, cy: number, msg: string): void {
  const maxW = 126;
  const px = fitPx(ctx, msg, maxW - 16, 12);
  const w = Math.min(maxW, ctx.measureText(msg).width + 16);
  const h = 24;
  const x = right - w;
  ctx.fillStyle = '#fff6e0';
  roundRect(ctx, x, cy - h / 2, w, h, 10);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(right - 2, cy - 5);
  ctx.lineTo(right + 8, cy);
  ctx.lineTo(right - 2, cy + 5);
  ctx.fill();
  text(ctx, msg, x + w / 2, cy + 1, px, '#5a2a10');
}

const TOAST_LIFE = 2;

/** Short messages stacked just above the player's HUD. */
export class Toasts {
  private items: { msg: string; t: number }[] = [];

  push(msg: string): void {
    const last = this.items[this.items.length - 1];
    if (last && last.msg === msg && last.t < 0.6) return;
    this.items.push({ msg, t: 0 });
    if (this.items.length > 3) this.items.shift();
  }

  update(dt: number): void {
    for (const it of this.items) it.t += dt;
    this.items = this.items.filter((it) => it.t < TOAST_LIFE);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    this.items.forEach((it, i) => {
      const y = 552 - (this.items.length - 1 - i) * 30;
      ctx.globalAlpha = it.t > TOAST_LIFE - 0.4 ? (TOAST_LIFE - it.t) / 0.4 : 1;
      const px = fitPx(ctx, it.msg, W - 60, 13);
      const w = Math.min(W - 40, ctx.measureText(it.msg).width + 28);
      ctx.fillStyle = 'rgba(25,12,6,0.85)';
      roundRect(ctx, (W - w) / 2, y - 13, w, 26, 13);
      ctx.fill();
      text(ctx, it.msg, W / 2, y + 1, px, '#fff1d6', 'center', 500);
    });
    ctx.restore();
  }
}
