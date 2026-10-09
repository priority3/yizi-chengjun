// Rating stars, drawn by code: the best rating on the chapter cards, the stars popping in on the result panel,
// and the camp marker on the map thumbnails.
import { MAX_STARS } from '../core/rating.ts';

/** Traces a five-pointed star centred at (x, y), point up; `inner` is the inner radius as a share of r. */
export function starPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, inner = 0.48): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * inner;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

/** Where an unearned star's empty outline sits: on parchment, or on a greyed-out locked card. */
export type StarTone = 'paper' | 'locked';

/** A rating star: gold when earned, an empty outline when not. `scale` (0..1+) grows it in for the pop-in. */
export function drawRatingStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, earned: boolean, tone: StarTone = 'paper', scale = 1): void {
  if (scale <= 0) return;
  const rr = r * scale;
  ctx.save();
  ctx.lineJoin = 'round';
  starPath(ctx, x, y, rr);
  if (earned) {
    const g = ctx.createLinearGradient(x, y - rr, x, y + rr);
    g.addColorStop(0, '#fff1a0');
    g.addColorStop(0.5, '#f5c03a');
    g.addColorStop(1, '#d28a12');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = Math.max(1, rr * 0.15);
    ctx.strokeStyle = '#7a4206';
    ctx.stroke();
    // A glint on the upper-left arm.
    ctx.beginPath();
    ctx.ellipse(x - rr * 0.22, y - rr * 0.22, rr * 0.2, rr * 0.11, -0.7, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fill();
  } else {
    ctx.fillStyle = tone === 'locked' ? 'rgba(30,26,22,0.3)' : 'rgba(110,70,30,0.13)';
    ctx.fill();
    ctx.lineWidth = Math.max(1, rr * 0.13);
    ctx.strokeStyle = tone === 'locked' ? 'rgba(210,198,182,0.45)' : 'rgba(140,95,45,0.65)';
    ctx.stroke();
  }
  ctx.restore();
}

/** A row of three stars, the first `earned` of them gold; (x, y) is the centre of the first, `gap` between centres. */
export function drawStarRow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, gap: number, earned: number, tone: StarTone = 'paper'): void {
  for (let i = 0; i < MAX_STARS; i++) drawRatingStar(ctx, x + i * gap, y, r, i < earned, tone);
}
