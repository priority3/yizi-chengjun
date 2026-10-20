// Scenery for the maps in the 国潮青绿 look: each theme's paper, washes and pigments, the water and lava pools, the
// rocks and trees placed in the ASCII layout, the clutter scattered over empty ground, and the darkened map edge.
// The props themselves are drawn in scenery-props.ts; every placement here is seeded, so repaints match.
import { TILE, type MapTheme } from '../config/maps.ts';
import type { Decor, MapData } from '../core/map.ts';
import { hash01 } from './draw.ts';
import { blobPts, ink, inkGrass, INK, rng, smoothPath, wash } from './ink.ts';
import { blossoms, bone, boulder, bush, butte, cobweb, ember, lantern, pebbles, reeds, tree, type Leaves } from './scenery-props.ts';

export type Extra = 'bush' | 'tree' | 'mesa' | 'ember' | 'reed' | 'cobweb' | 'bone' | 'lantern';

export interface Palette {
  /** The paper, top left to bottom right. */
  ground: [string, string];
  /** Soft washes over the paper: colour as "r,g,b", opacity at the centre, how many. */
  washes: ReadonlyArray<readonly [string, number, number]>;
  /** Ink grass. */
  grass: string;
  /** The road band under its ink rim. */
  road: string;
  /** Water (or lava) squares: the surface colour and the deep colour (the map editor's swatch shades between them). */
  liquid: [string, string];
  /** The deep middle of each liquid square, as "r,g,b" for its wash. */
  deep: string;
  /** Whether the liquid is lava (glowing cracks instead of ripples). */
  lava: boolean;
  /** Tree and bush canopies. */
  leaves: Leaves;
  flowers: boolean;
  /** Share of empty squares that get a tuft of grass. */
  density: number;
  extra: Extra;
}

const GREEN_LEAVES: Leaves = ['#3f6d53', '#5d8d6e', '#86b394'];
const WATER: [string, string] = ['#9cc3cf', '#3d6a87'];

export const THEMES: Record<MapTheme, Palette> = {
  ridge: {
    ground: ['#efe4c6', '#e0cfa6'],
    washes: [['105,158,124', 0.26, 8], ['201,150,90', 0.14, 4]],
    grass: 'rgba(52,84,62,0.75)', road: '#d2a468', liquid: WATER, deep: '61,106,135', lava: false, leaves: GREEN_LEAVES, flowers: true, density: 0.38, extra: 'bush',
  },
  wind: {
    ground: ['#efe0b6', '#dec792'],
    washes: [['214,170,90', 0.24, 7], ['150,170,110', 0.12, 4]],
    grass: 'rgba(96,92,52,0.7)', road: '#cfa060', liquid: WATER, deep: '61,106,135', lava: false, leaves: ['#5f6f3e', '#7f8d52', '#a9b377'], flowers: false, density: 0.3, extra: 'bush',
  },
  plateau: {
    ground: ['#ecdbb5', '#dbc497'],
    washes: [['201,150,90', 0.22, 7], ['120,160,120', 0.12, 3]],
    grass: 'rgba(88,92,56,0.7)', road: '#c99858', liquid: WATER, deep: '61,106,135', lava: false, leaves: ['#4e6e4e', '#6c8c62', '#98b48a'], flowers: false, density: 0.25, extra: 'mesa',
  },
  fire: {
    ground: ['#e9d2ad', '#d6b48a'],
    washes: [['176,92,52', 0.2, 6], ['92,60,40', 0.1, 4]],
    grass: 'rgba(110,70,40,0.65)', road: '#bf814e', liquid: ['#f2a04a', '#c8401c'], deep: '200,64,28', lava: true, leaves: ['#7a3a22', '#a8552c', '#d28a4c'], flowers: false, density: 0.15, extra: 'ember',
  },
  forest: {
    ground: ['#e9e5c6', '#d6d2a6'],
    washes: [['93,141,110', 0.32, 9], ['61,106,135', 0.12, 3]],
    grass: 'rgba(46,80,58,0.78)', road: '#c9a26a', liquid: WATER, deep: '61,106,135', lava: false, leaves: ['#36614a', '#4f7f62', '#7aaa88'], flowers: true, density: 0.5, extra: 'tree',
  },
  river: {
    ground: ['#ebe8cf', '#d8d6b2'],
    washes: [['61,106,135', 0.18, 5], ['105,158,124', 0.2, 6]],
    grass: 'rgba(52,84,72,0.75)', road: '#cfa86c', liquid: ['#a4ccd8', '#3d6a87'], deep: '61,106,135', lava: false, leaves: GREEN_LEAVES, flowers: true, density: 0.4, extra: 'reed',
  },
  web: {
    ground: ['#e8dfcf', '#d4c8b2'],
    washes: [['110,96,110', 0.16, 6], ['150,130,100', 0.12, 4]],
    grass: 'rgba(80,76,70,0.6)', road: '#c2a17a', liquid: WATER, deep: '61,106,135', lava: false, leaves: ['#4f5a50', '#6b766a', '#949e90'], flowers: false, density: 0.2, extra: 'cobweb',
  },
  flame: {
    ground: ['#efd2ab', '#dfb184'],
    washes: [['205,90,50', 0.24, 7], ['214,170,90', 0.14, 4]],
    grass: 'rgba(120,64,36,0.6)', road: '#c98552', liquid: ['#f6aa48', '#cf3e18'], deep: '207,62,24', lava: true, leaves: ['#7a3018', '#b0482a', '#de8a4a'], flowers: false, density: 0.15, extra: 'ember',
  },
  lion: {
    ground: ['#ecdeba', '#dbc99e'],
    washes: [['150,130,100', 0.18, 6], ['120,150,110', 0.12, 3]],
    grass: 'rgba(90,88,60,0.65)', road: '#c99c62', liquid: WATER, deep: '61,106,135', lava: false, leaves: ['#55684a', '#738a62', '#9fb38a'], flowers: false, density: 0.3, extra: 'bone',
  },
  temple: {
    ground: ['#f1e6ca', '#e2d2ab'],
    washes: [['201,160,74', 0.16, 5], ['105,158,124', 0.16, 6]],
    grass: 'rgba(60,90,64,0.7)', road: '#d4ab72', liquid: WATER, deep: '61,106,135', lava: false, leaves: ['#3f6d53', '#5d8d6e', '#8cb898'], flowers: true, density: 0.35, extra: 'lantern',
  },
};

/** A seed that is the same for every paint of this map's layout (and differs between maps). */
export function mapSeed(map: MapData): number {
  return map.cols * 7919 + map.rows * 104729 + map.slots.length * 131 + map.decor.length * 17 + map.theme.length;
}

/** The paper: the theme's gradient, then its soft pigment washes at seeded spots. */
export function paintPaper(ctx: CanvasRenderingContext2D, map: MapData, pal: Palette): void {
  const ground = ctx.createLinearGradient(0, 0, map.w, map.h);
  ground.addColorStop(0, pal.ground[0]);
  ground.addColorStop(1, pal.ground[1]);
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, map.w, map.h);
  const rand = rng(mapSeed(map));
  // Reason: wash count scales with the map's area, so a big map isn't paler than the small one the counts were tuned on.
  const area = (map.w * map.h) / (576 * 768);
  for (const [rgb, a, count] of pal.washes) {
    for (let i = 0; i < Math.round(count * area); i++) wash(ctx, rand() * map.w, rand() * map.h, 110 + rand() * 120, rgb, a);
  }
}

/** One square's ripples: two ink-blue wave strokes under white crests, the classic 水纹. */
function ripples(ctx: CanvasRenderingContext2D, x: number, y: number, rand: () => number): void {
  for (let i = 0; i < 2; i++) {
    const wy = y - 8 + i * 13 + (rand() - 0.5) * 4;
    const wx = x + (rand() - 0.5) * 8;
    for (const [dy, w, color] of [
      [1, 1.6, 'rgba(30,62,84,0.4)'],
      [0, 1.2, 'rgba(255,255,255,0.6)'],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(wx - 13, wy + dy);
      ctx.quadraticCurveTo(wx - 6, wy - 5 + dy, wx, wy + dy);
      ctx.quadraticCurveTo(wx + 6, wy + 5 + dy, wx + 13, wy + dy);
      ctx.lineWidth = w;
      ctx.strokeStyle = color;
      ctx.stroke();
    }
  }
}

/** One square of lava: two drifting plates of dark crust edged with glowing seams, never centred on the square. */
function lavaCrust(ctx: CanvasRenderingContext2D, x: number, y: number, rand: () => number): void {
  for (let i = 0; i < 2; i++) {
    const cx = x + (rand() - 0.5) * 30;
    const cy = y + (rand() - 0.5) * 26;
    smoothPath(ctx, blobPts(cx, cy, 5 + rand() * 6, 3 + rand() * 4, rand, 8, 0.45));
    ctx.fillStyle = 'rgba(70,30,16,0.5)';
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(255,214,120,0.85)';
    ctx.stroke();
  }
  ctx.beginPath();
  const sx = x - 16 + rand() * 6;
  const sy = y + (rand() - 0.5) * 20;
  ctx.moveTo(sx, sy);
  ctx.quadraticCurveTo(x, sy + (rand() - 0.5) * 16, x + 16 - rand() * 6, sy + (rand() - 0.5) * 10);
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = 'rgba(255,236,160,0.8)';
  ctx.stroke();
}

/**
 * The water / lava squares from the layout (under the roads), drawn as one pool or stream with a brushed ink shore.
 * Each square is a round blob reaching past the square's corners, so neighbours melt together into one body with a
 * gently scalloped shore and no gaps where four squares meet. Lava also glows on the ground around it.
 */
export function drawLiquids(ctx: CanvasRenderingContext2D, map: MapData, pal: Palette): void {
  const cells = map.decor.filter((d) => d.kind === 'water');
  if (cells.length === 0) return;
  const rand = rng(mapSeed(map) + 11);
  if (pal.lava) for (const d of cells) wash(ctx, d.x, d.y, 52, '255,120,50', 0.22);
  const shapes = cells.map((d) => blobPts(d.x, d.y, 36, 36, rand, 12, 0.1));
  // Reason: every blob is inked a little wider first and then all are filled, so the ink survives only on the shore.
  ctx.lineJoin = 'round';
  ctx.lineWidth = 4;
  ctx.strokeStyle = INK;
  for (const s of shapes) {
    smoothPath(ctx, s);
    ctx.stroke();
  }
  ctx.fillStyle = pal.liquid[0];
  for (const s of shapes) {
    smoothPath(ctx, s);
    ctx.fill();
  }
  for (const d of cells) wash(ctx, d.x, d.y, 30, pal.deep, pal.lava ? 0.55 : 0.32);
  for (const d of cells) {
    if (pal.lava) lavaCrust(ctx, d.x, d.y, rand);
    else ripples(ctx, d.x, d.y, rand);
  }
}

/** One rock or tree from the layout (drawn over the roads), standing at the bottom of its square; `i` seeds it. */
export function drawProp(ctx: CanvasRenderingContext2D, d: Decor, i: number, pal: Palette): void {
  const rand = rng(i * 7919 + 13);
  if (d.kind === 'rock') boulder(ctx, d.x, d.y + 10, rand, 0.95);
  else if (d.kind === 'tree') tree(ctx, d.x, d.y + 15, rand, pal.leaves, 0.82);
}

function extra(ctx: CanvasRenderingContext2D, pal: Palette, x: number, y: number, rand: () => number): void {
  switch (pal.extra) {
    case 'bush':
      bush(ctx, x, y, rand, pal.leaves);
      break;
    case 'tree':
      tree(ctx, x, y + 12, rand, pal.leaves, 0.62);
      break;
    case 'mesa':
      butte(ctx, x, y + 10, rand, 0.46);
      break;
    case 'ember':
      ember(ctx, x, y, rand);
      break;
    case 'reed':
      reeds(ctx, x, y + 6, rand);
      break;
    case 'cobweb':
      cobweb(ctx, x, y, rand);
      break;
    case 'bone':
      bone(ctx, x, y, rand);
      break;
    case 'lantern':
      lantern(ctx, x, y + 10);
      break;
  }
}

/** Deterministic clutter on every empty square: ink grass, pebbles, blossoms, and a themed prop now and then. */
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
      const rand = rng(i * 31 + 7);
      const open = !roadNear(c, r) && clear(x, y);
      if (open && h > 0.86) extra(ctx, pal, x, y, rand);
      else if (h < pal.density) inkGrass(ctx, x, y + 3, rand, pal.grass);
      else if (h < pal.density + 0.14) pebbles(ctx, x, y, rand);
      else if (pal.flowers && h < pal.density + 0.24) blossoms(ctx, x, y, rand);
    }
  }
}

/** Darkens the map's edges so the sheet reads as a painting with a soft border rather than a cut-out. */
export function vignette(ctx: CanvasRenderingContext2D, map: MapData): void {
  const d = 56;
  const edges: Array<[number, number, number, number, number, number, number, number]> = [
    [0, 0, 0, d, 0, 0, map.w, d],
    [0, map.h, 0, map.h - d, 0, map.h - d, map.w, d],
    [0, 0, d, 0, 0, 0, d, map.h],
    [map.w, 0, map.w - d, 0, map.w - d, 0, d, map.h],
  ];
  for (const [x0, y0, x1, y1, rx, ry, rw, rh] of edges) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, ink(0.26));
    g.addColorStop(1, ink(0));
    ctx.fillStyle = g;
    ctx.fillRect(rx, ry, rw, rh);
  }
}
