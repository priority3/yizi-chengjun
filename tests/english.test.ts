// The English version (src/i18n/): every id of the game's data has its English; the device's language and the
// player's switch pick the language; and in English the screens draw no Chinese besides the glyph art: the cards'
// and flags' glyphs, the 法宝 tokens' seals, the seal marks 金 王 妖 营 战 报, and 中文 on the switch back.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startGame } from '../src/boot.ts';
import { CHAPTERS } from '../src/config/chapters.ts';
import { ENEMIES } from '../src/config/enemies.ts';
import { SLOT_NAME, type SlotKind } from '../src/config/maps.ts';
import { TREASURE_IDS, TREASURES } from '../src/config/treasures.ts';
import { ULTIMATES } from '../src/config/ultimates.ts';
import { glyphOf, UNITS } from '../src/config/units.ts';
import { ENCOUNTER_IDS } from '../src/core/encounters.ts';
import type { GameState, HeroId, UnitId } from '../src/core/types.ts';
import { BOSS_SHORT_EN, CHAPTER_EN, ENCOUNTER_EN, ENEMY_EN, PAD_EN, TREASURE_EN, traitTextEn, ULTIMATE_EN, UNIT_EN } from '../src/i18n/en-tables.ts';
import { allowLangSwitch, canSwitchLang, lang, langForLocales, setLang } from '../src/i18n/lang.ts';
import { installPlatform, type KeyValueStore } from '../src/platform/env.ts';
import { loadLangChoice, saveLangChoice, switchLang } from '../src/platform/lang-choice.ts';
import { webPlatform } from '../src/platform/web.ts';
import { L, MIN_H, setDesignHeight } from '../src/render/layout.ts';
import { renderShareCard } from '../src/render/share-card.ts';
import type { Scene } from '../src/ui/scenes.ts';
import { sampleShareInfo } from '../src/ui/share-result.ts';
import { LANG_BUTTON } from '../src/ui/title-layout.ts';
import { fakePlatform, recordingContext, type Drawn, type FakePlatform } from './fake-platform.ts';

const CJK = /[㐀-鿿　-〿＀-￯]/;

/** Chinese the English screens may draw: glyph art and seals, never words to read. */
const ART = new Set<string>([
  ...(Object.keys(UNITS) as UnitId[]).flatMap((id) => [id, glyphOf(id), ...Array.from(glyphOf(id))]),
  ...TREASURE_IDS.map((id) => TREASURES[id].short),
  ...'金王妖营战报',
  '中文',
]);

/** The drawn strings holding Chinese that isn't glyph art, each once. */
const stray = (texts: readonly string[]): string[] => [...new Set(texts.filter((s) => CJK.test(s) && !ART.has(s)))];

describe('English tables', () => {
  const english = (s: string, what: string) => {
    expect(s.trim().length, what).toBeGreaterThan(0);
    expect(CJK.test(s), `${what}: ${s}`).toBe(false);
  };

  it('name every card, hero, fragment, monster, chapter, 法宝, ultimate, encounter and pad in English', () => {
    for (const id of Object.keys(UNITS) as UnitId[]) {
      english(UNIT_EN[id].name, id);
      english(UNIT_EN[id].desc, id);
    }
    for (const hero of Object.keys(ULTIMATES) as HeroId[]) {
      english(ULTIMATE_EN[hero].name, hero);
      english(ULTIMATE_EN[hero].desc, hero);
    }
    for (const [id, def] of Object.entries(ENEMIES)) {
      english(ENEMY_EN[id], id);
      if (def.boss) english(BOSS_SHORT_EN[id], id);
      if (def.trait || def.elite) english(traitTextEn(def.trait, def.elite), id);
    }
    expect(CHAPTER_EN).toHaveLength(CHAPTERS.length);
    CHAPTER_EN.forEach((name, i) => english(name, `chapter ${i + 1}`));
    for (const id of TREASURE_IDS) {
      english(TREASURE_EN[id].name, id);
      english(TREASURE_EN[id].text(0.25), id);
    }
    for (const id of ENCOUNTER_IDS) {
      english(ENCOUNTER_EN[id].name, id);
      english(ENCOUNTER_EN[id].desc, id);
    }
    for (const kind of Object.keys(SLOT_NAME) as SlotKind[]) english(PAD_EN[kind], kind);
  });
});

describe('language choice', () => {
  afterEach(() => setLang('zh'));

  it('is Chinese for a Chinese browser, English for any other, Chinese when the browser names none', () => {
    expect(['zh-CN', 'zh-TW', 'zh', 'ZH-hk', 'zh-Hans-CN'].map((l) => langForLocales([l, 'en-US']))).toEqual(['zh', 'zh', 'zh', 'zh', 'zh']);
    expect(['en-US', 'fr', 'ja-JP', 'zhx'].map((l) => langForLocales([l, 'zh-CN']))).toEqual(['en', 'en', 'en', 'en']);
    expect(langForLocales([])).toBe('zh');
  });

  it('remembers the switch, and ignores a missing or broken saved choice', () => {
    const map = new Map<string, string>();
    const store: KeyValueStore = {
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => void map.set(k, v),
      removeItem: (k) => void map.delete(k),
    };
    expect(loadLangChoice(store)).toBeNull();
    map.set('yzcj:lang', 'klingon');
    expect(loadLangChoice(store)).toBeNull();
    saveLangChoice('en', store);
    expect(loadLangChoice(store)).toBe('en');
    expect(loadLangChoice(null)).toBeNull();
  });
});

describe('screens in English', () => {
  let env: FakePlatform;
  const offscreen: Drawn = { texts: [], fills: [] };

  beforeEach(() => {
    setDesignHeight(MIN_H);
    offscreen.texts.length = 0;
    env = fakePlatform({
      createCanvas: (width, height) => ({ width, height, getContext: () => recordingContext(offscreen) }) as unknown as HTMLCanvasElement,
    });
    installPlatform(env);
    setLang('en');
    allowLangSwitch(true);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    setLang('zh');
    allowLangSwitch(false);
    installPlatform(webPlatform());
    vi.restoreAllMocks();
  });

  /** Updates `scene` by `dt` seconds and draws it; returns what the stage and the offscreen canvases drew. */
  function frame(scene: Scene, dt = 0.016): string[] {
    env.screen.texts.length = 0;
    offscreen.texts.length = 0;
    scene.update(dt);
    // Reason: every stage the fake platform makes draws into env.screen.
    scene.render(env.createStage().ctx);
    return [...env.screen.texts, ...offscreen.texts];
  }

  it('draw no Chinese words on the title, chapter, 法宝 and about screens', async () => {
    const scenes = await startGame({ splash: false });
    const draw = () => frame(scenes.current);
    const title = draw();
    expect(title).toEqual(expect.arrayContaining(['Glyph Legion', 'Journey to the West Tower Defense', 'Start', 'About', '中文']));
    expect(stray(title)).toEqual([]);
    scenes.chapters();
    expect(stray(draw())).toEqual([]);
    scenes.treasures();
    expect(stray(draw())).toEqual([]);
    scenes.about();
    const about = draw();
    expect(about).toEqual(expect.arrayContaining(['Privacy', 'Terms', 'Contact', 'Glyph Legion Privacy Policy']));
    expect(stray(about)).toEqual([]);
  });

  it('draw no Chinese words in a run: shop, tips, encounters, battle, pause and results', async () => {
    const scenes = await startGame({ splash: false });
    const seen: string[] = [];
    const draw = (dt = 0.016) => void seen.push(...frame(scenes.current, dt));
    for (const start of [() => scenes.play(1), () => scenes.play(9), () => scenes.endless(), () => scenes.daily()]) {
      start();
      const scene = scenes.current as Scene & { g: GameState; startWave(): void; pause(): void; paused: boolean };
      draw();
      // A shop card's description, then an encounter to pick from.
      const r = L.shopCards[0];
      scene.tap?.({ x: r.x + r.w / 2, y: r.y + r.h / 2, touch: false });
      draw();
      scene.g.encounter = ['goldDrop', '月圆之夜', '盗宝妖'];
      draw();
      scene.g.encounter = null;
      // A wave under way, then the pause panel.
      scene.startWave();
      for (let i = 0; i < 60; i++) draw(0.05);
      scene.pause();
      draw();
      scene.paused = false;
      // The run ends: the result panel shows a second later.
      scene.g.phase = scene.g.mode === 'chapter' && scene.g.chapter === 1 ? 'won' : 'lost';
      draw(0.5);
      draw(1);
      draw(1);
    }
    expect(seen).toEqual(expect.arrayContaining(['Battle', 'Refresh', 'Shop', 'Paused', 'Chapter Clear!', 'Share']));
    expect(stray(seen)).toEqual([]);
  });

  it('paint the share card with no Chinese words', () => {
    for (const chapter of [1, 10]) {
      offscreen.texts.length = 0;
      renderShareCard(sampleShareInfo(chapter, new Date(2026, 9, 23)));
      expect(offscreen.texts).toEqual(expect.arrayContaining(['Glyph Legion', 'October 23, 2026 · v0.9.0']));
      expect(stray(offscreen.texts)).toEqual([]);
    }
  });

  it('switch back to Chinese from the title screen, and stay so', async () => {
    const scenes = await startGame({ splash: false });
    expect(canSwitchLang()).toBe(true);
    scenes.current.tap?.({ x: LANG_BUTTON.x + LANG_BUTTON.w / 2, y: LANG_BUTTON.y + LANG_BUTTON.h / 2, touch: true });
    expect(lang()).toBe('zh');
    expect(env.store.get('yzcj:lang')).toBe('zh');
    const texts = frame(scenes.current);
    expect(texts).toEqual(expect.arrayContaining(['一字成军', '开始游戏', 'English']));
    switchLang();
    expect([lang(), env.store.get('yzcj:lang')]).toEqual(['en', 'en']);
  });
});
