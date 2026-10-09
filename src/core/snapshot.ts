// Run snapshots (局中存档): a build-phase GameState minus its map (rebuilt from config) and the per-step
// events, as plain JSON-safe data, so an unfinished run (a chapter, endless or the daily challenge) can be resumed
// exactly where it stood.
// Pure and DOM-free; platform/save.ts decides where the JSON is kept.
import { CHAPTERS } from '../config/chapters.ts';
import { ENEMIES } from '../config/enemies.ts';
import { ENDLESS_CHAPTER } from '../config/endless.ts';
import type { MapDef } from '../config/maps.ts';
import { MAX_LEVEL, UNITS } from '../config/units.ts';
import { TARGET_MODES } from './board.ts';
import { ENCOUNTERS } from './encounters.ts';
import { buildMap } from './map.ts';
import { isOpenEnded, modeMap, MODES, UNLIMITED } from './modes.ts';
import { padAllows } from './slots.ts';
import type { GameMode, GameState, RunMods, ShopOffer, Tile, WaveMods } from './types.ts';

/**
 * Format of RunSnapshot. Bump it when a saved field changes meaning, so older saves are dropped instead of
 * misread. (A newly added field needs no bump: older saves lack it and fail the checks below.)
 */
export const SNAPSHOT_VERSION = 1;

/** The part of a run a snapshot keeps: everything except the map and the events of the last step. */
export type SnapshotState = Omit<GameState, 'map' | 'events'>;

export interface RunSnapshot {
  v: number;
  /** mapKey() of the layout the run was played on. */
  mapKey: string;
  state: SnapshotState;
}

/** Stable FNV-1a hash of a map layout (theme, hp tuning, rows): a save made on an older layout is rejected. */
export function mapKey(def: MapDef): string {
  const src = `${def.theme}|${def.hp ?? 1}|${def.rows.join('/')}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < src.length; i++) {
    h ^= src.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// ---- field checks --------------------------------------------------------------------------------
// Snapshots come back from storage, possibly written by an older build, so every field is checked
// before the simulation trusts it: a missing or malformed field means "no save", never a crash mid-run.

type Check = (x: unknown) => boolean;
/**
 * One check per field of T.
 * Reason: a mapped type, so adding a field to GameState (or to a tile, the shop, the modifiers) is a compile
 * error here until the snapshot handles it — and old saves without the field are then rejected, not misread.
 */
type Checks<T> = { [K in keyof T]-?: Check };

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const num: Check = (x) => typeof x === 'number' && Number.isFinite(x);
const bool: Check = (x) => typeof x === 'boolean';
const intIn = (lo: number, hi: number): Check => (x) => Number.isInteger(x) && (x as number) >= lo && (x as number) <= hi;
const count = intIn(0, Number.MAX_SAFE_INTEGER);
/** An own key of a config table (so 'toString' is not a unit). */
const keyOf = (table: object): Check => (x) => typeof x === 'string' && Object.hasOwn(table, x);
const listOf = (item: Check): Check => (x) => Array.isArray(x) && x.every(item);
const orNull = (check: Check): Check => (x) => x === null || check(x);
/** Enemies, projectiles and pending spawns only exist during a battle, so a build-phase run has none. */
const none: Check = (x) => Array.isArray(x) && x.length === 0;

function shape<T>(fields: Checks<T>): Check {
  const entries = Object.entries(fields) as Array<[string, Check]>;
  return (x) => isObj(x) && entries.every(([k, ok]) => ok(x[k]));
}

const unitId = keyOf(UNITS);
/** A fighter's target priority; older saves and never-switched tiles have none ('first'). */
const targetMode: Check = (x) => x === undefined || TARGET_MODES.some((m) => m === x);
const tile = shape<Tile>({ uid: count, id: unitId, level: intIn(1, MAX_LEVEL), divine: bool, cd: num, invested: num, rage: num, target: targetMode });
const offer = shape<ShopOffer>({ id: unitId, price: num, sold: bool });
const waveMods = shape<WaveMods>({
  speedMul: num,
  hpMul: num,
  bountyMul: num,
  bonusMul: num,
  wolves: bool,
  thief: bool,
  miniBoss: orNull(keyOf(ENEMIES)),
});
/** Per-unit 法宝 multipliers such as { 火: 1.25 }. */
const unitTable: Check = (x) => isObj(x) && Object.entries(x).every(([k, v]) => unitId(k) && num(v));
const runMods = shape<RunMods>({
  dmgMul: num,
  unitDmgMul: unitTable,
  unitRangeMul: unitTable,
  splashRadiusMul: num,
  stunMul: num,
  executeBonus: num,
  rageMul: num,
  campHpBonus: num,
  healOnClear: num,
  startGongde: num,
  enemySpeedMul: num,
});

const STATE: Checks<SnapshotState> = {
  seed: num,
  chapter: intIn(1, CHAPTERS.length),
  // Saves from before the modes existed have none: they were all chapter runs (see restore).
  mode: (x) => x === undefined || MODES.some((m) => m === x),
  tick: count,
  phase: (x) => x === 'build',
  wave: count,
  totalWaves: count,
  waveTime: num,
  gongde: num,
  campHp: num,
  campMax: num,
  unlocked: listOf(bool),
  unlockCount: count,
  slots: listOf(orNull(tile)),
  enemies: none,
  projectiles: none,
  spawns: none,
  shop: listOf(offer),
  refreshes: count,
  encounter: orNull(listOf(keyOf(ENCOUNTERS))),
  encounters: count,
  waveMods,
  activeMods: waveMods,
  shopDiscount: num,
  freeRefresh: bool,
  chest: bool,
  mods: runMods,
  // The RNG state is a signed 32-bit integer.
  rng: intIn(-0x80000000, 0x7fffffff),
  kills: count,
  nextUid: count,
};
const STATE_KEYS = Object.keys(STATE) as Array<keyof SnapshotState>;

/**
 * Copies just the run-state fields.
 * Reason: through JSON, so the copy is deep (no tile or modifier object is shared with the live run) and holds
 * exactly what storage will hold.
 */
function copyState(src: object): SnapshotState {
  const from = src as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of STATE_KEYS) out[k] = from[k];
  return JSON.parse(JSON.stringify(out)) as SnapshotState;
}

/**
 * The run as JSON-safe data, or null outside the build phase: battles are never saved, so a resumed run always
 * restarts the current wave's build phase. `def` is the layout the run was created with (the mode's map by default).
 */
export function snapshot(g: GameState, def: MapDef = modeMap(g.mode, g.chapter, g.seed)): RunSnapshot | null {
  if (g.phase !== 'build') return null;
  return { v: SNAPSHOT_VERSION, mapKey: mapKey(def), state: copyState(g) };
}

/**
 * Whether the wave counters fit the mode. Reason: in the build phase `wave` counts cleared waves, so a chapter run is
 * always short of its total (clearing the last one wins); an endless or daily run has no total and plays chapter 10.
 */
function wavesFit(mode: GameMode, s: SnapshotState): boolean {
  if (isOpenEnded(mode)) return s.totalWaves === UNLIMITED && s.chapter === ENDLESS_CHAPTER;
  return s.wave < s.totalWaves;
}

/**
 * Rebuilds a run from a snapshot (usually parsed back from storage); `def` overrides the mode's map (tests).
 * Returns null when the snapshot doesn't fit this build: another version, another map layout, a bad field.
 */
export function restore(s: RunSnapshot, def?: MapDef): GameState | null {
  const raw: unknown = s;
  if (!isObj(raw) || raw.v !== SNAPSHOT_VERSION || !isObj(raw.state)) return null;
  const st = raw.state;
  // The map depends on these three (the daily challenge's seed is its day), so they are checked first.
  if (!STATE.chapter(st.chapter) || !STATE.mode(st.mode) || !STATE.seed(st.seed)) return null;
  const mode = (st.mode ?? 'chapter') as GameMode;
  const layout = def ?? modeMap(mode, st.chapter as number, st.seed as number);
  if (raw.mapKey !== mapKey(layout) || !STATE_KEYS.every((k) => STATE[k](st[k]))) return null;
  const state: SnapshotState = { ...copyState(st), mode };
  const map = buildMap(layout);
  const cells = map.slots.length;
  if (state.slots.length !== cells || state.unlocked.length !== cells || !wavesFit(mode, state)) return null;
  // No fighter can have been standing in a 泥沼.
  if (state.slots.some((t, i) => t !== null && !padAllows(map.slotKind[i], t.id))) return null;
  return { ...state, map, events: [] };
}
