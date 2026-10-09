// Live marks on the pads and cards, drawn by the renderer every frame (the pads' own looks are painted into the
// map image by pad-art.ts): the slowly turning rune ring over each unlocked 法阵, the name of a locked special
// pad, a special pad's label while a card is dragged over it, and the badge of a fighter's 瞄准.
import type { SlotKind } from '../config/maps.ts';
import type { Pt } from '../core/map.ts';
import type { GameState, TargetMode } from '../core/types.ts';
import { roundRect, text } from './draw.ts';
import { sans } from './fonts.ts';

/** Colour of a special pad's name on its locked overlay. */
export const PAD_TAG_COLOR: Readonly<Record<SlotKind, string>> = {
  plain: 'rgba(255,235,200,0.85)',
  altar: '#ffd166',
  high: '#f6ead2',
  mire: '#c9e6a0',
};

/**
 * The faint golden rune ring over every unlocked 法阵, radius `r` (a little wider than the pad, so it shows
 * around a card standing there). One path and one dashed stroke for all of them.
 */
export function drawRuneRings(ctx: CanvasRenderingContext2D, g: GameState, r: number, time: number): void {
  const { slots, slotKind } = g.map;
  let any = false;
  ctx.beginPath();
  for (let i = 0; i < slots.length; i++) {
    if (slotKind[i] !== 'altar' || !g.unlocked[i]) continue;
    const p = slots[i];
    ctx.moveTo(p.x + r, p.y);
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    any = true;
  }
  if (!any) return;
  ctx.save();
  // Long and short dashes read as a band of runes.
  ctx.setLineDash([7, 3, 2, 3]);
  // Reason: sliding the dash pattern along the circle turns the ring without a transform (about 20 s a turn);
  // `time` is the scene's animation clock, so the ring stands still while the game is paused.
  ctx.lineDashOffset = -time * 9;
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,200,80,0.55)';
  ctx.stroke();
  ctx.restore();
}

/**
 * The label of the special pad under a dragged card, `top` px above the pad's centre; red when the card can't
 * stand there. `k` = 1 / zoom keeps it readable at any zoom.
 */
export function drawPadLabel(ctx: CanvasRenderingContext2D, p: Pt, label: string, ok: boolean, top: number, k: number): void {
  const cy = p.y - top - 16 * k;
  const font = sans(Math.round(10 * k), 800);
  ctx.font = font;
  const w = ctx.measureText(label).width + 18 * k;
  roundRect(ctx, p.x - w / 2, cy - 10 * k, w, 20 * k, 10 * k);
  ctx.fillStyle = 'rgba(28,14,6,0.9)';
  ctx.fill();
  ctx.lineWidth = 1.5 * k;
  ctx.strokeStyle = ok ? '#e8d3a6' : '#ff6a5a';
  ctx.stroke();
  text(ctx, label, p.x, cy + 0.5 * k, font, ok ? '#fff1d6' : '#ffd0c8');
}

/** A golden crown with a red gem, `s` px from its centre to its sides. */
function crown(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.beginPath();
  ctx.moveTo(x - s, y + s * 0.55);
  ctx.lineTo(x - s, y - s * 0.45);
  ctx.lineTo(x - s * 0.5, y + s * 0.05);
  ctx.lineTo(x, y - s * 0.75);
  ctx.lineTo(x + s * 0.5, y + s * 0.05);
  ctx.lineTo(x + s, y - s * 0.45);
  ctx.lineTo(x + s, y + s * 0.55);
  ctx.closePath();
  ctx.fillStyle = '#ffd166';
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.lineWidth = s * 0.16;
  ctx.strokeStyle = '#8a5a0a';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y + s * 0.26, s * 0.17, 0, Math.PI * 2);
  ctx.fillStyle = '#c8322a';
  ctx.fill();
}

/** A red heart with a dark crack down the middle, `s` px from its centre to its sides. */
function crackedHeart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.8);
  ctx.bezierCurveTo(x - s * 1.25, y + s * 0.05, x - s * 0.7, y - s * 0.95, x, y - s * 0.38);
  ctx.bezierCurveTo(x + s * 0.7, y - s * 0.95, x + s * 1.25, y + s * 0.05, x, y + s * 0.8);
  ctx.closePath();
  ctx.fillStyle = '#e0453c';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x, y - s * 0.38);
  ctx.lineTo(x - s * 0.24, y);
  ctx.lineTo(x + s * 0.16, y + s * 0.3);
  ctx.lineTo(x, y + s * 0.8);
  ctx.lineJoin = 'round';
  ctx.lineWidth = s * 0.24;
  ctx.strokeStyle = 'rgba(28,14,6,0.95)';
  ctx.stroke();
}

/**
 * The 瞄准 badge centred at (x, y), radius `r`: a crown for 打最强, a cracked heart for 打最弱. The default 打最前
 * shows nothing, so only fighters the player switched carry a badge.
 */
export function drawAimBadge(ctx: CanvasRenderingContext2D, mode: TargetMode, x: number, y: number, r: number): void {
  if (mode === 'first') return;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(28,14,6,0.9)';
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.18);
  ctx.strokeStyle = mode === 'strong' ? '#ffd166' : '#ff8a7a';
  ctx.stroke();
  if (mode === 'strong') crown(ctx, x, y + r * 0.06, r * 0.6);
  else crackedHeart(ctx, x, y + r * 0.02, r * 0.58);
}
