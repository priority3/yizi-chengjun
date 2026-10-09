// Fonts: a subset of the OFL brush font 马善政 for card glyphs and titles,
// plus the system CJK sans for small UI text and numbers.

export const BRUSH_FAMILY = 'YzcjBrush';
export const SANS_STACK = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC","Source Han Sans SC",sans-serif';

export function brush(px: number): string {
  return `${px}px ${BRUSH_FAMILY}, ${SANS_STACK}`;
}

export function sans(px: number, weight = 700): string {
  return `${weight} ${px}px ${SANS_STACK}`;
}

/**
 * Waits for the brush font (declared in index.html) with a timeout.
 * Reason: canvas text only uses a web font once it has loaded; drawing earlier silently falls back.
 */
export async function loadFonts(timeoutMs = 2500): Promise<boolean> {
  if (!('fonts' in document)) return false;
  try {
    await Promise.race([
      document.fonts.load(`40px ${BRUSH_FAMILY}`, '一字成军'),
      new Promise((resolve) => setTimeout(resolve, timeoutMs)),
    ]);
    return document.fonts.check(`40px ${BRUSH_FAMILY}`, '字');
  } catch {
    return false;
  }
}
