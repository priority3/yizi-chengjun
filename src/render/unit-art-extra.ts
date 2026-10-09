// Illustrations of the B5 cards, in the style of unit-art.ts (which registers them): each grows richer with the level.
// 毒 a green vial and poisoned needles, 网 a knotted rope net, 鼓 a red war drum with its sticks, 镜 a bronze mirror.
import type { UnitId } from '../core/types.ts';
import { drawStar } from './draw.ts';

/** Same signature as unit-art.ts's painters: a box of size `s` centred at (x, y). */
export type UnitPainter = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, level: number) => void;

function stroke(ctx: CanvasRenderingContext2D, color: string, width: number): void {
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke();
}

/** One steel needle from (x0, y0) to its point at (x1, y1), its tip dipped green. */
function needle(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, s: number): void {
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  stroke(ctx, '#4a5560', s * 0.06);
  stroke(ctx, '#c9d3dc', s * 0.025);
  const tx = x0 + (x1 - x0) * 0.78;
  const ty = y0 + (y1 - y0) * 0.78;
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(x1, y1);
  stroke(ctx, '#3fbf2a', s * 0.05);
}

/** 毒: a round green vial with a cork; one, two, three needles behind it, bubbles from level 3, a drip at 5. */
function vial(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, level: number): void {
  const n = level >= 4 ? 3 : level >= 2 ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const a = -0.9 + i * 0.55;
    needle(ctx, x - Math.cos(a) * s * 0.46, y + s * 0.3 - Math.sin(a) * s * 0.1, x + Math.cos(a) * s * 0.46, y - s * 0.34 + i * s * 0.1, s);
  }
  const cy = y + s * 0.12;
  const r = s * 0.31;
  // The neck and its cork.
  ctx.beginPath();
  ctx.rect(x - s * 0.09, cy - r - s * 0.14, s * 0.18, s * 0.2);
  ctx.fillStyle = 'rgba(225,248,220,0.95)';
  ctx.fill();
  stroke(ctx, '#1d5a16', s * 0.035);
  ctx.beginPath();
  ctx.rect(x - s * 0.11, cy - r - s * 0.24, s * 0.22, s * 0.11);
  ctx.fillStyle = '#9a6a3a';
  ctx.fill();
  stroke(ctx, '#5a3412', s * 0.025);
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(225,248,220,0.9)';
  ctx.fill();
  ctx.clip();
  // The poison: deeper green, and glowing from level 4.
  const g = ctx.createLinearGradient(0, cy - r * 0.2, 0, cy + r);
  g.addColorStop(0, level >= 4 ? '#8dff6a' : '#6fdc4a');
  g.addColorStop(1, '#1f7a1a');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, cy - r * 0.15, r * 2, r * 1.2);
  ctx.restore();
  ctx.beginPath();
  ctx.arc(x, cy, r, 0, Math.PI * 2);
  stroke(ctx, '#1d5a16', s * 0.04);
  ctx.beginPath();
  ctx.arc(x - r * 0.35, cy - r * 0.35, r * 0.35, Math.PI * 1.1, Math.PI * 1.6);
  stroke(ctx, 'rgba(255,255,255,0.85)', s * 0.035);
  if (level >= 3) {
    for (const [dx, dy, br] of [
      [-0.08, -0.42, 0.05],
      [0.1, -0.56, 0.04],
      [-0.02, -0.68, 0.03],
    ] as const) {
      ctx.beginPath();
      ctx.arc(x + dx * s, y + dy * s, br * s, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(150,240,120,0.85)';
      ctx.fill();
      stroke(ctx, '#2f7a22', s * 0.015);
    }
  }
  if (level >= 5) {
    ctx.beginPath();
    ctx.moveTo(x + r * 0.2, cy + r);
    ctx.quadraticCurveTo(x + r * 0.45, cy + r + s * 0.12, x + r * 0.2, cy + r + s * 0.16);
    ctx.quadraticCurveTo(x - r * 0.05, cy + r + s * 0.12, x + r * 0.2, cy + r);
    ctx.fillStyle = '#4fd03a';
    ctx.fill();
  }
}

/** 网: a knotted rope net, denser at higher levels, with stone weights at its corners from level 3. */
function net(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, level: number): void {
  const half = s * 0.4;
  const cells = Math.min(5, 2 + Math.ceil(level / 2));
  // Corners of the net, sagging a little at the bottom like a net thrown over something.
  const at = (u: number, v: number): [number, number] => [x + (u * 2 - 1) * half * (1 - 0.12 * v), y + (v * 2 - 1) * half + Math.sin(u * Math.PI) * s * 0.06];
  ctx.lineCap = 'round';
  for (const [w, color] of [
    [0.07, '#6b4318'],
    [0.035, '#d6ad6a'],
  ] as const) {
    for (let i = 0; i <= cells; i++) {
      for (const across of [true, false]) {
        ctx.beginPath();
        for (let j = 0; j <= 12; j++) {
          const [px, py] = across ? at(j / 12, i / cells) : at(i / cells, j / 12);
          if (j === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        stroke(ctx, color, s * w);
      }
    }
  }
  // Knots where the ropes cross.
  ctx.fillStyle = '#5a3812';
  for (let i = 0; i <= cells; i++) {
    for (let j = 0; j <= cells; j++) {
      const [px, py] = at(i / cells, j / cells);
      ctx.beginPath();
      ctx.arc(px, py, s * 0.035, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (level >= 3) {
    for (const u of [0, 1]) {
      const [px, py] = at(u, 1);
      ctx.beginPath();
      ctx.arc(px, py + s * 0.05, s * 0.07, 0, Math.PI * 2);
      ctx.fillStyle = level >= 5 ? '#e0b84a' : '#8a8a80';
      ctx.fill();
      stroke(ctx, '#3a3a30', s * 0.02);
    }
  }
}

/** 鼓: a red war drum with a skin head and gold studs, its two sticks crossed above; more studs and a gold rim later. */
function drum(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, level: number): void {
  const rx = s * 0.36;
  const ry = s * 0.13;
  const top = y - s * 0.08;
  const bottom = y + s * 0.32;
  // Body: a barrel between the two rims.
  ctx.beginPath();
  ctx.moveTo(x - rx, top);
  ctx.quadraticCurveTo(x - rx * 1.12, (top + bottom) / 2, x - rx, bottom);
  ctx.ellipse(x, bottom, rx, ry, 0, Math.PI, 0, true);
  ctx.quadraticCurveTo(x + rx * 1.12, (top + bottom) / 2, x + rx, top);
  ctx.closePath();
  const g = ctx.createLinearGradient(x - rx, 0, x + rx, 0);
  g.addColorStop(0, '#7a1410');
  g.addColorStop(0.45, '#d8382a');
  g.addColorStop(1, '#7a1410');
  ctx.fillStyle = g;
  ctx.fill();
  stroke(ctx, '#4a0c08', s * 0.03);
  // Studs along both rims.
  const studs = level >= 3 ? 7 : 5;
  ctx.fillStyle = '#f0c24a';
  for (const ry0 of [top + ry * 0.55, bottom - ry * 0.2]) {
    for (let i = 0; i < studs; i++) {
      const a = Math.PI * (0.15 + (0.7 * i) / (studs - 1));
      ctx.beginPath();
      ctx.arc(x - Math.cos(a) * rx * 0.96, ry0 + Math.sin(a) * ry * 0.5, s * 0.025, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // The head.
  ctx.beginPath();
  ctx.ellipse(x, top, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#f3e2bc';
  ctx.fill();
  stroke(ctx, level >= 4 ? '#e0a100' : '#6a3a14', s * (level >= 4 ? 0.05 : 0.035));
  if (level >= 2) {
    ctx.beginPath();
    ctx.ellipse(x, top, rx * 0.45, ry * 0.45, 0, 0, Math.PI * 2);
    stroke(ctx, 'rgba(184,50,31,0.55)', s * 0.03);
  }
  // Two sticks crossing over the head, knobs down.
  ctx.lineCap = 'round';
  for (const sgn of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + sgn * s * 0.42, y - s * 0.46);
    ctx.lineTo(x - sgn * s * 0.08, top - s * 0.02);
    stroke(ctx, '#5a3412', s * 0.06);
    stroke(ctx, '#a8702e', s * 0.03);
    ctx.beginPath();
    ctx.arc(x - sgn * s * 0.08, top - s * 0.02, s * 0.05, 0, Math.PI * 2);
    ctx.fillStyle = '#c8322a';
    ctx.fill();
  }
  if (level >= 5) {
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + sgn * rx, top + s * 0.02);
      ctx.quadraticCurveTo(x + sgn * rx * 1.25, y + s * 0.12, x + sgn * rx * 1.1, y + s * 0.3);
      stroke(ctx, '#e0a100', s * 0.03);
    }
  }
}

/** 镜: a round bronze mirror on a little stand, its face catching a glint; patterned rim and a brighter glint later. */
function mirror(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, level: number): void {
  const cy = y - s * 0.05;
  const r = s * 0.38;
  if (level >= 3) {
    // A wooden stand under it.
    ctx.beginPath();
    ctx.moveTo(x - s * 0.26, y + s * 0.44);
    ctx.lineTo(x, cy + r * 0.6);
    ctx.lineTo(x + s * 0.26, y + s * 0.44);
    ctx.lineCap = 'round';
    stroke(ctx, '#6a3a14', s * 0.06);
  }
  const rim = ctx.createLinearGradient(x - r, cy - r, x + r, cy + r);
  rim.addColorStop(0, '#f0c27a');
  rim.addColorStop(0.5, '#a8742c');
  rim.addColorStop(1, '#6e4606');
  ctx.beginPath();
  ctx.arc(x, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = rim;
  ctx.fill();
  stroke(ctx, '#4a2e08', s * 0.03);
  const face = ctx.createRadialGradient(x - r * 0.3, cy - r * 0.3, r * 0.1, x, cy, r * 0.8);
  face.addColorStop(0, '#fffaf0');
  face.addColorStop(0.6, '#d9d2c2');
  face.addColorStop(1, '#a89c80');
  ctx.beginPath();
  ctx.arc(x, cy, r * 0.78, 0, Math.PI * 2);
  ctx.fillStyle = face;
  ctx.fill();
  if (level >= 2) {
    // Dots punched around the rim, like the patterns on a 铜镜.
    ctx.fillStyle = '#5a3a0a';
    const dots = level >= 4 ? 16 : 10;
    for (let i = 0; i < dots; i++) {
      const a = (i / dots) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * r * 0.89, cy + Math.sin(a) * r * 0.89, s * 0.018, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // The glint: a bright streak across the face, and a sparkle.
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, cy, r * 0.78, 0, Math.PI * 2);
  ctx.clip();
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - r * 0.7, cy + r * 0.2);
  ctx.lineTo(x + r * 0.2, cy - r * 0.7);
  stroke(ctx, 'rgba(255,255,255,0.9)', s * (level >= 5 ? 0.09 : 0.06));
  ctx.beginPath();
  ctx.moveTo(x - r * 0.35, cy + r * 0.45);
  ctx.lineTo(x + r * 0.45, cy - r * 0.35);
  stroke(ctx, 'rgba(255,255,255,0.55)', s * 0.03);
  ctx.restore();
  drawStar(ctx, x + r * 0.45, cy - r * 0.5, s * (level >= 4 ? 0.1 : 0.07), '#ffffff');
}

/** The B5 painters, keyed like unit-art.ts's table. */
export const EXTRA_PAINTERS: Partial<Record<UnitId, UnitPainter>> = { 毒: vial, 网: net, 鼓: drum, 镜: mirror };
