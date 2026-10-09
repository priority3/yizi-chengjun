// Records and rewards of the open-ended runs (endless and the daily challenge): the waves a run survived, the best per
// mode (the daily one per day), and the 灵石 paid when the run ends. Pure data + functions like rating.ts: the record
// is kept in the progress save (platform/web.ts), the 灵石 go into the 法宝 vault. Chapter progress and stars are
// never touched here.
import { ENDLESS } from '../config/endless.ts';
import type { Vault } from './treasures.ts';
import type { GameState } from './types.ts';

/** The daily challenge's best, kept for one day: `key` is that day (YYYYMMDD), 0 before the first daily run ends. */
export interface DailyRecord {
  key: number;
  best: number;
}

/** The open-ended part of the progress save. */
export interface EndlessRecord {
  /** Most waves survived in an endless run. */
  endlessBest: number;
  daily: DailyRecord;
}

/** What an ended endless or daily run earned, for the result panel. */
export interface EndlessAward {
  mode: 'endless' | 'daily';
  /** Waves survived: every cleared wave (the one the camp fell in doesn't count). */
  waves: number;
  kills: number;
  /** The record this run played for (endless, or its day's daily), this run included. */
  best: number;
  /** The run beat that record. */
  record: boolean;
  /** 灵石 paid into the vault. */
  stones: number;
}

/** A record with nothing in it yet. */
export function emptyEndlessRecord(): EndlessRecord {
  return { endlessBest: 0, daily: { key: 0, best: 0 } };
}

/** Waves survived so far: the cleared ones; the wave being fought, or lost, doesn't count. */
export function wavesSurvived(g: Pick<GameState, 'phase' | 'wave'>): number {
  return g.phase === 'battle' || g.phase === 'lost' ? Math.max(0, g.wave - 1) : g.wave;
}

/** The daily best of `day` (YYYYMMDD): 0 when the record holds another day's. */
export function dailyBest(rec: EndlessRecord, day: number): number {
  return rec.daily.key === day ? rec.daily.best : 0;
}

/**
 * Runs already settled. Reason: the scene settles a run in its end handler; this makes a second call for the same run
 * (a handler entered twice, a later screen asking again) pay nothing instead of paying twice. A finished run can't be
 * saved, so it can't come back as another object either.
 */
const settled = new WeakSet<GameState>();

/**
 * Settles an ended endless or daily run, once: pays ENDLESS.stonesPerWave 灵石 per wave survived into the vault, all at
 * once, and keeps the best (a daily run's under its own day — the seed — so a new day starts a new record).
 * Returns null and changes nothing for a chapter run, a run that hasn't ended, or one already settled.
 */
export function settleEndless(rec: EndlessRecord, vault: Vault, g: GameState): EndlessAward | null {
  const mode = g.mode;
  if (mode === 'chapter' || (g.phase !== 'lost' && g.phase !== 'won') || settled.has(g)) return null;
  settled.add(g);
  const waves = wavesSurvived(g);
  let before: number;
  let best: number;
  if (mode === 'daily') {
    before = dailyBest(rec, g.seed);
    best = Math.max(before, waves);
    rec.daily = { key: g.seed, best };
  } else {
    before = rec.endlessBest;
    best = Math.max(before, waves);
    rec.endlessBest = best;
  }
  const stones = waves * ENDLESS.stonesPerWave;
  vault.stones += stones;
  return { mode, waves, kills: g.kills, best, record: waves > before, stones };
}
