// The four heroes standing on their pads (the 字旗＋小兵 look): a bigger figure than a soldier, with the hero's
// portrait for a head and the hero's own weapon, posed by `a` like troop-parts.ts's soldiers: 悟空 thrusts the 金箍棒
// out, 八戒 brings the rake down, 沙僧 swings the crescent spade, 白龙 lifts a glowing pearl.
import type { HeroId } from '../core/types.ts';
import { drawPortrait } from './heroes-art.ts';
import { ink, INK } from './ink.ts';

/** How much bigger a hero stands than a soldier. */
export const HERO_SCALE = 1.2;

const SKIN = '#f0d2ae';
const GOLD = '#e2b13c';

const lerp = (a: number, b: number, t: number): number => a + (b - a) * Math.max(0, Math.min(1, t));

const CLOTH: Record<HeroId, string> = { 悟空: '#c0392b', 八戒: '#7a4ea6', 沙僧: '#2b6585', 白龙: '#e9eef2' };

function line(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, w: number, color: string): void {
  ctx.lineCap = 'round';
  for (const [lw, c] of [
    [w + 1.6, INK],
    [w, color],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineWidth = lw;
    ctx.strokeStyle = c;
    ctx.stroke();
  }
}

function hand(ctx: CanvasRenderingContext2D, sx: number, sy: number, hx: number, hy: number, cloth: string): void {
  line(ctx, sx, sy, hx, hy, 2.2, cloth);
  ctx.beginPath();
  ctx.arc(hx, hy, 1.5, 0, Math.PI * 2);
  ctx.fillStyle = SKIN;
  ctx.fill();
}

/** The weapon's angle for a swing like a soldier's staff: resting up, raised back, then down in front. */
function swingAngle(a: number, rest: number, back: number, down: number): number {
  if (a <= 0) return rest;
  if (a < 0.4) return lerp(rest, back, a / 0.4);
  if (a < 0.6) return lerp(back, down, (a - 0.4) / 0.2);
  return lerp(down, rest, (a - 0.6) / 0.4);
}

function weapon(ctx: CanvasRenderingContext2D, id: HeroId, a: number, time: number): void {
  const cloth = CLOTH[id];
  switch (id) {
    case '悟空': {
      // The 金箍棒 rests upright; on the strike it shoots out level and long.
      const out = a > 0.25 && a < 0.7;
      const th = out ? 0 : -1.35;
      const len = out ? 24 : 15;
      const hx = 5;
      const hy = -12;
      const dx = Math.cos(th);
      const dy = Math.sin(th);
      line(ctx, hx - dx * 9, hy - dy * 9, hx + dx * len, hy + dy * len, 1.9, GOLD);
      for (const k of [-9, len]) {
        ctx.beginPath();
        ctx.arc(hx + dx * k, hy + dy * k, 1.6, 0, Math.PI * 2);
        ctx.fillStyle = '#c8322a';
        ctx.fill();
      }
      hand(ctx, 2.6, -13.4, hx, hy, cloth);
      hand(ctx, -1.6, -13.2, hx - dx * 4, hy - dy * 4, cloth);
      break;
    }
    case '八戒': {
      // Reason: the rake rests up in front; resting over the shoulder it would lie across the banner behind.
      const th = swingAngle(a, -1.25, -2.5, 0.55);
      const hx = 4;
      const hy = -12;
      const dx = Math.cos(th);
      const dy = Math.sin(th);
      const ex = hx + dx * 15;
      const ey = hy + dy * 15;
      line(ctx, hx - dx * 6, hy - dy * 6, ex, ey, 1.5, '#7a5a3a');
      // The rake's head: a bar across the end with five teeth.
      const nx = -dy;
      const ny = dx;
      line(ctx, ex - nx * 5, ey - ny * 5, ex + nx * 5, ey + ny * 5, 1.4, '#b9c2c8');
      ctx.beginPath();
      for (let i = -2; i <= 2; i++) {
        ctx.moveTo(ex + nx * i * 2.4, ey + ny * i * 2.4);
        ctx.lineTo(ex + nx * i * 2.4 + dx * 3.4, ey + ny * i * 2.4 + dy * 3.4);
      }
      ctx.lineWidth = 1;
      ctx.strokeStyle = INK;
      ctx.stroke();
      hand(ctx, 2.4, -13.4, hx, hy, cloth);
      hand(ctx, -1.8, -13, hx - dx * 4, hy - dy * 4, cloth);
      break;
    }
    case '沙僧': {
      const tilt = a <= 0 ? 0 : a < 0.45 ? (a / 0.45) * 1 : lerp(1, 0, (a - 0.45) / 0.55);
      const th = -Math.PI / 2 + tilt;
      const hx = 5;
      const hy = -11.5;
      const dx = Math.cos(th);
      const dy = Math.sin(th);
      const tx = hx + dx * 16;
      const ty = hy + dy * 16;
      line(ctx, hx - dx * 8, hy - dy * 8, tx, ty, 1.3, '#7a5a3a');
      // The crescent blade on top, opening forward.
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(th + Math.PI / 2);
      ctx.beginPath();
      ctx.arc(0, -1, 5, Math.PI * 1.1, Math.PI * 1.9);
      ctx.arc(0, 1.5, 3.4, Math.PI * 1.85, Math.PI * 1.15, true);
      ctx.closePath();
      ctx.fillStyle = '#d8e4ee';
      ctx.fill();
      ctx.lineWidth = 0.9;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.restore();
      hand(ctx, 2.6, -13.4, hx, hy, cloth);
      hand(ctx, -1.8, -13, -3.8, -9, cloth);
      break;
    }
    case '白龙': {
      // A pearl held out, lifted high and glowing on the strike.
      const up = a <= 0 ? 0 : a < 0.3 ? a / 0.3 : a < 0.6 ? 1 : lerp(1, 0, (a - 0.6) / 0.4);
      const hx = lerp(6, 3, up);
      const hy = lerp(-12, -27, up);
      const glow = 0.35 + 0.15 * Math.sin(time * 4) + up * 0.4;
      const g = ctx.createRadialGradient(hx, hy - 3, 0.5, hx, hy - 3, 7);
      g.addColorStop(0, `rgba(220,240,255,${glow.toFixed(3)})`);
      g.addColorStop(1, 'rgba(160,210,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(hx - 7, hy - 10, 14, 14);
      ctx.beginPath();
      ctx.arc(hx, hy - 3, 2.8, 0, Math.PI * 2);
      ctx.fillStyle = '#eaf6ff';
      ctx.fill();
      ctx.lineWidth = 0.9;
      ctx.strokeStyle = INK;
      ctx.stroke();
      hand(ctx, 2.6, -13.4, hx, hy, cloth);
      hand(ctx, -1.8, -13, -3.8, -9, cloth);
      break;
    }
  }
}

/** Where a hero's attack leaves, in its own right-facing coordinates at normal size (multiply by HERO_SCALE). */
export function heroTip(id: HeroId): readonly [number, number] {
  switch (id) {
    case '悟空':
      return [28, -12];
    case '八戒':
      return [14, -6];
    case '沙僧':
      return [12, -26];
    case '白龙':
      return [3, -30];
  }
}

/** A hero standing at (x, y), facing `face`, in pose `a`; gilded heroes get gold trim. */
export function drawHeroFigure(ctx: CanvasRenderingContext2D, x: number, y: number, id: HeroId, face: number, a: number, time: number, gilded: boolean): void {
  const s = HERO_SCALE;
  ctx.beginPath();
  ctx.ellipse(x + 1, y + 1, 7.5 * s, 2.6 * s, 0, 0, Math.PI * 2);
  ctx.fillStyle = ink(0.26);
  ctx.fill();
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(face * s, s);
  ctx.translate(0, Math.sin(time * 3 + x * 0.3) * 0.45);
  if (a > 0.35 && a < 0.7) ctx.rotate(0.1);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#3a3330';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(-2.2, -6);
  ctx.lineTo(-2.8, 0);
  ctx.moveTo(2.2, -6);
  ctx.lineTo(3, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-5.6, -4.6);
  ctx.lineTo(5.6, -4.6);
  ctx.lineTo(4, -14.6);
  ctx.lineTo(-4, -14.6);
  ctx.closePath();
  ctx.fillStyle = CLOTH[id];
  ctx.fill();
  ctx.lineWidth = 1.1;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.fillStyle = gilded ? GOLD : '#d9a531';
  ctx.fillRect(-5, -9.6, 10, 1.9);
  drawPortrait(ctx, id, 0, -19.8, 6);
  weapon(ctx, id, a, time);
  ctx.restore();
}
