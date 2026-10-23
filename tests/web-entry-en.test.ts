// The web entry (src/main.ts) on a fake page (tests/fake-page.ts) whose browser prefers English: the game opens in
// English straight on the title screen (the 健康游戏忠告 splash is for games in China), the page takes the English
// title and language tag, and the language switch on the title screen goes over to Chinese and remembers it.
import { beforeAll, describe, expect, it } from 'vitest';
import { lang } from '../src/i18n/lang.ts';
import { LANG_BUTTON } from '../src/ui/title-layout.ts';
import { bootWebEntry, canvases, doc, frame, pointer, storage, win } from './fake-page.ts';

beforeAll(async () => {
  await bootWebEntry({ languages: ['en-US', 'zh-CN'], language: 'en-US' });
});

describe('web entry in an English browser', () => {
  it('opens in English on the title screen, and names the page in English', () => {
    expect(lang()).toBe('en');
    expect(win.__yzcj?.current.constructor.name).toBe('TitleScene');
    expect(frame()).toEqual(expect.arrayContaining(['Glyph Legion', 'Start', 'About', '中文']));
    expect([doc.title, doc.documentElement.attributes.get('lang')]).toEqual(['Glyph Legion', 'en']);
  });

  it('switches to Chinese from the title screen and keeps the choice', () => {
    const [x, y] = [LANG_BUTTON.x + LANG_BUTTON.w / 2, LANG_BUTTON.y + LANG_BUTTON.h / 2];
    canvases[0].dispatchEvent(pointer('pointerdown', x, y));
    canvases[0].dispatchEvent(pointer('pointerup', x, y));
    expect(lang()).toBe('zh');
    expect(storage.get('yzcj:lang')).toBe('zh');
    expect(frame()).toEqual(expect.arrayContaining(['一字成军', '开始游戏', 'English']));
    expect([doc.title, doc.documentElement.attributes.get('lang')]).toEqual(['一字成军', 'zh-CN']);
  });
});
