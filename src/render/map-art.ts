// Paints a chapter map in the 国潮青绿 look: the paper with its washes and scenery, the ochre roads with a brushed ink
// rim, the monster entrances, 师父's camp and the stone pads cards stand on, then the paper grain over it all.
// Painted once per zoom level into an offscreen canvas.
import { MAPS, TILE, type SlotKind } from '../config/maps.ts';
import { buildMap, LANE_SPREAD, pathPoint, ROAD_W, type MapData, type PathData, type Pt } from '../core/map.ts';
import { offscreen, type Stage } from '../platform/env.ts';
import { text } from './draw.ts';
import { brush } from './fonts.ts';
import { drawPortrait } from './heroes-art.ts';
import { blobPts, CINNABAR, inkGrass, INK, PAPER, paperGrain, rng, smoothPath, wash } from './ink.ts';
import { L, W } from './layout.ts';
import { altarGlow, altarRunes, drum, highPlinth, mirePad, PAD_SIDE, plainPad } from './pad-art.ts';
import { beaconPad, cofferPad, springPad, twinCord, twinPad } from './pad-art-extra.ts';
import { drawLiquids, drawProp, paintPaper, scatter, THEMES, vignette, type Palette } from './scenery.ts';

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

/** One road's centre line, resampled every 6 px and nudged sideways by a slow wobble of up to about `wob` px. */
function traceRoad(ctx: CanvasRenderingContext2D, path: PathData, wob: number, ph: number): void {
  if (wob === 0) {
    path.pts.forEach((q, i) => (i === 0 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y)));
    return;
  }
  for (let d = 0; ; d += 6) {
    const at = Math.min(d, path.length);
    const off = (wob * (Math.sin(at * 0.021 + ph) + 0.5 * Math.sin(at * 0.057 + ph * 2.3))) / 1.5;
    const q = pathPoint(path, at, off / LANE_SPREAD);
    if (d === 0) ctx.moveTo(q.x, q.y);
    else ctx.lineTo(q.x, q.y);
    if (at >= path.length) break;
  }
}

/** All roads at once, layer by layer, so overlapping roads merge into one surface instead of stacking. */
function roads(ctx: CanvasRenderingContext2D, map: MapData, pal: Palette): void {
  const { centres, stubs } = junctions(map);
  const shared = sharedFrom(map);
  const inJunction = (p: Pt): boolean => centres.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < JUNCTION_R);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const traceAll = (wob: number, ph: number): void => {
    ctx.beginPath();
    map.paths.forEach((p, k) => traceRoad(ctx, p, wob, ph + k * 1.7));
    for (const [a, b] of stubs) {
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
  };
  // A faint worn verge first, so the road stands out from paper of a similar colour.
  traceAll(0, 0);
  ctx.lineWidth = ROAD_W + 14;
  ctx.strokeStyle = 'rgba(70,48,24,0.1)';
  ctx.stroke();
  // Reason: the whole network is inked a little wider, wobbling like a brush, and then filled without the wobble, so
  // the ink is left only on the outer edges (thicker in places, thinner in others) and joining roads have no seam.
  traceAll(1.2, 0.4);
  ctx.lineWidth = ROAD_W + 4;
  ctx.strokeStyle = INK;
  ctx.stroke();
  traceAll(0, 0);
  ctx.lineWidth = ROAD_W;
  ctx.strokeStyle = pal.road;
  ctx.stroke();
  traceAll(1.4, 1.1);
  ctx.lineWidth = ROAD_W * 0.55;
  ctx.strokeStyle = 'rgba(255,243,215,0.33)';
  ctx.stroke();
  // Wheel ruts, pebbles and verge grass, drawn once per stretch of road (shared stretches only by the first road).
  map.paths.forEach((path, k) => {
    const limit = shared[k] < path.pts.length ? path.cum[shared[k]] : path.length;
    const rand = rng(k * 613 + 29);
    for (const side of [-7, 7]) {
      ctx.beginPath();
      let pen = false;
      for (let d = 0; d <= limit; d += 6) {
        const q = pathPoint(path, d, side / LANE_SPREAD);
        if (inJunction(q)) {
          pen = false;
          continue;
        }
        if (pen) ctx.lineTo(q.x, q.y);
        else ctx.moveTo(q.x, q.y);
        pen = true;
      }
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(140,96,52,0.22)';
      ctx.stroke();
    }
    for (let d = 8; d < limit; d += 14) {
      if (rand() < 0.45) continue;
      const q = pathPoint(path, d, ((rand() - 0.5) * (ROAD_W - 8)) / LANE_SPREAD);
      if (inJunction(q)) continue;
      ctx.beginPath();
      ctx.ellipse(q.x, q.y, 1.2 + rand() * 1.6, 0.9 + rand(), rand() * 3, 0, Math.PI * 2);
      ctx.fillStyle = rand() < 0.5 ? 'rgba(150,108,66,0.55)' : 'rgba(118,84,52,0.5)';
      ctx.fill();
    }
    const verge = (ROAD_W / 2 + 5) / LANE_SPREAD;
    for (let d = 10; d < limit; d += 22) {
      if (rand() < 0.5) continue;
      const q = pathPoint(path, d, rand() < 0.5 ? -verge : verge);
      if (!inJunction(q)) inkGrass(ctx, q.x, q.y + 3, rand, pal.grass);
    }
  });
}

/** A cave mouth under an arch of boulders: where the monsters come from. */
function entrance(ctx: CanvasRenderingContext2D, p: Pt, seed: number): void {
  const rand = rng(seed * 4099 + 3);
  wash(ctx, p.x, p.y + 6, 42, '43,36,32', 0.3);
  smoothPath(ctx, blobPts(p.x, p.y + 6, 22, 17, rand, 10, 0.14));
  ctx.fillStyle = '#1e1612';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.stroke();
  // Reason: the boulders run round the top half only, so the mouth opens onto the road below it.
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * (1.04 + i * 0.23);
    smoothPath(ctx, blobPts(p.x + Math.cos(a) * 25, p.y + 6 + Math.sin(a) * 19, 8.5, 6.5, rand, 7, 0.3));
    ctx.fillStyle = i % 2 ? '#9fb0b7' : '#8a9ea8';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }
  text(ctx, '妖', p.x, p.y + 9, brush(15), 'rgba(214,80,50,0.92)');
}

/** 师父's camp: a stone platform, a tent of paper-white canvas with cinnabar trim, 师父 himself and a cinnabar flag. */
function camp(ctx: CanvasRenderingContext2D, p: Pt): void {
  drum(ctx, p.x, p.y + 4, 40, 8, 0.26);
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(p.x - 30, p.y + 14);
  ctx.quadraticCurveTo(p.x - 14, p.y - 4, p.x, p.y - 28);
  ctx.quadraticCurveTo(p.x + 14, p.y - 4, p.x + 30, p.y + 14);
  ctx.closePath();
  ctx.fillStyle = PAPER;
  ctx.fill();
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(p.x - 30, p.y + 14);
  ctx.lineTo(p.x + 30, p.y + 14);
  ctx.lineWidth = 3;
  ctx.strokeStyle = CINNABAR;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(p.x - 9, p.y + 14);
  ctx.lineTo(p.x, p.y - 2);
  ctx.lineTo(p.x + 9, p.y + 14);
  ctx.closePath();
  ctx.fillStyle = '#4a2a1c';
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = INK;
  ctx.stroke();
  drawPortrait(ctx, 'master', p.x, p.y - 6, 10);
  ctx.lineCap = 'round';
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#5a3e2b';
  ctx.beginPath();
  ctx.moveTo(p.x + 27, p.y + 6);
  ctx.lineTo(p.x + 27, p.y - 40);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(p.x + 28, p.y - 39);
  ctx.quadraticCurveTo(p.x + 37, p.y - 41, p.x + 46, p.y - 37);
  ctx.lineTo(p.x + 46, p.y - 25);
  ctx.quadraticCurveTo(p.x + 37, p.y - 28, p.x + 28, p.y - 26);
  ctx.closePath();
  ctx.fillStyle = CINNABAR;
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = INK;
  ctx.stroke();
  text(ctx, '营', p.x + 37, p.y - 32, brush(9), '#fff1c2');
}

/**
 * A stone pad a card can stand on (its locked look is drawn live by the renderer), in pad-art.ts's looks:
 * a plain drum, a taller 高台, a 法阵 with rings cut into its top, or a 泥沼 of mud; and pad-art-extra.ts's 聚宝台,
 * 烽火台, 双生台 and 灵泉.
 */
export function pad(ctx: CanvasRenderingContext2D, p: Pt, seed: number, kind: SlotKind = 'plain'): void {
  if (kind === 'mire') return mirePad(ctx, p, PAD_R, seed);
  if (kind === 'high') return highPlinth(ctx, p, PAD_R, seed);
  if (kind === 'coffer') return cofferPad(ctx, p, PAD_R, seed);
  if (kind === 'beacon') return beaconPad(ctx, p, PAD_R, seed);
  if (kind === 'twin') return twinPad(ctx, p, PAD_R, seed);
  if (kind === 'spring') return springPad(ctx, p, PAD_R, seed);
  if (kind === 'altar') altarGlow(ctx, p, PAD_R);
  plainPad(ctx, p, PAD_R, seed);
  if (kind === 'altar') altarRunes(ctx, p, PAD_R);
}

/** Paints the whole map in world units (0..w, 0..h). */
export function paintMap(ctx: CanvasRenderingContext2D, map: MapData): void {
  const pal = THEMES[map.theme];
  paintPaper(ctx, map, pal);
  drawLiquids(ctx, map, pal);
  scatter(ctx, map, pal);
  roads(ctx, map, pal);
  // The red cords between paired 双生台 lie on the ground, under everything standing.
  map.twin.forEach((j, i) => {
    if (j > i) twinCord(ctx, map.slots[i], map.slots[j], PAD_R);
  });
  // Reason: rocks, trees, entrances, the camp and the pads are drawn back to front by where they touch the ground,
  // so a tall tree in front of a pad overlaps it instead of being covered by it.
  const standing: Array<{ y: number; draw: () => void }> = [];
  map.decor.forEach((d, i) => {
    if (d.kind !== 'water') standing.push({ y: d.y + TILE / 3, draw: () => drawProp(ctx, d, i, pal) });
  });
  map.spawns.forEach((s, i) => standing.push({ y: s.y + 20, draw: () => entrance(ctx, s, i) }));
  standing.push({ y: map.camp.y + 30, draw: () => camp(ctx, map.camp) });
  map.slots.forEach((s, i) => standing.push({ y: s.y + PAD_SIDE, draw: () => pad(ctx, s, i, map.slotKind[i]) }));
  standing.sort((a, b) => a.y - b.y).forEach((it) => it.draw());
  vignette(ctx, map);
  paperGrain(ctx, map.w, map.h);
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
  const { canvas: c, ctx } = offscreen(Math.ceil(map.w * res), Math.ceil(map.h * res));
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
    const { canvas: img, ctx: g } = offscreen(Math.ceil(map.w * res), Math.ceil(map.h * res));
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
