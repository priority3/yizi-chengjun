// 局中存档 storage: save / peek / load / clear through a fake storage; bad data and broken storage mean "no save".
import { describe, expect, it } from 'vitest';
import { act, createGame, hashState } from '../src/core/game.ts';
import { SNAPSHOT_VERSION } from '../src/core/snapshot.ts';
import { clearRun, loadRun, peekRun, RUN_KEY, saveRun, type RunStorage } from '../src/platform/save.ts';

/** In-memory stand-in for localStorage. */
class MemoryStorage implements RunStorage {
  readonly data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
}

/** Storage that refuses everything, like a blocked or full localStorage. */
const blocked: RunStorage = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
  removeItem: () => {
    throw new Error('SecurityError');
  },
};

const camera = { x: 120, y: 340.5, zoom: 1.25 };

describe('run save', () => {
  it('saves, peeks, loads and clears a build-phase run', () => {
    const store = new MemoryStorage();
    expect(loadRun(store)).toBeNull();
    expect(peekRun(store)).toBeNull();
    const g = createGame({ seed: 8, chapter: 3 });
    // Three waves cleared: the next one to fight is the 4th.
    g.wave = 3;
    expect(saveRun(g, camera, store)).toBe(true);
    expect([...store.data.keys()]).toEqual([RUN_KEY]);
    expect(peekRun(store)).toEqual({ chapter: 3, wave: 4 });
    const run = loadRun(store);
    expect(run).not.toBeNull();
    expect(run && hashState(run.g)).toBe(hashState(g));
    expect(run?.camera).toEqual(camera);
    clearRun(store);
    expect(store.data.size).toBe(0);
    expect(loadRun(store)).toBeNull();
    expect(peekRun(store)).toBeNull();
  });

  it('keeps only the latest save, and only the camera numbers', () => {
    const store = new MemoryStorage();
    const g = createGame({ seed: 8, chapter: 1 });
    saveRun(g, camera, store);
    g.wave = 1;
    // Like the live Camera, which also holds the map: only x, y and zoom are stored.
    saveRun(g, { ...camera, map: g.map } as typeof camera, store);
    expect(peekRun(store)).toEqual({ chapter: 1, wave: 2 });
    const stored = JSON.parse(store.getItem(RUN_KEY) ?? '{}') as { camera: object; snapshot: { v: number } };
    expect(Object.keys(stored.camera)).toEqual(['x', 'y', 'zoom']);
    expect(stored.snapshot.v).toBe(SNAPSHOT_VERSION);
  });

  it('never saves a battle', () => {
    const store = new MemoryStorage();
    const g = createGame({ seed: 8, chapter: 1 });
    act(g, { t: 'start' });
    expect(saveRun(g, camera, store)).toBe(false);
    expect(store.data.size).toBe(0);
  });

  it('treats corrupt, foreign or outdated data as no save', () => {
    const store = new MemoryStorage();
    for (const bad of ['{not json', '', 'null', '42', '"text"', '[]', '{}', '{"snapshot":{},"camera":{"x":0,"y":0,"zoom":1}}']) {
      store.setItem(RUN_KEY, bad);
      expect(loadRun(store), bad).toBeNull();
      expect(peekRun(store), bad).toBeNull();
    }
    saveRun(createGame({ seed: 1, chapter: 2 }), camera, store);
    const good = store.getItem(RUN_KEY) ?? '';
    const stored = JSON.parse(good) as { snapshot: { v: number }; camera: object };
    store.setItem(RUN_KEY, JSON.stringify({ ...stored, camera: { x: 0, y: 0, zoom: 0 } }));
    expect(loadRun(store)).toBeNull();
    store.setItem(RUN_KEY, JSON.stringify({ ...stored, snapshot: { ...stored.snapshot, v: SNAPSHOT_VERSION + 1 } }));
    expect(loadRun(store)).toBeNull();
    expect(peekRun(store)).toBeNull();
    store.setItem(RUN_KEY, good);
    expect(peekRun(store)).toEqual({ chapter: 2, wave: 1 });
  });

  it('never throws when storage is blocked, full or missing', () => {
    const g = createGame({ seed: 1, chapter: 1 });
    expect(saveRun(g, camera, blocked)).toBe(false);
    expect(loadRun(blocked)).toBeNull();
    expect(peekRun(blocked)).toBeNull();
    expect(() => clearRun(blocked)).not.toThrow();
    expect(saveRun(g, camera, null)).toBe(false);
    expect(loadRun(null)).toBeNull();
    expect(() => clearRun(null)).not.toThrow();
  });
});
