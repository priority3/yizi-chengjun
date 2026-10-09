// The map editor's text formats (plan.md D1): 导出 writes the rows as a TypeScript array laid out exactly like
// config/maps.ts, 导入 reads that back (or bare rows, or a whole maps.ts entry), and the draft is kept as JSON in
// the platform's storage. Pure: the storage is passed in, so tests use an in-memory one.
import type { MapTheme } from '../config/maps.ts';
import { clampSide, colsOf, GROUND, LEGEND, makeDraft, MAP_THEMES, MAX_SIDE, MIN_SIDE, resize, type Draft } from './editor-model.ts';

/** Indentation of a row inside a map entry of config/maps.ts, and of the bracket that closes the rows. */
const ROW_INDENT = ' '.repeat(6);
const CLOSE_INDENT = ' '.repeat(4);

/**
 * 导出: the rows as a TypeScript array literal, laid out like config/maps.ts. Select the `[ … ]` after a map's
 * `rows:` there and paste this over it; the result reads exactly like the hand-written maps.
 */
export function exportRows(d: Draft): string {
  return `[\n${d.rows.map((row) => `${ROW_INDENT}'${row}',`).join('\n')}\n${CLOSE_INDENT}]`;
}

/** What a paste was read as: rows (plus the theme and HP tuning when a whole maps.ts entry was pasted), or why not. */
export type Paste = { rows: string[]; theme?: MapTheme; hp?: number } | { error: string };

/** Quoted strings: the rows of an exported array, whatever quotes and separators surround them. */
const QUOTED = /'([^'\n]*)'|"([^"\n]*)"|`([^`\n]*)`/g;
/** `theme: 'ridge'` and `hp: 1.55` of a whole maps.ts entry. */
const THEME_FIELD = /\btheme\s*:\s*(['"`])(\w+)\1/;
const HP_FIELD = /\bhp\s*:\s*(\d+(?:\.\d+)?)/;

const isTheme = (s: unknown): s is MapTheme => MAP_THEMES.some((t) => t === s);

/**
 * Reads pasted map rows: the exported array (also after a one-line prompt swallowed its line breaks — the quotes
 * still tell the rows apart), a whole `{ theme, hp, rows }` entry from config/maps.ts, or bare rows separated by line
 * breaks, spaces or commas. Short rows are padded with plain ground.
 */
export function parsePaste(text: string): Paste {
  const theme = THEME_FIELD.exec(text);
  const hp = HP_FIELD.exec(text);
  // Reason: the theme is a quoted string too; take it out before collecting the quoted rows.
  const body = theme ? text.replace(theme[0], '') : text;
  const quoted = [...body.matchAll(QUOTED)].map((m) => m[1] ?? m[2] ?? m[3]);
  const rows = quoted.length > 0 ? quoted : body.split(/[\s,;]+/).filter((s) => s.length > 0);
  if (rows.length === 0) return { error: '没读到地图：粘贴「导出」的数组，或一行一行的地图字符' };
  const bad = [...rows.join('')].find((ch) => !LEGEND.has(ch));
  if (bad !== undefined) return { error: `不认识的字符「${bad}」：地图里只能用图例的字符` };
  const cols = Math.max(...rows.map((r) => r.length));
  if (rows.length === 1 && cols > MAX_SIDE) return { error: '粘贴的地图连成了一整行：请粘贴「导出」的带引号数组' };
  if (cols > MAX_SIDE || rows.length > MAX_SIDE) return { error: `地图最大 ${MAX_SIDE}×${MAX_SIDE}，粘贴的是 ${cols}×${rows.length}` };
  const out: { rows: string[]; theme?: MapTheme; hp?: number } = { rows: rows.map((r) => r.padEnd(cols, GROUND)) };
  if (theme && isTheme(theme[2])) out.theme = theme[2];
  const knob = hp ? Number(hp[1]) : NaN;
  if (knob > 0 && Number.isFinite(knob)) out.hp = knob;
  return out;
}

/**
 * 导入: the pasted map as the new draft, at least MIN_SIDE squares each way (padded with plain ground). Bare rows
 * keep the current theme and HP tuning, so an exported chapter map comes back exactly; a pasted maps.ts entry
 * brings its own.
 */
export function importDraft(text: string, current: Draft): Draft | { error: string } {
  const p = parsePaste(text);
  if ('error' in p) return p;
  const whole = p.theme !== undefined || p.hp !== undefined;
  const d = makeDraft(p.theme ?? current.theme, p.rows, whole ? p.hp : current.hp);
  return resize(d, Math.max(colsOf(d), MIN_SIDE), Math.max(d.rows.length, MIN_SIDE));
}

// ---- 草稿 (the platform's storage) ---------------------------------------------------------------------------------

/** Where the draft is kept. */
export const DRAFT_KEY = 'yzcj:editor';
/** Where the draft was kept before the game was renamed 一字成军 (zdxy = 字斗西游); read when DRAFT_KEY is empty. */
export const LEGACY_DRAFT_KEY = 'zdxy:editor';

/** The slice of the Web Storage API the draft uses (tests pass an in-memory one). */
export interface DraftStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Keeps the draft; false when there is no storage or it refused (quota, private mode). */
export function saveDraft(d: Draft, store: DraftStore | null): boolean {
  if (!store) return false;
  try {
    store.setItem(DRAFT_KEY, JSON.stringify(d));
    return true;
  } catch {
    return false;
  }
}

/** The kept draft, or null when there is none or it doesn't read back as one. Never throws. */
export function loadDraft(store: DraftStore | null): Draft | null {
  try {
    return parseDraft(store?.getItem(DRAFT_KEY) ?? store?.getItem(LEGACY_DRAFT_KEY) ?? null);
  } catch {
    return null;
  }
}

/**
 * A draft from its JSON, checked like anything else from storage: a known theme, MIN_SIDE..MAX_SIDE equally wide
 * rows of legend characters, an optional positive HP tuning. Null for anything else; throws only on broken JSON.
 */
export function parseDraft(raw: string | null): Draft | null {
  if (!raw) return null;
  const data = JSON.parse(raw) as { theme?: unknown; hp?: unknown; rows?: unknown } | null;
  if (!data || typeof data !== 'object' || !isTheme(data.theme) || !Array.isArray(data.rows)) return null;
  const rows = data.rows as unknown[];
  if (!rows.every((r): r is string => typeof r === 'string')) return null;
  const cols = rows[0]?.length ?? 0;
  if (clampSide(rows.length) !== rows.length || clampSide(cols) !== cols) return null;
  if (!rows.every((r) => r.length === cols && [...r].every((ch) => LEGEND.has(ch)))) return null;
  const hp = typeof data.hp === 'number' && Number.isFinite(data.hp) && data.hp > 0 ? data.hp : undefined;
  return makeDraft(data.theme, rows, hp);
}
