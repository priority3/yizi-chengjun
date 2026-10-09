// The result panel of an endless or daily run: the waves it survived, kills, the record (a 新纪录！ seal when beaten)
// and the 灵石 earned. game-overlays.ts sizes the panel and stacks its buttons under this content.
import { dayLabel } from '../core/modes.ts';
import type { EndlessAward } from '../core/records.ts';
import type { GameState } from '../core/types.ts';
import { roundRect, text } from '../render/draw.ts';
import { brush, sans } from '../render/fonts.ts';
import { W, type Rect } from '../render/layout.ts';
import { drawStone } from '../render/treasure-art.ts';

/** Height of the panel above its buttons: the content below, clear of the first button (like the pause panel's). */
export const ENDLESS_TOP = 226;

/** The 新纪录！ seal lands this long after the panel appears (seconds)... */
const SEAL_AT = 0.35;
/** ...stamped down over this long. */
const SEAL_POP = 0.25;

/** Draws the content of the panel `r` for the ended run `g` and what it earned. `t`: seconds since the panel appeared. */
export function drawEndlessResult(ctx: CanvasRenderingContext2D, r: Rect, g: GameState, a: EndlessAward, t: number): void {
  text(ctx, a.mode === 'daily' ? '每日挑战' : '无尽', W / 2, r.y + 44, brush(32), '#b3261e');
  const fell = `阵地在第 ${g.wave} 波失守`;
  text(ctx, a.mode === 'daily' ? `${dayLabel(g.seed)} · ${fell}` : fell, W / 2, r.y + 78, sans(12, 600), '#7a6248');
  text(ctx, `撑过 ${a.waves} 波`, W / 2, r.y + 118, brush(34), '#8a3a22');
  if (a.record) drawSeal(ctx, W / 2 + 100, r.y + 104, t);
  const best = `${a.mode === 'daily' ? '今日最佳' : '最佳'} 撑过 ${a.best} 波`;
  text(ctx, `击杀 ${a.kills} · ${best}`, W / 2, r.y + 156, sans(12, 600), '#6a4a26');
  // The 灵石 line, like a chapter clear's.
  drawStone(ctx, W / 2 - 44, r.y + 188, 9);
  text(ctx, `灵石 +${a.stones}`, W / 2 - 30, r.y + 189, sans(14, 800), '#1b7a5a', 'left');
}

/** The red 新纪录！ seal, stamped at a slant a moment after the panel appears: it drops from 1.6x its size. */
function drawSeal(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  const k = Math.min(1, (t - SEAL_AT) / SEAL_POP);
  if (k <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, k * 2);
  ctx.translate(x, y);
  ctx.rotate(-0.16);
  const s = 1.6 - 0.6 * k * k;
  ctx.scale(s, s);
  roundRect(ctx, -35, -14, 70, 28, 5);
  ctx.fillStyle = '#c8322a';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#7a1a14';
  ctx.stroke();
  roundRect(ctx, -31.5, -10.5, 63, 21, 3);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255,236,210,0.75)';
  ctx.stroke();
  text(ctx, '新纪录！', 0, 1, brush(15), '#fff4e2');
  ctx.restore();
}
