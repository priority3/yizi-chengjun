// The map editor's live check (plan.md D1): builds the draft with core/map.ts buildMap exactly as a run would, says
// in Chinese what keeps it from building and which squares are at fault, and gathers what the editor shows beside the
// map: each road's length, the HP scale, the pads, the five pads that cover the most road, and layout warnings.
import { SLOT_BONUS, TILE, type SlotKind } from '../config/maps.ts';
import { buildMap, coverage, pathPoint, type MapData } from '../core/map.ts';
import { CAMP, cellsOf, ENTRANCES, type Cell, type Draft } from './editor-model.ts';

/** Reach (world px) the best-pad ranking measures road coverage with: about a tower's. */
export const BEST_RANGE = 200;
/** How many of the best-covering pads the editor rings. */
export const BEST_COUNT = 5;
/** Distance between the road samples that tell which squares a road runs through (well under a square). */
const SAMPLE_STEP = 6;

export interface PadStats {
  /** Open from the start (upper case letters). */
  open: number;
  /** Bought with 铜钱 (lower case letters). */
  locked: number;
  /** 法阵, 高台 and 泥沼, open or not. */
  special: number;
  /** Pads of each kind. */
  kinds: Record<SlotKind, number>;
}

/** One of the pads covering the most road: its slot index and the share of all road within BEST_RANGE of it. */
export interface BestPad {
  slot: number;
  cover: number;
}

export interface DraftCheck {
  /** The built map, or null when the draft doesn't build. */
  map: MapData | null;
  /** Why the draft doesn't build, in Chinese; null when it builds. */
  error: string | null;
  /** The squares the error is about, for the editor to mark. */
  faults: Cell[];
  /** Length of each road in world px, entrance 1 first (the order of map.paths). */
  roads: number[];
  /** Monster HP multiplier of the map (road length and HP tuning), as a run uses it. */
  hpScale: number;
  pads: PadStats;
  /** Up to BEST_COUNT pads by road coverage, best first; pads that see no road at all are left out. */
  best: BestPad[];
  /** Things that build but play oddly, in Chinese. */
  warnings: string[];
}

const noPads = (): PadStats => ({ open: 0, locked: 0, special: 0, kinds: { plain: 0, altar: 0, high: 0, mire: 0 } });

/** A draft that doesn't build: why, and where. */
function failed(error: string, faults: Cell[] = []): DraftCheck {
  return { map: null, error, faults, roads: [], hpScale: 0, pads: noPads(), best: [], warnings: [] };
}

/** Builds and rates the draft. Never throws: a draft that doesn't build comes back with its error. */
export function checkDraft(d: Draft): DraftCheck {
  const camps = cellsOf(d, CAMP);
  if (camps.length === 0) return failed('还没有营地：选「营地」，点一格放下 E');
  if (camps.length > 1) return failed(`营地只能有一个，现在有 ${camps.length} 个`, camps);
  if (ENTRANCES.every((n) => cellsOf(d, n).length === 0)) return failed('还没有入口：选「入口1」，放在路的起点');
  let map: MapData;
  try {
    map = buildMap(d);
  } catch (e) {
    // Reason: buildMap names a stuck entrance by its square index; ask it entrance by entrance to say which digit.
    const stuck = ENTRANCES.filter((n) => cellsOf(d, n).length > 0 && !reaches(d, n));
    if (stuck.length === 0) return failed(`地图有错：${e instanceof Error ? e.message : String(e)}`);
    return failed(`入口 ${stuck.join('、')} 的路走不到营地：用「路」把它连到 E`, [...stuck.flatMap((n) => cellsOf(d, n)), ...camps]);
  }
  return {
    map,
    error: null,
    faults: [],
    roads: map.paths.map((p) => p.length),
    hpScale: map.hpScale,
    pads: padStats(map),
    best: bestPads(map),
    warnings: warningsOf(d, map),
  };
}

/** Whether entrance `n`'s road reaches the camp, tried on its own. */
function reaches(d: Draft, n: string): boolean {
  // Reason: buildMap counts entrances as road squares, so turning the other entrances into plain road keeps every
  // connection while it traces only this one.
  const rows = d.rows.map((row) => row.replace(/[1-4]/g, (ch) => (ch === n ? ch : '#')));
  try {
    buildMap({ theme: d.theme, rows });
    return true;
  } catch {
    return false;
  }
}

function padStats(map: MapData): PadStats {
  const s = noPads();
  map.slotKind.forEach((kind, i) => {
    s.kinds[kind]++;
    if (map.open[i]) s.open++;
    else s.locked++;
    if (kind !== 'plain') s.special++;
  });
  return s;
}

/** The pads that cover the most road within BEST_RANGE (coverage, as the bot rates them), best first. */
function bestPads(map: MapData): BestPad[] {
  return map.slots
    .map((_, slot) => ({ slot, cover: coverage(map, slot, BEST_RANGE) }))
    .filter((p) => p.cover > 0)
    .sort((a, b) => b.cover - a.cover || a.slot - b.slot)
    .slice(0, BEST_COUNT);
}

/** Layouts that build but play oddly; the README's rules for roads included. */
function warningsOf(d: Draft, map: MapData): string[] {
  const out: string[] = [];
  const twice = ENTRANCES.filter((n) => cellsOf(d, n).length > 1);
  if (twice.length > 0) out.push(`入口 ${twice.join('、')} 不止一个`);
  if (map.slots.length === 0) out.push('还没有石台：放几个 O 才能试玩');
  else if (!map.slots.some((_, i) => map.open[i] && SLOT_BONUS[map.slotKind[i]].fighters)) out.push('没有开局可用的兵字石台，开局送的箭没处放');
  const blocks = roadBlocks(map);
  if (blocks > 0) out.push(`有 ${blocks} 处 2×2 的路块：路要一格宽`);
  const idle = idleRoad(map);
  if (idle > 0) out.push(`有 ${idle} 格路不在任何一条路线上`);
  return out;
}

/** 2 x 2 squares that are all road: the README asks for one-square corridors (the painted roads would look off). */
function roadBlocks(map: MapData): number {
  const { cols, rows, road } = map;
  let n = 0;
  for (let r = 0; r + 1 < rows; r++) {
    for (let c = 0; c + 1 < cols; c++) {
      const i = r * cols + c;
      if (road[i] && road[i + 1] && road[i + cols] && road[i + cols + 1]) n++;
    }
  }
  return n;
}

/** Road squares no road runs through (dead ends and loose bits): monsters never walk them. */
function idleRoad(map: MapData): number {
  const walked = new Set<number>();
  for (const p of map.paths) {
    for (let dist = 0; dist <= p.length; dist += SAMPLE_STEP) {
      const q = pathPoint(p, dist);
      walked.add(Math.floor(q.y / TILE) * map.cols + Math.floor(q.x / TILE));
    }
  }
  return map.road.reduce((n, isRoad, i) => (isRoad && !walked.has(i) ? n + 1 : n), 0);
}
