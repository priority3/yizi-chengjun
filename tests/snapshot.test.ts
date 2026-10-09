// 局中存档: a build-phase run survives snapshot -> JSON -> restore exactly and then plays on identically;
// anything that doesn't fit the current build (version, map layout, phase, fields) is refused.
import { describe, expect, it } from 'vitest';
import { ENDLESS_CHAPTER } from '../src/config/endless.ts';
import { MAPS, type MapDef } from '../src/config/maps.ts';
import { botBuildAction, DEFAULT_BOT } from '../src/core/bot.ts';
import { act, createGame, hashState, step } from '../src/core/game.ts';
import { dailyMapIndex, UNLIMITED } from '../src/core/modes.ts';
import { mixSeed, type RngHolder } from '../src/core/rng.ts';
import { isFighter } from '../src/core/slots.ts';
import { mapKey, restore, snapshot, SNAPSHOT_VERSION, type RunSnapshot, type SnapshotState } from '../src/core/snapshot.ts';
import { defaultMods } from '../src/core/treasures.ts';
import type { ActionResult, GameState, UnitId } from '../src/core/types.ts';
import { emptyGame, put, TEST_MAP } from './helpers.ts';

/** Same cap as the balance sim: 20 simulated minutes. */
const MAX_TICKS = 20 * 60 * 60;
/** Results that changed the board; the bot stops shopping on anything else (as in core/sim.ts; only endless runs sell). */
const PROGRESS: ReadonlySet<ActionResult> = new Set<ActionResult>(['ok', 'merge', 'hero', 'divine', 'move', 'swap', 'sold']);

/** As if the snapshot went to localStorage and back. */
const viaJson = (s: RunSnapshot | null): RunSnapshot => JSON.parse(JSON.stringify(s)) as RunSnapshot;

/**
 * The bot loop of core/sim.ts runChapter, on an existing run. `atBuild` runs at the start of every build phase,
 * before the bot shops: it may hand back another GameState to continue with (a restored copy), or null to stop there.
 * `onStep` (optional) watches the run after every tick.
 */
function play(g: GameState, luck: RngHolder, atBuild: (g: GameState) => GameState | null = (x) => x, onStep?: (g: GameState) => void): GameState {
  while (g.phase !== 'won' && g.phase !== 'lost' && g.tick < MAX_TICKS) {
    if (g.phase === 'build') {
      const next = atBuild(g);
      if (!next) return g;
      g = next;
      for (let k = 0; k < 60 && g.phase === 'build'; k++) {
        const a = botBuildAction(g, DEFAULT_BOT, luck);
        if (!PROGRESS.has(act(g, a)) && a.t !== 'start') break;
      }
      if (g.phase === 'build') {
        if (g.encounter) act(g, { t: 'choose', option: 0 });
        act(g, { t: 'start' });
      }
    }
    step(g);
    onStep?.(g);
  }
  return g;
}

/** Everything a snapshot keeps, as text: equal strings mean equal run states. */
const stateText = (g: GameState, def?: MapDef): string => JSON.stringify(snapshot(g, def));

describe('snapshot round trip', () => {
  it('restores a fresh run exactly, with the map rebuilt from config', () => {
    const g = createGame({ seed: 5, chapter: 2 });
    const s = snapshot(g);
    expect(s?.v).toBe(SNAPSHOT_VERSION);
    expect(s?.mapKey).toBe(mapKey(MAPS[1]));
    const r = restore(viaJson(s));
    expect(r).not.toBeNull();
    if (!r) return;
    expect(hashState(r)).toBe(hashState(g));
    expect(stateText(r)).toBe(stateText(g));
    expect(r.map.slots).toEqual(g.map.slots);
    expect(r.map.paths.map((p) => p.length)).toEqual(g.map.paths.map((p) => p.length));
    expect(r.events).toEqual([]);
  });

  it('covers every GameState field except the map and the events', () => {
    const g = createGame({ seed: 1, chapter: 1 });
    const s = snapshot(g);
    const runKeys = Object.keys(g).filter((k) => k !== 'map' && k !== 'events');
    expect(Object.keys(s?.state ?? {}).sort()).toEqual(runKeys.sort());
    expect(Object.keys(restore(viaJson(s)) ?? {}).sort()).toEqual(Object.keys(g).sort());
  });

  it('keeps a pending encounter, queued wave modifiers, the chest and 法宝 multipliers', () => {
    const mods = defaultMods();
    mods.unitDmgMul = { 火: 1.25, 白龙: 1.3 };
    mods.unitRangeMul = { 箭: 1.15 };
    mods.dmgMul = 1.1;
    mods.campHpBonus = 30;
    const g = createGame({ seed: 3, chapter: 4, mods });
    g.wave = 2;
    g.encounter = ['财神到', '宝箱', '妖王亲临'];
    g.encounters = 1;
    g.waveMods = { ...g.waveMods, speedMul: 1.4, bountyMul: 2, bonusMul: 2, thief: true, miniBoss: '白骨精' };
    g.activeMods = { ...g.activeMods, wolves: true, bountyMul: 2 };
    g.chest = true;
    g.shopDiscount = 0.5;
    g.freeRefresh = true;
    g.shop[1].sold = true;
    const r = restore(viaJson(snapshot(g)));
    expect(r).not.toBeNull();
    if (!r) return;
    expect(r.encounter).toEqual(['财神到', '宝箱', '妖王亲临']);
    expect(r.waveMods).toEqual(g.waveMods);
    expect(r.activeMods).toEqual(g.activeMods);
    expect(r.chest).toBe(true);
    expect(r.mods).toEqual(mods);
    expect(r.mods.unitDmgMul).toEqual({ 火: 1.25, 白龙: 1.3 });
    expect(r.shop).toEqual(g.shop);
    expect([r.shopDiscount, r.freeRefresh]).toEqual([0.5, true]);
    expect(hashState(r)).toBe(hashState(g));
    // The pending encounter still blocks the shop and can be answered.
    expect(act(r, { t: 'refresh' })).toBe('phase');
    expect(act(r, { t: 'choose', option: 0 })).toBe('ok');
    expect(r.gongde).toBe(g.gongde + 50);
  });

  it('copies deeply: the live run, the snapshot and the restored run share nothing', () => {
    const g = emptyGame();
    const fire = put(g, 1, '火', 2);
    g.mods.unitDmgMul = { 火: 1.5 };
    const s = snapshot(g, TEST_MAP);
    const r = restore(viaJson(s), TEST_MAP);
    expect(r).not.toBeNull();
    if (!s || !r) return;
    fire.level = 5;
    g.mods.unitDmgMul.火 = 9;
    g.unlocked[7] = true;
    expect(s.state.slots[1]?.level).toBe(2);
    expect(s.state.mods.unitDmgMul.火).toBe(1.5);
    expect(s.state.unlocked[7]).toBe(false);
    expect(r.slots[1]?.level).toBe(2);
    expect(r.mods.unitDmgMul.火).toBe(1.5);
  });

  it('keeps each fighter\'s target priority (瞄准)', () => {
    const g = createGame({ seed: 7, chapter: 2 });
    const starter = g.slots.findIndex((t) => t !== null);
    act(g, { t: 'mode', cell: starter });
    act(g, { t: 'mode', cell: starter });
    expect(g.slots[starter]?.target).toBe('weak');
    const r = restore(viaJson(snapshot(g)));
    expect(r?.slots[starter]?.target).toBe('weak');
    expect(r && stateText(r)).toBe(stateText(g));
    expect(r && hashState(r)).toBe(hashState(g));
  });
});

describe('snapshot timing', () => {
  it('only snapshots the build phase', () => {
    const g = createGame({ seed: 2, chapter: 1 });
    expect(snapshot(g)).not.toBeNull();
    act(g, { t: 'start' });
    expect(g.phase).toBe('battle');
    expect(snapshot(g)).toBeNull();
    g.phase = 'lost';
    expect(snapshot(g)).toBeNull();
    g.phase = 'won';
    expect(snapshot(g)).toBeNull();
  });
});

describe('restore checks', () => {
  const s = viaJson(snapshot(createGame({ seed: 1, chapter: 1 })));
  const withState = (patch: Partial<Record<keyof SnapshotState, unknown>>): RunSnapshot =>
    ({ ...s, state: { ...s.state, ...patch } }) as RunSnapshot;

  it('accepts the untouched snapshot', () => {
    expect(restore(s)).not.toBeNull();
    expect(restore(s, MAPS[0])).not.toBeNull();
  });

  it('rejects another version', () => {
    expect(restore({ ...s, v: SNAPSHOT_VERSION + 1 })).toBeNull();
    expect(restore({ ...s, v: SNAPSHOT_VERSION - 1 })).toBeNull();
  });

  it('fingerprints map layouts stably', () => {
    const keys = MAPS.map(mapKey);
    expect(keys.every((k) => /^[0-9a-f]{8}$/.test(k))).toBe(true);
    expect(new Set(keys).size).toBe(MAPS.length);
    expect(mapKey({ ...MAPS[0], rows: [...MAPS[0].rows] })).toBe(keys[0]);
    // No hp tuning means 1, exactly as buildMap reads it.
    expect(mapKey({ theme: 'ridge', rows: TEST_MAP.rows })).toBe(mapKey({ theme: 'ridge', rows: TEST_MAP.rows, hp: 1 }));
  });

  it('rejects a run played on a different map layout', () => {
    const def = MAPS[0];
    const moved: MapDef = { ...def, rows: def.rows.map((row, i) => (i === 2 ? row.replace('O', '.') : row)) };
    expect(moved.rows).not.toEqual(def.rows);
    expect(mapKey(moved)).not.toBe(mapKey(def));
    expect(restore(s, moved)).toBeNull();
    expect(restore(s, { ...def, hp: (def.hp ?? 1) + 0.1 })).toBeNull();
    expect(restore(s, { ...def, theme: 'temple' })).toBeNull();
    expect(restore({ ...s, mapKey: '00000000' })).toBeNull();
    // A run on a custom layout needs that layout back.
    const custom = snapshot(emptyGame(), TEST_MAP);
    expect(restore(viaJson(custom))).toBeNull();
    expect(restore(viaJson(custom), TEST_MAP)).not.toBeNull();
  });

  it('rejects anything but the build phase', () => {
    expect(restore(withState({ phase: 'battle' }))).toBeNull();
    expect(restore(withState({ phase: 'won' }))).toBeNull();
    const busy = { def: '妖', at: 0, path: 0, side: 0, hp: 10, speed: 30, bounty: 1 };
    expect(restore(withState({ spawns: [busy] }))).toBeNull();
  });

  it('rejects chapters out of range and boards that do not fit the map', () => {
    expect(restore(withState({ chapter: 0 }))).toBeNull();
    expect(restore(withState({ chapter: 11 }))).toBeNull();
    expect(restore(withState({ chapter: 1.5 }))).toBeNull();
    expect(restore(withState({ slots: s.state.slots.slice(1) }))).toBeNull();
    expect(restore(withState({ unlocked: [...s.state.unlocked, true] }))).toBeNull();
    expect(restore(withState({ wave: s.state.totalWaves }))).toBeNull();
  });

  it('rejects missing or malformed fields instead of crashing later', () => {
    const missing: Partial<SnapshotState> = { ...s.state };
    delete missing.kills;
    expect(restore({ ...s, state: missing as SnapshotState })).toBeNull();
    // The starter 箭 is the tile that gets tampered with.
    expect(s.state.slots.some((t) => t !== null)).toBe(true);
    const ghost = s.state.slots.map((t) => (t ? { ...t, id: '猴' as UnitId } : t));
    expect(restore(withState({ slots: ghost }))).toBeNull();
    const overLevel = s.state.slots.map((t) => (t ? { ...t, level: 9 } : t));
    expect(restore(withState({ slots: overLevel }))).toBeNull();
    expect(restore(withState({ gongde: '70' }))).toBeNull();
    expect(restore(withState({ campHp: null }))).toBeNull();
    expect(restore(withState({ encounter: ['财神到', '不存在'] }))).toBeNull();
    expect(restore(withState({ mods: { ...s.state.mods, unitDmgMul: { toString: 2 } } }))).toBeNull();
    expect(restore(withState({ waveMods: { ...s.state.waveMods, miniBoss: '孙悟空' } }))).toBeNull();
    expect(restore({ ...s, state: null } as unknown as RunSnapshot)).toBeNull();
    expect(restore(null as unknown as RunSnapshot)).toBeNull();
    expect(restore('{}' as unknown as RunSnapshot)).toBeNull();
  });
});

describe('resumed runs play on identically', () => {
  it('plays to the same end as the run it was saved from', () => {
    const seed = 5;
    const g = createGame({ seed, chapter: 4 });
    const luck = { rng: mixSeed(seed, 99) };
    // Play until the second wave is cleared: the run waits in its build phase with an encounter to pick.
    play(g, luck, (x) => (x.wave === 2 ? null : x));
    expect(g.phase).toBe('build');
    expect(g.wave).toBe(2);
    expect(g.encounter).not.toBeNull();
    const savedAt = g.tick;
    const r = restore(viaJson(snapshot(g)));
    expect(r).not.toBeNull();
    if (!r) return;
    expect(hashState(r)).toBe(hashState(g));
    const luckR = { ...luck };
    const a = play(g, luck);
    const b = play(r, luckR);
    // The bot fought on after the save.
    expect(a.tick).toBeGreaterThan(savedAt);
    expect(a.wave).toBeGreaterThan(2);
    expect(b.phase).toBe(a.phase);
    expect(b.wave).toBe(a.wave);
    expect(b.tick).toBe(a.tick);
    expect(hashState(b)).toBe(hashState(a));
  });

  it('can be saved and resumed at every build phase without changing the outcome', () => {
    // Two chapters and seeds (with today's numbers, one run is won and the other lost).
    for (const [seed, chapter] of [
      [2024, 7],
      [104729, 3],
    ]) {
      const plain = play(createGame({ seed, chapter }), { rng: mixSeed(seed, 99) });
      let resumes = 0;
      const hopped = play(createGame({ seed, chapter }), { rng: mixSeed(seed, 99) }, (x) => {
        const r = restore(viaJson(snapshot(x)));
        expect(r && stateText(r)).toBe(stateText(x));
        resumes++;
        return r;
      });
      expect(resumes, `chapter ${chapter}`).toBeGreaterThan(1);
      expect(hopped.phase, `chapter ${chapter}`).toBe(plain.phase);
      expect(hopped.tick, `chapter ${chapter}`).toBe(plain.tick);
      expect(hashState(hopped), `chapter ${chapter}`).toBe(hashState(plain));
    }
  });

  it('plays on identically with switched target priorities on a map with special pads', () => {
    const seed = 2024;
    // Every build phase the first fighter on the board switches its 瞄准 once, before the bot shops.
    const aim = (x: GameState): GameState => {
      const cell = x.slots.findIndex((t) => t !== null && isFighter(t.id));
      if (cell >= 0 && !x.encounter) act(x, { t: 'mode', cell });
      return x;
    };
    const plain = play(createGame({ seed, chapter: 5 }), { rng: mixSeed(seed, 99) }, aim);
    let resumes = 0;
    const hopped = play(createGame({ seed, chapter: 5 }), { rng: mixSeed(seed, 99) }, (x) => {
      resumes++;
      return restore(viaJson(snapshot(aim(x))));
    });
    expect(resumes).toBeGreaterThan(1);
    expect(plain.slots.some((t) => t?.target !== undefined)).toBe(true);
    expect(hopped.tick).toBe(plain.tick);
    expect(hashState(hopped)).toBe(hashState(plain));
  });

  it('resumes runs with air raids identically: flyers only exist mid-battle, so there is nothing of theirs to save', () => {
    const chapter = 6;
    // The first seed whose chapter-6 run meets an air raid before its last build phase (seed 2 with today's numbers).
    let seed = 0;
    let plain: GameState | null = null;
    for (let s = 1; s <= 30 && !plain; s++) {
      let raidWave = 0;
      const run = play(createGame({ seed: s, chapter }), { rng: mixSeed(s, 99) }, (x) => x, (g) => {
        if (!raidWave && g.enemies.some((e) => e.air)) raidWave = g.wave;
      });
      if (raidWave > 0 && raidWave < run.wave) {
        seed = s;
        plain = run;
      }
    }
    expect(plain).not.toBeNull();
    if (!plain) return;
    const hopped = play(createGame({ seed, chapter }), { rng: mixSeed(seed, 99) }, (x) => {
      expect(x.enemies).toEqual([]);
      const r = restore(viaJson(snapshot(x)));
      expect(r && stateText(r)).toBe(stateText(x));
      return r;
    });
    expect(hopped.phase).toBe(plain.phase);
    expect(hopped.tick).toBe(plain.tick);
    expect(hashState(hopped)).toBe(hashState(plain));
  });
});

describe('endless and daily snapshots', () => {
  const DAY = 20261005;
  const endless = (seed: number) => createGame({ seed, chapter: ENDLESS_CHAPTER, mode: 'endless' });
  const daily = (day: number) => createGame({ seed: day, chapter: 1, mode: 'daily' });
  const patch = (s: RunSnapshot, p: Partial<Record<keyof SnapshotState, unknown>>): RunSnapshot =>
    ({ ...s, state: { ...s.state, ...p } }) as RunSnapshot;

  it('round-trip an endless run mid-way through JSON, its missing last wave included, and play on identically', () => {
    const seed = 7919;
    const luck = { rng: mixSeed(seed, 99) };
    const g = play(endless(seed), luck, (x) => (x.wave === 6 ? null : x));
    expect([g.phase, g.wave]).toEqual(['build', 6]);
    const json = JSON.stringify(snapshot(g));
    // Reason: Infinity would come back from JSON as null; the unlimited total is a plain 0.
    expect(json).toContain(`"totalWaves":${UNLIMITED}`);
    expect(json).toContain('"mode":"endless"');
    const r = restore(JSON.parse(json) as RunSnapshot);
    expect(r).not.toBeNull();
    if (!r) return;
    expect(stateText(r)).toBe(stateText(g));
    expect(hashState(r)).toBe(hashState(g));
    // Both play on to wave 12's build phase (or their fall): an endless run can outlast the helper's time cap.
    const luckR = { ...luck };
    const until12 = (x: GameState): GameState | null => (x.wave >= 12 ? null : x);
    const a = play(g, luck, until12);
    const b = play(r, luckR, until12);
    expect(a.wave).toBeGreaterThan(9);
    expect([b.phase, b.wave, b.tick]).toEqual([a.phase, a.wave, a.tick]);
    expect(hashState(b)).toBe(hashState(a));
  });

  it('can save and resume a daily run on a map with 泥沼 at every build phase without changing the outcome', () => {
    expect(daily(DAY).map.slotKind).toContain('mire');
    const plain = play(daily(DAY), { rng: mixSeed(DAY, 99) });
    let resumes = 0;
    const hopped = play(daily(DAY), { rng: mixSeed(DAY, 99) }, (x) => {
      const r = restore(viaJson(snapshot(x)));
      expect(r && stateText(r)).toBe(stateText(x));
      expect(r?.mode).toBe('daily');
      resumes++;
      return r;
    });
    expect(resumes).toBeGreaterThan(5);
    expect([hopped.phase, hopped.wave, hopped.tick]).toEqual([plain.phase, plain.wave, plain.tick]);
    expect(hashState(hopped)).toBe(hashState(plain));
  });

  it('rebuild a daily run on the map of its day', () => {
    const s = viaJson(snapshot(daily(DAY)));
    expect(s.mapKey).toBe(mapKey(MAPS[dailyMapIndex(DAY)]));
    expect(restore(s)?.map.slots).toEqual(daily(DAY).map.slots);
    // Another day, on another map, can't pass for it.
    expect(restore(patch(s, { seed: DAY + 1 }))).toBeNull();
  });

  it('reject open-ended saves whose wave counters or chapter do not fit their mode, and unknown modes', () => {
    const e = viaJson(snapshot(endless(3)));
    const c = viaJson(snapshot(createGame({ seed: 3, chapter: ENDLESS_CHAPTER })));
    expect(restore(e)).not.toBeNull();
    expect(restore(patch(e, { totalWaves: 8 }))).toBeNull();
    expect(restore(patch(e, { totalWaves: null }))).toBeNull();
    expect(restore(patch(e, { chapter: 9 }))).toBeNull();
    expect(restore(patch(e, { mode: 'arena' }))).toBeNull();
    // A chapter run always has a last wave.
    expect(restore(patch(c, { totalWaves: UNLIMITED }))).toBeNull();
    // An endless run has no last wave to be past, however far it got.
    expect(restore(patch(e, { wave: 57 }))?.wave).toBe(57);
  });

  it('read a save from before the modes existed as a chapter run', () => {
    const g = createGame({ seed: 9, chapter: 4 });
    const old = viaJson(snapshot(g));
    delete (old.state as Partial<SnapshotState>).mode;
    const r = restore(old);
    expect(r?.mode).toBe('chapter');
    expect(r && hashState(r)).toBe(hashState(g));
    expect(r && stateText(r)).toBe(stateText(g));
  });
});
