// Card sprites: brush-lettered paper cards with an illustration that grows with the level, a level badge,
// hero portraits, torn-scroll fragments and the red 神 seal.
import { HERO_RECIPES } from '../config/combos.ts';
import { UNITS } from '../config/units.ts';
import type { HeroId, UnitId } from '../core/types.ts';
import { COLORS, hash01, roundRect, text } from './draw.ts';
import { brush, sans } from './fonts.ts';
import { drawPortrait } from './heroes-art.ts';
import { sprites } from './sprites.ts';
import { drawLevelDressing, drawTornPaper, drawUnitIcon } from './unit-art.ts';

/** Card size on the camp (a slot pad is 50 wide). */
export const CARD = 52;
/** Padding around a card sprite for the 神 glow and shadow. */
const PAD = 6;

export const LEVEL_EDGE = ['#b39462', '#4f9d5b', '#3f78c9', '#8a55c9', '#e0862a'];

/** Fragments that are the right half of a name (空/戒/僧/龙) are torn on the left. */
const RIGHT_HALF = new Set<UnitId>(HERO_RECIPES.map((r) => r.b));

function paintCard(ctx: CanvasRenderingContext2D, id: UnitId, level: number, divine: boolean, s: number): void {
  const def = UNITS[id];
  const x = PAD;
  const y = PAD;
  let edge = LEVEL_EDGE[level - 1];
  let top = '#fdf6e2';
  let bottom = '#efdcb2';
  if (def.kind === 'hero') {
    edge = '#c8962c';
    top = '#fff3c9';
    bottom = '#f3d487';
  } else if (def.kind === 'fragment') {
    edge = '#c9a13b';
    top = '#fffaf0';
    bottom = '#f6e6bf';
  } else if (def.kind === 'divine') {
    edge = '#c8001f';
    top = '#fff1ea';
    bottom = '#f9d6c8';
  }
  if (divine) {
    ctx.save();
    ctx.shadowColor = 'rgba(255,190,40,0.95)';
    ctx.shadowBlur = 8;
    roundRect(ctx, x, y, s, s, 9);
    ctx.fillStyle = '#ffd35a';
    ctx.fill();
    ctx.restore();
  }
  // Drop shadow, then the paper.
  roundRect(ctx, x + 1, y + 3, s, s, 9);
  ctx.fillStyle = 'rgba(40,20,5,0.28)';
  ctx.fill();
  const g = ctx.createLinearGradient(0, y, 0, y + s);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  roundRect(ctx, x, y, s, s, 9);
  ctx.fillStyle = g;
  ctx.fill();
  // Paper fibres: a few stable specks per card type.
  const seed = id.charCodeAt(0);
  ctx.fillStyle = 'rgba(120,85,40,0.12)';
  for (let i = 0; i < 12; i++) {
    const px = x + 5 + hash01(seed * 31 + i) * (s - 10);
    const py = y + 5 + hash01(seed * 17 + i * 7) * (s - 10);
    ctx.fillRect(px, py, 1.2, 1.2);
  }
  roundRect(ctx, x, y, s, s, 9);
  ctx.lineWidth = def.kind === 'hero' ? 3 : 2.4;
  ctx.strokeStyle = divine ? '#e0a100' : edge;
  if (def.kind === 'fragment') ctx.setLineDash([5, 3]);
  ctx.stroke();
  ctx.setLineDash([]);
  roundRect(ctx, x + 4, y + 4, s - 8, s - 8, 6);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(140,100,50,0.25)';
  ctx.stroke();

  const cx = x + s / 2;
  if (def.kind === 'hero') {
    drawLevelDressing(ctx, cx, y + s * 0.4, s * 0.56, level);
    drawPortrait(ctx, id as HeroId, cx, y + s * 0.4, s * 0.28);
    text(ctx, id, cx, y + s * 0.82, brush(Math.round(s * 0.25)), def.color);
  } else if (def.kind === 'fragment') {
    drawTornPaper(ctx, cx, y + s * 0.5, s * 0.62, s * 0.7, RIGHT_HALF.has(id));
    text(ctx, id, cx, y + s * 0.52, brush(Math.round(s * 0.46)), def.color);
  } else {
    // Illustration on top, the character underneath like a caption.
    const iy = y + s * 0.38;
    drawLevelDressing(ctx, cx, iy, s * 0.56, level);
    drawUnitIcon(ctx, id, cx, iy, s * 0.5, level);
    ctx.save();
    ctx.globalAlpha = 0.18;
    text(ctx, id, cx + 1, y + s * 0.8 + 1.2, brush(Math.round(s * 0.32)), COLORS.ink);
    ctx.restore();
    text(ctx, id, cx, y + s * 0.8, brush(Math.round(s * 0.32)), def.color);
  }
  if (level > 1) {
    const bx = x + s * 0.16;
    const by = y + s * 0.16;
    ctx.beginPath();
    ctx.arc(bx, by, s * 0.14, 0, Math.PI * 2);
    ctx.fillStyle = edge;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#fff8e6';
    ctx.stroke();
    text(ctx, String(level), bx, by + 0.5, sans(Math.round(s * 0.2), 800), '#ffffff');
  }
  if (divine) {
    // A red seal stamp in the corner, like a painter's chop.
    const sx = x + s * 0.8;
    const sy = y + s * 0.8;
    const ss = s * 0.3;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(-0.12);
    roundRect(ctx, -ss / 2, -ss / 2, ss, ss, 3);
    ctx.fillStyle = '#c8001f';
    ctx.fill();
    text(ctx, '神', 0, 0.5, brush(Math.round(ss * 0.8)), '#fff4ec');
    ctx.restore();
  }
}

/** Cached card sprite; draw it with `blit` at size (s + 2*PAD). */
export function cardSprite(id: UnitId, level: number, divine: boolean, s = CARD): { img: HTMLCanvasElement; size: number } {
  const size = s + PAD * 2;
  const img = sprites.get(`card:${id}:${level}:${divine ? 1 : 0}:${s}`, size, size, (ctx) => paintCard(ctx, id, level, divine, s));
  return { img, size };
}
