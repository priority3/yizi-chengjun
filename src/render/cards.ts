// Card sprites: framed parchment cards whose frame material rises with the level (wood, bronze, silver, gold,
// jade), an illustration on top, the character on a name ribbon below, hero portraits, torn-scroll fragments
// and the red 神 seal. Painted at 2x so they stay crisp when the camera zooms in.
import { HERO_RECIPES } from '../config/combos.ts';
import { UNITS } from '../config/units.ts';
import type { HeroId, UnitId } from '../core/types.ts';
import { drawStar, hash01, outlined, roundRect, text } from './draw.ts';
import { brush, sans } from './fonts.ts';
import { drawPortrait } from './heroes-art.ts';
import { sprites } from './sprites.ts';
import { drawLevelDressing, drawTornPaper, drawUnitIcon } from './unit-art.ts';

/** Card size on the map (a slot pad is 50 wide). */
export const CARD = 52;
/** Padding around a card sprite for the 神 glow and shadow. */
const PAD = 6;
/** Supersampling factor of the cached sprites. */
const RES = 2;

interface Material {
  outer: string;
  inner: string;
  light: string;
}

/** Frame material by level (index = level - 1). */
const MATERIALS: readonly Material[] = [
  { outer: '#5a3d1c', inner: '#a0773f', light: '#dcb77c' },
  { outer: '#5e3514', inner: '#b8742e', light: '#f0bc74' },
  { outer: '#44525f', inner: '#a3b4c3', light: '#eef4f9' },
  { outer: '#6e4606', inner: '#dba62c', light: '#fff0b0' },
  { outer: '#1c5244', inner: '#2f9c86', light: '#c5f3e6' },
];
const HERO_MATERIAL: Material = { outer: '#6a1710', inner: '#c0392b', light: '#ffc9a8' };
const FRAG_MATERIAL: Material = { outer: '#8a6a2a', inner: '#d9bd7c', light: '#fff4d6' };
const DIVINE_MATERIAL: Material = { outer: '#7a0012', inner: '#c8001f', light: '#ffd9a0' };
export const LEVEL_EDGE = MATERIALS.map((m) => m.inner);

/** Fragments that are the right half of a name (空/戒/僧/龙) are torn on the left. */
const RIGHT_HALF = new Set<UnitId>(HERO_RECIPES.map((r) => r.b));

function frame(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, m: Material, dashed: boolean): void {
  // Shadow, then the bevelled frame.
  roundRect(ctx, x + 1, y + 3.5, s, s, 8);
  ctx.fillStyle = 'rgba(30,15,5,0.35)';
  ctx.fill();
  const g = ctx.createLinearGradient(x, y, x + s * 0.4, y + s);
  g.addColorStop(0, m.light);
  g.addColorStop(0.5, m.inner);
  g.addColorStop(1, m.outer);
  roundRect(ctx, x, y, s, s, 8);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = m.outer;
  if (dashed) ctx.setLineDash([4, 2.5]);
  ctx.stroke();
  ctx.setLineDash([]);
  roundRect(ctx, x + 2, y + 2, s - 4, s - 4, 6.5);
  ctx.lineWidth = 1;
  ctx.strokeStyle = m.light;
  ctx.globalAlpha = 0.7;
  ctx.stroke();
  ctx.globalAlpha = 1;
  // Corner studs.
  for (const [cx, cy] of [
    [x + 5, y + 5],
    [x + s - 5, y + 5],
    [x + 5, y + s - 5],
    [x + s - 5, y + s - 5],
  ]) {
    ctx.beginPath();
    ctx.arc(cx, cy, 1.6, 0, Math.PI * 2);
    ctx.fillStyle = m.light;
    ctx.fill();
    ctx.lineWidth = 0.6;
    ctx.strokeStyle = m.outer;
    ctx.stroke();
  }
}

/** The parchment panel inside the frame, with fibres and faint stains. */
function parchment(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number, tint: [string, string]): void {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, tint[0]);
  g.addColorStop(1, tint[1]);
  roundRect(ctx, x, y, w, h, 5);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  for (let i = 0; i < 3; i++) {
    const sx = x + hash01(seed * 23 + i) * w;
    const sy = y + hash01(seed * 29 + i) * h;
    const r = 6 + hash01(seed + i) * 10;
    const stain = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
    stain.addColorStop(0, 'rgba(150,110,50,0.14)');
    stain.addColorStop(1, 'rgba(150,110,50,0)');
    ctx.fillStyle = stain;
    ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
  }
  ctx.fillStyle = 'rgba(120,85,40,0.14)';
  for (let i = 0; i < 18; i++) {
    const px = x + hash01(seed * 31 + i) * w;
    const py = y + hash01(seed * 17 + i * 7) * h;
    ctx.fillRect(px, py, 1 + hash01(i) * 2, 0.8);
  }
  ctx.restore();
  roundRect(ctx, x, y, w, h, 5);
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = 'rgba(110,75,35,0.45)';
  ctx.stroke();
}

/** The name ribbon along the bottom, with the character on it. */
function ribbon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, m: Material, label: string): void {
  const h = s * 0.22;
  const ry = y + s - h - 5;
  roundRect(ctx, x + 6, ry, s - 12, h, 3);
  const g = ctx.createLinearGradient(0, ry, 0, ry + h);
  g.addColorStop(0, m.inner);
  g.addColorStop(1, m.outer);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = m.light;
  ctx.globalAlpha = 0.8;
  ctx.stroke();
  ctx.globalAlpha = 1;
  outlined(ctx, label, x + s / 2, ry + h / 2 + 0.5, brush(Math.round(h * 0.82)), '#fff7e6', 'rgba(30,15,5,0.7)', 2);
}

/** A soft white gloss across the top-left of the card. */
function gloss(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.save();
  roundRect(ctx, x, y, s, s, 8);
  ctx.clip();
  const g = ctx.createLinearGradient(x, y, x + s * 0.6, y + s * 0.6);
  g.addColorStop(0, 'rgba(255,255,255,0.28)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.05)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, s, s);
  ctx.restore();
}

function paintCard(ctx: CanvasRenderingContext2D, id: UnitId, level: number, divine: boolean, s: number): void {
  const def = UNITS[id];
  const x = PAD;
  const y = PAD;
  const material = def.kind === 'hero' ? HERO_MATERIAL : def.kind === 'fragment' ? FRAG_MATERIAL : def.kind === 'divine' ? DIVINE_MATERIAL : MATERIALS[level - 1];
  if (divine) {
    ctx.save();
    ctx.shadowColor = 'rgba(255,190,40,0.95)';
    ctx.shadowBlur = 9;
    roundRect(ctx, x, y, s, s, 8);
    ctx.fillStyle = '#ffd35a';
    ctx.fill();
    ctx.restore();
  }
  frame(ctx, x, y, s, material, def.kind === 'fragment');
  const tint: [string, string] = def.kind === 'divine' ? ['#fff3ea', '#f6d6c4'] : def.kind === 'hero' ? ['#fff6d8', '#f3dca0'] : ['#fff8e8', '#eedbb3'];
  parchment(ctx, x + 5, y + 5, s - 10, s - 10, id.charCodeAt(0), tint);
  const cx = x + s / 2;
  if (def.kind === 'hero') {
    drawLevelDressing(ctx, cx, y + s * 0.4, s * 0.56, level);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1.5;
    drawPortrait(ctx, id as HeroId, cx, y + s * 0.38, s * 0.26);
    ctx.restore();
    ribbon(ctx, x, y, s, material, id);
  } else if (def.kind === 'fragment') {
    drawTornPaper(ctx, cx, y + s * 0.5, s * 0.6, s * 0.66, RIGHT_HALF.has(id));
    text(ctx, id, cx, y + s * 0.52, brush(Math.round(s * 0.44)), def.color);
  } else {
    const iy = y + s * 0.36;
    drawLevelDressing(ctx, cx, iy, s * 0.54, level);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.28)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1.5;
    drawUnitIcon(ctx, id, cx, iy, s * 0.46, level);
    ctx.restore();
    ribbon(ctx, x, y, s, material, id);
  }
  gloss(ctx, x, y, s);
  if (level > 1) {
    const bx = x + s * 0.17;
    const by = y + s * 0.17;
    ctx.beginPath();
    ctx.arc(bx, by, s * 0.135, 0, Math.PI * 2);
    ctx.fillStyle = material.inner;
    ctx.fill();
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = '#fff8e6';
    ctx.stroke();
    text(ctx, String(level), bx, by + 0.5, sans(Math.round(s * 0.19), 800), '#ffffff');
    if (level >= 4) drawStar(ctx, bx + s * 0.11, by - s * 0.11, s * 0.05, '#fff3b0');
  }
  if (divine) {
    // A red seal stamp in the corner, like a painter's chop.
    const sx = x + s * 0.82;
    const sy = y + s * 0.2;
    const ss = s * 0.26;
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
  const img = sprites.get(`card:${id}:${level}:${divine ? 1 : 0}:${s}`, size * RES, size * RES, (ctx) => {
    ctx.scale(RES, RES);
    paintCard(ctx, id, level, divine, s);
  });
  return { img, size };
}
