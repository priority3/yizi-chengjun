// 分享战报: what the result card shows for a run (pure, built from the run's state: chapterShareInfo, modeShareInfo
// for endless and daily runs), and the tap that paints the card once and hands it to the share sheet or the
// save-image overlay. The card and the share flow work from ShareInfo alone.
import { CHAPTERS } from '../config/chapters.ts';
import { ENDLESS_CHAPTER } from '../config/endless.ts';
import { ENEMIES } from '../config/enemies.ts';
import { MAX_TIER, TREASURE_IDS, TREASURES } from '../config/treasures.ts';
import { createGame } from '../core/game.ts';
import { dailyMapIndex, dayLabel } from '../core/modes.ts';
import { starRating } from '../core/rating.ts';
import { wavesSurvived } from '../core/records.ts';
import { buildMods, defaultMods, effectValue, type Vault } from '../core/treasures.ts';
import type { GameState, RunMods } from '../core/types.ts';
import { shareImage, showShareOverlay, type ShareOutcome } from '../platform/share.ts';
import { BRUSH_FAMILY, loadFonts } from '../render/fonts.ts';
import { NUMERALS } from '../render/panels.ts';
import { renderShareCard, type ShareInfo, type ShareToken } from '../render/share-card.ts';

/** The date as the card prints it, in local time: 2026年10月8日. */
export function shareDateText(d: Date): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/** The card of a chapter run, from its state. Pure: `now` only dates the card. */
export function chapterShareInfo(g: GameState, now: Date): ShareInfo {
  const ch = CHAPTERS[g.chapter - 1];
  const won = g.phase === 'won';
  const boss = ENEMIES[ch.boss].name;
  const info: ShareInfo = {
    mode: 'chapter',
    title: `第${NUMERALS[g.chapter - 1]}章 · ${ch.name}`,
    subtitle: won ? `打败了${boss}` : `本章 Boss · ${boss}`,
    chapter: g.chapter,
    won,
    // Reason: g.wave is the wave being fought in battle (a lost run fell during it) and the waves cleared otherwise,
    // the same rule as summarize in core/sim.ts.
    waves: g.phase === 'battle' || g.phase === 'lost' ? Math.max(0, g.wave - 1) : g.wave,
    totalWaves: g.totalWaves,
    campHp: Math.max(0, Math.ceil(g.campHp)),
    campMax: g.campMax,
    kills: g.kills,
    treasures: loadoutOf(g.mods),
    dateText: shareDateText(now),
  };
  if (won) info.stars = starRating(g.campHp, g.campMax);
  return info;
}

/**
 * The card of an endless or daily run: no last wave and no stars; it counts the waves survived. Pure: `now` only
 * dates the card. Reason: a daily run's seed is its day (YYYYMMDD), which also picks the day's map; endless plays
 * chapter 10's map.
 */
export function modeShareInfo(g: GameState, now: Date): ShareInfo {
  const daily = g.mode === 'daily';
  const map = daily ? dailyMapIndex(g.seed) + 1 : ENDLESS_CHAPTER;
  return {
    mode: daily ? 'daily' : 'endless',
    title: daily ? `每日挑战 · ${dayLabel(g.seed)}` : '无尽模式',
    subtitle: `${CHAPTERS[map - 1].name}地图`,
    map,
    won: false,
    waves: wavesSurvived(g),
    campHp: Math.max(0, Math.ceil(g.campHp)),
    campMax: g.campMax,
    kills: g.kills,
    treasures: loadoutOf(g.mods),
    dateText: shareDateText(now),
  };
}

/** The card of any run: a chapter's, or an endless or daily run's. */
export function runShareInfo(g: GameState, now: Date): ShareInfo {
  return g.mode === 'chapter' ? chapterShareInfo(g, now) : modeShareInfo(g, now);
}

/**
 * The 法宝 a run was played with, read back from its modifiers (buildMods in reverse), in TREASURE_IDS order.
 * Reason: the run doesn't keep its equipped list, and the vault may have changed since (a resumed run keeps the
 * modifiers it was saved with; daily runs play without 法宝). Each 法宝 moves RunMods fields no other one moves, to a
 * different value at each tier, so the modifiers name both; tests/share.test.ts holds that for every loadout.
 */
export function loadoutOf(mods: RunMods): ShareToken[] {
  const base = flatMods(defaultMods());
  const have = flatMods(mods);
  const out: ShareToken[] = [];
  for (const id of TREASURE_IDS) {
    for (let tier = MAX_TIER; tier >= 1; tier--) {
      const alone = defaultMods();
      TREASURES[id].apply(alone, effectValue(id, tier));
      const moved = Object.entries(flatMods(alone)).filter(([k, v]) => base[k] !== v);
      if (moved.length > 0 && moved.every(([k, v]) => have[k] === v)) {
        out.push({ id, tier });
        break;
      }
    }
  }
  return out;
}

/** RunMods as flat numbers: `dmgMul`, `campHpBonus`, ... and `unitDmgMul.火` for the per-unit tables. */
function flatMods(m: RunMods): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(m) as Array<[string, number | Record<string, number>]>) {
    if (typeof v === 'number') out[k] = v;
    else for (const [unit, x] of Object.entries(v)) out[`${k}.${unit}`] = x;
  }
  return out;
}

/** 一星 .. 三星, for the share text. */
const STAR_WORDS = ['', '一', '两', '三'];

/** The words sent with the picture (also its alt text): the run in one line, then the address when there is one. */
export function shareText(info: ShareInfo, url: string): string {
  let result: string;
  if (info.mode !== 'chapter') result = `撑过第 ${info.waves} 波`;
  else if (info.won) result = `${info.stars ? `${STAR_WORDS[info.stars]}星` : ''}通关`;
  else result = `守住 ${info.waves}/${info.totalWaves ?? info.waves} 波`;
  return `《一字成军》${info.title}：${result}，击杀 ${info.kills} 只妖怪！${url ? ` ${url}` : ''}`;
}

/** The game's address for the share text: this page without query or hash; '' off the web (a file opened from disk). */
function siteUrl(): string {
  if (typeof location === 'undefined' || !location.protocol.startsWith('http')) return '';
  return `${location.origin}${location.pathname}`;
}

/** A share is being prepared, or its sheet is open. */
let busy = false;

/** Whether a share is under way: the result panel dims its 分享 seal meanwhile, and another tap is ignored. */
export function isSharing(): boolean {
  return busy;
}

/**
 * 分享战报: paints the card (only now, on the tap; never per frame) and shares it through shareImage. Ignored while a
 * share is under way. Resolves to how the share ended, or null when it didn't happen.
 */
export async function shareResult(info: ShareInfo): Promise<ShareOutcome | null> {
  if (busy) return null;
  busy = true;
  try {
    await brushReady();
    return await shareImage(renderShareCard(info), shareText(info, siteUrl()));
  } catch (err) {
    console.warn('[一字成军] 战报分享失败', err);
    return null;
  } finally {
    busy = false;
  }
}

/**
 * Waits briefly for the brush font if it isn't ready: the card's titles are brush text. Boot has normally loaded it
 * already, and then nothing waits (the card is painted in the same task as the tap, which the share sheet needs).
 */
async function brushReady(): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document) || document.fonts.check(`40px ${BRUSH_FAMILY}`, '字')) return;
  await loadFonts(1500);
}

/** A plausible won run of `chapter` with three 法宝 equipped, for the dev hook. */
export function sampleShareInfo(chapter: number, now: Date): ShareInfo {
  const vault: Vault = {
    stones: 0,
    treasures: [
      { id: '金刚琢', tier: 2, count: 1 },
      { id: '照妖镜', tier: 1, count: 1 },
      { id: '紧箍咒', tier: 3, count: 1 },
    ],
    equipped: ['金刚琢', '照妖镜', '紧箍咒'],
  };
  const n = Math.min(CHAPTERS.length, Math.max(1, Math.round(chapter)));
  const g = createGame({ seed: 1, chapter: n, mods: buildMods(vault) });
  g.phase = 'won';
  g.wave = g.totalWaves;
  g.kills = 30 + 22 * n;
  g.campHp = Math.round(g.campMax * 0.85);
  return chapterShareInfo(g, now);
}

declare global {
  interface Window {
    /** Dev only: paints a result card and shows it in the save-image overlay; returns the PNG as a data URL. */
    __yzcjShare?: (patch?: Partial<ShareInfo>) => string;
  }
}

/**
 * Dev console hook. `__yzcjShare()` paints the card of the run on screen (in any phase) or, away from a run, a sample
 * chapter-1 win; `__yzcjShare({ chapter: 8 })` paints a sample of chapter 8; any other fields patch the card, e.g.
 * `__yzcjShare({ won: false, waves: 3, stars: undefined })`. Shows it in the overlay (never the share sheet).
 */
function devShare(patch: Partial<ShareInfo> = {}): string {
  const scene = (window as unknown as { __yzcj?: { current?: { shareInfo?: () => ShareInfo } } }).__yzcj?.current;
  const base = patch.chapter === undefined && scene?.shareInfo ? scene.shareInfo() : sampleShareInfo(patch.chapter ?? 1, new Date());
  const info: ShareInfo = { ...base, ...patch };
  const url = renderShareCard(info).toDataURL('image/png');
  showShareOverlay(url, shareText(info, siteUrl()));
  return url;
}

if (import.meta.env.DEV && typeof window !== 'undefined') window.__yzcjShare = devShare;
