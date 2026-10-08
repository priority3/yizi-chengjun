// Paints a chapter map: themed ground, water or lava, rocks and trees, the dirt roads, the monster
// entrances, 唐僧's camp and the stone pads cards stand on. Painted once per zoom level into an offscreen canvas.
import { MAPS, type MapTheme } from '../config/maps.ts';
import { buildMap, ROAD_W, type MapData, type Pt } from '../core/map.ts';
import type { Stage } from '../platform/web.ts';
import { hash01, roundRect, text } from './draw.ts';
import { brush } from './fonts.ts';
import { drawPortrait } from './heroes-art.ts';
import { L, W } from './layout.ts';

/** Slot pad radius (world px). */
export const PAD_R = 25;

interface Palette {
  ground: [string, string];
  speck: string;
  road: string;
  edge: string;
  liquid: [string, string];
  lava: boolean;
}

const THEMES: Record<MapTheme, Palette> = {
  ridge: { ground: ['#ead9b4', '#d2bb8c'], speck: 'rgba(110,130,70,0.35)', road: '#c9a872', edge: '#8a6a3c', liquid: ['#7cc1e0', '#3f8fb8'], lava: false },
  wind: { ground: ['#e8dcbb', '#cfbd8e'], speck: 'rgba(150,120,70,0.3)', road: '#c3a470', edge: '#86663a', liquid: ['#7cc1e0', '#3f8fb8'], lava: false },
  plateau: { ground: ['#dccba6', '#c0a97e'], speck: 'rgba(120,90,50,0.3)', road: '#b8945e', edge: '#7a5a30', liquid: ['#7cc1e0', '#3f8fb8'], lava: false },
  fire: { ground: ['#d9b48c', '#b8865c'], speck: 'rgba(120,50,20,0.35)', road: '#a56a40', edge: '#6a3c1c', liquid: ['#ffb24a', '#e0481a'], lava: true },
  forest: { ground: ['#cfdba6', '#a8bf7c'], speck: 'rgba(60,110,50,0.4)', road: '#b59a68', edge: '#6e5634', liquid: ['#7cc1e0', '#3f8fb8'], lava: false },
  river: { ground: ['#dfe3c0', '#c2cd98'], speck: 'rgba(90,120,60,0.35)', road: '#bca473', edge: '#7e6238', liquid: ['#8ad0ee', '#3f8fb8'], lava: false },
  web: { ground: ['#d9cfc1', '#b7ab99'], speck: 'rgba(90,70,60,0.35)', road: '#a9956f', edge: '#6a5a3c', liquid: ['#7cc1e0', '#3f8fb8'], lava: false },
  flame: { ground: ['#e0b58c', '#bf895a'], speck: 'rgba(140,50,20,0.4)', road: '#b07445', edge: '#6e3f1a', liquid: ['#ffc24a', '#e8501a'], lava: true },
  lion: { ground: ['#e2d3ad', '#c5b085'], speck: 'rgba(120,100,60,0.35)', road: '#bf9c66', edge: '#7e5e32', liquid: ['#7cc1e0', '#3f8fb8'], lava: false },
  temple: { ground: ['#ebddc0', '#d0be97'], speck: 'rgba(160,120,60,0.3)', road: '#c8a976', edge: '#8a6a3c', liquid: ['#7cc1e0', '#3f8fb8'], lava: false },
};

function liquid(ctx: CanvasRenderingContext2D, p: Pt, pal: Palette, seed: number): void {
  const half = 24;
  const g = ctx.createLinearGradient(p.x, p.y - half, p.x, p.y + half);
  g.addColorStop(0, pal.liquid[0]);
  g.addColorStop(1, pal.liquid[1]);
  ctx.fillStyle = g;
  ctx.fillRect(p.x - half, p.y - half, half * 2, half * 2);
  ctx.strokeStyle = pal.lava ? 'rgba(255,240,160,0.5)' : 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    const y = p.y - half + 10 + i * 14 + hash01(seed + i) * 6;
    ctx.beginPath();
    ctx.moveTo(p.x - half + 6, y);
    ctx.quadraticCurveTo(p.x - 8, y - 4, p.x, y);
    ctx.quadraticCurveTo(p.x + 8, y + 4, p.x + half - 6, y);
    ctx.stroke();
  }
}

function rock(ctx: CanvasRenderingContext2D, p: Pt, seed: number): void {
  ctx.fillStyle = 'rgba(40,25,10,0.25)';
  ctx.beginPath();
  ctx.ellipse(p.x + 3, p.y + 12, 18, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const [dx, dy, r, c] of [
    [-6, 2, 13, '#8c8478'],
    [8, 4, 10, '#7a7266'],
    [2, -6, 9, '#a39a8c'],
  ] as const) {
    ctx.beginPath();
    ctx.ellipse(p.x + dx, p.y + dy, r, r * (0.8 + hash01(seed + r) * 0.3), 0, 0, Math.PI * 2);
    ctx.fillStyle = c;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#4a4238';
    ctx.stroke();
  }
}

function tree(ctx: CanvasRenderingContext2D, p: Pt, seed: number): void {
  ctx.fillStyle = 'rgba(40,25,10,0.25)';
  ctx.beginPath();
  ctx.ellipse(p.x + 2, p.y + 16, 14, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6b4a2a';
  ctx.fillRect(p.x - 2.5, p.y, 5, 16);
  for (const [dx, dy, r, c] of [
    [-7, -2, 11, '#4f8a3c'],
    [7, -3, 10, '#5f9c48'],
    [0, -10, 11, '#6fae55'],
  ] as const) {
    ctx.beginPath();
    ctx.arc(p.x + dx, p.y + dy, r + hash01(seed + r) * 2, 0, Math.PI * 2);
    ctx.fillStyle = c;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#2f5a24';
    ctx.stroke();
  }
}

function road(ctx: CanvasRenderingContext2D, pts: Pt[], pal: Palette): void {
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
  // Worn centre line.
  trace();
  ctx.setLineDash([10, 16]);
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(255,245,220,0.22)';
  ctx.stroke();
  ctx.setLineDash([]);
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
  // Tent.
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
  // Banner on a pole.
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
  // Pebbles and grass tufts, placed deterministically.
  const n = Math.round((map.w * map.h) / 2200);
  for (let i = 0; i < n; i++) {
    const x = hash01(i * 7 + 1) * map.w;
    const y = hash01(i * 13 + 5) * map.h;
    ctx.fillStyle = i % 3 === 0 ? pal.speck : 'rgba(120,90,50,0.2)';
    ctx.fillRect(x, y, 1.5 + hash01(i) * 2.5, 1.5 + hash01(i + 3) * 2.5);
  }
  map.decor.forEach((d, i) => {
    if (d.kind === 'water') liquid(ctx, d, pal, i);
  });
  map.paths.forEach((p) => road(ctx, p.pts, pal));
  map.decor.forEach((d, i) => {
    if (d.kind === 'rock') rock(ctx, d, i);
    else if (d.kind === 'tree') tree(ctx, d, i);
  });
  map.spawns.forEach((s) => entrance(ctx, s));
  camp(ctx, map.camp);
  map.slots.forEach((s, i) => pad(ctx, s, i));
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
