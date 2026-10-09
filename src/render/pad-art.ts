// Painted looks of the special build pads (特殊石台), drawn into the map image by map-art.ts's pad():
// 高台 stands taller (a stone drum with a long shadow and a little stair), 法阵 has a golden rune circle cut into
// its stone, 泥沼 is a disc of dark wet mud with bubbles and reeds instead of stone. Pure Canvas, no assets.
// A card covers most of a pad, so each look keeps something visible around the card's bottom and sides.
import type { Pt } from '../core/map.ts';
import { hash01 } from './draw.ts';

/** How much taller a 高台 stands than a plain pad, in world px (its stone side shows below the top). */
const HIGH_H = 10;

/**
 * 高台, everything under its top face: a long shadow, the stone side of the drum and a little stair on the
 * front right. map-art.ts then paints the usual stone top over it.
 */
export function highPlinth(ctx: CanvasRenderingContext2D, p: Pt, r: number, seed: number): void {
  // Reason: a taller block throws a longer shadow, further down and to the right than a plain pad's.
  ctx.beginPath();
  ctx.ellipse(p.x + 7, p.y + HIGH_H + 7, r + 5, r * 0.85, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(40,25,10,0.34)';
  ctx.fill();
  // The drum's side: the top face's outline pushed down by HIGH_H, joined to it at both ends.
  const side = ctx.createLinearGradient(0, p.y, 0, p.y + HIGH_H + r);
  side.addColorStop(0, '#a38660');
  side.addColorStop(1, '#6e5636');
  ctx.beginPath();
  ctx.moveTo(p.x - r, p.y);
  ctx.lineTo(p.x - r, p.y + HIGH_H);
  ctx.arc(p.x, p.y + HIGH_H, r, Math.PI, 0, true);
  ctx.lineTo(p.x + r, p.y);
  ctx.closePath();
  ctx.fillStyle = side;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#5a4220';
  ctx.stroke();
  // A course of masonry halfway down, and a few joints between the blocks.
  ctx.strokeStyle = 'rgba(55,35,12,0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(p.x, p.y + HIGH_H / 2, r, Math.PI * 0.08, Math.PI * 0.92);
  ctx.stroke();
  for (let i = 0; i < 4; i++) {
    const a = Math.PI * (0.2 + 0.2 * i) + (hash01(seed * 5 + i) - 0.5) * 0.15;
    const x = p.x + Math.cos(a) * r;
    const y = p.y + Math.sin(a) * r;
    const half = i % 2 === 0 ? 0 : HIGH_H / 2;
    ctx.beginPath();
    ctx.moveTo(x, y + half);
    ctx.lineTo(x, y + half + HIGH_H / 2);
    ctx.stroke();
  }
  // Three steps down the front right, the lowest furthest out (each a lit tread over a dark riser).
  for (let i = 0; i < 3; i++) {
    const x = p.x + r * 0.5 + i * 5;
    const y = p.y + r * 0.62 + i * 4.5;
    ctx.fillStyle = '#7d6440';
    ctx.fillRect(x, y + 3.5, 12, 4);
    ctx.fillStyle = '#d6c198';
    ctx.fillRect(x, y, 12, 3.5);
    ctx.strokeStyle = '#5a4220';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(x, y, 12, 7.5);
  }
}

/** A tiny rune, one of three shapes, centred at (x, y) and turned to face the pad's centre (`a`). */
function rune(ctx: CanvasRenderingContext2D, x: number, y: number, a: number, s: number, shape: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.beginPath();
  if (shape < 1 / 3) {
    // A stroke across the ring with a short bar.
    ctx.moveTo(-s, 0);
    ctx.lineTo(s, 0);
    ctx.moveTo(0, -s * 0.7);
    ctx.lineTo(0, s * 0.7);
  } else if (shape < 2 / 3) {
    // A zigzag.
    ctx.moveTo(-s, -s * 0.6);
    ctx.lineTo(-s * 0.3, s * 0.6);
    ctx.lineTo(s * 0.3, -s * 0.6);
    ctx.lineTo(s, s * 0.6);
  } else {
    // A small ring with a tail.
    ctx.arc(0, 0, s * 0.55, 0, Math.PI * 2);
    ctx.moveTo(s * 0.55, 0);
    ctx.lineTo(s * 1.1, 0);
  }
  ctx.stroke();
  ctx.restore();
}

/** 法阵: a golden rune circle engraved into the pad's stone top (call after the top is painted). */
export function altarRunes(ctx: CanvasRenderingContext2D, p: Pt, r: number, seed: number): void {
  const outer = r - 3.5;
  const inner = r - 10;
  ctx.save();
  ctx.lineCap = 'round';
  // Reason: each line is cut twice, a dark groove nudged down-right and the gold on top, so it reads as carved.
  for (const [dx, dy, color] of [
    [0.7, 0.9, 'rgba(80,50,10,0.5)'],
    [0, 0, '#d9a531'],
  ] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.x + dx, p.y + dy, outer, 0, Math.PI * 2);
    ctx.moveTo(p.x + dx + inner, p.y + dy);
    ctx.arc(p.x + dx, p.y + dy, inner, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1.1;
    const mid = (outer + inner) / 2;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 + Math.PI / 8;
      rune(ctx, p.x + dx + Math.cos(a) * mid, p.y + dy + Math.sin(a) * mid, a + Math.PI / 2, 2.2, hash01(seed * 11 + i));
    }
  }
  // An eight-pointed star in the middle, filled with a wash of gold.
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8 - Math.PI / 2;
    const rr = i % 2 === 0 ? inner - 3 : (inner - 3) * 0.45;
    ctx.lineTo(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(240,190,70,0.45)';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#b07d18';
  ctx.stroke();
  ctx.restore();
}

/** One clump of reeds: thin green stems with brown cattail heads, rooted at (x, y). */
function reeds(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number, lean: number): void {
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const dx = (i - 1) * 3.2;
    const h = 13 + hash01(seed * 3 + i) * 7;
    const tip = { x: x + dx + lean * (3 + i), y: y - h };
    ctx.beginPath();
    ctx.moveTo(x + dx, y);
    ctx.quadraticCurveTo(x + dx + lean, y - h * 0.5, tip.x, tip.y);
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = '#4f8a3c';
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(tip.x, tip.y, 1.5, 3.6, lean * 0.15, 0, Math.PI * 2);
    ctx.fillStyle = '#7a4e22';
    ctx.fill();
  }
}

/** 泥沼: no stone at all — a disc of dark wet mud with a damp rim, a sheen, bubbles and two clumps of reeds. */
export function mirePad(ctx: CanvasRenderingContext2D, p: Pt, r: number, seed: number): void {
  // The damp ground around it: an uneven ring a little wider than a stone pad.
  ctx.beginPath();
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r + 2 + (hash01(seed * 13 + (i % n)) - 0.5) * 5;
    const x = p.x + Math.cos(a) * rr;
    const y = p.y + 2 + Math.sin(a) * rr * 0.92;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(58,42,22,0.55)';
  ctx.fill();
  const mud = ctx.createRadialGradient(p.x - 5, p.y - 6, 3, p.x, p.y, r);
  mud.addColorStop(0, '#5f4a32');
  mud.addColorStop(0.7, '#3d2f1d');
  mud.addColorStop(1, '#2b2014');
  ctx.beginPath();
  ctx.arc(p.x, p.y, r - 1, 0, Math.PI * 2);
  ctx.fillStyle = mud;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(25,16,6,0.7)';
  ctx.stroke();
  // Wet sheen across the top left.
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,240,210,0.32)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(p.x - 3, p.y - 3, r * 0.62, Math.PI * 1.08, Math.PI * 1.42);
  ctx.stroke();
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(p.x - 3, p.y - 3, r * 0.42, Math.PI * 1.12, Math.PI * 1.32);
  ctx.stroke();
  // Bubbles, one with a ripple around it.
  for (let i = 0; i < 3; i++) {
    const a = hash01(seed * 17 + i) * Math.PI * 2;
    const d = r * (0.2 + 0.45 * hash01(seed * 19 + i));
    const x = p.x + Math.cos(a) * d;
    const y = p.y + Math.sin(a) * d;
    const br = 1.6 + hash01(seed * 23 + i) * 1.6;
    if (i === 0) {
      ctx.beginPath();
      ctx.ellipse(x, y, br * 2.6, br * 1.6, 0, 0, Math.PI * 2);
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = 'rgba(200,180,140,0.35)';
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(x, y, br, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(120,95,60,0.9)';
    ctx.fill();
    ctx.lineWidth = 0.7;
    ctx.strokeStyle = 'rgba(230,210,170,0.65)';
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,250,235,0.8)';
    ctx.fillRect(x - br * 0.45, y - br * 0.55, 0.9, 0.9);
  }
  // Reeds on the lower rim, where a card standing on the pad leaves them showing.
  reeds(ctx, p.x - r * 0.88, p.y + r * 0.5, seed, -1);
  reeds(ctx, p.x + r * 0.92, p.y + r * 0.3, seed + 7, 1);
}
