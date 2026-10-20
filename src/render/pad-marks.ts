// Live marks of the four later pads, drawn by the renderer every frame under the cards (their stone is painted into
// the map image by pad-art-extra.ts): a lit 烽火台's fire and the ring of its reach, the cord of a 双生台 pair glowing
// gold while the same fighter stands on both, and the pearls of a 灵泉's layers. Also the little flame over a monster
// a lit 烽火台 is marking.
import { BEACON } from '../config/maps.ts';
import type { Pt } from '../core/map.ts';
import { beaconLit, twinHaste } from '../core/slots.ts';
import type { GameState } from '../core/types.ts';
import { AZURE, INK } from './ink.ts';
import { BASKET, cordCurve, pearlAt } from './pad-art-extra.ts';

/** One flame tongue rising `h` from (x, y), `w` wide, in `fill` with an ink outline. */
function tongue(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, lean: number, fill: string): void {
  ctx.beginPath();
  ctx.moveTo(x - w, y);
  ctx.quadraticCurveTo(x - w * 0.9, y - h * 0.6, x + lean, y - h);
  ctx.quadraticCurveTo(x + w * 0.9, y - h * 0.6, x + w, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

/** The fire burning in a lit 烽火台's basket: a warm glow and three flickering tongues. */
function beaconFire(ctx: CanvasRenderingContext2D, p: Pt, time: number): void {
  const x = p.x + BASKET[0];
  const y = p.y + BASKET[1] - 1;
  const glow = ctx.createRadialGradient(x, y - 4, 1, x, y - 4, 20);
  glow.addColorStop(0, 'rgba(255,170,70,0.45)');
  glow.addColorStop(1, 'rgba(255,170,70,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y - 4, 20, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 3; i++) {
    const f = Math.sin(time * 9 + i * 2.1);
    const dx = (i - 1) * 3.4;
    tongue(ctx, x + dx, y, 3.4, 9 + (i === 1 ? 4 : 0) + f * 2, f * 1.5, '#ff8a2a');
  }
  tongue(ctx, x, y, 2.2, 6 + Math.sin(time * 11) * 1.5, 0, '#ffd65a');
}

/** The reach of a lit 烽火台: a faint cinnabar disc with a slowly turning dashed rim. `k` = 1 / zoom. */
function beaconRing(ctx: CanvasRenderingContext2D, p: Pt, time: number, k: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(p.x, p.y, BEACON.range, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(185,54,42,0.06)';
  ctx.fill();
  ctx.setLineDash([8 * k, 6 * k]);
  ctx.lineDashOffset = -time * 6;
  ctx.lineWidth = 1.5 * k;
  ctx.strokeStyle = 'rgba(185,54,42,0.45)';
  ctx.stroke();
  ctx.restore();
}

/** The point at `t` (0..1) along the quadratic curve s -> e bending towards c. */
function along(s: Pt, c: Pt, e: Pt, t: number): Pt {
  const u = 1 - t;
  return { x: u * u * s.x + 2 * t * u * c.x + t * t * e.x, y: u * u * s.y + 2 * t * u * c.y + t * t * e.y };
}

/** A 双生台 pair's cord lit up gold, with two sparks running along it. */
function twinGlow(ctx: CanvasRenderingContext2D, a: Pt, b: Pt, r: number, time: number): void {
  const [s, c, e] = cordCurve(a, b, r);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(s.x, s.y);
  ctx.quadraticCurveTo(c.x, c.y, e.x, e.y);
  ctx.lineCap = 'round';
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(255,214,110,0.5)';
  ctx.stroke();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = '#ffe9a8';
  ctx.stroke();
  for (let j = 0; j < 2; j++) {
    const t = (time * 0.6 + j / 2) % 1;
    const q = along(s, c, e, t);
    ctx.beginPath();
    ctx.moveTo(q.x, q.y - 3.2);
    ctx.lineTo(q.x + 1, q.y - 1);
    ctx.lineTo(q.x + 3.2, q.y);
    ctx.lineTo(q.x + 1, q.y + 1);
    ctx.lineTo(q.x, q.y + 3.2);
    ctx.lineTo(q.x - 1, q.y + 1);
    ctx.lineTo(q.x - 3.2, q.y);
    ctx.lineTo(q.x - 1, q.y - 1);
    ctx.closePath();
    ctx.fillStyle = '#fff7d6';
    ctx.fill();
  }
  ctx.restore();
}

/** The pearls of the `layers` a card on a 灵泉 has soaked up, set into the sockets on the drum's front. */
function springPearls(ctx: CanvasRenderingContext2D, p: Pt, layers: number, r: number, time: number): void {
  for (let i = 0; i < layers; i++) {
    const [dx, dy] = pearlAt(i, r);
    const x = p.x + dx;
    const y = p.y + dy;
    const glow = ctx.createRadialGradient(x, y, 0.5, x, y, 6);
    glow.addColorStop(0, `rgba(190,236,250,${0.55 + 0.2 * Math.sin(time * 3 + i)})`);
    glow.addColorStop(1, 'rgba(190,236,250,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, 2.6, 0, Math.PI * 2);
    ctx.fillStyle = '#e4f7ff';
    ctx.fill();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = AZURE;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x - 0.8, y - 0.8, 0.8, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }
}

/** Every live mark of the later pads on unlocked pads; `r` is the pad radius, `k` = 1 / zoom. */
export function drawPadMarks(ctx: CanvasRenderingContext2D, g: GameState, r: number, time: number, k: number): void {
  const { slots, slotKind, twin } = g.map;
  for (const cell of g.map.beacons) if (g.unlocked[cell] && beaconLit(g, cell)) beaconRing(ctx, slots[cell], time, k);
  for (let i = 0; i < slots.length; i++) {
    if (!g.unlocked[i]) continue;
    const kind = slotKind[i];
    if (kind === 'beacon' && beaconLit(g, i)) beaconFire(ctx, slots[i], time);
    else if (kind === 'twin' && twin[i] > i && twinHaste(g, i) > 0) twinGlow(ctx, slots[i], slots[twin[i]], r, time);
    else if (kind === 'spring') springPearls(ctx, slots[i], g.slots[i]?.spring ?? 0, r, time);
  }
}

/** The little cinnabar flame left of a monster's HP bar while a lit 烽火台 is marking it; (x, y) is its base. */
export function drawBeaconMark(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  tongue(ctx, x, y, 2.6, 7, 0.6, '#e2582f');
  tongue(ctx, x, y, 1.4, 4, 0, '#ffd65a');
}
