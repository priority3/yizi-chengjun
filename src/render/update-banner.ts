// The 有新版本 banner on the title screen, shown while a newer build waits (platform/pwa.ts).
import { roundRect, text } from './draw.ts';
import { sans } from './fonts.ts';
import { L, W, type Rect } from './layout.ts';

const BANNER_W = 176;
const BANNER_H = 28;

/**
 * The banner's box, centred just above the version label.
 * Reason: anchored to the bottom, it stays between the two hint lines (which end at 0.66 H + 106) and the version
 * label (from H - 14) at every design height 640..800, clear of the 继续上次 / 开始游戏 buttons.
 */
export function updateBannerRect(): Rect {
  return { x: (W - BANNER_W) / 2, y: L.H - 56, w: BANNER_W, h: BANNER_H };
}

/** Where a tap counts: the banner plus a little slack above and below for fingers. */
export function updateBannerHit(): Rect {
  const r = updateBannerRect();
  return { x: r.x, y: r.y - 6, w: r.w, h: r.h + 12 };
}

/** A circular arrow, the usual "reload" glyph. */
function reloadGlyph(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  const end = Math.PI * 1.6;
  ctx.beginPath();
  ctx.arc(x, y, r, Math.PI * 0.05, end);
  ctx.lineWidth = 1.7;
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  ctx.stroke();
  // Arrowhead at the open end: (dx, dy) is the arc's direction of travel there, (nx, ny) points away from the centre.
  const nx = Math.cos(end);
  const ny = Math.sin(end);
  const dx = -ny;
  const dy = nx;
  const tx = x + nx * r;
  const ty = y + ny * r;
  ctx.beginPath();
  ctx.moveTo(tx + dx * 3.4, ty + dy * 3.4);
  ctx.lineTo(tx + nx * 3 - dx * 0.8, ty + ny * 3 - dy * 0.8);
  ctx.lineTo(tx - nx * 3 - dx * 0.8, ty - ny * 3 - dy * 0.8);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/** Draws the banner; `busy` once tapped (the page reloads as soon as the new build has taken over). */
export function drawUpdateBanner(ctx: CanvasRenderingContext2D, t: number, busy: boolean): void {
  const r = updateBannerRect();
  const pulse = busy ? 0 : 0.5 + 0.5 * Math.sin(t * 3.2);
  ctx.save();
  roundRect(ctx, r.x, r.y, r.w, r.h, r.h / 2);
  ctx.shadowColor = `rgba(127,217,196,${(0.25 + 0.45 * pulse).toFixed(3)})`;
  ctx.shadowBlur = 10;
  ctx.fillStyle = busy ? 'rgba(30,48,44,0.88)' : 'rgba(18,62,54,0.9)';
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = busy ? 'rgba(127,217,196,0.45)' : '#7fd9c4';
  ctx.stroke();
  const cy = r.y + r.h / 2;
  reloadGlyph(ctx, r.x + 22, cy, 6, '#c5f3e6');
  text(ctx, busy ? '正在刷新…' : '有新版本，点此刷新', r.x + r.w / 2 + 9, cy + 0.5, sans(12, 700), '#f2fffb');
  ctx.restore();
}
