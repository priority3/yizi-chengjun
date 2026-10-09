// The game was renamed 一字成军 (code prefix yzcj, formerly zdxy = 字斗西游): saves kept under the old keys still load,
// and clearing a run removes it under both keys so an old one can't come back.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CHAPTERS } from '../src/config/chapters.ts';
import { createGame } from '../src/core/game.ts';
import { clearRun, LEGACY_RUN_KEY, loadRun, RUN_KEY, saveRun, type RunStorage } from '../src/platform/save.ts';
import { loadProgress } from '../src/platform/web.ts';
import { DRAFT_KEY, LEGACY_DRAFT_KEY, loadDraft, saveDraft } from '../src/ui/editor-text.ts';
import { blankDraft, colsOf } from '../src/ui/editor-model.ts';

/** A Storage-like map, as localStorage would hold it. */
function memoryStore(init: Record<string, string> = {}): RunStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(init));
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('saves from before the rename', () => {
  it('load the long-term progress from the old key when the new one is empty', () => {
    const old = JSON.stringify({ unlocked: 4, wins: [1, 2, 1], vault: { stones: 77, treasures: [], equipped: [] }, tutorialDone: true });
    vi.stubGlobal('localStorage', memoryStore({ 'zdxy:v3': old }));
    const p = loadProgress(CHAPTERS.length);
    expect(p.unlocked).toBe(4);
    expect(p.wins.slice(0, 3)).toEqual([1, 2, 1]);
    expect(p.vault.stones).toBe(77);
  });

  it('prefer the new key once it holds a save', () => {
    const old = JSON.stringify({ unlocked: 2, wins: [1], vault: { stones: 1, treasures: [], equipped: [] } });
    const fresh = JSON.stringify({ unlocked: 7, wins: [1, 1, 1, 1, 1, 1], vault: { stones: 9, treasures: [], equipped: [] } });
    vi.stubGlobal('localStorage', memoryStore({ 'zdxy:v3': old, 'yzcj:v3': fresh }));
    expect(loadProgress(CHAPTERS.length).unlocked).toBe(7);
  });

  it('resume a run saved under the old key, and clear it under both keys', () => {
    const g = createGame({ seed: 5, chapter: 2 });
    const store = memoryStore();
    expect(saveRun(g, { x: 1, y: 2, zoom: 1 }, store)).toBe(true);
    // Move the save to where an older build kept it.
    store.data.set(LEGACY_RUN_KEY, store.data.get(RUN_KEY)!);
    store.data.delete(RUN_KEY);
    expect(loadRun(store)?.g.chapter).toBe(2);
    clearRun(store);
    expect(store.data.size).toBe(0);
    expect(loadRun(store)).toBeNull();
  });

  it('restore the editor draft from the old key, and keep new drafts under the new one', () => {
    const store = memoryStore();
    const d = blankDraft(9, 10, 'river');
    expect(saveDraft(d, store)).toBe(true);
    store.data.set(LEGACY_DRAFT_KEY, store.data.get(DRAFT_KEY)!);
    store.data.delete(DRAFT_KEY);
    expect(loadDraft(store)).toEqual(d);
    saveDraft(blankDraft(8, 8, 'ridge'), store);
    expect(colsOf(loadDraft(store)!)).toBe(8);
  });
});
