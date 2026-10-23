// Short toast messages stacked above the bottom panel.
import { isEn } from '../i18n/lang.ts';
import { fitLines, fitPx, roundRect, text } from '../render/draw.ts';
import { sans } from '../render/fonts.ts';
import { W } from '../render/layout.ts';

const TOAST_LIFE = 2.2;
/** Height of a one-line toast, the gap between two, and how much each further line of an English toast adds. */
const TOAST_H = 26;
const TOAST_GAP = 4;
const LINE_H = 16;

const font = (px: number): string => sans(px, 600);

/**
 * A toast's lines and size, the font set on `ctx`: one line shrunk to fit in Chinese; in English, whose messages run
 * about twice as long, up to three lines before it shrinks below 11 px.
 */
function toastLines(ctx: CanvasRenderingContext2D, msg: string): { px: number; lines: string[] } {
  if (!isEn()) return { px: fitPx(ctx, msg, W - 60, 13, font), lines: [msg] };
  const fit = fitLines(ctx, msg, W - 60, 13, font, 3, 11);
  ctx.font = font(fit.px);
  return fit;
}

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

  /** Draws the stack with its newest message centred at `bottomY` (a longer one grows upwards from there). */
  draw(ctx: CanvasRenderingContext2D, bottomY: number): void {
    ctx.save();
    // Stacked from the newest up, then drawn oldest first.
    const tops: number[] = [];
    let bottom = bottomY + TOAST_H / 2;
    for (let i = this.items.length - 1; i >= 0; i--) {
      tops[i] = bottom - (TOAST_H + (toastLines(ctx, this.items[i].msg).lines.length - 1) * LINE_H);
      bottom = tops[i] - TOAST_GAP;
    }
    this.items.forEach((it, i) => {
      ctx.globalAlpha = it.t > TOAST_LIFE - 0.4 ? (TOAST_LIFE - it.t) / 0.4 : Math.min(1, it.t / 0.12);
      const { px, lines } = toastLines(ctx, it.msg);
      const w = Math.min(W - 30, Math.max(...lines.map((s) => ctx.measureText(s).width)) + 30);
      roundRect(ctx, (W - w) / 2, tops[i], w, TOAST_H + (lines.length - 1) * LINE_H, 13);
      ctx.fillStyle = 'rgba(28,14,6,0.88)';
      ctx.fill();
      lines.forEach((line, k) => text(ctx, line, W / 2, tops[i] + TOAST_H / 2 + 1 + k * LINE_H, font(px), '#fff1d6'));
    });
    ctx.restore();
  }
}
