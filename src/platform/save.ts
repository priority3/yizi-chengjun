// 局中存档: keeps the unfinished run (a build-phase snapshot plus where the camera was) in localStorage, so a
// refresh or a killed tab resumes it — a chapter, an endless run, or today's daily challenge. Separate from the
// progress save in web.ts. Nothing here ever throws: a missing, blocked, corrupt or outdated save simply means "no save".
import { restore, snapshot, type RunSnapshot } from '../core/snapshot.ts';
import type { GameMode, GameState } from '../core/types.ts';
import { todayKey } from './today.ts';

export const RUN_KEY = 'zdxy:run';

/** The slice of the Web Storage API the run save uses (tests pass an in-memory fake). */
export interface RunStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Camera position: world coordinates of the viewport's top-left corner, and the zoom. */
export interface CameraPos {
  x: number;
  y: number;
  zoom: number;
}

/** A run read back from storage, ready to play on. */
export interface SavedRun {
  g: GameState;
  camera: CameraPos;
}

/** What the menus say about a saved run: its chapter and the wave the player fights next (1-based). */
export interface RunInfo {
  chapter: number;
  wave: number;
  mode: GameMode;
  /** The daily challenge's day (YYYYMMDD); 0 for other runs. */
  day: number;
}

/** The JSON stored under RUN_KEY. */
interface StoredRun {
  snapshot: RunSnapshot;
  camera: CameraPos;
}

/** localStorage, or null where there is none (Node) or it is blocked (private mode, some in-app browsers). */
function browserStorage(): RunStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // Reason: some browsers throw on merely touching localStorage when site data is disabled.
    return null;
  }
}

const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** Saves the run if it is in its build phase (battles are never saved). Returns whether anything was written. */
export function saveRun(g: GameState, camera: CameraPos, store: RunStorage | null = browserStorage()): boolean {
  const snap = snapshot(g);
  if (!snap || !store) return false;
  // Only the three numbers: the live Camera object also holds the whole map.
  const data: StoredRun = { snapshot: snap, camera: { x: camera.x, y: camera.y, zoom: camera.zoom } };
  try {
    store.setItem(RUN_KEY, JSON.stringify(data));
    return true;
  } catch {
    // Quota exceeded or storage blocked: this run just can't be resumed after a reload.
    return false;
  }
}

/**
 * The saved run, rebuilt and checked against this build (see core/snapshot.ts restore), or null. A daily challenge
 * saved on another day than `today` (YYYYMMDD) is out of date: it is deleted, and there is no save.
 */
export function loadRun(store: RunStorage | null = browserStorage(), today = todayKey()): SavedRun | null {
  try {
    const raw = store?.getItem(RUN_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<StoredRun> | null;
    const cam = data?.camera;
    if (!data?.snapshot || !cam || !finite(cam.x) || !finite(cam.y) || !finite(cam.zoom) || cam.zoom <= 0) return null;
    const g = restore(data.snapshot);
    if (g?.mode === 'daily' && g.seed !== today) {
      clearRun(store);
      return null;
    }
    return g ? { g, camera: { x: cam.x, y: cam.y, zoom: cam.zoom } } : null;
  } catch {
    return null;
  }
}

/**
 * Chapter (or mode) and next wave of the saved run, for menu buttons, or null.
 * Reason: validated exactly like loadRun (one parse and map rebuild), so a menu never offers a run that then
 * fails to load; screens read it once when they open, not every frame.
 */
export function peekRun(store: RunStorage | null = browserStorage(), today = todayKey()): RunInfo | null {
  const run = loadRun(store, today);
  if (!run) return null;
  const { chapter, wave, mode, seed } = run.g;
  return { chapter, wave: wave + 1, mode, day: mode === 'daily' ? seed : 0 };
}

/** Forgets the saved run (it ended, or the player started over). */
export function clearRun(store: RunStorage | null = browserStorage()): void {
  try {
    store?.removeItem(RUN_KEY);
  } catch {
    // Storage blocked: there is nothing to clear.
  }
}
