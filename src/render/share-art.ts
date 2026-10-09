// Art for the shared result card (share-card.ts) and the 分享 seal on the result panel: aged paper with fibres and
// distant ink-wash hills, a red-and-gold frame, carved red seals and a tapered ink rule. Every texture is placed by
// hash01, so the same card always paints the same pixels.
import { hash01, roundRect, text } from './draw.ts';
import { brush } from './fonts.ts';

/** Seal red, the same as the 金 seal on gilded cards. */
export const SEAL_RED = '#c8001f';
const SEAL_TEXT = '#fff4ec';

/** Fills w x h with warm paper: a light-to-dark wash, faint hills behind the top, fibres, and darker edges. */
export function paintPaper(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#faf1d9');
  g.addColorStop(0.55, '#f2e2bf');
  g.addColorStop(1, '#e7d0a2');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  hills(ctx, w, h * 0.2, h * 0.11, 1, 'rgba(90,80,70,0.08)');
  hills(ctx, w, h * 0.215, h * 0.065, 2, 'rgba(70,60,50,0.09)');
  fibres(ctx, w, h);
  const edge = ctx.createRadialGradient(w / 2, h * 0.47, Math.min(w, h) * 0.3, w / 2, h / 2, Math.hypot(w, h) * 0.56);
  edge.addColorStop(0, 'rgba(120,70,20,0)');
  edge.addColorStop(1, 'rgba(120,70,20,0.2)');
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, w, h);
}

/**
 * A ridge of soft hills standing on `baseY`, `height` at the tallest, fading out downwards like mist.
 * Reason: the outline is the highest of a few bell curves, which gives rounded peaks without any noise function.
 */
function hills(ctx: CanvasRenderingContext2D, w: number, baseY: number, height: number, seed: number, color: string): void {
  const n = 6;
  const peaks = Array.from({ length: n }, (_, i) => ({
    x: (i + 0.15 + hash01(seed * 31 + i) * 0.7) * (w / n),
    h: height * (0.45 + 0.55 * hash01(seed * 57 + i)),
    s: w * (0.06 + 0.06 * hash01(seed * 83 + i)),
  }));
  const foot = baseY + height * 0.6;
  ctx.beginPath();
  ctx.moveTo(0, foot);
  for (let x = 0; x <= w; x += 12) {
    let y = 0;
    for (const p of peaks) y = Math.max(y, p.h * Math.exp(-(((x - p.x) / p.s) ** 2)));
    ctx.lineTo(x, baseY - y);
  }
  ctx.lineTo(w, foot);
  ctx.closePath();
  const fade = ctx.createLinearGradient(0, baseY - height, 0, foot);
  fade.addColorStop(0, color);
  fade.addColorStop(1, 'rgba(70,60,50,0)');
  ctx.fillStyle = fade;
  ctx.fill();
}

/** Short faint fibres all over the paper, in three strokes (one per shade) so a thousand of them stay cheap. */
function fibres(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const n = Math.round((w * h) / 2200);
  for (let layer = 0; layer < 3; layer++) {
    ctx.beginPath();
    for (let i = layer; i < n; i += 3) {
      const x = hash01(i * 5 + 1) * w;
      const y = hash01(i * 5 + 2) * h;
      // Mostly lying along the paper, like the fibres of real 宣纸.
      const a = (hash01(i * 5 + 3) - 0.5) * 1.4;
      const len = 6 + hash01(i * 5 + 4) * 24;
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    }
    ctx.lineWidth = 1 + layer * 0.7;
    ctx.strokeStyle = `rgba(130,90,40,${0.06 + layer * 0.025})`;
    ctx.stroke();
  }
}

/** A deep red border around a gold line inset `inner` px, with red diamonds on the gold line's corners. */
export function paintFrame(ctx: CanvasRenderingContext2D, w: number, h: number, inner: number): void {
  const outer = inner - 18;
  ctx.save();
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#6b1c1c';
  ctx.strokeRect(outer, outer, w - 2 * outer, h - 2 * outer);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#b8862c';
  ctx.strokeRect(inner, inner, w - 2 * inner, h - 2 * inner);
  for (const [x, y] of [
    [inner, inner],
    [w - inner, inner],
    [inner, h - inner],
    [w - inner, h - inner],
  ]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#6b1c1c';
    ctx.fillRect(-12, -12, 24, 24);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#e8c27a';
    ctx.strokeRect(-6, -6, 12, 12);
    ctx.restore();
  }
  ctx.restore();
}

/**
 * A carved red seal (pale characters cut into red stone) w x h, centred at (x, y) and tilted by `angle`: `rows` of
 * brush characters stacked top to bottom inside a pale border line. Big seals get a few nicks where the stamp missed.
 */
export function drawSeal(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rows: readonly string[], angle = -0.08): void {
  const m = Math.min(w, h);
  const inset = m * 0.08;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  roundRect(ctx, -w / 2, -h / 2, w, h, m * 0.12);
  ctx.fillStyle = SEAL_RED;
  ctx.fill();
  roundRect(ctx, -w / 2 + inset, -h / 2 + inset, w - 2 * inset, h - 2 * inset, m * 0.07);
  ctx.lineWidth = Math.max(1, m * 0.035);
  ctx.strokeStyle = 'rgba(255,240,228,0.9)';
  ctx.stroke();
  // The characters share the box inside the border line: one row per string, each glyph in a square cell.
  const boxW = w - 4 * inset;
  const boxH = h - 4 * inset;
  const cols = Math.max(1, ...rows.map((r) => r.length));
  const rowH = boxH / rows.length;
  const px = Math.round(Math.min(boxW / cols, rowH) * 0.92);
  rows.forEach((row, i) => text(ctx, row, 0, (i - (rows.length - 1) / 2) * rowH + px * 0.03, brush(px), SEAL_TEXT));
  if (m >= 60) nicks(ctx, w, h, m);
  ctx.restore();
}

/** Paper-coloured nicks along a seal's edges (the seal's own frame: centred on the origin). */
function nicks(ctx: CanvasRenderingContext2D, w: number, h: number, m: number): void {
  ctx.fillStyle = 'rgba(250,241,217,0.85)';
  for (let i = 0; i < 14; i++) {
    const along = hash01(i * 3 + 7) - 0.5;
    const side = i % 4;
    const px = side < 2 ? along * w : (side === 2 ? -0.5 : 0.5) * w;
    const py = side < 2 ? (side === 0 ? -0.5 : 0.5) * h : along * h;
    ctx.beginPath();
    ctx.arc(px, py, m * (0.012 + 0.02 * hash01(i * 5 + 11)), 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A tapered horizontal ink stroke 2 x `half` long, thickest in the middle, broken by a small red diamond. */
export function inkRule(ctx: CanvasRenderingContext2D, cx: number, y: number, half: number): void {
  ctx.beginPath();
  ctx.moveTo(cx - half, y);
  ctx.quadraticCurveTo(cx, y - 8, cx + half, y + 1);
  ctx.quadraticCurveTo(cx, y + 6, cx - half, y);
  ctx.fillStyle = 'rgba(42,26,16,0.78)';
  ctx.fill();
  ctx.save();
  ctx.translate(cx, y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = '#f6ead0';
  ctx.fillRect(-15, -15, 30, 30);
  ctx.fillStyle = SEAL_RED;
  ctx.fillRect(-10, -10, 20, 20);
  ctx.restore();
}
