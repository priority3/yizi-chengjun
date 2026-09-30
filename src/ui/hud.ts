// Short toast messages stacked above the bottom panel.
import { fitPx, roundRect, text } from '../render/draw.ts';
import { sans } from '../render/fonts.ts';
import { W } from '../render/layout.ts';

const TOAST_LIFE = 2.2;

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

  /** Draws the stack with its newest message at `bottomY`. */
  draw(ctx: CanvasRenderingContext2D, bottomY: number): void {
    ctx.save();
    this.items.forEach((it, i) => {
      const y = bottomY - (this.items.length - 1 - i) * 30;
      ctx.globalAlpha = it.t > TOAST_LIFE - 0.4 ? (TOAST_LIFE - it.t) / 0.4 : Math.min(1, it.t / 0.12);
      const px = fitPx(ctx, it.msg, W - 60, 13, (p) => sans(p, 600));
      const w = Math.min(W - 30, ctx.measureText(it.msg).width + 30);
      roundRect(ctx, (W - w) / 2, y - 13, w, 26, 13);
      ctx.fillStyle = 'rgba(28,14,6,0.88)';
      ctx.fill();
      text(ctx, it.msg, W / 2, y + 1, sans(px, 600), '#fff1d6');
    });
    ctx.restore();
  }
}
