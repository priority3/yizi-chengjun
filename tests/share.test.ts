// 分享战报: the card's data built from a chapter run (won, lost, bot-played), the 法宝 read back from the run's
// modifiers, the share text and date, the card's layout math, and the 分享 seal on the result panel.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CHAPTERS } from '../src/config/chapters.ts';
import { EQUIP_SLOTS, MAX_TIER, TREASURE_IDS, TREASURES, type TreasureId } from '../src/config/treasures.ts';
import { createGame } from '../src/core/game.ts';
import { starRating } from '../src/core/rating.ts';
import { playChapter, summarize } from '../src/core/sim.ts';
import { restore, snapshot } from '../src/core/snapshot.ts';
import { buildMods, defaultMods, effectValue, type Vault } from '../src/core/treasures.ts';
import type { RunMods } from '../src/core/types.ts';
import { MIN_H, setDesignHeight, W, type Rect } from '../src/render/layout.ts';
import {
  CARD_H,
  CARD_LAYOUT,
  CARD_W,
  HEADLINE_PX,
  headerLayout,
  SEAL_H,
  SEAL_W,
  shareHeadline,
  shareStats,
  STAR_MID_R,
  STAR_R,
  STAR_RISE,
  TITLE_PX,
  TOKEN_GAP,
  TOKEN_R,
  tokenXs,
  type ShareInfo,
} from '../src/render/share-card.ts';
import { resultPanel, shareButtonRect, tapResult, type ResultInfo } from '../src/ui/game-overlays.ts';
import { chapterShareInfo, loadoutOf, modeShareInfo, runShareInfo, sampleShareInfo, shareDateText, shareText } from '../src/ui/share-result.ts';

/** The evening of 8 October 2026, local time. */
const DAY = new Date(2026, 9, 8, 21, 30);

/** A vault holding one of each listed 法宝 at its tier, all equipped. */
function vaultWith(items: ReadonlyArray<readonly [TreasureId, number]>): Vault {
  return { stones: 0, treasures: items.map(([id, tier]) => ({ id, tier, count: 1 })), equipped: items.map(([id]) => id) };
}

/** A won run of chapter 3 played with 金刚琢 (tier 2: camp +48) and 照妖镜, 101.4 of 168 camp HP left. */
function wonRun() {
  const g = createGame({ seed: 7, chapter: 3, mods: buildMods(vaultWith([['金刚琢', 2], ['照妖镜', 1]])) });
  g.phase = 'won';
  g.wave = g.totalWaves;
  g.kills = 87;
  g.campHp = 101.4;
  return g;
}

/** A run of chapter 5 lost during wave 4, the last leak taking the camp below zero. */
function lostRun() {
  const g = createGame({ seed: 7, chapter: 5 });
  g.phase = 'lost';
  g.wave = 4;
  g.kills = 31;
  g.campHp = -6;
  return g;
}

describe('share card data from a chapter run', () => {
  it('fills every field of a won chapter', () => {
    expect(chapterShareInfo(wonRun(), DAY)).toEqual({
      mode: 'chapter',
      title: '第三章 · 平顶山',
      subtitle: '打败了金角大王',
      chapter: 3,
      won: true,
      waves: 6,
      totalWaves: 6,
      campHp: 102,
      campMax: 168,
      kills: 87,
      stars: 2,
      treasures: [
        { id: '金刚琢', tier: 2 },
        { id: '照妖镜', tier: 1 },
      ],
      dateText: '2026年10月8日',
    });
  });

  it('reports a lost chapter: the waves cleared before the fall, an empty camp and no stars', () => {
    const info = chapterShareInfo(lostRun(), DAY);
    expect(info).toEqual({
      mode: 'chapter',
      title: '第五章 · 黑风山',
      subtitle: '本章 Boss · 黑熊精',
      chapter: 5,
      won: false,
      waves: 3,
      totalWaves: 6,
      campHp: 0,
      campMax: 120,
      kills: 31,
      treasures: [],
      dateText: '2026年10月8日',
    });
    expect('stars' in info).toBe(false);
  });

  it('is plain data that survives JSON', () => {
    for (const info of [chapterShareInfo(wonRun(), DAY), chapterShareInfo(lostRun(), DAY)]) {
      expect(JSON.parse(JSON.stringify(info))).toEqual(info);
    }
  });

  it('agrees with bot-played runs, won and lost', () => {
    // Reason: real end states (leaks, heals, the wave the camp fell in) rather than numbers picked by hand.
    const runs = [1, 2, 3].map((seed) => playChapter(seed, 1)).concat([1, 2, 3].map((seed) => playChapter(seed, CHAPTERS.length)));
    expect(runs.some((g) => g.phase === 'won')).toBe(true);
    expect(runs.some((g) => g.phase === 'lost')).toBe(true);
    for (const g of runs) {
      const info = chapterShareInfo(g, DAY);
      expect(info.won).toBe(g.phase === 'won');
      expect(info.waves).toBe(summarize(g).wavesCleared);
      expect(info.totalWaves).toBe(CHAPTERS[g.chapter - 1].waves);
      expect(info.campHp).toBe(Math.max(0, Math.ceil(g.campHp)));
      expect(info.kills).toBe(g.kills);
      expect(info.stars).toBe(g.phase === 'won' ? starRating(g.campHp, g.campMax) : undefined);
      expect(info.treasures).toEqual([]);
    }
  });

  it('counts the waves already cleared while a run is still going', () => {
    const g = createGame({ seed: 7, chapter: 2 });
    g.wave = 2;
    expect(chapterShareInfo(g, DAY).waves).toBe(2);
    g.phase = 'battle';
    g.wave = 3;
    expect(chapterShareInfo(g, DAY).waves).toBe(2);
  });

  it('builds a dev sample for any chapter, clamped to the real ones', () => {
    const s = sampleShareInfo(8, DAY);
    expect(s).toMatchObject({ mode: 'chapter', chapter: 8, won: true, waves: 7, totalWaves: 7, title: '第八章 · 火焰山' });
    expect(s.treasures.map((t) => t.id)).toEqual(['金刚琢', '照妖镜', '紧箍咒']);
    expect(sampleShareInfo(99, DAY).chapter).toBe(CHAPTERS.length);
  });
});

/** Every k-subset (k <= max) of `items`, each in the items' order. */
function subsets<T>(items: readonly T[], max: number): T[][] {
  const out: T[][] = [[]];
  const grow = (from: number, cur: T[]) => {
    for (let i = from; i < items.length; i++) {
      const next = [...cur, items[i]];
      out.push(next);
      if (next.length < max) grow(i + 1, next);
    }
  };
  grow(0, []);
  return out;
}

/** RunMods as `field=value` strings, per-unit tables as `field.unit=value`. */
function flat(m: RunMods): string[] {
  return Object.entries(m).flatMap(([k, v]: [string, number | Record<string, number>]) =>
    typeof v === 'number' ? [`${k}=${v}`] : Object.entries(v).map(([unit, x]) => `${k}.${unit}=${x}`),
  );
}

/** The RunMods fields (and per-unit entries) that equipping `id` alone at `tier` changes. */
function movedBy(id: TreasureId, tier: number): string[] {
  const before = new Set(flat(defaultMods()));
  const m = defaultMods();
  TREASURES[id].apply(m, effectValue(id, tier));
  return flat(m)
    .filter((kv) => !before.has(kv))
    .map((kv) => kv.split('=')[0]);
}

describe('share card data from an endless or daily run', () => {
  /** An open-ended run whose camp fell during wave 13 (12 waves survived). */
  function fell(mode: 'endless' | 'daily', seed: number, mods?: RunMods) {
    const g = createGame({ seed, chapter: 1, mode, mods });
    g.phase = 'lost';
    g.wave = 13;
    g.kills = 240;
    g.campHp = -3;
    return g;
  }

  it('counts the waves survived, with no last wave and no stars', () => {
    const info = modeShareInfo(fell('endless', 7, buildMods(vaultWith([['金刚琢', 2]]))), DAY);
    expect(info).toMatchObject({ mode: 'endless', title: '无尽模式', subtitle: '小雷音寺地图', map: 10, won: false, waves: 12, campHp: 0, kills: 240 });
    expect(info.totalWaves).toBeUndefined();
    expect(info.stars).toBeUndefined();
    expect(info.chapter).toBeUndefined();
    expect(info.treasures).toEqual([{ id: '金刚琢', tier: 2 }]);
    expect(shareHeadline(info)).toBe('撑过第 12 波');
    expect(shareText(info, '')).toBe('《一字成军》无尽模式：撑过第 12 波，击杀 240 只妖怪！');
  });

  it('names the day and its map for a daily run, which plays without 法宝', () => {
    // 20261009 ends in 9: the tenth map (小雷音寺); 20261003 ends in 3: the fourth (火云洞).
    const info = modeShareInfo(fell('daily', 20261009, buildMods(vaultWith([['金刚琢', 2]]))), DAY);
    expect(info).toMatchObject({ mode: 'daily', title: '每日挑战 · 10月9日', subtitle: '小雷音寺地图', map: 10, waves: 12 });
    expect(info.treasures).toEqual([]);
    expect(modeShareInfo(fell('daily', 20261003), DAY)).toMatchObject({ map: 4, subtitle: '火云洞地图', title: '每日挑战 · 10月3日' });
  });

  it('is what runShareInfo picks for those runs, and chapter runs keep their own card', () => {
    const daily = fell('daily', 20261009);
    expect(runShareInfo(daily, DAY)).toEqual(modeShareInfo(daily, DAY));
    expect(runShareInfo(wonRun(), DAY)).toEqual(chapterShareInfo(wonRun(), DAY));
  });
});

describe('the 法宝 a run was played with', () => {
  it('reads every loadout of up to three 法宝, at any tiers, back from the run modifiers', () => {
    const wrong: string[] = [];
    let checked = 0;
    for (const ids of subsets(TREASURE_IDS, EQUIP_SLOTS)) {
      for (let code = 0; code < MAX_TIER ** ids.length; code++) {
        // Each digit of `code` in base MAX_TIER is one 法宝's tier - 1.
        const items = ids.map((id, i) => [id, (Math.floor(code / MAX_TIER ** i) % MAX_TIER) + 1] as const);
        const want = items.map(([id, tier]) => ({ id, tier }));
        const got = loadoutOf(buildMods(vaultWith(items)));
        if (JSON.stringify(got) !== JSON.stringify(want)) wrong.push(`${JSON.stringify(want)} -> ${JSON.stringify(got)}`);
        checked++;
      }
    }
    // 1 + 12 x 3 + 66 x 9 + 220 x 27 loadouts.
    expect(checked).toBe(6571);
    expect(wrong).toEqual([]);
  });

  it('relies on every 法宝 moving modifiers that no other one moves', () => {
    // Reason: loadoutOf reads 法宝 back from the fields they move; a new 法宝 sharing a field needs another way.
    const owner = new Map<string, TreasureId>();
    for (const id of TREASURE_IDS) {
      const fields = movedBy(id, 1);
      expect(fields.length).toBeGreaterThan(0);
      for (const f of fields) {
        expect(owner.get(f) ?? id, `${f} is moved by both ${owner.get(f)} and ${id}`).toBe(id);
        owner.set(f, id);
      }
    }
  });

  it('keeps the loadout of a resumed run, whatever the vault holds by then', () => {
    const g = createGame({ seed: 3, chapter: 2, mods: buildMods(vaultWith([['紧箍咒', 3], ['人参果', 1]])) });
    const back = restore(JSON.parse(JSON.stringify(snapshot(g))));
    if (!back) throw new Error('the snapshot did not restore');
    expect(loadoutOf(back.mods)).toEqual([
      { id: '人参果', tier: 1 },
      { id: '紧箍咒', tier: 3 },
    ]);
  });

  it('is empty for a run without 法宝', () => {
    expect(loadoutOf(defaultMods())).toEqual([]);
  });
});

/** An endless-mode card as B4 might fill it: no chapter, no total, no stars. */
const ENDLESS: ShareInfo = {
  mode: 'endless',
  title: '无尽模式',
  subtitle: '第十章地图',
  map: 10,
  won: false,
  waves: 23,
  campHp: 0,
  campMax: 120,
  kills: 410,
  treasures: [],
  dateText: '2026年10月8日',
};

describe('share text and date', () => {
  it('prints the local date the Chinese way', () => {
    expect(shareDateText(DAY)).toBe('2026年10月8日');
    expect(shareDateText(new Date(2027, 0, 1, 0, 0, 1))).toBe('2027年1月1日');
  });

  it('sums the run up in one line, with the address when there is one', () => {
    const url = 'https://zidou-xiyou.vercel.app/';
    expect(shareText(chapterShareInfo(wonRun(), DAY), url)).toBe(`《一字成军》第三章 · 平顶山：两星通关，击杀 87 只妖怪！ ${url}`);
    expect(shareText(chapterShareInfo(lostRun(), DAY), '')).toBe('《一字成军》第五章 · 黑风山：守住 3/6 波，击杀 31 只妖怪！');
    expect(shareText(ENDLESS, '')).toBe('《一字成军》无尽模式：撑过第 23 波，击杀 410 只妖怪！');
  });
});

describe('the card layout', () => {
  it('names the outcome', () => {
    const won = chapterShareInfo(wonRun(), DAY);
    expect(shareHeadline(won)).toBe('章节通关！');
    expect(shareHeadline({ ...won, chapter: CHAPTERS.length })).toBe('取得真经！');
    expect(shareHeadline(chapterShareInfo(lostRun(), DAY))).toBe('阵地失守');
    expect(shareHeadline(ENDLESS)).toBe('撑过第 23 波');
    expect(shareHeadline({ ...ENDLESS, mode: 'daily', waves: 0 })).toBe('阵地失守');
  });

  it('lists the waves cleared, the camp left and the kills', () => {
    expect(shareStats(chapterShareInfo(wonRun(), DAY))).toEqual([
      { label: '守住波数', value: '6/6' },
      { label: '剩余阵地', value: '102/168' },
      { label: '击杀妖怪', value: '87' },
    ]);
    expect(shareStats(ENDLESS)[0].value).toBe('23');
  });

  it('centres the title and its seal as one group inside the frame', () => {
    for (const w of [450, 600, 660]) {
      const { titleX, sealX } = headerLayout(w);
      const left = titleX - w / 2;
      const right = sealX + SEAL_W / 2;
      expect(left + right).toBeCloseTo(CARD_W);
      expect(sealX - SEAL_W / 2).toBeGreaterThan(titleX + w / 2);
      expect(left).toBeGreaterThan(CARD_LAYOUT.inner);
      expect(right).toBeLessThan(CARD_W - CARD_LAYOUT.inner);
    }
  });

  it('centres up to three 法宝 tokens with room for their names', () => {
    expect(tokenXs(0)).toEqual([]);
    expect(tokenXs(1)).toEqual([CARD_W / 2]);
    const xs = tokenXs(EQUIP_SLOTS);
    expect(xs[0] + xs[2]).toBe(CARD_W);
    expect(xs[1] - xs[0]).toBe(TOKEN_GAP);
    // The longest name (紫金红葫芦, five characters at 26 px) fits between two neighbours' centres.
    expect(TOKEN_GAP).toBeGreaterThan(5 * 26 + 2 * 12);
    expect(xs[0] - TOKEN_R).toBeGreaterThan(CARD_LAYOUT.inner);
  });

  it('stacks its blocks top to bottom inside the frame without overlaps', () => {
    const C = CARD_LAYOUT;
    // [top, bottom] of each block in paint order, from the font sizes and radii in share-card.ts.
    const withStars: Array<[string, number, number]> = [
      ['title and seal', Math.min(C.titleY - TITLE_PX / 2, C.titleY - 4 - SEAL_H / 2), Math.max(C.titleY + TITLE_PX / 2, C.titleY - 4 + SEAL_H / 2)],
      ['tagline', C.taglineY - 22, C.taglineY + 22],
      ['rule', C.ruleY - 22, C.ruleY + 22],
      ['chapter', C.chapterY - 40, C.chapterY + 40],
      ['subtitle', C.subtitleY - 17, C.subtitleY + 17],
      ['map', C.map.y, C.map.y + C.map.h + 16],
      ['headline', C.headlineY - HEADLINE_PX / 2, C.headlineY + HEADLINE_PX / 2],
      ['stars', C.starsY - STAR_RISE - STAR_MID_R, C.starsY + STAR_R],
      ['stats', C.stats.y, C.stats.y + C.stats.h],
      ['tokens', C.tokensY - TOKEN_R, C.tokensY + TOKEN_R + 28 + 13],
      ['address', C.hostY - 17, C.hostY + 17],
      ['date', C.footY - 13, C.footY + 13],
    ];
    const alone = withStars.filter(([name]) => name !== 'stars' && name !== 'headline');
    alone.splice(6, 0, ['headline', C.headlineAloneY - HEADLINE_PX / 2, C.headlineAloneY + HEADLINE_PX / 2]);
    for (const blocks of [withStars, alone]) {
      expect(blocks[0][1]).toBeGreaterThan(C.inner);
      expect(blocks[blocks.length - 1][2]).toBeLessThan(CARD_H - C.inner);
      for (let i = 1; i < blocks.length; i++) {
        expect(blocks[i][1], `${blocks[i][0]} starts below ${blocks[i - 1][0]}`).toBeGreaterThan(blocks[i - 1][2]);
      }
    }
    expect(C.map.w / C.map.h).toBeCloseTo(3 / 4);
    expect(C.stats.x).toBeGreaterThan(C.inner);
    expect(C.stats.x + C.stats.w).toBeLessThan(CARD_W - C.inner);
  });
});

/** The result panel's state at `t` seconds after it appeared: a won (with or without the three-star bonus) or lost run. */
function resultInfo(phase: 'won' | 'lost', t: number, bonus = 0): ResultInfo {
  const g = createGame({ seed: 1, chapter: 2 });
  g.phase = phase;
  const won = phase === 'won';
  return { g, chapter: 2, rewards: won ? { stones: 25, treasure: '定风珠' } : null, award: won ? { stars: 3, best: 3, bonus } : null, t };
}

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const centre = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2, touch: true });

describe('the 分享 seal on the result panel', () => {
  afterEach(() => setDesignHeight(MIN_H));

  it('stays on screen, clear of the title, the stars and the buttons, at every design height', () => {
    for (const H of [640, 700, 800]) {
      setDesignHeight(H);
      for (const info of [resultInfo('won', 1), resultInfo('won', 1, 10), resultInfo('lost', 1)]) {
        const p = resultPanel(info);
        const s = shareButtonRect(p);
        expect(s.x).toBeGreaterThanOrEqual(0);
        expect(s.x + s.w).toBeLessThanOrEqual(W);
        expect(s.y).toBeGreaterThanOrEqual(0);
        // The title: up to five brush(34) characters centred at the panel's y + 46.
        expect(overlaps(s, { x: W / 2 - 85, y: p.y + 29, w: 170, h: 34 })).toBe(false);
        // A win's stars: the middle one (radius 23) centred at y + 94; the stacked buttons start lower still.
        expect(s.y + s.h).toBeLessThan(p.y + 94 - 23);
      }
    }
  });

  it('shares on a tap once it has stamped down, and leaves the buttons their own taps', () => {
    const share = vi.fn();
    const go = vi.fn();
    const buttons = [{ label: '下一章', go }];
    const info = resultInfo('won', 0.5);
    const p = resultPanel(info);
    tapResult(centre(shareButtonRect(p)), info, buttons, share);
    expect(share).toHaveBeenCalledTimes(1);
    expect(go).not.toHaveBeenCalled();
    // The one button sits at the panel's bottom: 26 from its edge, 42 high.
    tapResult({ x: W / 2, y: p.y + p.h - 26 - 21, touch: false }, info, buttons, share);
    expect(go).toHaveBeenCalledTimes(1);
    expect(share).toHaveBeenCalledTimes(1);
    // Before the seal has come down, its corner is just the panel.
    tapResult(centre(shareButtonRect(p)), resultInfo('won', 0.05), buttons, share);
    expect(share).toHaveBeenCalledTimes(1);
  });
});
