// Chibi portraits for the heroes (and 师父 for the HUD and the camp), drawn with simple vector shapes in an
// ink-outline style.
import type { HeroId } from '../core/types.ts';
import { COLORS } from './draw.ts';

/** A hero, or 'master': 师父, whom the camp shelters (config/terms.ts MASTER). */
export type PortraitId = HeroId | 'master';

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, outline = 0): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (outline > 0) {
    ctx.lineWidth = outline;
    ctx.strokeStyle = COLORS.ink;
    ctx.stroke();
  }
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string, outline = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (outline > 0) {
    ctx.lineWidth = outline;
    ctx.strokeStyle = COLORS.ink;
    ctx.stroke();
  }
}

/** Two eyes with white highlights; `look` shifts the pupils. */
function eyes(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, gap: number, iris = '#1b120c'): void {
  for (const s of [-1, 1]) {
    circle(ctx, x + s * gap, y, r, '#ffffff', Math.max(1, r * 0.35));
    circle(ctx, x + s * gap, y + r * 0.1, r * 0.62, iris);
    circle(ctx, x + s * gap - r * 0.22, y - r * 0.2, r * 0.22, '#ffffff');
  }
}

function smile(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, lw: number): void {
  ctx.beginPath();
  ctx.arc(x, y - w * 0.6, w, Math.PI * 0.25, Math.PI * 0.75);
  ctx.lineWidth = lw;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineCap = 'round';
  ctx.stroke();
}

function wukong(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  const lw = Math.max(1.2, r * 0.07);
  for (const s of [-1, 1]) {
    circle(ctx, x + s * r * 0.9, y + r * 0.08, r * 0.3, '#8b5a2b', lw);
    circle(ctx, x + s * r * 0.9, y + r * 0.08, r * 0.16, '#f0c08a');
  }
  circle(ctx, x, y, r * 0.88, '#8b5a2b', lw);
  // Heart-shaped face mask.
  ctx.fillStyle = '#f3c897';
  ctx.beginPath();
  ctx.arc(x - r * 0.27, y - r * 0.05, r * 0.36, 0, Math.PI * 2);
  ctx.arc(x + r * 0.27, y - r * 0.05, r * 0.36, 0, Math.PI * 2);
  ctx.fill();
  ellipse(ctx, x, y + r * 0.22, r * 0.56, r * 0.5, '#f3c897');
  // 紧箍: the golden headband with a ring on each side.
  ctx.beginPath();
  ctx.arc(x, y + r * 0.5, r * 0.98, Math.PI * 1.2, Math.PI * 1.8);
  ctx.lineWidth = r * 0.17;
  ctx.strokeStyle = '#f2b632';
  ctx.stroke();
  ctx.lineWidth = lw * 0.8;
  ctx.strokeStyle = '#9a6a0c';
  ctx.stroke();
  for (const s of [-1, 1]) circle(ctx, x + s * r * 0.8, y - r * 0.28, r * 0.1, '#f2b632', lw * 0.7);
  eyes(ctx, x, y + r * 0.02, r * 0.15, r * 0.27);
  circle(ctx, x - r * 0.07, y + r * 0.25, r * 0.04, COLORS.ink);
  circle(ctx, x + r * 0.07, y + r * 0.25, r * 0.04, COLORS.ink);
  smile(ctx, x, y + r * 0.46, r * 0.2, lw);
  for (const s of [-1, 1]) circle(ctx, x + s * r * 0.42, y + r * 0.3, r * 0.08, 'rgba(230,110,90,0.55)');
}

function bajie(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  const lw = Math.max(1.2, r * 0.07);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + s * r * 0.45, y - r * 0.6);
    ctx.quadraticCurveTo(x + s * r * 1.15, y - r * 0.55, x + s * r * 1.02, y + r * 0.25);
    ctx.quadraticCurveTo(x + s * r * 0.75, y - r * 0.1, x + s * r * 0.45, y - r * 0.6);
    ctx.fillStyle = '#ee9ea4';
    ctx.fill();
    ctx.lineWidth = lw;
    ctx.strokeStyle = COLORS.ink;
    ctx.stroke();
  }
  circle(ctx, x, y + r * 0.05, r * 0.85, '#f7bcc0', lw);
  // Black monk's cap.
  ctx.beginPath();
  ctx.ellipse(x, y - r * 0.62, r * 0.6, r * 0.24, 0, Math.PI, 0);
  ctx.lineTo(x + r * 0.6, y - r * 0.5);
  ctx.lineTo(x - r * 0.6, y - r * 0.5);
  ctx.closePath();
  ctx.fillStyle = '#2f2426';
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = COLORS.ink;
  ctx.stroke();
  eyes(ctx, x, y - r * 0.12, r * 0.12, r * 0.3);
  ellipse(ctx, x, y + r * 0.28, r * 0.36, r * 0.26, '#f19aa2', lw);
  ellipse(ctx, x - r * 0.12, y + r * 0.28, r * 0.06, r * 0.09, '#a8505a');
  ellipse(ctx, x + r * 0.12, y + r * 0.28, r * 0.06, r * 0.09, '#a8505a');
  smile(ctx, x, y + r * 0.66, r * 0.18, lw);
}

function shaseng(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  const lw = Math.max(1.2, r * 0.07);
  // Prayer beads (skull necklace) below the chin.
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.15 + (0.7 * i) / 6);
    circle(ctx, x + Math.cos(a) * r * 0.86, y + Math.sin(a) * r * 0.62 + r * 0.25, r * 0.13, i % 2 ? '#f1ead9' : '#8a3a2a', lw * 0.7);
  }
  circle(ctx, x, y - r * 0.05, r * 0.78, '#6f93aa', lw);
  // Bald head highlight.
  ellipse(ctx, x - r * 0.2, y - r * 0.5, r * 0.22, r * 0.1, 'rgba(255,255,255,0.35)');
  // Big red beard.
  ctx.beginPath();
  ctx.moveTo(x - r * 0.62, y + r * 0.05);
  ctx.quadraticCurveTo(x - r * 0.55, y + r * 0.85, x, y + r * 0.95);
  ctx.quadraticCurveTo(x + r * 0.55, y + r * 0.85, x + r * 0.62, y + r * 0.05);
  ctx.quadraticCurveTo(x, y + r * 0.42, x - r * 0.62, y + r * 0.05);
  ctx.fillStyle = '#b4442f';
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = COLORS.ink;
  ctx.stroke();
  // Thick brows over round eyes.
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + s * r * 0.12, y - r * 0.3);
    ctx.lineTo(x + s * r * 0.48, y - r * 0.38);
    ctx.lineWidth = r * 0.1;
    ctx.strokeStyle = '#2a1a14';
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  eyes(ctx, x, y - r * 0.12, r * 0.13, r * 0.3);
  ellipse(ctx, x, y + r * 0.12, r * 0.1, r * 0.07, '#4f6f86');
}

function bailong(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  const lw = Math.max(1.2, r * 0.07);
  // Golden antlers.
  ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + s * r * 0.3, y - r * 0.55);
    ctx.lineTo(x + s * r * 0.62, y - r * 1.02);
    ctx.moveTo(x + s * r * 0.47, y - r * 0.8);
    ctx.lineTo(x + s * r * 0.85, y - r * 0.86);
    ctx.lineWidth = r * 0.14;
    ctx.strokeStyle = '#8a5a0a';
    ctx.stroke();
    ctx.lineWidth = r * 0.08;
    ctx.strokeStyle = '#f0c24a';
    ctx.stroke();
  }
  // Blue mane spikes.
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.9 + (1.2 * i) / 6);
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a - 0.2) * r * 0.7, y + Math.sin(a - 0.2) * r * 0.7);
    ctx.lineTo(x + Math.cos(a) * r * 1.0, y + Math.sin(a) * r * 1.0);
    ctx.lineTo(x + Math.cos(a + 0.2) * r * 0.7, y + Math.sin(a + 0.2) * r * 0.7);
    ctx.fillStyle = '#7fb8e8';
    ctx.fill();
  }
  circle(ctx, x, y - r * 0.1, r * 0.72, '#f5f8fc', lw);
  ellipse(ctx, x, y + r * 0.38, r * 0.46, r * 0.32, '#e8f0f8', lw);
  ellipse(ctx, x - r * 0.14, y + r * 0.33, r * 0.05, r * 0.07, '#5a7a9a');
  ellipse(ctx, x + r * 0.14, y + r * 0.33, r * 0.05, r * 0.07, '#5a7a9a');
  // Whiskers.
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + s * r * 0.35, y + r * 0.4);
    ctx.quadraticCurveTo(x + s * r * 0.95, y + r * 0.3, x + s * r * 1.05, y + r * 0.75);
    ctx.lineWidth = r * 0.05;
    ctx.strokeStyle = '#4f8fd0';
    ctx.stroke();
  }
  eyes(ctx, x, y - r * 0.2, r * 0.13, r * 0.28, '#1f5fa8');
}

/** 师父: a calm monk in a golden five-petal crown. */
function master(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  const lw = Math.max(1, r * 0.08);
  circle(ctx, x, y + r * 0.08, r * 0.8, '#f6d7b5', lw);
  // A golden crown of five petals on a red band.
  for (let i = 0; i < 5; i++) {
    const px = x + (i - 2) * r * 0.3;
    ctx.beginPath();
    ctx.moveTo(px - r * 0.16, y - r * 0.4);
    ctx.quadraticCurveTo(px, y - r * 1.0, px + r * 0.16, y - r * 0.4);
    ctx.closePath();
    ctx.fillStyle = '#f2c14a';
    ctx.fill();
    ctx.lineWidth = lw * 0.7;
    ctx.strokeStyle = COLORS.ink;
    ctx.stroke();
  }
  ctx.fillStyle = '#c8322a';
  ctx.fillRect(x - r * 0.72, y - r * 0.45, r * 1.44, r * 0.16);
  // Calm closed eyes and a red dot on the brow.
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(x + s * r * 0.28, y + r * 0.08, r * 0.12, Math.PI * 0.1, Math.PI * 0.9);
    ctx.lineWidth = lw;
    ctx.strokeStyle = COLORS.ink;
    ctx.stroke();
  }
  circle(ctx, x, y - r * 0.12, r * 0.06, '#c8322a');
  smile(ctx, x, y + r * 0.52, r * 0.16, lw);
}

const PAINTERS: Record<PortraitId, (ctx: CanvasRenderingContext2D, x: number, y: number, r: number) => void> = {
  悟空: wukong,
  八戒: bajie,
  沙僧: shaseng,
  白龙: bailong,
  master,
};

/** Draws a portrait filling a circle of radius r centred at (x, y). */
export function drawPortrait(ctx: CanvasRenderingContext2D, id: PortraitId, x: number, y: number, r: number): void {
  ctx.save();
  ctx.lineJoin = 'round';
  PAINTERS[id](ctx, x, y, r);
  ctx.restore();
}
