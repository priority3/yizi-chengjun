// Paints a chapter map: themed ground, scenery, the dirt roads, the monster entrances, 唐僧's camp and the
// stone pads cards stand on. Painted once per zoom level into an offscreen canvas.
import { MAPS, TILE, type SlotKind } from '../config/maps.ts';
import { buildMap, pathPoint, ROAD_W, type MapData, type Pt } from '../core/map.ts';
import type { Stage } from '../platform/web.ts';
import { hash01, roundRect, text } from './draw.ts';
import { brush } from './fonts.ts';
import { drawPortrait } from './heroes-art.ts';
import { L, W } from './layout.ts';
import { altarRunes, highPlinth, mirePad } from './pad-art.ts';
import { drawLiquids, drawProps, scatter, THEMES, vignette, type Palette } from './scenery.ts';

/** Slot pad radius (world px). */
export const PAD_R = 25;

/** Decorations (tracks, pebbles) stay this far from a junction's centre, so nothing crosses the merge. */
const JUNCTION_R = TILE * 0.95;

/**
 * Junction squares (three or more road neighbours) and straight stubs from each to its neighbours.
 * Reason: each road's centre line cuts its corners, so where two roads meet in a T the rounded corners
 * would leave a notch; the stubs fill the junction squarely underneath.
 */
function junctions(map: MapData): { centres: Pt[]; stubs: Array<[Pt, Pt]> } {
  const { cols, rows, road } = map;
  const centres: Pt[] = [];
  const stubs: Array<[Pt, Pt]> = [];
  const centre = (c: number, r: number): Pt => ({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 });
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!road[r * cols + c]) continue;
      const ns: Pt[] = [];
      for (const [dc, dr] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nc = c + dc;
        const nr = r + dr;
        if (nc >= 0 && nc < cols && nr >= 0 && nr < rows && road[nr * cols + nc]) ns.push(centre(nc, nr));
      }
      if (ns.length < 3) continue;
      centres.push(centre(c, r));
      for (const n of ns) stubs.push([centre(c, r), n]);
    }
  }
  return { centres, stubs };
}

/** For each road, the point index from which it runs on top of an earlier road (its length when it never does). */
function sharedFrom(map: MapData): number[] {
  const seen = new Set<string>();
  return map.paths.map((p) => {
    let from = p.pts.length;
    for (let i = 0; i < p.pts.length; i++) {
      if (seen.has(`${p.pts[i].x},${p.pts[i].y}`)) {
        from = i;
        break;
      }
    }
    for (const q of p.pts) seen.add(`${q.x},${q.y}`);
    return from;
  });
}

/** All roads at once, layer by layer, so overlapping roads merge into one surface instead of stacking. */
function roads(ctx: CanvasRenderingContext2D, map: MapData, pal: Palette): void {
  const { centres, stubs } = junctions(map);
  const shared = sharedFrom(map);
  const inJunction = (p: Pt): boolean => centres.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < JUNCTION_R);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const traceAll = () => {
    ctx.beginPath();
    for (const p of map.paths) p.pts.forEach((q, i) => (i === 0 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y)));
    for (const [a, b] of stubs) {
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
  };
  traceAll();
  ctx.lineWidth = ROAD_W + 10;
  ctx.strokeStyle = pal.edge;
  ctx.globalAlpha = 0.55;
  ctx.stroke();
  ctx.globalAlpha = 1;
  traceAll();
  ctx.lineWidth = ROAD_W;
  ctx.strokeStyle = pal.road;
  ctx.stroke();
  traceAll();
  ctx.lineWidth = ROAD_W * 0.55;
  ctx.strokeStyle = 'rgba(255,240,210,0.13)';
  ctx.stroke();
  // Cart tracks and verge pebbles, drawn once per stretch of road (shared stretches only by the first road).
  map.paths.forEach((path, k) => {
    const upto = Math.min(path.pts.length, shared[k] + 1);
    ctx.beginPath();
    let pen = false;
    for (let i = 0; i < upto; i++) {
      const q = path.pts[i];
      if (inJunction(q)) {
        pen = false;
        continue;
      }
      if (pen) ctx.lineTo(q.x, q.y);
      else ctx.moveTo(q.x, q.y);
      pen = true;
    }
    ctx.setLineDash([10, 16]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,245,220,0.22)';
    ctx.stroke();
    ctx.setLineDash([]);
    const limit = shared[k] < path.pts.length ? path.cum[shared[k]] : path.length;
    const verge = (ROAD_W / 2 + 4) / 12;
    for (let d = 10; d < limit; d += 26) {
      for (const side of [-verge, verge]) {
        const p = pathPoint(path, d + hash01(Math.round(d) + (side > 0 ? 1 : 0)) * 10, side);
        if (inJunction(p)) continue;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 2.6, 1.8, hash01(Math.round(d)) * 3, 0, Math.PI * 2);
        ctx.fillStyle = hash01(Math.round(d * 3)) > 0.5 ? '#a89a82' : '#8f8370';
        ctx.fill();
      }
    }
  });
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

/**
 * A stone pad a card can stand on (its locked overlay is drawn live by the renderer). Special pads look the part:
 * a 高台 stands taller, a 法阵 has runes cut into its stone, a 泥沼 is mud instead of stone (pad-art.ts).
 */
export function pad(ctx: CanvasRenderingContext2D, p: Pt, seed: number, kind: SlotKind = 'plain'): void {
  if (kind === 'mire') return mirePad(ctx, p, PAD_R, seed);
  if (kind === 'high') highPlinth(ctx, p, PAD_R, seed);
  else {
    ctx.beginPath();
    ctx.ellipse(p.x + 2, p.y + 4, PAD_R + 2, PAD_R * 0.9, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(40,25,10,0.28)';
    ctx.fill();
  }
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
  if (kind === 'altar') altarRunes(ctx, p, PAD_R, seed);
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
  roads(ctx, map, pal);
  drawProps(ctx, map);
  map.spawns.forEach((s) => entrance(ctx, s));
  camp(ctx, map.camp);
  map.slots.forEach((s, i) => pad(ctx, s, i, map.slotKind[i]));
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

// ---- Menu backdrop: the map of the day behind the title, chapter and 法宝 screens -------------------------------

/** Day of the year in local time, 1 on 1 January. */
export function dayOfYear(d: Date): number {
  // Reason: count whole calendar days through the UTC midnights of the local dates, so a daylight-saving change
  // can't leave a fraction of a day.
  return (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 1)) / 86_400_000 + 1;
}

/** Index into MAPS of the menu backdrop on day `d`: the ten maps take turns, one per day. */
export function menuMapIndex(d: Date): number {
  return dayOfYear(d) % MAPS.length;
}

/** The one cached backdrop: today's map, painted at backing-store resolution `res`. */
let menu: { index: number; res: number; map: MapData; img: HTMLCanvasElement } | null = null;

/** Today's chapter map, scaled to cover the screen and dimmed, behind menus. */
export function menuBackdrop(ctx: CanvasRenderingContext2D, stage: Stage, dim: number): void {
  const index = menuMapIndex(new Date());
  const map = menu?.index === index ? menu.map : buildMap(MAPS[index]);
  const scale = Math.max(W / map.w, L.H / map.h);
  // Reason: quarter steps so small resizes don't repaint; capped at 3x, the most mapImage paints a map at.
  const res = Math.min(3, Math.ceil(stage.pixelRatio * scale * 4) / 4);
  if (!menu || menu.index !== index || menu.res !== res) {
    // Reason: painted here rather than through mapImage, whose per-map cache would keep up to three copies;
    // replacing `menu` keeps exactly one image, and yesterday's map is dropped at midnight.
    const img = document.createElement('canvas');
    img.width = Math.ceil(map.w * res);
    img.height = Math.ceil(map.h * res);
    const g = img.getContext('2d');
    if (!g) throw new Error('Canvas 2D is not supported in this browser');
    g.setTransform(res, 0, 0, res, 0, 0);
    paintMap(g, map);
    menu = { index, res, map, img };
  }
  const dw = map.w * scale;
  const dh = map.h * scale;
  ctx.drawImage(menu.img, (W - dw) / 2, (L.H - dh) / 2, dw, dh);
  ctx.fillStyle = `rgba(28,14,6,${dim})`;
  ctx.fillRect(0, 0, W, L.H);
}
