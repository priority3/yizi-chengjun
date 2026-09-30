// The painted battlefield: paper sky, ink-wash mountains, a sandy arena, city walls with gates,
// pagoda towers and red banners. Rendered once per screen size into an offscreen canvas.
import { GRID_H, GRID_W, GRID_X, GRID_Y, WORLD_H } from '../core/grid.ts';
import { COLORS, hash01, roundRect } from './draw.ts';
import { L, W } from './layout.ts';

function mountains(ctx: CanvasRenderingContext2D, baseY: number, height: number, seed: number, color: string): void {
  ctx.beginPath();
  ctx.moveTo(0, baseY);
  const peaks = 7;
  for (let i = 0; i <= peaks; i++) {
    const x = (i / peaks) * W;
    const h = height * (0.45 + 0.55 * hash01(seed + i * 13));
    ctx.quadraticCurveTo(x - W / peaks / 2, baseY - h * 1.1, x, baseY - h * (0.3 + 0.3 * hash01(seed + i)));
  }
  ctx.lineTo(W, baseY);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function pagoda(ctx: CanvasRenderingContext2D, x: number, baseY: number, s: number): void {
  // Three stacked roofs with upturned eaves.
  ctx.fillStyle = '#8a3a2a';
  ctx.fillRect(x - s * 0.22, baseY - s * 1.05, s * 0.44, s * 1.05);
  for (let i = 0; i < 3; i++) {
    const y = baseY - s * (0.35 + i * 0.36);
    const w = s * (0.75 - i * 0.14);
    ctx.beginPath();
    ctx.moveTo(x - w, y + s * 0.02);
    ctx.quadraticCurveTo(x - w * 0.5, y - s * 0.06, x, y - s * 0.2);
    ctx.quadraticCurveTo(x + w * 0.5, y - s * 0.06, x + w, y + s * 0.02);
    ctx.lineTo(x + w * 0.7, y + s * 0.08);
    ctx.lineTo(x - w * 0.7, y + s * 0.08);
    ctx.closePath();
    ctx.fillStyle = '#4a2a20';
    ctx.fill();
  }
  ctx.fillStyle = '#f0c24a';
  ctx.fillRect(x - s * 0.03, baseY - s * 1.32, s * 0.06, s * 0.2);
}

function banner(ctx: CanvasRenderingContext2D, x: number, y: number, flip: boolean): void {
  ctx.fillStyle = '#5a3a24';
  ctx.fillRect(x - 1, y - 26, 2, 30);
  const d = flip ? -1 : 1;
  ctx.beginPath();
  ctx.moveTo(x + d, y - 26);
  ctx.quadraticCurveTo(x + d * 12, y - 22, x + d * 20, y - 25);
  ctx.lineTo(x + d * 14, y - 18);
  ctx.lineTo(x + d * 20, y - 12);
  ctx.quadraticCurveTo(x + d * 10, y - 14, x + d, y - 12);
  ctx.closePath();
  ctx.fillStyle = '#c8322a';
  ctx.fill();
}

/**
 * A crenellated wall band with a gate in the middle; `top` is the band's upper edge on screen.
 * `outerUp` is true for the top wall (its outside faces up); the gate always opens toward the arena.
 */
function wall(ctx: CanvasRenderingContext2D, top: number, outerUp: boolean): void {
  const h = 26;
  const g = ctx.createLinearGradient(0, top, 0, top + h);
  g.addColorStop(0, '#9a5a3c');
  g.addColorStop(1, '#6e3a26');
  ctx.fillStyle = g;
  ctx.fillRect(0, top, W, h);
  // Merlons along the outer edge.
  ctx.fillStyle = '#7a4430';
  const my = outerUp ? top - 7 : top + h;
  for (let x = 4; x < W; x += 18) ctx.fillRect(x, my, 10, 7);
  // Brick lines.
  ctx.strokeStyle = 'rgba(40,20,10,0.25)';
  ctx.lineWidth = 1;
  for (let r = 1; r < 3; r++) {
    ctx.beginPath();
    ctx.moveTo(0, top + r * (h / 3));
    ctx.lineTo(W, top + r * (h / 3));
    ctx.stroke();
  }
  // Gate arch: rounded on the outer side, open toward the arena.
  const gx = W / 2;
  const gw = 70;
  ctx.beginPath();
  if (outerUp) {
    ctx.moveTo(gx - gw / 2, top + h + 1);
    ctx.lineTo(gx - gw / 2, top + 8);
    ctx.quadraticCurveTo(gx, top - 12, gx + gw / 2, top + 8);
    ctx.lineTo(gx + gw / 2, top + h + 1);
  } else {
    ctx.moveTo(gx - gw / 2, top - 1);
    ctx.lineTo(gx - gw / 2, top + h - 8);
    ctx.quadraticCurveTo(gx, top + h + 12, gx + gw / 2, top + h - 8);
    ctx.lineTo(gx + gw / 2, top - 1);
  }
  ctx.closePath();
  ctx.fillStyle = '#2a1810';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#d9a53a';
  ctx.stroke();
  // Towers stand on the wall at both ends; banners fly on the arena side of the gate.
  pagoda(ctx, 26, top + 10, 30);
  pagoda(ctx, W - 26, top + 10, 30);
  const bannerY = outerUp ? top + h + 22 : top - 2;
  banner(ctx, gx - gw / 2 - 12, bannerY, true);
  banner(ctx, gx + gw / 2 + 12, bannerY, false);
}

export function paintBackground(ctx: CanvasRenderingContext2D, H: number): void {
  const top = L.worldY;
  const bottom = L.worldY + WORLD_H;
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#f1e4c6');
  sky.addColorStop(1, '#dcc496');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  mountains(ctx, top + 10, 46 + (top - 60) * 0.5, 3, 'rgba(120,110,95,0.22)');
  mountains(ctx, top + 14, 30 + (top - 60) * 0.4, 11, 'rgba(95,85,70,0.28)');
  mountains(ctx, H, 60, 29, 'rgba(110,100,85,0.2)');

  // The sandy arena between the walls.
  const arena = ctx.createRadialGradient(W / 2, top + WORLD_H / 2, 40, W / 2, top + WORLD_H / 2, WORLD_H * 0.62);
  arena.addColorStop(0, '#f0dcae');
  arena.addColorStop(1, '#d8bd88');
  ctx.fillStyle = arena;
  ctx.fillRect(0, top + 12, W, WORLD_H - 24);
  // Worn dirt lanes from each gate to the camp.
  ctx.fillStyle = 'rgba(160,120,70,0.16)';
  roundRect(ctx, GRID_X + 8, top + 10, GRID_W - 16, GRID_Y - 4, 30);
  ctx.fill();
  roundRect(ctx, GRID_X + 8, top + GRID_Y + GRID_H, GRID_W - 16, WORLD_H - GRID_Y - GRID_H - 10, 30);
  ctx.fill();
  // Pebbles and grass tufts, placed deterministically.
  for (let i = 0; i < 90; i++) {
    const x = hash01(i * 7 + 1) * W;
    const y = top + 20 + hash01(i * 13 + 5) * (WORLD_H - 40);
    ctx.fillStyle = i % 3 === 0 ? 'rgba(110,130,70,0.35)' : 'rgba(120,90,50,0.22)';
    ctx.fillRect(x, y, 1.5 + hash01(i) * 2, 1.5 + hash01(i + 3) * 2);
  }
  wall(ctx, top - 14, true);
  wall(ctx, bottom - 12, false);

  // The stone platform under the camp.
  roundRect(ctx, GRID_X - 10, top + GRID_Y - 10, GRID_W + 20, GRID_H + 20, 14);
  ctx.fillStyle = 'rgba(60,35,15,0.35)';
  ctx.fill();
  roundRect(ctx, GRID_X - 8, top + GRID_Y - 8, GRID_W + 16, GRID_H + 16, 12);
  const stone = ctx.createLinearGradient(0, top + GRID_Y, 0, top + GRID_Y + GRID_H);
  stone.addColorStop(0, '#cbb083');
  stone.addColorStop(1, '#a88a5a');
  ctx.fillStyle = stone;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = COLORS.goldDark;
  ctx.stroke();
}
