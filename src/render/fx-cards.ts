// Drawing for the B5 cards on the field: 毒's needle and 网's net in flight (fx-draw.ts drawProjectile calls these after
// turning the canvas along the flight), the poison bubbles and the net over a monster (renderer.ts drawStatus).
// Pure functions of their inputs; the renderer and Vfx own the timing.
import { uidPhase } from './monster-pose.ts';

const ROPE_DARK = '#6b4318';
const ROPE_LIGHT = '#d6ad6a';
const STONE = '#7a7a70';

/** 毒's needle in flight, pointing along +x: a steel shaft, a green-dipped point and a drop of poison trailing it. */
export function drawNeedleShot(ctx: CanvasRenderingContext2D): void {
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-9, 0);
  ctx.lineTo(5, 0);
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = '#4a5560';
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#dfe7ee';
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(4, -1.9);
  ctx.lineTo(4, 1.9);
  ctx.closePath();
  ctx.fillStyle = '#3fbf2a';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-11, 0, 1.7, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(120,235,90,0.85)';
  ctx.fill();
}

/** 网 in flight: a bundled rope net tumbling (`spin` radians) around the stones that weight it. */
export function drawNetShot(ctx: CanvasRenderingContext2D, spin: number): void {
  const r = 8;
  ctx.rotate(spin);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(214,173,106,0.35)';
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.beginPath();
  for (let i = -2; i <= 2; i++) {
    ctx.moveTo(i * 4 - r, -r);
    ctx.lineTo(i * 4 + r, r);
    ctx.moveTo(i * 4 + r, -r);
    ctx.lineTo(i * 4 - r, r);
  }
  ctx.lineWidth = 1.1;
  ctx.strokeStyle = ROPE_DARK;
  ctx.stroke();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = ROPE_DARK;
  ctx.stroke();
  ctx.fillStyle = STONE;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 1.9, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Green bubbles rising off a poisoned monster, one per stack: (x, y) is its body's centre and `r` its radius. Each
 * bubble swells as it climbs from the shoulders to above the head and pops; `uid` keeps neighbours out of step.
 */
export function drawPoisonBubbles(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, stacks: number, time: number, uid: number): void {
  const n = Math.min(5, stacks);
  ctx.save();
  for (let i = 0; i < n; i++) {
    const k = (time / 1.3 + i / n + uidPhase(uid)) % 1;
    const bx = x + (i - (n - 1) / 2) * r * 0.3 + Math.sin((k + i) * 6) * r * 0.18;
    const by = y - r * (0.35 + 1.25 * k);
    const br = 1.3 + k * 2.4;
    ctx.globalAlpha = k < 0.8 ? 0.9 : (1 - k) * 4.5;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(130,235,100,0.7)';
    ctx.fill();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = '#2f7a22';
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillRect(bx - br * 0.45, by - br * 0.45, br * 0.4, br * 0.4);
  }
  ctx.restore();
}

/**
 * A rope net over a caught monster, (x, y) its body's centre and `r` its radius: a mesh dome with a weighted hem that
 * twitches as the monster struggles under it.
 */
export function drawNetOver(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, time: number, uid: number): void {
  const rx = r * 1.2;
  const ry = r * 1.1;
  const twitch = Math.sin(time * 11 + uidPhase(uid) * 7) * r * 0.05;
  ctx.save();
  ctx.translate(x + twitch, y - r * 0.12);
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(214,173,106,0.14)';
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.beginPath();
  const gap = r * 0.55;
  for (let d = -2 * rx; d <= 2 * rx; d += gap) {
    ctx.moveTo(d - rx, -ry);
    ctx.lineTo(d + rx, ry);
    ctx.moveTo(d + rx, -ry);
    ctx.lineTo(d - rx, ry);
  }
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = 'rgba(107,67,24,0.95)';
  ctx.stroke();
  ctx.lineWidth = 0.7;
  ctx.strokeStyle = ROPE_LIGHT;
  ctx.stroke();
  ctx.restore();
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = ROPE_DARK;
  ctx.stroke();
  // Stones along the lower hem hold it down.
  ctx.fillStyle = STONE;
  for (const a of [0.45, 1.2, 1.95, 2.7]) {
    ctx.beginPath();
    ctx.arc(Math.cos(a) * rx, Math.sin(a) * ry, Math.max(1.8, r * 0.13), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
