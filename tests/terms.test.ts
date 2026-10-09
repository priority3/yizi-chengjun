// The v0.9 wording as players meet it (src/config/terms.ts): the strengthening card shows 金 while its id stays '神',
// strengthened tiles read 金X, the four renamed encounters and the harder kind, chapter 10, 沙僧 and the 法宝 text.
// The share text, the result titles and the kill counts are covered in share.test.ts; tests/compliance.test.ts keeps
// the replaced words out of src/.
import { afterEach, describe as group, expect, it, vi } from 'vitest';
import { CHAPTERS } from '../src/config/chapters.ts';
import { ENC_FORTUNE, ENC_GOLD_DROP, ENC_PEDDLER, ENC_RENEWAL, GILDING, GOLD_GLYPH, LAST_CHAPTER_NAME, TRIAL } from '../src/config/terms.ts';
import { TREASURES } from '../src/config/treasures.ts';
import { glyphOf, UNITS } from '../src/config/units.ts';
import { resolveDrop } from '../src/core/board.ts';
import { encounterName, ENCOUNTER_IDS, ENCOUNTERS, KIND_LABEL } from '../src/core/encounters.ts';
import { defaultMods } from '../src/core/treasures.ts';
import type { UnitId } from '../src/core/types.ts';
import { cardSprite } from '../src/render/cards.ts';
import { sprites } from '../src/render/sprites.ts';
import { describe } from '../src/ui/describe.ts';
import type { Pointer } from '../src/ui/input.ts';
import { CardDrag, type SlotLocator } from '../src/ui/map-controls.ts';
import { emptyGame, put } from './helpers.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Every card but the strengthening one. */
const OTHERS = (Object.keys(UNITS) as UnitId[]).filter((id) => id !== '神');

/**
 * The strings a freshly painted card sprite writes with fillText, through a stand-in canvas: its 2D context records
 * fillText and lets every other call (paths, transforms, gradients) do nothing.
 */
function paintedText(id: UnitId, level: number, divine: boolean): string[] {
  const texts: string[] = [];
  const gradient = { addColorStop: () => {} };
  const ctx = new Proxy({} as Record<string | symbol, unknown>, {
    get: (state, key) => (key in state ? state[key] : key === 'fillText' ? (s: string) => void texts.push(s) : () => gradient),
    set: (state, key, value) => {
      state[key] = value;
      return true;
    },
  });
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) });
  // Reason: sprites are cached by id and level, so start from an empty cache to see this card painted.
  sprites.clear();
  cardSprite(id, level, divine);
  return texts;
}

group('the strengthening card', () => {
  it('keeps its id and kind, and shows 金 with 鎏金 as its label', () => {
    const def = UNITS['神'];
    expect([def.id, def.kind]).toEqual(['神', 'divine']);
    expect([GOLD_GLYPH, GILDING]).toEqual(['金', '鎏金']);
    expect([glyphOf('神'), def.label, def.desc]).toEqual(['金', '鎏金', '拖到兵字或英雄上，变成金X']);
    // Every other card is still named by its id, so it looks exactly as before.
    for (const id of OTHERS) expect(glyphOf(id), id).toBe(id);
  });

  it('is painted 金, and so is the seal on a strengthened card; every other card paints its id', () => {
    const card = paintedText('神', 1, false);
    expect(card).toContain('金');
    expect(card).not.toContain('神');
    expect(paintedText('箭', 2, true)).toEqual(expect.arrayContaining(['箭', '2', '金']));
    for (const id of OTHERS) expect(paintedText(id, 1, false), id).toContain(id);
  });

  it('reads 金 in descriptions, and a strengthened tile 金X', () => {
    const mods = defaultMods();
    expect(describe({ id: '神', level: 1, divine: false }, mods)).toBe('金 · 拖到兵字或英雄上，变成金X');
    expect(describe({ id: '箭', level: 2, divine: true }, mods)).toMatch(/^金箭 2级 · /);
    expect(describe({ id: '悟空', level: 1, divine: true }, mods)).toMatch(/^金悟空 · 大招「/);
  });

  it('refuses a second card, a strengthened tile and a support in 金 and 鎏金 words', () => {
    const g = emptyGame();
    const refusal = (from: number, to: number) => {
      expect(resolveDrop(g, from, to)).toBe('invalid');
      return g.events.at(-1);
    };
    put(g, 1, '神');
    put(g, 2, '神');
    put(g, 3, '箭', 1, true);
    put(g, 4, '钱');
    expect(refusal(1, 2)).toMatchObject({ msg: '两个金字不能叠加' });
    expect(refusal(1, 3)).toMatchObject({ msg: '它已经鎏金了' });
    expect(refusal(1, 4)).toMatchObject({ msg: '金字只能附在兵字或英雄上' });
  });

  it('says 松开鎏金 while it is dragged onto a fighter', () => {
    const g = emptyGame();
    put(g, 3, '箭');
    put(g, 5, '神');
    // Pointers at (cell, 100), read straight back as the cell (as in pad-ui.test.ts).
    const at = (cell: number): Pointer => ({ x: cell, y: 100, touch: false });
    const locator: SlotLocator = (x) => (Number.isInteger(x) && x >= 0 && x < g.slots.length ? x : -1);
    const drag = new CardDrag();
    expect(drag.begin(g, locator, at(5), at(5))).toBe(true);
    drag.move(g, locator, at(3));
    expect([drag.hoverValid, drag.hoverHint]).toEqual([true, '松开鎏金']);
  });
});

group('encounters', () => {
  it('keep their roll order, so every run plays out as before', () => {
    expect(ENCOUNTER_IDS).toEqual(['renewal', 'fortune', 'goldDrop', 'peddler', '宝箱', '妖风大作', '月圆之夜', '狼群来袭', '盗宝妖', '妖王亲临']);
  });

  it('show the renamed four and the harder kind in the new words, never an id', () => {
    expect((['renewal', 'fortune', 'goldDrop', 'peddler'] as const).map(encounterName)).toEqual([ENC_RENEWAL, ENC_FORTUNE, ENC_GOLD_DROP, ENC_PEDDLER]);
    expect([ENC_RENEWAL, ENC_FORTUNE, ENC_GOLD_DROP, ENC_PEDDLER]).toEqual(['枯木逢春', '招财进宝', '天降金字', '货郎摆摊']);
    for (const id of ENCOUNTER_IDS) expect(encounterName(id), id).toMatch(/^[\u4e00-\u9fff]+$/);
    expect(encounterName('宝箱')).toBe('宝箱');
    expect([KIND_LABEL.challenge, TRIAL]).toEqual(['考验', '考验']);
    expect(ENCOUNTERS.fortune.desc).toBe('立刻获得 50 铜钱');
    expect(ENCOUNTERS.goldDrop.desc).toBe('一张「金」落到阵地空格上（没空格则得 40 铜钱）');
  });
});

group('other wording', () => {
  it('names chapter 10, 沙僧\'s finishing blow, the coins and the 法宝 in the new words', () => {
    expect(CHAPTERS[CHAPTERS.length - 1].name).toBe(LAST_CHAPTER_NAME);
    expect(LAST_CHAPTER_NAME).toBe('雷音谷');
    expect([UNITS['沙僧'].label, UNITS['沙僧'].desc]).toEqual(['收服', '月牙铲飞出，残血妖怪直接收服']);
    expect(UNITS['钱'].desc).toBe('战斗时每 4 秒产出铜钱');
    expect(TREASURES['降妖宝杖'].text(0.08)).toBe('沙僧收服线 +8%');
    expect(TREASURES['紫金红葫芦'].text(30)).toBe('开局铜钱 +30');
  });
});
