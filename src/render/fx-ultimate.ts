// Hero ultimates (大招) on screen: one big hand-drawn animation per cast, driven by the `ultimate` sim event.
// Pure drawing in world coordinates; the Vfx class owns the list and the timers.
import type { HeroId } from '../core/types.ts';
import { drawStar, hash01, roundRect } from './draw.ts';
import { drawPortrait } from './heroes-art.ts';

export interface UltFx {
  hero: HeroId;
  /** Caster slot centre. */
  x: number;
  y: number;
  /** Target point. */
  tx: number;
  ty: number;
  /** Road direction at the target (radians). */
  dir: number;
  mapW: number;
  mapH: number;
  /** Victims in hit order. */
  pts: Array<{ x: number; y: number }>;
  t: number;
  life: number;
}

export function ultLife(hero: HeroId, targets: number): number {
  switch (hero) {
    case '悟空':
      return 0.6;
    case '八戒':
      return 0.85;
    case '沙僧':
      return 0.4 + 0.09 * Math.max(1, targets);
    case '白龙':
      return 1.2;
  }
}

const easeOut = (k: number) => 1 - (1 - k) * (1 - k);
const easeIn = (k: number) => k * k;

/** 金箍棒: a thick golden staff with red bands, from (x, y) along angle `a`. */
function staff(ctx: CanvasRenderingContext2D, x: number, y: number, a: number, len: number, w: number): void {
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + ux * len, y + uy * len);
  ctx.lineWidth = w + 4;
  ctx.strokeStyle = '#5a3608';
  ctx.stroke();
  ctx.lineWidth = w;
  ctx.strokeStyle = '#f5c542';
  ctx.stroke();
  for (const s of [0.03, 0.9]) {
    ctx.beginPath();
    ctx.moveTo(x + ux * len * s, y + uy * len * s);
    ctx.lineTo(x + ux * len * (s + 0.07), y + uy * len * (s + 0.07));
    ctx.lineWidth = w;
    ctx.strokeStyle = '#c8322a';
    ctx.stroke();
  }
}

/** 悟空: the staff grows out of the hero's slot and sweeps a wide arc across the road around the target. */
function drawSweep(ctx: CanvasRenderingContext2D, f: UltFx, k: number): void {
  const base = Math.atan2(f.ty - f.y, f.tx - f.x);
  const a0 = base - 1.25;
  const a1 = base + 1.25;
  const a = a0 + (a1 - a0) * easeOut(Math.min(1, k / 0.8));
  const len = (Math.hypot(f.tx - f.x, f.ty - f.y) + 120) * Math.min(1, 0.3 + k / 0.15);
  // Golden trail behind the staff.
  ctx.globalAlpha = 0.5 * (1 - k);
  ctx.beginPath();
  ctx.moveTo(f.x, f.y);
  ctx.arc(f.x, f.y, len, a0, a, false);
  ctx.closePath();
  const g = ctx.createRadialGradient(f.x, f.y, 10, f.x, f.y, len);
  g.addColorStop(0, 'rgba(255,235,140,0.05)');
  g.addColorStop(1, 'rgba(255,200,60,0.85)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.globalAlpha = k > 0.8 ? (1 - k) / 0.2 : 1;
  staff(ctx, f.x, f.y, a, len, 13);
  if (k < 0.5) {
    ctx.globalAlpha = 1 - k / 0.5;
    for (const p of f.pts) drawStar(ctx, p.x, p.y - 10 - k * 30, 7, '#ffe27a');
  }
}

/** 九齿钉耙 with the handle pointing up, head centred at (x, y). */
function rake(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y - 6 * s);
  ctx.lineTo(x, y - 84 * s);
  ctx.lineWidth = 7 * s;
  ctx.strokeStyle = '#5a3608';
  ctx.stroke();
  ctx.lineWidth = 4 * s;
  ctx.strokeStyle = '#b8752e';
  ctx.stroke();
  roundRect(ctx, x - 32 * s, y - 8 * s, 64 * s, 8 * s, 3 * s);
  ctx.fillStyle = '#4a4a52';
  ctx.fill();
  ctx.lineWidth = 1.5 * s;
  ctx.strokeStyle = '#1a1a1e';
  ctx.stroke();
  ctx.lineWidth = 2.4 * s;
  ctx.strokeStyle = '#9a9aa6';
  for (let i = 0; i < 9; i++) {
    const tx = x - 28 * s + i * 7 * s;
    ctx.beginPath();
    ctx.moveTo(tx, y - 1 * s);
    ctx.lineTo(tx, y + 11 * s);
    ctx.stroke();
  }
}

/** 八戒: the rake drops from the sky onto the target and cracks the ground. */
function drawRakeDrop(ctx: CanvasRenderingContext2D, f: UltFx, k: number): void {
  const FALL = 0.3;
  if (k < FALL) {
    const kk = easeIn(k / FALL);
    const y = f.ty - 190 + 190 * kk;
    const s = 1.5 - 0.5 * kk;
    for (const [dy, a] of [
      [-44, 0.12],
      [-22, 0.28],
    ] as const) {
      ctx.globalAlpha = a;
      rake(ctx, f.tx, y + dy, s);
    }
    ctx.globalAlpha = 1;
    rake(ctx, f.tx, y, s);
    return;
  }
  const kk = (k - FALL) / (1 - FALL);
  const grow = easeOut(kk);
  // Flash, then the shockwave ring and cracks.
  if (kk < 0.15) {
    ctx.globalAlpha = (1 - kk / 0.15) * 0.85;
    ctx.beginPath();
    ctx.arc(f.tx, f.ty, 46, 0, Math.PI * 2);
    ctx.fillStyle = '#fff6d6';
    ctx.fill();
  }
  ctx.globalAlpha = 1 - kk;
  ctx.beginPath();
  ctx.arc(f.tx, f.ty, 24 + 86 * grow, 0, Math.PI * 2);
  ctx.lineWidth = 11 * (1 - kk) + 1;
  ctx.strokeStyle = '#c9a46a';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(f.tx, f.ty, 12 + 60 * grow, 0, Math.PI * 2);
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255,245,220,0.85)';
  ctx.stroke();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = 'rgba(60,35,15,0.8)';
  ctx.lineJoin = 'round';
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + hash01(i) * 0.5;
    const len = (30 + 55 * grow) * (0.7 + hash01(i * 3) * 0.3);
    ctx.beginPath();
    ctx.moveTo(f.tx, f.ty);
    for (let j = 1; j <= 3; j++) {
      const r = (len * j) / 3;
      const wob = (hash01(i * 11 + j) - 0.5) * 14;
      ctx.lineTo(f.tx + Math.cos(a) * r - Math.sin(a) * wob, f.ty + Math.sin(a) * r + Math.cos(a) * wob);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = kk < 0.6 ? 1 : (1 - kk) / 0.4;
  rake(ctx, f.tx, f.ty, 1);
}

/** 沙僧: crescents chain from victim to victim, nearest-death first. */
function drawChainSlash(ctx: CanvasRenderingContext2D, f: UltFx, _k: number): void {
  const STEP = 0.09;
  const LIFE = 0.4;
  let prev = { x: f.x, y: f.y };
  f.pts.forEach((p, i) => {
    const tk = (f.t - i * STEP) / LIFE;
    if (tk >= 0 && tk < 1) {
      // Link line, drawn in from the previous victim.
      const reach = Math.min(1, tk * 2.5);
      ctx.globalAlpha = (1 - tk) * 0.85;
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(prev.x + (p.x - prev.x) * reach, prev.y + (p.y - prev.y) * reach);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#bfe4ff';
      ctx.lineCap = 'round';
      ctx.stroke();
      // Two crossing crescents.
      ctx.globalAlpha = 1 - tk;
      ctx.lineWidth = 6 * (1 - tk) + 1.5;
      ctx.strokeStyle = '#eef6fc';
      for (const rot of [0, 2.2]) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 20, -2.3 + tk * 1.4 + rot, -0.5 + tk * 1.4 + rot);
        ctx.stroke();
      }
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#2b6585';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 20, -2.3 + tk * 1.4, -0.5 + tk * 1.4);
      ctx.stroke();
    }
    prev = p;
  });
}

/** A white dragon flying from (x0, y0) to (x1, y1), `p` of the way there. */
function dragon(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, p: number): void {
  const at = (q: number) => ({ x: x0 + (x1 - x0) * q, y: y0 + (y1 - y0) * q + Math.sin(q * Math.PI * 4) * 26 });
  for (let i = 18; i >= 1; i--) {
    const q = Math.max(0, p - i * 0.022);
    const s = at(q);
    ctx.beginPath();
    ctx.arc(s.x, s.y, 15 - i * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = i % 2 ? '#f5f8fc' : '#dbe8f6';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#4f8fd0';
    ctx.stroke();
  }
  const head = at(p);
  drawPortrait(ctx, '白龙', head.x, head.y, 19);
}

/** 白龙: a shockwave from the caster and two dragons sweeping both lanes in opposite directions. */
function drawDragonRoar(ctx: CanvasRenderingContext2D, f: UltFx, k: number): void {
  if (k < 0.55) {
    const kk = k / 0.55;
    ctx.globalAlpha = 1 - kk;
    ctx.beginPath();
    ctx.arc(f.x, f.y, 20 + 300 * easeOut(kk), 0, Math.PI * 2);
    ctx.lineWidth = 14 * (1 - kk) + 1;
    ctx.strokeStyle = '#cfe6ff';
    ctx.stroke();
  }
  const p = easeOut(Math.min(1, k / 0.95));
  ctx.globalAlpha = k > 0.85 ? (1 - k) / 0.15 : 1;
  const y1 = Math.max(60, f.y - 150);
  const y2 = Math.min(f.mapH - 60, f.y + 150);
  dragon(ctx, -50, y1, f.mapW + 50, y1, p);
  dragon(ctx, f.mapW + 50, y2, -50, y2, p);
}

export function drawUltimate(ctx: CanvasRenderingContext2D, f: UltFx): void {
  const k = Math.min(1, f.t / f.life);
  ctx.save();
  switch (f.hero) {
    case '悟空':
      drawSweep(ctx, f, k);
      break;
    case '八戒':
      drawRakeDrop(ctx, f, k);
      break;
    case '沙僧':
      drawChainSlash(ctx, f, k);
      break;
    case '白龙':
      drawDragonRoar(ctx, f, k);
      break;
  }
  ctx.restore();
}
