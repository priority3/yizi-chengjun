// Fonts: a subset of the OFL brush font 马善政 for card glyphs and titles,
// plus the system CJK sans for small UI text and numbers.
import { platform } from '../platform/env.ts';

/** The brush font's family as the web page declares it (index.html @font-face). */
export const BRUSH_FAMILY = 'YzcjBrush';
export const SANS_STACK = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC","Source Han Sans SC",sans-serif';

/**
 * The family brush text is drawn in: BRUSH_FAMILY, or the name the platform loaded the font under.
 * Reason: a mini-game's font loader names the family itself (from the font file) instead of taking one.
 */
let brushFamily = BRUSH_FAMILY;

export function brush(px: number): string {
  return `${px}px ${brushFamily}, ${SANS_STACK}`;
}

export function sans(px: number, weight = 700): string {
  return `${weight} ${px}px ${SANS_STACK}`;
}

/**
 * Loads the brush font through the platform (the web waits for index.html's @font-face) with a timeout; true once
 * brush text can use it. Reason: canvas text only uses a font once it has loaded; drawing earlier silently falls back.
 */
export async function loadFonts(timeoutMs = 2500): Promise<boolean> {
  const family = await platform().loadBrushFont(timeoutMs);
  if (!family) return false;
  brushFamily = family;
  return true;
}
