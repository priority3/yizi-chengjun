// The 每日挑战 and 无尽 entries of the chapter screen, in the style of the chapter cards (chapter-card.ts): a map
// thumbnail on the left, then the mode's name and two short lines. A locked entry is greyed out with a padlock.
import { drawThumb, thumbRect } from './chapter-card.ts';
import { fitPx, roundRect, text } from './draw.ts';
import { brush, sans } from './fonts.ts';
import type { Rect } from './layout.ts';

export interface ModeCard {
  title: string;
  /** Colour of the title (jade for the daily challenge, red for endless). */
  color: string;
  /** Under the title: what it is (the day and map, the boss rhythm, what unlocks it) and the record so far. */
  info: string;
  record: string;
  /** The record line is a call to play (no record yet): drawn in red. */
  hot: boolean;
  open: boolean;
  /** Chapter whose map the thumbnail shows (also gives the placeholder its colours). */
  chapter: number;
  /** A chapter card's painted thumbnail, drawn scaled into this card's smaller box; null while it is still queued. */
  thumb: HTMLCanvasElement | null;
  /** Animation clock in seconds (placeholder sheen). */
  t: number;
}

const CARD_R = 12;

/** One entry in its rect. Drawn directly every frame: there are only two, unlike the ten cached chapter cards. */
export function drawModeCard(ctx: CanvasRenderingContext2D, r: Rect, c: ModeCard): void {
  roundRect(ctx, r.x, r.y + 3, r.w, r.h, CARD_R);
  ctx.fillStyle = 'rgba(20,10,4,0.35)';
  ctx.fill();
  roundRect(ctx, r.x, r.y, r.w, r.h, CARD_R);
  const body = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  body.addColorStop(0, c.open ? '#f8edd4' : '#6e655d');
  body.addColorStop(1, c.open ? '#ead5aa' : '#5a524b');
  ctx.fillStyle = body;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = c.open ? '#b8862c' : '#4a4440';
  ctx.stroke();

  const tr = thumbRect(r);
  drawThumb(ctx, tr, { chapter: c.chapter, open: c.open, thumb: c.thumb, fade: 1, t: c.t });

  // The text column, right of the thumbnail.
  const x = tr.x + tr.w + 8;
  const w = r.x + r.w - 7 - x;
  const dim = '#b0a698';
  text(ctx, c.title, x, r.y + r.h * 0.27, brush(fitPx(ctx, c.title, w, 18, brush, 12)), c.open ? c.color : dim, 'left');
  const small = (s: string) => sans(fitPx(ctx, s, w, 10, (n) => sans(n, 700), 7), 700);
  text(ctx, c.info, x, r.y + r.h * 0.56, small(c.info), c.open ? '#6a4a26' : dim, 'left');
  if (c.record) text(ctx, c.record, x, r.y + r.h * 0.79, small(c.record), !c.open ? dim : c.hot ? '#b3261e' : '#1b7a5a', 'left');
}
