// The cards of the chapter screen: the map thumbnail on the left, then the chapter number, its name, the boss and the
// best star rating. Locked chapters are greyed out with a padlock over the map; the chapter to play next glows.
// Cards that have stopped changing are drawn from a cached canvas each (see ChapterCards).
import { CHAPTERS } from '../config/chapters.ts';
import { ENEMIES } from '../config/enemies.ts';
import { MAPS } from '../config/maps.ts';
import { fitPx, roundRect, text } from './draw.ts';
import { brush, sans } from './fonts.ts';
import type { Rect } from './layout.ts';
import { monsterSprite } from './monsters-art.ts';
import { NUMERALS } from './panels.ts';
import { drawStarRow } from './rating-art.ts';
import { THEMES } from './scenery.ts';
import { blit } from './sprites.ts';

export interface ChapterCard {
  /** 1-based chapter. */
  chapter: number;
  /** Unlocked (playable). */
  open: boolean;
  /** Cleared at least once: the boss is beaten. */
  cleared: boolean;
  /** Best star rating, 0 = none yet. */
  stars: number;
  /** The chapter to play next: a glow pulses around it. */
  next: boolean;
  /** The painted map thumbnail, or null while it is still queued (a placeholder shows meanwhile). */
  thumb: HTMLCanvasElement | null;
  /** Fade-in of a freshly painted thumbnail, 0..1. */
  fade: number;
  /** Animation clock in seconds (glow, placeholder sheen). */
  t: number;
}

const CARD_R = 12;
const THUMB_R = 7;
/** Room around a cached card for its drop shadow and anti-aliased edges (design units). */
const SPRITE_MARGIN = 4;
/**
 * Most cards copied into their cache per frame; the others are drawn directly until their turn.
 * Reason: painting a card's canvas costs as much as drawing the card, so caching all ten at once would make the
 * screen's first frame several times slower than any later one.
 */
const SPRITES_PER_FRAME = 2;

/** A settled card painted into a canvas of its own, and where that canvas goes on the screen. */
interface CardSprite {
  /** Everything the painted pixels depend on. */
  key: string;
  img: HTMLCanvasElement;
  /** Device-pixel position of its top-left corner. */
  x: number;
  y: number;
}

/**
 * Draws the chapter screen's cards, keeping each settled card (its thumbnail painted and faded in) in a canvas of its
 * own that is repainted only when what it shows changes.
 * Reason: ten cards with gradients, clipped thumbnails and, when locked, a greyscale blend cost several milliseconds
 * a frame on phones that draw without the GPU; one drawImage per card is nearly free. Each chapter screen owns one
 * of these, so its canvases go away with the screen (about 0.8 MB per card on a 3x phone).
 */
export class ChapterCards {
  private readonly cached = new Map<number, CardSprite>();

  /** Draws every card in its rect. The screen's transform must be a plain scale (and offset), like the stage's. */
  draw(ctx: CanvasRenderingContext2D, cards: ReadonlyArray<{ r: Rect; c: ChapterCard }>): void {
    const m = ctx.getTransform();
    let budget = SPRITES_PER_FRAME;
    for (const { r, c } of cards) {
      let s: CardSprite | null = null;
      if (c.thumb && c.fade >= 1) {
        s = this.cached.get(c.chapter) ?? null;
        const key = [c.open, c.cleared, c.stars, r.x, r.y, r.w, r.h, m.a, m.d, m.e, m.f].join();
        if (s?.key !== key) {
          s = budget > 0 ? paintSprite(r, c, m, key) : null;
          if (s) {
            budget--;
            this.cached.set(c.chapter, s);
          }
        }
      }
      if (s) {
        ctx.save();
        // Reason: copied 1:1 onto whole device pixels, so the card stays exactly as crisp as when drawn directly.
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(s.img, s.x, s.y);
        ctx.restore();
      } else {
        drawChapterCard(ctx, r, c);
      }
      if (c.next) drawGlow(ctx, r, c.t);
    }
  }
}

/** Paints a card into a new canvas covering its device pixels (plus the shadow margin) under the transform `m`. */
function paintSprite(r: Rect, c: ChapterCard, m: DOMMatrix, key: string): CardSprite {
  const x = Math.floor(m.a * (r.x - SPRITE_MARGIN) + m.e);
  const y = Math.floor(m.d * (r.y - SPRITE_MARGIN) + m.f);
  const img = document.createElement('canvas');
  img.width = Math.ceil(m.a * (r.x + r.w + SPRITE_MARGIN) + m.e) - x;
  img.height = Math.ceil(m.d * (r.y + r.h + SPRITE_MARGIN) + m.f) - y;
  const g = img.getContext('2d');
  if (!g) throw new Error('Canvas 2D is not supported in this browser');
  // The screen's own transform, shifted so the canvas starts at (x, y): the same pixels as drawing in place.
  g.setTransform(m.a, 0, 0, m.d, m.e - x, m.f - y);
  drawChapterCard(g, r, c);
  return { key, img, x, y };
}

/** The pulsing gold ring around the chapter to play next (drawn live, outside any cached card). */
function drawGlow(ctx: CanvasRenderingContext2D, r: Rect, t: number): void {
  roundRect(ctx, r.x - 2.5, r.y - 2.5, r.w + 5, r.h + 5, CARD_R + 2);
  ctx.lineWidth = 4;
  ctx.strokeStyle = `rgba(255,206,90,${0.45 + 0.35 * Math.sin(t * 3.2)})`;
  ctx.stroke();
}

/** The thumbnail's box inside a card: the left side, 3:4 like the maps. */
export function thumbRect(card: Rect): Rect {
  const h = card.h - 12;
  return { x: card.x + 6, y: card.y + 6, w: Math.round(h * 0.75), h };
}

/** One card in place, everything but the next-chapter glow (that is drawGlow's). */
function drawChapterCard(ctx: CanvasRenderingContext2D, r: Rect, c: ChapterCard): void {
  const ch = CHAPTERS[c.chapter - 1];
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
  drawThumb(ctx, tr, c);

  // The text column, right of the thumbnail.
  const x = tr.x + tr.w + 8;
  const w = r.x + r.w - 7 - x;
  const ink = c.open ? '#3b2a1e' : '#b0a698';
  text(ctx, `第${NUMERALS[c.chapter - 1]}章`, x, r.y + r.h * 0.19, brush(15), c.open ? '#8a3a22' : ink, 'left');
  // Reason: four-character names (小雷音寺) would overflow the column at the default size.
  text(ctx, ch.name, x, r.y + r.h * 0.43, brush(fitPx(ctx, ch.name, w, 22, brush)), ink, 'left');
  drawBoss(ctx, ch.boss, x, r.y + r.h * 0.66, w, c.open, c.cleared);
  const sr = r.h * 0.072;
  drawStarRow(ctx, x + sr, r.y + r.h * 0.85, sr, sr * 2.5, c.stars, c.open ? 'paper' : 'locked');
}

/**
 * The thumbnail (fading in over its placeholder), greyed out with a padlock when the chapter is locked. Also draws the
 * thumbnails of the chapter screen's 每日挑战 and 无尽 entries (render/mode-card.ts).
 */
export function drawThumb(ctx: CanvasRenderingContext2D, r: Rect, c: Pick<ChapterCard, 'chapter' | 'open' | 'thumb' | 'fade' | 't'>): void {
  ctx.save();
  roundRect(ctx, r.x, r.y, r.w, r.h, THUMB_R);
  ctx.clip();
  if (!c.thumb || c.fade < 1) placeholder(ctx, r, c.chapter, c.t);
  if (c.thumb) {
    ctx.globalAlpha = c.fade;
    ctx.drawImage(c.thumb, r.x, r.y, r.w, r.h);
    ctx.globalAlpha = 1;
  }
  if (!c.open) {
    // Reason: a 'saturation' blend with grey keeps each pixel's lightness but drops its colour; the canvas `filter`
    // property would be simpler but isn't available in every browser.
    ctx.globalCompositeOperation = 'saturation';
    ctx.fillStyle = '#808080';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(28,22,18,0.42)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
  ctx.restore();
  roundRect(ctx, r.x, r.y, r.w, r.h, THUMB_R);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = c.open ? 'rgba(110,70,25,0.85)' : 'rgba(40,36,32,0.9)';
  ctx.stroke();
  if (!c.open) drawLock(ctx, r.x + r.w / 2, r.y + r.h / 2, Math.min(15, r.w * 0.24));
}

/** Stand-in until the thumbnail is painted: the map's ground colours with a soft band of light sweeping down. */
function placeholder(ctx: CanvasRenderingContext2D, r: Rect, chapter: number, t: number): void {
  const pal = THEMES[MAPS[chapter - 1].theme];
  const g = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
  g.addColorStop(0, pal.ground[0]);
  g.addColorStop(1, pal.ground[1]);
  ctx.fillStyle = g;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  const y = r.y - 18 + ((t * 0.9) % 1) * (r.h + 36);
  const sheen = ctx.createLinearGradient(0, y - 18, 0, y + 18);
  sheen.addColorStop(0, 'rgba(255,250,235,0)');
  sheen.addColorStop(0.5, 'rgba(255,250,235,0.4)');
  sheen.addColorStop(1, 'rgba(255,250,235,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(r.x, y - 18, r.w, 36);
}

/** A padlock on a dark disc. */
function drawLock(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(24,18,14,0.82)';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(214,200,178,0.65)';
  ctx.stroke();
  // The shackle: two short legs joined by a half circle.
  ctx.beginPath();
  ctx.moveTo(x - r * 0.3, y - r * 0.02);
  ctx.lineTo(x - r * 0.3, y - r * 0.22);
  ctx.arc(x, y - r * 0.22, r * 0.3, Math.PI, 0);
  ctx.lineTo(x + r * 0.3, y - r * 0.02);
  ctx.lineWidth = r * 0.14;
  ctx.strokeStyle = '#d8ccb6';
  ctx.stroke();
  roundRect(ctx, x - r * 0.46, y - r * 0.08, r * 0.92, r * 0.62, r * 0.12);
  ctx.fillStyle = '#e2d6c0';
  ctx.fill();
  ctx.fillStyle = '#3a302a';
  ctx.beginPath();
  ctx.arc(x, y + r * 0.14, r * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x - r * 0.04, y + r * 0.14, r * 0.08, r * 0.2);
  ctx.restore();
}

/** The boss line: its sprite as a small icon, then its name (red until the chapter is beaten). */
function drawBoss(ctx: CanvasRenderingContext2D, boss: string, x: number, y: number, w: number, open: boolean, beaten: boolean): void {
  const icon = 20;
  const { img, box } = monsterSprite(boss);
  ctx.save();
  if (!open) ctx.globalAlpha = 0.4;
  blit(ctx, img, x + icon / 2 - 1, y, box, box, icon / box);
  ctx.restore();
  const name = ENEMIES[boss].name;
  const px = fitPx(ctx, name, w - icon - 1, 11, (n) => sans(n, 700));
  text(ctx, name, x + icon + 1, y + 0.5, sans(px, 700), !open ? '#b0a698' : beaten ? '#7a6248' : '#b3261e', 'left');
}
