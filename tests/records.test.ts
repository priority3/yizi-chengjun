// Records and rewards of endless and daily runs: 2 灵石 per wave survived, paid once when the run ends; the best per
// mode (the daily one per day); the progress save's new fields, old saves included. Chapter progress is never touched.
import { describe, expect, it } from 'vitest';
import { CHAPTERS } from '../src/config/chapters.ts';
import { ENDLESS, ENDLESS_CHAPTER } from '../src/config/endless.ts';
import { createGame } from '../src/core/game.ts';
import { dailyBest, emptyEndlessRecord, settleEndless, wavesSurvived } from '../src/core/records.ts';
import { endlessOptions, playChapter } from '../src/core/sim.ts';
import { snapshot } from '../src/core/snapshot.ts';
import { emptyVault } from '../src/core/treasures.ts';
import type { GameState } from '../src/core/types.ts';
import { loadProgress, parseProgress, saveProgress } from '../src/platform/progress.ts';

const N = CHAPTERS.length;
const DAY = 20261009;

/** An endless (or daily) run whose camp just fell in wave `fellIn`, after `kills` kills. */
function ended(mode: 'endless' | 'daily', fellIn: number, kills = 40, seed = DAY): GameState {
  const g = createGame({ seed, chapter: ENDLESS_CHAPTER, mode });
  g.wave = fellIn;
  g.phase = 'lost';
  g.kills = kills;
  return g;
}

describe('waves survived', () => {
  it('count the cleared waves, never the one being fought or lost', () => {
    expect(wavesSurvived({ phase: 'build', wave: 0 })).toBe(0);
    expect(wavesSurvived({ phase: 'build', wave: 7 })).toBe(7);
    expect(wavesSurvived({ phase: 'battle', wave: 8 })).toBe(7);
    expect(wavesSurvived({ phase: 'lost', wave: 13 })).toBe(12);
    expect(wavesSurvived({ phase: 'lost', wave: 1 })).toBe(0);
  });
});

describe('endless and daily rewards', () => {
  it('pay 2 灵石 per wave survived and keep the endless best', () => {
    const rec = emptyEndlessRecord();
    const v = emptyVault();
    expect(ENDLESS.stonesPerWave).toBe(2);
    expect(settleEndless(rec, v, ended('endless', 13, 210))).toEqual({ mode: 'endless', waves: 12, kills: 210, best: 12, record: true, stones: 24 });
    expect(v.stones).toBe(24);
    // A shorter run pays for its own waves; the record stands.
    expect(settleEndless(rec, v, ended('endless', 9))).toMatchObject({ waves: 8, best: 12, record: false, stones: 16 });
    // Equalling the record is not beating it.
    expect(settleEndless(rec, v, ended('endless', 13))?.record).toBe(false);
    expect(rec.endlessBest).toBe(12);
    expect(v.stones).toBe(24 + 16 + 24);
    // Falling in the very first wave earns nothing and sets no record.
    expect(settleEndless(emptyEndlessRecord(), v, ended('endless', 1))).toMatchObject({ waves: 0, stones: 0, record: false });
  });

  it('keep the daily best per day, a new day starting over', () => {
    const rec = emptyEndlessRecord();
    const v = emptyVault();
    expect(settleEndless(rec, v, ended('daily', 11))).toMatchObject({ mode: 'daily', waves: 10, best: 10, record: true });
    expect(settleEndless(rec, v, ended('daily', 8))).toMatchObject({ waves: 7, best: 10, record: false });
    expect(dailyBest(rec, DAY)).toBe(10);
    expect(dailyBest(rec, DAY + 1)).toBe(0);
    // The next day's first run sets that day's record, even below yesterday's.
    expect(settleEndless(rec, v, ended('daily', 6, 40, DAY + 1))).toMatchObject({ waves: 5, best: 5, record: true });
    expect(rec.daily).toEqual({ key: DAY + 1, best: 5 });
    // The endless record is a separate one.
    expect(rec.endlessBest).toBe(0);
    expect(v.stones).toBe(2 * (10 + 7 + 5));
  });

  it('pay nothing for a chapter run or a run still going', () => {
    const rec = emptyEndlessRecord();
    const v = emptyVault();
    const chapter = createGame({ seed: 1, chapter: 3 });
    chapter.phase = 'lost';
    expect(settleEndless(rec, v, chapter)).toBeNull();
    const going = ended('endless', 7);
    for (const phase of ['build', 'battle'] as const) {
      going.phase = phase;
      expect(settleEndless(rec, v, going)).toBeNull();
    }
    expect(v.stones).toBe(0);
    expect(rec).toEqual(emptyEndlessRecord());
  });

  it('are paid once per run, all at once when it ends', () => {
    const rec = emptyEndlessRecord();
    const v = emptyVault();
    // A whole bot run: the vault isn't part of the run, so nothing is paid while it goes on.
    const g = playChapter(7919, ENDLESS_CHAPTER, endlessOptions({ maxWaves: 40 }));
    expect(g.phase).toBe('lost');
    expect(v.stones).toBe(0);
    const award = settleEndless(rec, v, g);
    expect(award?.waves).toBe(g.wave - 1);
    expect(v.stones).toBe(2 * (g.wave - 1));
    // Asking again pays nothing more, and a finished run can't be saved to come back and be settled anew.
    expect(settleEndless(rec, v, g)).toBeNull();
    expect(v.stones).toBe(2 * (g.wave - 1));
    expect(snapshot(g)).toBeNull();
  });
});

describe('records in the progress save', () => {
  it('fill in defaults for a save from before they existed', () => {
    const p = parseProgress(JSON.stringify({ unlocked: 10, wins: new Array<number>(N).fill(1) }), N);
    expect(p?.endlessBest).toBe(0);
    expect(p?.daily).toEqual({ key: 0, best: 0 });
  });

  it('keep saved records and repair junk', () => {
    const p = parseProgress(JSON.stringify({ unlocked: 2, wins: [1], endlessBest: 17.8, daily: { key: DAY, best: 12 } }), N);
    expect(p?.endlessBest).toBe(17);
    expect(p?.daily).toEqual({ key: DAY, best: 12 });
    const junk = [
      { endlessBest: -3, daily: 'x' },
      { endlessBest: 'lots', daily: { key: -1, best: '1e999' } },
      { endlessBest: null, daily: null },
      { endlessBest: '1e999', daily: [5] },
    ];
    for (const j of junk) {
      const q = parseProgress(JSON.stringify({ unlocked: 1, wins: [], ...j }), N);
      expect(q?.endlessBest, JSON.stringify(j)).toBe(0);
      expect(q?.daily, JSON.stringify(j)).toEqual({ key: 0, best: 0 });
    }
  });

  it('survive a save and load as copies, and settling never touches chapter progress or stars', () => {
    const p = loadProgress(N);
    p.wins[0] = 1;
    p.stars[0] = 2;
    const chapters = JSON.stringify({ unlocked: p.unlocked, wins: p.wins, stars: p.stars, starBonus: p.starBonus, tutorialDone: p.tutorialDone });
    settleEndless(p, p.vault, ended('daily', 9));
    settleEndless(p, p.vault, ended('endless', 15));
    expect(JSON.stringify({ unlocked: p.unlocked, wins: p.wins, stars: p.stars, starBonus: p.starBonus, tutorialDone: p.tutorialDone })).toBe(chapters);
    expect(p.vault.stones).toBe(2 * (8 + 14));
    saveProgress(p);
    p.daily.best = 99;
    // Reason: no localStorage under Node, so this reads the in-memory copy saveProgress keeps.
    const back = loadProgress(N);
    expect(back.endlessBest).toBe(14);
    expect(back.daily).toEqual({ key: DAY, best: 8 });
  });
});
