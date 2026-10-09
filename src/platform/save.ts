// 局中存档: keeps the unfinished run (a build-phase snapshot plus where the camera was) in the platform's storage
// (platform/env.ts), so a refresh or a killed tab resumes it — a chapter, an endless run, or today's daily challenge.
// Separate from the progress save in progress.ts. Nothing here ever throws: a missing, blocked, corrupt or outdated
// save simply means "no save".
import { restore, snapshot, type RunSnapshot } from '../core/snapshot.ts';
import type { GameMode, GameState } from '../core/types.ts';
import { platform, type KeyValueStore } from './env.ts';
import { todayKey } from './today.ts';

export const RUN_KEY = 'yzcj:run';
/** Where the run was saved before the game was renamed 一字成军 (zdxy = 字斗西游); still read, and cleared with it. */
export const LEGACY_RUN_KEY = 'zdxy:run';

/** The storage the run save uses: the platform's (tests pass an in-memory fake). */
export type RunStorage = KeyValueStore;

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

const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/**
 * Saves the run if it is in its build phase (battles are never saved). Returns whether anything was written. `store`
 * defaults to the platform's storage (null where there is none or it is blocked), here and in the functions below.
 */
export function saveRun(g: GameState, camera: CameraPos, store: RunStorage | null = platform().storage()): boolean {
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
export function loadRun(store: RunStorage | null = platform().storage(), today = todayKey()): SavedRun | null {
  try {
    const raw = store?.getItem(RUN_KEY) ?? store?.getItem(LEGACY_RUN_KEY);
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
export function peekRun(store: RunStorage | null = platform().storage(), today = todayKey()): RunInfo | null {
  const run = loadRun(store, today);
  if (!run) return null;
  const { chapter, wave, mode, seed } = run.g;
  return { chapter, wave: wave + 1, mode, day: mode === 'daily' ? seed : 0 };
}

/** Forgets the saved run (it ended, or the player started over). */
export function clearRun(store: RunStorage | null = platform().storage()): void {
  try {
    store?.removeItem(RUN_KEY);
    // Reason: loadRun falls back to the old key, so a run saved before the rename would otherwise come back.
    store?.removeItem(LEGACY_RUN_KEY);
  } catch {
    // Storage blocked: there is nothing to clear.
  }
}
