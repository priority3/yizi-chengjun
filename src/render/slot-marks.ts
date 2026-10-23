// Live marks on the pads and cards, drawn by the renderer every frame (the pads' own looks are painted into the
// map image by pad-art.ts): the slowly turning rune ring round each unlocked 法阵, the paper seal strip with the price
// over a locked pad, the ring on the ground under a pad, a special pad's label while a card is dragged over it, and
// the badge of a fighter's 瞄准.
import type { SlotKind } from '../config/maps.ts';
import type { Pt } from '../core/map.ts';
import type { GameState, TargetMode } from '../core/types.ts';
import { padName } from '../i18n/names.ts';
import { drawCoin, roundRect, text } from './draw.ts';
import { sans } from './fonts.ts';
import { CINNABAR, INK, ink, PAPER } from './ink.ts';
import { PAD_SIDE, PAD_TILT } from './pad-art.ts';
import { wrapText } from './text-wrap.ts';

/**
 * Traces the ring on the ground round a pad's foot, `r` across (an ellipse like the pads' top faces), ready to stroke.
 * It sits a little below the pad's centre so it shows round the bottom and sides of a card standing there.
 */
export function padRing(ctx: CanvasRenderingContext2D, p: Pt, r: number): void {
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + PAD_SIDE * 0.6, r, r * PAD_TILT, 0, 0, Math.PI * 2);
}

/**
 * The faint golden rune ring round every unlocked 法阵, `r` across (a little wider than the pad, so it shows round a
 * card standing there). One path and one dashed stroke for all of them. Only the map and which pads are unlocked are
 * read, so the map editor draws them too.
 */
export function drawRuneRings(ctx: CanvasRenderingContext2D, g: Pick<GameState, 'map' | 'unlocked'>, r: number, time: number): void {
  const { slots, slotKind } = g.map;
  const rx = r + 2;
  const ry = rx * PAD_TILT;
  let any = false;
  ctx.beginPath();
  for (let i = 0; i < slots.length; i++) {
    if (slotKind[i] !== 'altar' || !g.unlocked[i]) continue;
    const cx = slots[i].x;
    const cy = slots[i].y + PAD_SIDE * 0.6;
    ctx.moveTo(cx + rx, cy);
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    any = true;
  }
  if (!any) return;
  ctx.save();
  // Long and short dashes read as a band of runes.
  ctx.setLineDash([7, 3, 2, 3]);
  // Reason: sliding the dash pattern along the ring turns it without a transform (about 20 s a turn);
  // `time` is the scene's animation clock, so the ring stands still while the game is paused.
  ctx.lineDashOffset = -time * 9;
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(214,160,60,0.7)';
  ctx.stroke();
  ctx.restore();
}

/**
 * A locked pad: its stone dimmed under an ink wash, and a paper seal strip across it carrying the price (after the
 * name of a special pad). The price turns cinnabar while it can't be paid; with no price (the map editor) a plain pad's
 * strip shows a "+" instead. `k` = 1 / zoom keeps the strip readable.
 */
export function drawLockedPad(ctx: CanvasRenderingContext2D, p: Pt, kind: SlotKind, price: number | null, affordable: boolean, r: number, k: number): void {
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, r, r * PAD_TILT, 0, 0, Math.PI * 2);
  ctx.fillStyle = ink(0.4);
  ctx.fill();
  const nameFont = sans(Math.round(10 * k), 800);
  const priceFont = sans(Math.round(10 * k), 800);
  const name = kind !== 'plain' ? padName(kind) : price === null ? '+' : '';
  ctx.font = nameFont;
  const nameW = name ? ctx.measureText(name).width + 4 * k : 0;
  ctx.font = priceFont;
  const priceW = price === null ? 0 : ctx.measureText(String(price)).width;
  const coin = price === null ? 0 : 4 * k;
  const w = nameW + (price === null ? -4 * k : coin * 2 + 3 * k + priceW) + 14 * k;
  const h = 16 * k;
  ctx.save();
  ctx.translate(p.x, p.y + 1);
  // Reason: a slight tilt makes it read as a strip of paper pasted on by hand rather than a button.
  ctx.rotate(-0.1);
  roundRect(ctx, -w / 2, -h / 2, w, h, 2 * k);
  ctx.fillStyle = PAPER;
  ctx.fill();
  ctx.lineWidth = 1.4 * k;
  ctx.strokeStyle = CINNABAR;
  ctx.stroke();
  let x = -w / 2 + 7 * k;
  if (name) {
    text(ctx, name, x + (nameW - 4 * k) / 2, 0.5 * k, nameFont, INK);
    x += nameW;
  }
  if (price !== null) {
    drawCoin(ctx, x + coin, 0, coin);
    text(ctx, String(price), x + coin * 2 + 3 * k, 0.6 * k, priceFont, affordable ? INK : CINNABAR, 'left');
  }
  ctx.restore();
}

/**
 * The label of the special pad under a dragged card, `top` px above the pad's centre; red when the card can't
 * stand there. `k` = 1 / zoom keeps it readable at any zoom.
 */
export function drawPadLabel(ctx: CanvasRenderingContext2D, p: Pt, label: string, ok: boolean, top: number, k: number): void {
  const font = sans(Math.round(10 * k), 800);
  ctx.font = font;
  const measure = (s: string): number => ctx.measureText(s).width;
  // Reason: an English label runs about twice as long as a Chinese one; past this width it takes two lines, growing up.
  const lines = measure(label) > PAD_LABEL_W * k ? wrapText(label, PAD_LABEL_W * k, measure) : [label];
  const lineH = 13 * k;
  const h = 20 * k + (lines.length - 1) * lineH;
  const w = Math.max(...lines.map(measure)) + 18 * k;
  const cy = p.y - top - 16 * k - ((lines.length - 1) * lineH) / 2;
  roundRect(ctx, p.x - w / 2, cy - h / 2, w, h, 10 * k);
  ctx.fillStyle = 'rgba(28,14,6,0.9)';
  ctx.fill();
  ctx.lineWidth = 1.5 * k;
  ctx.strokeStyle = ok ? '#e8d3a6' : '#ff6a5a';
  ctx.stroke();
  lines.forEach((s, i) => text(ctx, s, p.x, cy + 0.5 * k + (i - (lines.length - 1) / 2) * lineH, font, ok ? '#fff1d6' : '#ffd0c8'));
}

/** Widest a pad label's line gets (at zoom 1) before it wraps. */
const PAD_LABEL_W = 210;

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
