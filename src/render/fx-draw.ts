// Drawing for individual effects, particles and projectiles. Pure functions of their inputs;
// the Vfx class owns the state and timing.
import type { ShotKind } from '../core/types.ts';
import { drawCoin, drawStar, hash01, outlined, roundRect, text } from './draw.ts';
import { brush, sans } from './fonts.ts';
import { drawPortrait } from './heroes-art.ts';

export type FxKind = 'swing' | 'bolt' | 'beam' | 'slam' | 'dragon' | 'ring' | 'burst' | 'seal' | 'slash';

export interface Fx {
  kind: FxKind;
  x: number;
  y: number;
  x2: number;
  y2: number;
  color: string;
  size: number;
  t: number;
  life: number;
  seed: number;
}

export type ParticleShape = 'dot' | 'ink' | 'star' | 'snow' | 'coin' | 'ember';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  size: number;
  color: string;
  shape: ParticleShape;
  t: number;
  life: number;
}

export interface Floater {
  x: number;
  y: number;
  msg: string;
  color: string;
  px: number;
  brushFont: boolean;
  t: number;
  life: number;
}

function drawBolt(ctx: CanvasRenderingContext2D, f: Fx, k: number): void {
  const pts: Array<[number, number]> = [];
  const n = 7;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const jitter = i === 0 || i === n ? 0 : (hash01(f.seed * 31 + i) - 0.5) * 22;
    pts.push([f.x + (f.x2 - f.x) * t + jitter, f.y + (f.y2 - f.y) * t]);
  }
  ctx.lineJoin = 'round';
  for (const [w, color, a] of [
    [9, f.color, 0.35],
    [3.5, '#ffffff', 1],
  ] as const) {
    ctx.globalAlpha = a * (1 - k);
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.lineWidth = w;
    ctx.strokeStyle = color;
    ctx.stroke();
  }
  ctx.globalAlpha = (1 - k) * 0.6;
  ctx.beginPath();
  ctx.arc(f.x2, f.y2, 16 + 10 * k, 0, Math.PI * 2);
  ctx.fillStyle = f.color;
  ctx.fill();
}

/** 金箍棒: a golden staff with red bands at both ends, thinning as it retracts. */
function drawBeam(ctx: CanvasRenderingContext2D, f: Fx, k: number): void {
  const w = 4 + 7 * (1 - k);
  ctx.lineCap = 'round';
  ctx.globalAlpha = 1 - k * 0.6;
  ctx.beginPath();
  ctx.moveTo(f.x, f.y);
  ctx.lineTo(f.x2, f.y2);
  ctx.lineWidth = w + 6;
  ctx.strokeStyle = 'rgba(255,200,60,0.35)';
  ctx.stroke();
  ctx.lineWidth = w + 2;
  ctx.strokeStyle = '#6b4308';
  ctx.stroke();
  ctx.lineWidth = w;
  ctx.strokeStyle = '#f5c542';
  ctx.stroke();
  const len = Math.hypot(f.x2 - f.x, f.y2 - f.y) || 1;
  const ux = (f.x2 - f.x) / len;
  const uy = (f.y2 - f.y) / len;
  for (const [sx, sy] of [
    [f.x, f.y],
    [f.x2 - ux * 10, f.y2 - uy * 10],
  ]) {
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + ux * 10, sy + uy * 10);
    ctx.lineWidth = w;
    ctx.strokeStyle = '#c8322a';
    ctx.stroke();
  }
}

function drawDragon(ctx: CanvasRenderingContext2D, f: Fx, k: number): void {
  const at = (p: number) => ({ x: f.x + (f.x2 - f.x) * p, y: f.y + Math.sin(p * Math.PI * 4) * 26 });
  ctx.globalAlpha = k > 0.8 ? (1 - k) / 0.2 : 1;
  for (let i = 14; i >= 1; i--) {
    const p = Math.max(0, k - i * 0.022);
    const s = at(p);
    ctx.beginPath();
    ctx.arc(s.x, s.y, 13 - i * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = i % 2 ? '#f5f8fc' : '#dbe8f6';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#4f8fd0';
    ctx.stroke();
  }
  const head = at(k);
  drawPortrait(ctx, '白龙', head.x, head.y, 17);
}

export function drawFx(ctx: CanvasRenderingContext2D, f: Fx): void {
  const k = Math.min(1, f.t / f.life);
  ctx.save();
  switch (f.kind) {
    case 'swing': {
      const dir = Math.atan2(f.y2 - f.y, f.x2 - f.x);
      ctx.globalAlpha = 1 - k;
      ctx.beginPath();
      ctx.arc(f.x2, f.y2, f.size, dir - 1.2 + k * 1.2, dir + 0.2 + k * 1.2);
      ctx.lineWidth = 6 * (1 - k) + 1;
      ctx.strokeStyle = f.color;
      ctx.lineCap = 'round';
      ctx.stroke();
      break;
    }
    case 'bolt':
      drawBolt(ctx, f, k);
      break;
    case 'beam':
      drawBeam(ctx, f, k);
      break;
    case 'slam': {
      ctx.globalAlpha = 1 - k;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.size * (0.3 + 0.7 * k), 0, Math.PI * 2);
      ctx.lineWidth = 9 * (1 - k) + 1;
      ctx.strokeStyle = f.color;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.size * 0.6 * (0.3 + 0.7 * k), 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255,245,220,0.8)';
      ctx.stroke();
      break;
    }
    case 'dragon':
      drawDragon(ctx, f, k);
      break;
    case 'ring':
      ctx.globalAlpha = 1 - k;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.size * (0.35 + 0.65 * k), 0, Math.PI * 2);
      ctx.lineWidth = 4 * (1 - k) + 1;
      ctx.strokeStyle = f.color;
      ctx.stroke();
      break;
    case 'burst': {
      const r = f.size * (0.4 + 0.6 * k);
      const g = ctx.createRadialGradient(f.x, f.y, 1, f.x, f.y, r);
      g.addColorStop(0, `rgba(255,245,200,${0.95 * (1 - k)})`);
      g.addColorStop(0.45, `rgba(255,140,40,${0.8 * (1 - k)})`);
      g.addColorStop(1, 'rgba(200,40,10,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'seal': {
      // A red chop stamped down onto the card.
      const scale = k < 0.3 ? 2.4 - (k / 0.3) * 1.4 : 1;
      ctx.globalAlpha = k < 0.75 ? 1 : (1 - k) / 0.25;
      ctx.translate(f.x, f.y);
      ctx.rotate(-0.12);
      ctx.scale(scale, scale);
      roundRect(ctx, -14, -14, 28, 28, 4);
      ctx.fillStyle = '#c8001f';
      ctx.fill();
      text(ctx, '神', 0, 1, brush(22), '#fff4ec');
      break;
    }
    case 'slash':
      ctx.globalAlpha = 1 - k;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.size, -2.4 + k, -0.6 + k);
      ctx.lineWidth = 5 * (1 - k) + 1;
      ctx.strokeStyle = f.color;
      ctx.lineCap = 'round';
      ctx.stroke();
      break;
  }
  ctx.restore();
}

export function drawParticle(ctx: CanvasRenderingContext2D, p: Particle): void {
  const k = p.t / p.life;
  ctx.globalAlpha = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
  switch (p.shape) {
    case 'star':
      drawStar(ctx, p.x, p.y, p.size, p.color);
      break;
    case 'coin':
      drawCoin(ctx, p.x, p.y, p.size);
      break;
    case 'snow':
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      break;
    case 'ember': {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
      g.addColorStop(0, p.color);
      g.addColorStop(1, 'rgba(255,90,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    default:
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.shape === 'ink' ? p.size * (1 + k * 0.6) : p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function drawFloater(ctx: CanvasRenderingContext2D, f: Floater): void {
  const k = f.t / f.life;
  ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
  const pop = k < 0.12 ? 0.6 + (k / 0.12) * 0.4 : 1;
  outlined(ctx, f.msg, f.x, f.y - k * 26, f.brushFont ? brush(Math.round(f.px * pop)) : sans(Math.round(f.px * pop), 800), f.color);
  ctx.globalAlpha = 1;
}

/** Projectiles, oriented along their direction of travel. */
export function drawProjectile(ctx: CanvasRenderingContext2D, kind: ShotKind, x: number, y: number, dx: number, dy: number, divine: boolean): void {
  const a = Math.atan2(dy, dx);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  if (divine) {
    ctx.shadowColor = 'rgba(255,200,60,0.9)';
    ctx.shadowBlur = 8;
  }
  switch (kind) {
    case 'arrow':
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#6b4a2a';
      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.lineTo(6, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(4, -3.5);
      ctx.lineTo(4, 3.5);
      ctx.closePath();
      ctx.fillStyle = '#3a3a3a';
      ctx.fill();
      ctx.fillStyle = '#e8e2d0';
      ctx.fillRect(-13, -3, 5, 2);
      ctx.fillRect(-13, 1, 5, 2);
      break;
    case 'fire': {
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 9);
      g.addColorStop(0, '#fff6c8');
      g.addColorStop(0.5, '#ff9a2a');
      g.addColorStop(1, 'rgba(220,50,10,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'ice':
      ctx.beginPath();
      ctx.moveTo(9, 0);
      ctx.lineTo(0, -4);
      ctx.lineTo(-8, 0);
      ctx.lineTo(0, 4);
      ctx.closePath();
      ctx.fillStyle = '#9fe4ff';
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = '#2a8fc0';
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-1, -1.5, 5, 1.5);
      break;
    case 'crescent':
      ctx.rotate(performance.now() / 60);
      ctx.beginPath();
      ctx.arc(0, 0, 9, -1.3, 1.3);
      ctx.arc(-4, 0, 7, 1.1, -1.1, true);
      ctx.closePath();
      ctx.fillStyle = '#d8e4ee';
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = '#2b6585';
      ctx.stroke();
      break;
    default:
      break;
  }
  ctx.restore();
}
