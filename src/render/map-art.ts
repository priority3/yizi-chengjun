// Paints a chapter map: themed ground, scenery, the dirt roads, the monster entrances, 唐僧's camp and the
// stone pads cards stand on. Painted once per zoom level into an offscreen canvas.
import { MAPS } from '../config/maps.ts';
import { buildMap, pathPoint, ROAD_W, type MapData, type PathData, type Pt } from '../core/map.ts';
import type { Stage } from '../platform/web.ts';
import { hash01, roundRect, text } from './draw.ts';
import { brush } from './fonts.ts';
import { drawPortrait } from './heroes-art.ts';
import { L, W } from './layout.ts';
import { drawLiquids, drawProps, scatter, THEMES, vignette, type Palette } from './scenery.ts';

/** Slot pad radius (world px). */
export const PAD_R = 25;

function road(ctx: CanvasRenderingContext2D, path: PathData, pal: Palette): void {
  const pts = path.pts;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const trace = () => {
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  };
  trace();
  ctx.lineWidth = ROAD_W + 10;
  ctx.strokeStyle = pal.edge;
  ctx.globalAlpha = 0.55;
  ctx.stroke();
  ctx.globalAlpha = 1;
  trace();
  ctx.lineWidth = ROAD_W;
  ctx.strokeStyle = pal.road;
  ctx.stroke();
  // Worn middle and cart-track lines.
  trace();
  ctx.lineWidth = ROAD_W * 0.55;
  ctx.strokeStyle = 'rgba(255,240,210,0.13)';
  ctx.stroke();
  trace();
  ctx.setLineDash([10, 16]);
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255,245,220,0.22)';
  ctx.stroke();
  ctx.setLineDash([]);
  // Pebbles along both verges.
  const verge = (ROAD_W / 2 + 4) / 12;
  for (let d = 10; d < path.length; d += 26) {
    for (const side of [-verge, verge]) {
      const p = pathPoint(path, d + hash01(Math.round(d) + (side > 0 ? 1 : 0)) * 10, side);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 2.6, 1.8, hash01(Math.round(d)) * 3, 0, Math.PI * 2);
      ctx.fillStyle = hash01(Math.round(d * 3)) > 0.5 ? '#a89a82' : '#8f8370';
      ctx.fill();
    }
  }
}

/** A dark cave mouth with a stone arch: where the monsters come from. */
function entrance(ctx: CanvasRenderingContext2D, p: Pt): void {
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 4, 30, 24, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#6a6058';
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 6, 22, 17, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#1e1410';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#3a2e26';
  ctx.stroke();
  text(ctx, '妖', p.x, p.y + 7, brush(16), 'rgba(255,120,80,0.85)');
}

/** 唐僧's camp: a stone platform, a tent with red trim, and the monk himself. */
function camp(ctx: CanvasRenderingContext2D, p: Pt): void {
  roundRect(ctx, p.x - 40, p.y - 30, 80, 62, 12);
  ctx.fillStyle = 'rgba(60,35,15,0.3)';
  ctx.fill();
  roundRect(ctx, p.x - 38, p.y - 32, 76, 60, 12);
  const stone = ctx.createLinearGradient(0, p.y - 32, 0, p.y + 28);
  stone.addColorStop(0, '#cbb083');
  stone.addColorStop(1, '#a88a5a');
  ctx.fillStyle = stone;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#a8740c';
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(p.x - 30, p.y + 18);
  ctx.lineTo(p.x, p.y - 26);
  ctx.lineTo(p.x + 30, p.y + 18);
  ctx.closePath();
  ctx.fillStyle = '#f3e4c4';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#8a3a22';
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(p.x - 9, p.y + 18);
  ctx.lineTo(p.x, p.y + 2);
  ctx.lineTo(p.x + 9, p.y + 18);
  ctx.closePath();
  ctx.fillStyle = '#5a2a18';
  ctx.fill();
  drawPortrait(ctx, '唐僧', p.x, p.y - 4, 10);
  ctx.fillStyle = '#5a3a24';
  ctx.fillRect(p.x + 26, p.y - 40, 2, 34);
  ctx.beginPath();
  ctx.moveTo(p.x + 28, p.y - 40);
  ctx.lineTo(p.x + 46, p.y - 35);
  ctx.lineTo(p.x + 28, p.y - 28);
  ctx.closePath();
  ctx.fillStyle = '#c8322a';
  ctx.fill();
  text(ctx, '营', p.x + 34, p.y - 34, brush(8), '#fff1c2');
}

/** A stone pad a card can stand on (its locked overlay is drawn live by the renderer). */
export function pad(ctx: CanvasRenderingContext2D, p: Pt, seed: number): void {
  ctx.beginPath();
  ctx.ellipse(p.x + 2, p.y + 4, PAD_R + 2, PAD_R * 0.9, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(40,25,10,0.28)';
  ctx.fill();
  const g = ctx.createRadialGradient(p.x - 6, p.y - 8, 4, p.x, p.y, PAD_R);
  g.addColorStop(0, '#e4d2ac');
  g.addColorStop(1, '#b59a6c');
  ctx.beginPath();
  ctx.arc(p.x, p.y, PAD_R, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#7a5a30';
  ctx.stroke();
  ctx.strokeStyle = 'rgba(90,60,30,0.35)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const a = hash01(seed * 7 + i) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(a) * 6, p.y + Math.sin(a) * 6);
    ctx.lineTo(p.x + Math.cos(a) * (PAD_R - 4), p.y + Math.sin(a) * (PAD_R - 4));
    ctx.stroke();
  }
}

/** Paints the whole map in world units (0..w, 0..h). */
export function paintMap(ctx: CanvasRenderingContext2D, map: MapData): void {
  const pal = THEMES[map.theme];
  const ground = ctx.createLinearGradient(0, 0, map.w, map.h);
  ground.addColorStop(0, pal.ground[0]);
  ground.addColorStop(1, pal.ground[1]);
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, map.w, map.h);
  const n = Math.round((map.w * map.h) / 2200);
  for (let i = 0; i < n; i++) {
    const x = hash01(i * 7 + 1) * map.w;
    const y = hash01(i * 13 + 5) * map.h;
    ctx.fillStyle = i % 3 === 0 ? pal.speck : 'rgba(120,90,50,0.2)';
    ctx.fillRect(x, y, 1.5 + hash01(i) * 2.5, 1.5 + hash01(i + 3) * 2.5);
  }
  drawLiquids(ctx, map, pal);
  scatter(ctx, map, pal);
  map.paths.forEach((p) => road(ctx, p, pal));
  drawProps(ctx, map);
  map.spawns.forEach((s) => entrance(ctx, s));
  camp(ctx, map.camp);
  map.slots.forEach((s, i) => pad(ctx, s, i));
  vignette(ctx, map);
}

const cache = new WeakMap<MapData, Map<number, HTMLCanvasElement>>();

/** The painted map at a resolution suited to the zoom (quantised so a pinch doesn't repaint every frame). */
export function mapImage(map: MapData, zoom: number, pixelRatio: number): HTMLCanvasElement {
  const res = Math.min(3, pixelRatio * Math.min(1.5, Math.max(0.5, Math.round(zoom * 4) / 4)));
  let byRes = cache.get(map);
  if (!byRes) {
    byRes = new Map();
    cache.set(map, byRes);
  }
  const hit = byRes.get(res);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = Math.ceil(map.w * res);
  c.height = Math.ceil(map.h * res);
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not supported in this browser');
  ctx.setTransform(res, 0, 0, res, 0, 0);
  paintMap(ctx, map);
  // Reason: keep only a few zoom levels per map; large maps at high resolution are tens of megabytes.
  if (byRes.size >= 3) byRes.delete(byRes.keys().next().value as number);
  byRes.set(res, c);
  return c;
}

export function drawMap(ctx: CanvasRenderingContext2D, map: MapData, zoom: number, pixelRatio: number): void {
  ctx.drawImage(mapImage(map, zoom, pixelRatio), 0, 0, map.w, map.h);
}

let menuMap: MapData | null = null;

/** The first chapter's map, scaled to cover the screen and dimmed, behind menus. */
export function menuBackdrop(ctx: CanvasRenderingContext2D, stage: Stage, dim: number): void {
  if (!menuMap) menuMap = buildMap(MAPS[0]);
  const scale = Math.max(W / menuMap.w, L.H / menuMap.h);
  const img = mapImage(menuMap, scale, stage.pixelRatio);
  const dw = menuMap.w * scale;
  const dh = menuMap.h * scale;
  ctx.drawImage(img, (W - dw) / 2, (L.H - dh) / 2, dw, dh);
  ctx.fillStyle = `rgba(28,14,6,${dim})`;
  ctx.fillRect(0, 0, W, L.H);
}
