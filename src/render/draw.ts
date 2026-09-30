// Low-level drawing helpers: fonts, colours, tiles, enemies, hearts and round tokens.
import { ENEMIES } from '../config/enemies.ts';
import { UNITS } from '../config/units.ts';
import type { Enemy, Tile } from '../core/types.ts';

export const FONT_STACK =
  '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC","Source Han Sans SC",sans-serif';

export function font(px: number, weight = 700): string {
  return `${weight} ${px}px ${FONT_STACK}`;
}

export const COLORS = {
  bg: '#1d1714',
  paper: '#f1e6cd',
  paperAi: '#e3dac8',
  road: '#caa56f',
  roadEdge: '#9f7b48',
  roadLine: 'rgba(255,245,220,0.4)',
  bar: '#6b1c1c',
  barEdge: '#3f0f0f',
  barText: '#ffd98a',
  hud: '#2a211d',
  hudText: '#f3e6c8',
  dim: '#a8977c',
  gold: '#f0b93a',
  red: '#e0453c',
  ink: '#3b2a1e',
};

const LEVEL_BG = ['#fcf7eb', '#dcf1d3', '#d6e6fb', '#eadcfb', '#ffe1b3'];
const LEVEL_EDGE = ['#b9a684', '#4f9d5b', '#3f78c9', '#8a55c9', '#e08a2c'];

export function text(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  px: number,
  color: string,
  align: CanvasTextAlign = 'center',
  weight = 700,
): void {
  ctx.font = font(px, weight);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}

/** Largest font size (<= maxPx) at which `s` fits in `maxWidth`. */
export function fitPx(ctx: CanvasRenderingContext2D, s: string, maxWidth: number, maxPx: number, minPx = 9): number {
  for (let px = maxPx; px > minPx; px--) {
    ctx.font = font(px);
    if (ctx.measureText(s).width <= maxWidth) return px;
  }
  return minPx;
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function drawTile(ctx: CanvasRenderingContext2D, t: Tile, cx: number, cy: number, size: number, alpha = 1): void {
  const def = UNITS[t.id];
  const x = cx - size / 2;
  const y = cy - size / 2;
  let bg = LEVEL_BG[t.level - 1];
  let edge = LEVEL_EDGE[t.level - 1];
  if (def.kind === 'hero') {
    bg = '#ffe7a6';
    edge = '#c8962c';
  } else if (def.kind === 'fragment') {
    bg = '#fff5d4';
    edge = '#c9a13b';
  } else if (def.kind === 'divine') {
    bg = '#ffe8e3';
    edge = '#d4002a';
  }
  ctx.save();
  ctx.globalAlpha = alpha;
  if (t.divine) {
    ctx.fillStyle = 'rgba(255,190,50,0.55)';
    roundRect(ctx, x - 3, y - 3, size + 6, size + 6, 11);
    ctx.fill();
  }
  ctx.fillStyle = bg;
  roundRect(ctx, x, y, size, size, 8);
  ctx.fill();
  ctx.lineWidth = def.kind === 'hero' || t.divine ? 2.5 : 2;
  ctx.strokeStyle = t.divine ? '#e0a100' : edge;
  if (def.kind === 'fragment') ctx.setLineDash([4, 3]);
  ctx.stroke();
  ctx.setLineDash([]);

  const lift = t.level > 1 ? size * 0.06 : 0;
  text(ctx, t.id, cx, cy - lift + 1, Math.round(size * (t.id.length === 1 ? 0.58 : 0.37)), def.color);

  if (t.level > 1) {
    // Level pips along the bottom edge.
    const gap = size * 0.14;
    const r = size * 0.045;
    const startX = cx - ((t.level - 1) * gap) / 2;
    ctx.fillStyle = edge;
    for (let i = 0; i < t.level; i++) {
      ctx.beginPath();
      ctx.arc(startX + i * gap, y + size * 0.86, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (t.divine) {
    const bx = x + size - 3;
    const by = y + 3;
    const br = size * 0.18;
    ctx.fillStyle = '#d4002a';
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, '神', bx, by + 0.5, Math.round(br * 1.3), '#ffffff');
  }
  ctx.restore();
}

export function enemyRadius(def: string): number {
  if (ENEMIES[def].boss) return 18;
  if (def === '熊') return 14;
  return def === '狼' ? 11 : 12;
}

export function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, cx: number, cy: number): void {
  const def = ENEMIES[e.def];
  const r = enemyRadius(e.def);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = e.slowT > 0 ? '#2b5f86' : def.boss ? '#3a0d12' : '#5e1b1b';
  ctx.fill();
  ctx.lineWidth = def.boss ? 2.5 : 1.5;
  ctx.strokeStyle = def.boss ? COLORS.gold : '#2a0b0b';
  ctx.stroke();
  text(ctx, def.glyph, cx, cy + 1, Math.round(def.glyph.length === 1 ? r * 1.15 : r * 0.78), '#fff4e2');

  const bw = r * 2;
  const bx = cx - r;
  const by = cy - r - 6;
  const f = Math.max(0, Math.min(1, e.hp / e.maxHp));
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(bx, by, bw, 3);
  ctx.fillStyle = f > 0.5 ? '#5fd35f' : f > 0.25 ? '#f0c040' : '#ff5a4a';
  ctx.fillRect(bx, by, bw * f, 3);
  if (e.stunT > 0) text(ctx, '晕', cx + r - 1, cy - r + 3, 10, '#ffe066');
}

export function drawHeart(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, filled: boolean): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.42);
  ctx.bezierCurveTo(cx - s * 0.62, cy + s * 0.02, cx - s * 0.5, cy - s * 0.6, cx, cy - s * 0.22);
  ctx.bezierCurveTo(cx + s * 0.5, cy - s * 0.6, cx + s * 0.62, cy + s * 0.02, cx, cy + s * 0.42);
  ctx.closePath();
  ctx.fillStyle = filled ? '#e8414d' : 'rgba(255,255,255,0.14)';
  ctx.fill();
}

/** A round token with a glyph in it (唐僧, 妖洞, the AI avatar...). */
export function drawToken(
  ctx: CanvasRenderingContext2D,
  glyph: string,
  cx: number,
  cy: number,
  r: number,
  fill: string,
  edge: string,
  color: string,
): void {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = edge;
  ctx.stroke();
  text(ctx, glyph, cx, cy + 1, Math.round(r * 1.1), color);
}
