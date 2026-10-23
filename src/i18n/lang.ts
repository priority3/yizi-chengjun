// The language players read: 简体中文 'zh' (the default, and the only one mini-game builds show) or English 'en'. The
// web entry picks it at launch (main.ts); where the build allows (canSwitchLang) the title screen and the pause panel
// switch it while the game runs. Player-visible text is looked up when it is drawn, through tr() and the English
// tables next to this file, so a switch shows on the next frame. Ids stay Chinese (棍, 悟空, 金刚琢, 白骨精…): saves,
// hashes and the card art use them, so they are never translated.

export type Lang = 'zh' | 'en';

let current: Lang = 'zh';
let switchable = false;
const listeners: ((next: Lang) => void)[] = [];

/** The language text is drawn in. */
export function lang(): Lang {
  return current;
}

/** Text is drawn in English. */
export function isEn(): boolean {
  return current === 'en';
}

/** `zh` while the game shows Chinese, `en` while it shows English. */
export function tr<T>(zh: T, en: T): T {
  return current === 'en' ? en : zh;
}

/** Switches the language; the listeners (sprite caches, the page title) hear of it when it changes. */
export function setLang(next: Lang): void {
  if (next === current) return;
  current = next;
  for (const listener of listeners) listener(next);
}

/** Calls `listener` after every switch of the language; returns a function that stops it. */
export function onLangChange(listener: (next: Lang) => void): () => void {
  listeners.push(listener);
  return () => {
    const i = listeners.indexOf(listener);
    if (i >= 0) listeners.splice(i, 1);
  };
}

/** The player may switch the language: the web build. Mini-game and portal builds keep the one they start in. */
export function canSwitchLang(): boolean {
  return switchable;
}

/** Shows or hides the language switches (set once by the entry). */
export function allowLangSwitch(on: boolean): void {
  switchable = on;
}

export function isLang(value: unknown): value is Lang {
  return value === 'zh' || value === 'en';
}

/**
 * The language for a device whose preferred languages are `locales`, most preferred first (navigator.languages):
 * Chinese when the first one is any kind of Chinese (zh, zh-CN, zh-Hant-TW…), English for any other. A device that
 * names none keeps the default, Chinese.
 */
export function langForLocales(locales: readonly string[]): Lang {
  if (locales.length === 0) return 'zh';
  return /^zh\b/i.test(locales[0]) ? 'zh' : 'en';
}
