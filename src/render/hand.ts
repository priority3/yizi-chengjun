// A cartoon pointing hand for the tutorial: fingertip at (x, y), drawn in screen space.
import { roundRect } from './draw.ts';

export function drawHand(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, pressed: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  if (pressed) ctx.scale(0.88, 0.88);
  ctx.rotate(-0.25);
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 3;
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#4a2c14';
  ctx.fillStyle = '#fff3dc';
  // Palm and cuff.
  roundRect(ctx, -s * 0.3, s * 0.4, s * 0.72, s * 0.62, s * 0.16);
  ctx.fill();
  ctx.stroke();
  roundRect(ctx, -s * 0.26, s * 0.92, s * 0.64, s * 0.26, s * 0.06);
  ctx.fillStyle = '#c8322a';
  ctx.fill();
  ctx.stroke();
  // Index finger pointing up, three folded fingers, a thumb.
  ctx.fillStyle = '#fff3dc';
  roundRect(ctx, -s * 0.12, -s * 0.02, s * 0.24, s * 0.62, s * 0.12);
  ctx.fill();
  ctx.stroke();
  for (let i = 0; i < 3; i++) {
    roundRect(ctx, s * 0.14 + i * s * 0.04, s * 0.42 + i * s * 0.1, s * 0.26, s * 0.16, s * 0.08);
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(-s * 0.32, s * 0.6, s * 0.12, s * 0.2, 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  if (pressed) {
    ctx.beginPath();
    ctx.arc(x, y, s * 0.3, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,210,90,0.9)';
    ctx.stroke();
  }
}

/** Two fingertips moving apart: the pinch-to-zoom pictogram. */
export function drawPinch(ctx: CanvasRenderingContext2D, x: number, y: number, spread: number): void {
  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,245,220,0.9)';
  ctx.fillStyle = 'rgba(255,245,220,0.35)';
  for (const sgn of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(x + sgn * spread, y - sgn * spread * 0.4, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + sgn * 14, y - sgn * 6);
    ctx.lineTo(x + sgn * (spread - 14), y - sgn * (spread * 0.4 - 6));
    ctx.setLineDash([3, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}
