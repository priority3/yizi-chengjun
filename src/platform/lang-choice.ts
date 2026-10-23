// The language the player picked with a language switch (title screen, pause panel), kept in the platform's storage
// under 'yzcj:lang', apart from the progress save so the entry can read it before the first screen is drawn. Only a
// switch writes it; until then the device's language decides (main.ts).
import { isLang, lang, setLang, tr, type Lang } from '../i18n/lang.ts';
import { platform, type KeyValueStore } from './env.ts';

const STORAGE_KEY = 'yzcj:lang';

/** The saved choice, or null when the player never switched (or storage is missing or blocked). */
export function loadLangChoice(store: KeyValueStore | null = platform().storage()): Lang | null {
  try {
    const saved = store?.getItem(STORAGE_KEY);
    return isLang(saved) ? saved : null;
  } catch {
    return null;
  }
}

/** Remembers `choice` for the next launches; without storage it lasts this session only. */
export function saveLangChoice(choice: Lang, store: KeyValueStore | null = platform().storage()): void {
  try {
    store?.setItem(STORAGE_KEY, choice);
  } catch {
    // Ignore: the language still applies to this session.
  }
}

/** The label of a language switch: the language it switches to, written in that language so its readers find it. */
export function langSwitchLabel(): string {
  return tr('English', '中文');
}

/** What a language switch does: the other language, from now on and at the next launches. */
export function switchLang(): void {
  const next: Lang = lang() === 'zh' ? 'en' : 'zh';
  setLang(next);
  saveLangChoice(next);
}
