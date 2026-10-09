// The 适龄提示 badge, drawn by code (plan.md v0.9 合规版 item 3): a rounded badge in the rating's colour (8+ green,
// 12+ blue, 16+ yellow, the usual scheme of the mark) with the age in large white figures over a white band reading
// 适龄提示. Shown on the launch splash and the 关于 screen; sans text only, so it needs no brush glyphs.
import { fitPx, roundRect, text } from './draw.ts';
import { sans } from './fonts.ts';

/** Body colours (lighter top, darker bottom) per rating; the darker one also writes the band's text. */
const RATING_COLORS: Readonly<Record<number, readonly [string, string]>> = {
  8: ['#4fbf5c', '#2a8a3a'],
  12: ['#3e92e6', '#1c5fb3'],
  16: ['#f5bd3a', '#c98710'],
};

/** The mark's name, printed on its band. */
const MARK_NAME = '适龄提示';

/** A badge `w` wide is this tall. */
export function ageBadgeHeight(w: number): number {
  return Math.round(w * 1.25);
}

/** Draws the badge for `age` (12 reads "12+") with its top-left corner at (x, y), `w` wide. */
export function drawAgeBadge(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, age: number): void {
  const h = ageBadgeHeight(w);
  const [light, dark] = RATING_COLORS[age] ?? RATING_COLORS[12];
  const r = w * 0.16;
  const heavy = (px: number) => sans(px, 800);
  ctx.save();
  roundRect(ctx, x, y + 2, w, h, r);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fill();
  const body = ctx.createLinearGradient(0, y, 0, y + h);
  body.addColorStop(0, light);
  body.addColorStop(1, dark);
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = body;
  ctx.fill();
  // A thin white frame just inside the edge, as on the printed mark.
  const inset = w * 0.06;
  roundRect(ctx, x + inset, y + inset, w - 2 * inset, h - 2 * inset, r * 0.7);
  ctx.lineWidth = Math.max(1, w * 0.03);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.stroke();
  const cx = x + w / 2;
  const label = `${age}+`;
  text(ctx, label, cx, y + h * 0.37, heavy(fitPx(ctx, label, w * 0.74, Math.round(w * 0.48), heavy)), '#ffffff');
  // The white band at the bottom with the mark's name, as large as its width allows (11 px on a 64-wide badge).
  const band = { x: x + w * 0.1, y: y + h * 0.63, w: w * 0.8, h: h * 0.21 };
  roundRect(ctx, band.x, band.y, band.w, band.h, band.h * 0.3);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  const px = fitPx(ctx, MARK_NAME, band.w - 4, Math.round(band.h * 0.75), heavy, 6);
  text(ctx, MARK_NAME, cx, band.y + band.h / 2 + 0.5, heavy(px), dark);
  ctx.restore();
}
