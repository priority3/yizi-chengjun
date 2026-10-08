// Scenery for the maps: the big props placed in the ASCII layout (water, rocks, trees) and the small
// deterministic clutter scattered over empty ground (grass, pebbles, flowers, themed extras), plus the edge vignette.
import { TILE, type MapTheme } from '../config/maps.ts';
import type { MapData, Pt } from '../core/map.ts';
import { hash01, roundRect } from './draw.ts';

export type Extra = 'bush' | 'tree' | 'mesa' | 'ember' | 'reed' | 'cobweb' | 'bone' | 'lantern';

export interface Palette {
  ground: [string, string];
  speck: string;
  grass: string;
  road: string;
  edge: string;
  liquid: [string, string];
  lava: boolean;
  flowers: boolean;
  /** Share of empty squares that get a tuft of grass. */
  density: number;
  extra: Extra;
}

export const THEMES: Record<MapTheme, Palette> = {
  ridge: { ground: ['#ead9b4', '#d2bb8c'], speck: 'rgba(110,130,70,0.35)', grass: '#7f9a4c', road: '#c9a872', edge: '#8a6a3c', liquid: ['#7cc1e0', '#3f8fb8'], lava: false, flowers: true, density: 0.4, extra: 'bush' },
  wind: { ground: ['#e8dcbb', '#cfbd8e'], speck: 'rgba(150,120,70,0.3)', grass: '#a3a460', road: '#c3a470', edge: '#86663a', liquid: ['#7cc1e0', '#3f8fb8'], lava: false, flowers: false, density: 0.3, extra: 'bush' },
  plateau: { ground: ['#dccba6', '#c0a97e'], speck: 'rgba(120,90,50,0.3)', grass: '#8f945a', road: '#b8945e', edge: '#7a5a30', liquid: ['#7cc1e0', '#3f8fb8'], lava: false, flowers: false, density: 0.25, extra: 'mesa' },
  fire: { ground: ['#d9b48c', '#b8865c'], speck: 'rgba(120,50,20,0.35)', grass: '#9a6a3a', road: '#a56a40', edge: '#6a3c1c', liquid: ['#ffb24a', '#e0481a'], lava: true, flowers: false, density: 0.15, extra: 'ember' },
  forest: { ground: ['#cfdba6', '#a8bf7c'], speck: 'rgba(60,110,50,0.4)', grass: '#5f9a44', road: '#b59a68', edge: '#6e5634', liquid: ['#7cc1e0', '#3f8fb8'], lava: false, flowers: true, density: 0.5, extra: 'tree' },
  river: { ground: ['#dfe3c0', '#c2cd98'], speck: 'rgba(90,120,60,0.35)', grass: '#6f9c52', road: '#bca473', edge: '#7e6238', liquid: ['#8ad0ee', '#3f8fb8'], lava: false, flowers: true, density: 0.4, extra: 'reed' },
  web: { ground: ['#d9cfc1', '#b7ab99'], speck: 'rgba(90,70,60,0.35)', grass: '#8a8f72', road: '#a9956f', edge: '#6a5a3c', liquid: ['#7cc1e0', '#3f8fb8'], lava: false, flowers: false, density: 0.2, extra: 'cobweb' },
  flame: { ground: ['#e0b58c', '#bf895a'], speck: 'rgba(140,50,20,0.4)', grass: '#a5703a', road: '#b07445', edge: '#6e3f1a', liquid: ['#ffc24a', '#e8501a'], lava: true, flowers: false, density: 0.15, extra: 'ember' },
  lion: { ground: ['#e2d3ad', '#c5b085'], speck: 'rgba(120,100,60,0.35)', grass: '#9c9a5c', road: '#bf9c66', edge: '#7e5e32', liquid: ['#7cc1e0', '#3f8fb8'], lava: false, flowers: false, density: 0.3, extra: 'bone' },
  temple: { ground: ['#ebddc0', '#d0be97'], speck: 'rgba(160,120,60,0.3)', grass: '#8aa05a', road: '#c8a976', edge: '#8a6a3c', liquid: ['#7cc1e0', '#3f8fb8'], lava: false, flowers: true, density: 0.35, extra: 'lantern' },
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

function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  ctx.fillStyle = 'rgba(40,25,10,0.25)';
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function rock(ctx: CanvasRenderingContext2D, p: Pt, seed: number, s = 1): void {
  shadow(ctx, p.x + 3 * s, p.y + 12 * s, 18 * s, 7 * s);
  for (const [dx, dy, r, c] of [
    [-6, 2, 13, '#8c8478'],
    [8, 4, 10, '#7a7266'],
    [2, -6, 9, '#a39a8c'],
  ] as const) {
    ctx.beginPath();
    ctx.ellipse(p.x + dx * s, p.y + dy * s, r * s, r * s * (0.8 + hash01(seed + r) * 0.3), 0, 0, Math.PI * 2);
    ctx.fillStyle = c;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#4a4238';
    ctx.stroke();
  }
}

function tree(ctx: CanvasRenderingContext2D, p: Pt, seed: number, s = 1): void {
  shadow(ctx, p.x + 2 * s, p.y + 16 * s, 14 * s, 5 * s);
  ctx.fillStyle = '#6b4a2a';
  ctx.fillRect(p.x - 2.5 * s, p.y, 5 * s, 16 * s);
  for (const [dx, dy, r, c] of [
    [-7, -2, 11, '#4f8a3c'],
    [7, -3, 10, '#5f9c48'],
    [0, -10, 11, '#6fae55'],
  ] as const) {
    ctx.beginPath();
    ctx.arc(p.x + dx * s, p.y + dy * s, (r + hash01(seed + r) * 2) * s, 0, Math.PI * 2);
    ctx.fillStyle = c;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#2f5a24';
    ctx.stroke();
  }
}

function bush(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number): void {
  shadow(ctx, x + 1, y + 7, 11, 4);
  for (const [dx, dy, r] of [
    [-6, 1, 7],
    [5, 0, 7],
    [0, -4, 7],
  ] as const) {
    ctx.beginPath();
    ctx.arc(x + dx, y + dy, r + hash01(seed + r), 0, Math.PI * 2);
    ctx.fillStyle = dy < 0 ? '#79ad5a' : '#5f9444';
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#3a6a2c';
    ctx.stroke();
  }
}

/** A flat-topped sandstone outcrop. */
function mesa(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number): void {
  const w = 22 + hash01(seed) * 8;
  shadow(ctx, x + 2, y + 10, w, 5);
  ctx.beginPath();
  ctx.moveTo(x - w, y + 8);
  ctx.lineTo(x - w * 0.7, y - 10);
  ctx.lineTo(x + w * 0.7, y - 10);
  ctx.lineTo(x + w, y + 8);
  ctx.closePath();
  ctx.fillStyle = '#c9a97c';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#7a5a30';
  ctx.stroke();
  ctx.fillStyle = '#e0c494';
  ctx.beginPath();
  ctx.ellipse(x, y - 10, w * 0.7, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

/** Glowing cracks with embers, for the fire maps. */
function ember(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number): void {
  ctx.lineCap = 'round';
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const a = hash01(seed * 3 + i) * Math.PI * 2;
    const len = 8 + hash01(seed + i * 7) * 10;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.strokeStyle = 'rgba(60,20,5,0.6)';
    ctx.stroke();
  }
  const g = ctx.createRadialGradient(x, y, 0, x, y, 7);
  g.addColorStop(0, 'rgba(255,200,80,0.9)');
  g.addColorStop(1, 'rgba(255,90,20,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.fill();
}

function reed(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number): void {
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const dx = (i - 1.5) * 4;
    const h = 14 + hash01(seed + i) * 8;
    ctx.beginPath();
    ctx.moveTo(x + dx, y + 6);
    ctx.quadraticCurveTo(x + dx + 2, y - h * 0.5, x + dx + 4, y - h);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = '#4f8a3c';
    ctx.stroke();
    ctx.fillStyle = '#8a5a2a';
    ctx.beginPath();
    ctx.ellipse(x + dx + 4, y - h, 1.6, 4, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function cobweb(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number): void {
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1;
  const r = 14 + hash01(seed) * 6;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    ctx.stroke();
  }
  for (let k = 1; k <= 3; k++) {
    ctx.beginPath();
    ctx.arc(x, y, (r * k) / 3.2, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function bone(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number): void {
  const a = hash01(seed) * Math.PI;
  const dx = Math.cos(a) * 9;
  const dy = Math.sin(a) * 9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - dx, y - dy);
  ctx.lineTo(x + dx, y + dy);
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#f2ead8';
  ctx.stroke();
  ctx.fillStyle = '#f2ead8';
  for (const sgn of [-1, 1]) {
    for (const t of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(x + sgn * dx - t * dy * 0.3, y + sgn * dy + t * dx * 0.3, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** A stone lantern. */
function lantern(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  shadow(ctx, x + 1, y + 12, 9, 3.5);
  ctx.fillStyle = '#9a9388';
  ctx.strokeStyle = '#4a4238';
  ctx.lineWidth = 1.2;
  ctx.fillRect(x - 3, y - 4, 6, 14);
  ctx.strokeRect(x - 3, y - 4, 6, 14);
  roundRect(ctx, x - 7, y - 12, 14, 9, 2);
  ctx.fillStyle = '#b8b0a4';
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 10, y - 12);
  ctx.lineTo(x, y - 19);
  ctx.lineTo(x + 10, y - 12);
  ctx.closePath();
  ctx.fillStyle = '#6a625a';
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,200,90,0.85)';
  ctx.fillRect(x - 4, y - 10, 8, 5);
}

function grass(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, seed: number): void {
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = color;
  for (let i = 0; i < 4; i++) {
    const dx = (i - 1.5) * 3;
    const h = 5 + hash01(seed + i) * 6;
    ctx.beginPath();
    ctx.moveTo(x + dx, y + 3);
    ctx.quadraticCurveTo(x + dx + 1, y - h * 0.4, x + dx + (i % 2 ? 3 : -2), y - h);
    ctx.stroke();
  }
}

function pebbles(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number): void {
  for (let i = 0; i < 3; i++) {
    const dx = (hash01(seed * 7 + i) - 0.5) * 16;
    const dy = (hash01(seed * 11 + i) - 0.5) * 10;
    ctx.beginPath();
    ctx.ellipse(x + dx, y + dy, 2.4, 1.7, hash01(seed + i) * 2, 0, Math.PI * 2);
    ctx.fillStyle = i % 2 ? '#b3a68f' : '#9a8d78';
    ctx.fill();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = 'rgba(60,45,30,0.6)';
    ctx.stroke();
  }
}

function flowers(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number): void {
  const colors = ['#ff8aa8', '#ffd45a', '#f7f0ff', '#ff9a5a'];
  for (let i = 0; i < 3; i++) {
    const fx = x + (hash01(seed * 5 + i) - 0.5) * 16;
    const fy = y + (hash01(seed * 9 + i) - 0.5) * 12;
    ctx.beginPath();
    ctx.arc(fx, fy, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = colors[(seed + i) % colors.length];
    ctx.fill();
    ctx.beginPath();
    ctx.arc(fx, fy, 0.9, 0, Math.PI * 2);
    ctx.fillStyle = '#7a4a10';
    ctx.fill();
  }
}

function extra(ctx: CanvasRenderingContext2D, kind: Extra, x: number, y: number, seed: number): void {
  switch (kind) {
    case 'bush':
      bush(ctx, x, y, seed);
      break;
    case 'tree':
      tree(ctx, { x, y }, seed, 0.8);
      break;
    case 'mesa':
      mesa(ctx, x, y, seed);
      break;
    case 'ember':
      ember(ctx, x, y, seed);
      break;
    case 'reed':
      reed(ctx, x, y, seed);
      break;
    case 'cobweb':
      cobweb(ctx, x, y, seed);
      break;
    case 'bone':
      bone(ctx, x, y, seed);
      break;
    case 'lantern':
      lantern(ctx, x, y);
      break;
  }
}

/** The water / lava squares from the layout (under the roads). */
export function drawLiquids(ctx: CanvasRenderingContext2D, map: MapData, pal: Palette): void {
  map.decor.forEach((d, i) => {
    if (d.kind === 'water') liquid(ctx, d, pal, i);
  });
}

/** The rocks and trees from the layout (over the roads). */
export function drawProps(ctx: CanvasRenderingContext2D, map: MapData): void {
  map.decor.forEach((d, i) => {
    if (d.kind === 'rock') rock(ctx, d, i);
    else if (d.kind === 'tree') tree(ctx, d, i);
  });
}

/** Deterministic clutter on every empty square: grass, pebbles, flowers, and a themed prop now and then. */
export function scatter(ctx: CanvasRenderingContext2D, map: MapData, pal: Palette): void {
  const { cols, rows, road } = map;
  const taken = new Set(map.decor.map((d) => Math.floor(d.y / TILE) * cols + Math.floor(d.x / TILE)));
  const roadNear = (c: number, r: number): boolean => {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nc = c + dc;
        const nr = r + dr;
        if (nc >= 0 && nc < cols && nr >= 0 && nr < rows && road[nr * cols + nc]) return true;
      }
    }
    return false;
  };
  const clear = (x: number, y: number): boolean =>
    map.slots.every((s) => Math.hypot(s.x - x, s.y - y) > 46) &&
    Math.hypot(map.camp.x - x, map.camp.y - y) > 72 &&
    map.spawns.every((s) => Math.hypot(s.x - x, s.y - y) > 60);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (road[i] || taken.has(i)) continue;
      const x = c * TILE + TILE / 2 + (hash01(i * 5 + 1) - 0.5) * 22;
      const y = r * TILE + TILE / 2 + (hash01(i * 9 + 2) - 0.5) * 22;
      const h = hash01(i * 17 + 3);
      const open = !roadNear(c, r) && clear(x, y);
      if (open && h > 0.86) extra(ctx, pal.extra, x, y, i);
      else if (h < pal.density) grass(ctx, x, y, pal.grass, i);
      else if (h < pal.density + 0.14) pebbles(ctx, x, y, i);
      else if (pal.flowers && h < pal.density + 0.24) flowers(ctx, x, y, i);
    }
  }
}

/** Darkens the map's edges so the world reads as a place rather than a flat sheet. */
export function vignette(ctx: CanvasRenderingContext2D, map: MapData): void {
  const d = 52;
  const edges: Array<[number, number, number, number, number, number, number, number]> = [
    [0, 0, 0, d, 0, 0, map.w, d],
    [0, map.h, 0, map.h - d, 0, map.h - d, map.w, d],
    [0, 0, d, 0, 0, 0, d, map.h],
    [map.w, 0, map.w - d, 0, map.w - d, 0, d, map.h],
  ];
  for (const [x0, y0, x1, y1, rx, ry, rw, rh] of edges) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, 'rgba(40,25,10,0.32)');
    g.addColorStop(1, 'rgba(40,25,10,0)');
    ctx.fillStyle = g;
    ctx.fillRect(rx, ry, rw, rh);
  }
}
