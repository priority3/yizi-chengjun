// The long-term save (chapters, stars, the 法宝 vault, sound settings, endless and daily records), kept in the
// platform's storage (platform/env.ts) under 'yzcj:v3'. Reading fills in defaults for anything older saves lack;
// without storage (private mode, some in-app browsers) progress lives in memory for the session.
import { EQUIP_SLOTS, MAX_TIER } from '../config/treasures.ts';
import { MAX_STARS } from '../core/rating.ts';
import { emptyEndlessRecord, type DailyRecord } from '../core/records.ts';
import { emptyVault, isTreasureId, type Vault } from '../core/treasures.ts';
import { platform, type KeyValueStore } from './env.ts';

export interface SoundSettings {
  /** All sound off (the HUD speaker button). */
  muted: boolean;
  /** Background music on (the pause panel switch). */
  music: boolean;
}

export interface Progress {
  /** Highest chapter the player may start (1-based). */
  unlocked: number;
  /** Clears per chapter. */
  wins: number[];
  vault: Vault;
  /** The chapter-1 animated guide has been completed. */
  tutorialDone: boolean;
  sound: SoundSettings;
  /** Best star rating per chapter (see core/rating.ts): 1..3, or 0 when not rated (not cleared since ratings exist). */
  stars: number[];
  /** Per chapter: the one-time three-star bonus has been paid. */
  starBonus: boolean[];
  /** Most waves survived in an endless run (core/records.ts). */
  endlessBest: number;
  /** The daily challenge's best, for one day at a time (a new day starts over). */
  daily: DailyRecord;
}

const STORAGE_KEY = 'yzcj:v3';
/**
 * Older keys, read when STORAGE_KEY is empty, newest first: the save from before the game was renamed 一字成军
 * (zdxy = 字斗西游), then the v2 save that had no vault yet (upgraded on first load).
 */
const LEGACY_KEYS = ['zdxy:v3', 'zdxy:v2'];
let memoryCopy: Progress | null = null;

function parseVault(raw: unknown): Vault {
  const v = emptyVault();
  if (!raw || typeof raw !== 'object') return v;
  const r = raw as Partial<Vault>;
  v.stones = Math.max(0, Math.floor(Number(r.stones) || 0));
  for (const s of Array.isArray(r.treasures) ? r.treasures : []) {
    if (s && isTreasureId(String(s.id)) && Number(s.count) > 0) {
      v.treasures.push({ id: s.id, tier: Math.min(MAX_TIER, Math.max(1, Math.floor(Number(s.tier) || 1))), count: Math.floor(Number(s.count)) });
    }
  }
  for (const id of Array.isArray(r.equipped) ? r.equipped : []) {
    if (isTreasureId(String(id)) && !v.equipped.includes(id) && v.equipped.length < EQUIP_SLOTS) v.equipped.push(id);
  }
  return v;
}

/** Sound settings with defaults (sound on, music on) for saves made before they existed. */
export function parseSound(raw: unknown): SoundSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<SoundSettings>;
  return { muted: r.muted === true, music: r.music !== false };
}

/**
 * Best stars of one chapter: 0 while it has no clear, else 1..3.
 * Reason: every win earns at least one star, so a chapter cleared in a save from before ratings existed shows one
 * (three empty outlines would read as "never cleared"); a chapter without a clear can't carry stars, so junk in a
 * hand-edited save can't rate it.
 */
function parseStars(raw: unknown, wins: number): number {
  if (wins <= 0) return 0;
  return Math.min(MAX_STARS, Math.max(1, Math.floor(Number(raw) || 0)));
}

/** A whole number of at least 0 from a saved value; 0 for anything else (missing, junk, negative, infinite). */
function whole(raw: unknown): number {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

/** The daily record, with no day and no best for saves made before it existed (or junk). */
function parseDaily(raw: unknown): DailyRecord {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<DailyRecord>;
  return { key: whole(r.key), best: whole(r.best) };
}

/** Parses a saved progress string (null when it isn't one); missing fields get their defaults. Pure. */
export function parseProgress(raw: string | null, chapters: number): Progress | null {
  if (!raw) return null;
  const p = JSON.parse(raw) as Partial<Progress>;
  if (typeof p.unlocked !== 'number' || !Array.isArray(p.wins)) return null;
  const wins = Array.from({ length: chapters }, (_, i) => Number(p.wins?.[i]) || 0);
  const stars = (Array.isArray(p.stars) ? p.stars : []) as unknown[];
  const bonus = (Array.isArray(p.starBonus) ? p.starBonus : []) as unknown[];
  return {
    unlocked: Math.min(chapters, Math.max(1, p.unlocked)),
    wins,
    vault: parseVault(p.vault),
    tutorialDone: p.tutorialDone === true,
    sound: parseSound(p.sound),
    stars: wins.map((w, i) => parseStars(stars[i], w)),
    starBonus: wins.map((_, i) => bonus[i] === true),
    endlessBest: whole(p.endlessBest),
    daily: parseDaily(p.daily),
  };
}

/** Progress of a brand-new player. */
function freshProgress(chapters: number): Progress {
  return {
    unlocked: 1,
    wins: new Array<number>(chapters).fill(0),
    vault: emptyVault(),
    tutorialDone: false,
    sound: parseSound(null),
    stars: new Array<number>(chapters).fill(0),
    starBonus: new Array<boolean>(chapters).fill(false),
    ...emptyEndlessRecord(),
  };
}

/** The saved progress (else a legacy save, this session's copy, or a fresh start); `store` is the platform's by default. */
export function loadProgress(chapters: number, store: KeyValueStore | null = platform().storage()): Progress {
  try {
    const current = parseProgress(store?.getItem(STORAGE_KEY) ?? null, chapters);
    if (current) return current;
    // Reason: a player from before the rename keeps their progress; the next save writes it under the new key.
    for (const key of LEGACY_KEYS) {
      const legacy = parseProgress(store?.getItem(key) ?? null, chapters);
      if (legacy) return legacy;
    }
  } catch {
    // Storage blocked or a corrupt save: fall back to the in-memory copy below.
  }
  return memoryCopy ?? freshProgress(chapters);
}

/** Saves `p`, keeping a copy in memory for when storage is missing or refuses; `store` is the platform's by default. */
export function saveProgress(p: Progress, store: KeyValueStore | null = platform().storage()): void {
  memoryCopy = {
    unlocked: p.unlocked,
    wins: [...p.wins],
    vault: { stones: p.vault.stones, treasures: p.vault.treasures.map((s) => ({ ...s })), equipped: [...p.vault.equipped] },
    tutorialDone: p.tutorialDone,
    sound: { ...p.sound },
    stars: [...p.stars],
    starBonus: [...p.starBonus],
    endlessBest: p.endlessBest,
    daily: { ...p.daily },
  };
  try {
    store?.setItem(STORAGE_KEY, JSON.stringify(memoryCopy));
  } catch {
    // Ignore: progress still lives in memory for this session.
  }
}
