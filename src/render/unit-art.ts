// Illustrations for the cards: one little painting per unit that grows richer with the level
// (more arrows, taller flames, extra coins...), plus the shared level dressing (aura, sparkles, halo).
import type { UnitId } from '../core/types.ts';
import { drawCoin, drawStar } from './draw.ts';

type Painter = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, level: number) => void;

function stroke(ctx: CanvasRenderingContext2D, color: string, width: number): void {
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke();
}

/** 棍: a staff; red bands from level 2, a gold finish from level 4. */
function staff(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, level: number): void {
  const a = -Math.PI / 4;
  const dx = (Math.cos(a) * s) / 2;
  const dy = (Math.sin(a) * s) / 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - dx, y - dy);
  ctx.lineTo(x + dx, y + dy);
  stroke(ctx, '#4a2c08', s * 0.17);
  stroke(ctx, level >= 4 ? '#f5c542' : '#b8752e', s * 0.11);
  if (level >= 2) {
    for (const k of [-0.42, 0.42]) {
      ctx.beginPath();
      ctx.moveTo(x + dx * (k - 0.08), y + dy * (k - 0.08));
      ctx.lineTo(x + dx * (k + 0.08), y + dy * (k + 0.08));
      stroke(ctx, '#c8322a', s * 0.11);
    }
  }
  if (level >= 3) {
    ctx.beginPath();
    ctx.moveTo(x - dx * 0.7, y - dy * 0.7 - s * 0.04);
    ctx.lineTo(x + dx * 0.2, y + dy * 0.2 - s * 0.04);
    stroke(ctx, 'rgba(255,245,210,0.7)', s * 0.03);
  }
}

/** 箭: a bow with one, two or three arrows. */
function bow(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, level: number): void {
  const bx = x - s * 0.12;
  const r = s * 0.44;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(bx, y, r, -Math.PI * 0.42, Math.PI * 0.42);
  stroke(ctx, '#6e4318', s * 0.1);
  stroke(ctx, '#a86a30', s * 0.05);
  const top = { x: bx + Math.cos(-Math.PI * 0.42) * r, y: y + Math.sin(-Math.PI * 0.42) * r };
  ctx.beginPath();
  ctx.moveTo(top.x, top.y);
  ctx.lineTo(top.x, y + (y - top.y));
  stroke(ctx, '#e8e2d0', s * 0.03);
  const n = level >= 5 ? 3 : level >= 3 ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const oy = (i - (n - 1) / 2) * s * 0.16;
    const x0 = x - s * 0.34;
    const x1 = x + s * 0.44;
    ctx.beginPath();
    ctx.moveTo(x0, y + oy);
    ctx.lineTo(x1 - s * 0.08, y + oy);
    stroke(ctx, '#5a4028', s * 0.045);
    ctx.beginPath();
    ctx.moveTo(x1, y + oy);
    ctx.lineTo(x1 - s * 0.14, y + oy - s * 0.07);
    ctx.lineTo(x1 - s * 0.14, y + oy + s * 0.07);
    ctx.closePath();
    ctx.fillStyle = level >= 4 ? '#f0c24a' : '#3a3a3a';
    ctx.fill();
    ctx.fillStyle = '#c8322a';
    ctx.fillRect(x0, y + oy - s * 0.06, s * 0.1, s * 0.04);
    ctx.fillRect(x0, y + oy + s * 0.02, s * 0.1, s * 0.04);
  }
}

function tongue(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, w: number, outer: string, inner: string): void {
  ctx.beginPath();
  ctx.moveTo(x, y - h);
  ctx.bezierCurveTo(x + w, y - h * 0.45, x + w * 0.9, y + h * 0.35, x, y + h * 0.4);
  ctx.bezierCurveTo(x - w * 0.9, y + h * 0.35, x - w, y - h * 0.45, x, y - h);
  ctx.fillStyle = outer;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x, y - h * 0.45);
  ctx.bezierCurveTo(x + w * 0.45, y - h * 0.15, x + w * 0.4, y + h * 0.3, x, y + h * 0.35);
  ctx.bezierCurveTo(x - w * 0.4, y + h * 0.3, x - w * 0.45, y - h * 0.15, x, y - h * 0.45);
  ctx.fillStyle = inner;
  ctx.fill();
}

/** 火: a flame that gains side tongues and embers. */
function flame(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, level: number): void {
  if (level >= 3) {
    tongue(ctx, x - s * 0.26, y + s * 0.12, s * 0.28, s * 0.14, '#e8651a', '#ffb347');
    tongue(ctx, x + s * 0.26, y + s * 0.12, s * 0.3, s * 0.14, '#e8651a', '#ffb347');
  }
  tongue(ctx, x, y + s * 0.08, s * 0.44 + level * s * 0.02, s * 0.26, '#d23a12', '#ff9a2a');
  tongue(ctx, x, y + s * 0.16, s * 0.2, s * 0.12, '#ffd36a', '#fff3b0');
  if (level >= 4) {
    for (const [dx, dy] of [
      [-0.38, -0.3],
      [0.4, -0.22],
      [0.1, -0.5],
    ] as const) {
      ctx.beginPath();
      ctx.arc(x + dx * s, y + dy * s, s * 0.04, 0, Math.PI * 2);
      ctx.fillStyle = '#ffb347';
      ctx.fill();
    }
  }
}

/** 冰: a snowflake, with crystal shards growing around it. */
function ice(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, level: number): void {
  const shards = Math.min(4, Math.floor(level / 2) + (level >= 5 ? 1 : 0));
  for (let i = 0; i < shards; i++) {
    const a = -Math.PI / 2 + ((i + 0.5) / shards) * Math.PI * 2;
    const px = x + Math.cos(a) * s * 0.3;
    const py = y + Math.sin(a) * s * 0.3;
    ctx.beginPath();
    ctx.moveTo(px, py - s * 0.16);
    ctx.lineTo(px + s * 0.07, py);
    ctx.lineTo(px, py + s * 0.16);
    ctx.lineTo(px - s * 0.07, py);
    ctx.closePath();
    ctx.fillStyle = '#bfefff';
    ctx.fill();
    stroke(ctx, '#2a8fc0', s * 0.025);
  }
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI) / 3;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    ctx.beginPath();
    ctx.moveTo(x - ux * s * 0.36, y - uy * s * 0.36);
    ctx.lineTo(x + ux * s * 0.36, y + uy * s * 0.36);
    stroke(ctx, '#1e84b8', s * 0.06);
    stroke(ctx, '#dff6ff', s * 0.03);
    for (const k of [-0.24, 0.24]) {
      const cx = x + ux * s * k;
      const cy = y + uy * s * k;
      for (const sgn of [-1, 1]) {
        const b = a + (sgn * Math.PI) / 3 + (k < 0 ? Math.PI : 0);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(b) * s * 0.1, cy + Math.sin(b) * s * 0.1);
        stroke(ctx, '#dff6ff', s * 0.03);
      }
    }
  }
}

/** 雷: a storm cloud with one to three bolts. */
function thunder(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, level: number): void {
  const n = level >= 5 ? 3 : level >= 3 ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const bx = x + (i - (n - 1) / 2) * s * 0.26;
    ctx.beginPath();
    ctx.moveTo(bx + s * 0.06, y - s * 0.1);
    ctx.lineTo(bx - s * 0.08, y + s * 0.12);
    ctx.lineTo(bx + s * 0.02, y + s * 0.12);
    ctx.lineTo(bx - s * 0.06, y + s * 0.42);
    ctx.lineTo(bx + s * 0.12, y + s * 0.06);
    ctx.lineTo(bx + s * 0.02, y + s * 0.06);
    ctx.closePath();
    ctx.fillStyle = '#ffe45a';
    ctx.fill();
    stroke(ctx, '#b8860b', s * 0.025);
  }
  for (const [dx, dy, r] of [
    [-0.2, -0.16, 0.17],
    [0.02, -0.26, 0.2],
    [0.24, -0.16, 0.16],
  ] as const) {
    ctx.beginPath();
    ctx.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2);
    ctx.fillStyle = level >= 4 ? '#5a3a8a' : '#7a6aa0';
    ctx.fill();
    stroke(ctx, '#3b2a60', s * 0.03);
  }
  ctx.fillStyle = level >= 4 ? '#5a3a8a' : '#7a6aa0';
  ctx.fillRect(x - s * 0.32, y - s * 0.16, s * 0.68, s * 0.12);
}

/** 速: a gust of wind, more swirls and a feather at higher levels. */
function wind(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, level: number): void {
  ctx.lineCap = 'round';
  const n = Math.min(4, 1 + Math.ceil(level / 2));
  for (let i = 0; i < n; i++) {
    const oy = (i - (n - 1) / 2) * s * 0.22;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.4, y + oy);
    ctx.quadraticCurveTo(x + s * 0.1, y + oy - s * 0.06, x + s * 0.3, y + oy);
    ctx.quadraticCurveTo(x + s * 0.44, y + oy + s * 0.08, x + s * 0.22, y + oy + s * 0.14);
    stroke(ctx, '#0d7f73', s * 0.07);
    stroke(ctx, '#8fe3d5', s * 0.03);
  }
  if (level >= 3) {
    ctx.beginPath();
    ctx.ellipse(x + s * 0.28, y - s * 0.3, s * 0.07, s * 0.18, 0.6, 0, Math.PI * 2);
    ctx.fillStyle = '#f7ead0';
    ctx.fill();
    stroke(ctx, '#0d7f73', s * 0.025);
  }
}

/** 钱: copper coins piling up, topped by a gold ingot from level 3. */
function money(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, level: number): void {
  const n = Math.min(4, level);
  for (let i = 0; i < n; i++) drawCoin(ctx, x - s * 0.05 + (i % 2) * s * 0.08, y + s * 0.26 - i * s * 0.12, s * 0.2);
  if (level >= 3) {
    // 元宝: a boat-shaped gold ingot.
    const iy = y - s * 0.2;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.3, iy);
    ctx.quadraticCurveTo(x, iy + s * 0.3, x + s * 0.3, iy);
    ctx.quadraticCurveTo(x + s * 0.2, iy - s * 0.14, x, iy - s * 0.06);
    ctx.quadraticCurveTo(x - s * 0.2, iy - s * 0.14, x - s * 0.3, iy);
    ctx.closePath();
    ctx.fillStyle = '#ffd34a';
    ctx.fill();
    stroke(ctx, '#a8740c', s * 0.03);
    ctx.beginPath();
    ctx.ellipse(x, iy - s * 0.02, s * 0.12, s * 0.06, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#fff0b0';
    ctx.fill();
  }
}

/** 疗: a red gourd with a leaf; it glows at higher levels. */
function gourd(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, level: number): void {
  if (level >= 3) {
    const g = ctx.createRadialGradient(x, y, s * 0.1, x, y, s * 0.5);
    g.addColorStop(0, 'rgba(140,255,170,0.55)');
    g.addColorStop(1, 'rgba(140,255,170,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, s * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const [dy, r] of [
    [0.16, 0.26],
    [-0.18, 0.18],
  ] as const) {
    const g = ctx.createRadialGradient(x - r * s * 0.4, y + dy * s - r * s * 0.4, s * 0.02, x, y + dy * s, r * s);
    g.addColorStop(0, '#ff8a7a');
    g.addColorStop(1, '#b8281e');
    ctx.beginPath();
    ctx.arc(x, y + dy * s, r * s, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    stroke(ctx, '#6a1a12', s * 0.03);
  }
  ctx.fillStyle = '#f0c24a';
  ctx.fillRect(x - s * 0.05, y - s * 0.42, s * 0.1, s * 0.08);
  ctx.beginPath();
  ctx.ellipse(x + s * 0.14, y - s * 0.42, s * 0.14, s * 0.06, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = '#4f9d5b';
  ctx.fill();
  if (level >= 5) {
    ctx.beginPath();
    ctx.ellipse(x - s * 0.16, y - s * 0.4, s * 0.12, s * 0.05, 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** 神: a golden sun with rays. */
function sun(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.lineCap = 'round';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r0 = s * (i % 2 ? 0.3 : 0.34);
    const r1 = s * (i % 2 ? 0.42 : 0.5);
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
    ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
    stroke(ctx, '#e0a100', s * 0.05);
  }
  const g = ctx.createRadialGradient(x, y, 1, x, y, s * 0.3);
  g.addColorStop(0, '#fff6c8');
  g.addColorStop(1, '#f0b93a');
  ctx.beginPath();
  ctx.arc(x, y, s * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  stroke(ctx, '#a8740c', s * 0.035);
}

const PAINTERS: Partial<Record<UnitId, Painter>> = { 棍: staff, 箭: bow, 火: flame, 冰: ice, 雷: thunder, 速: wind, 钱: money, 疗: gourd, 神: sun };

/** Draws the unit's illustration in a box of size `s` centred at (x, y). False when the unit has none (fragments, heroes). */
export function drawUnitIcon(ctx: CanvasRenderingContext2D, id: UnitId, x: number, y: number, s: number, level: number): boolean {
  const painter = PAINTERS[id];
  if (!painter) return false;
  ctx.save();
  ctx.lineJoin = 'round';
  painter(ctx, x, y, s, level);
  ctx.restore();
  return true;
}

/** A torn half of a name scroll: the paper the fragment glyph sits on. `right` = the right half of the name. */
export function drawTornPaper(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, right: boolean): void {
  ctx.save();
  ctx.beginPath();
  const x0 = x - w / 2;
  const x1 = x + w / 2;
  const y0 = y - h / 2;
  const y1 = y + h / 2;
  if (right) {
    ctx.moveTo(x1, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x0 + w * 0.12, y1);
    for (let i = 5; i >= 0; i--) ctx.lineTo(x0 + (i % 2 ? w * 0.14 : 0), y0 + (i / 5) * h);
  } else {
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0, y1);
    ctx.lineTo(x1 - w * 0.12, y1);
    for (let i = 5; i >= 0; i--) ctx.lineTo(x1 - (i % 2 ? w * 0.14 : 0), y0 + (i / 5) * h);
  }
  ctx.closePath();
  ctx.fillStyle = '#fff8e6';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#b8945e';
  ctx.stroke();
  ctx.restore();
}

/** Shared level dressing behind an illustration: an aura ring from level 3, sparkles from 4, a halo at 5. */
export function drawLevelDressing(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, level: number): void {
  if (level < 3) return;
  ctx.save();
  const g = ctx.createRadialGradient(x, y, s * 0.2, x, y, s * 0.62);
  g.addColorStop(0, level >= 5 ? 'rgba(255,200,80,0.55)' : 'rgba(255,230,160,0.4)');
  g.addColorStop(1, 'rgba(255,220,120,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, s * 0.62, 0, Math.PI * 2);
  ctx.fill();
  if (level >= 5) {
    ctx.beginPath();
    ctx.arc(x, y, s * 0.52, 0, Math.PI * 2);
    ctx.setLineDash([3, 4]);
    stroke(ctx, 'rgba(224,160,0,0.8)', s * 0.035);
    ctx.setLineDash([]);
  }
  if (level >= 4) {
    for (const [dx, dy, r] of [
      [-0.5, -0.4, 0.09],
      [0.5, -0.3, 0.07],
      [0.42, 0.45, 0.08],
      [-0.46, 0.4, 0.06],
    ] as const) {
      drawStar(ctx, x + dx * s, y + dy * s, r * s, level >= 5 ? '#ffd34a' : '#ffe9a8');
    }
  }
  ctx.restore();
}
