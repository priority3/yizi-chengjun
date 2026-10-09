// Browser glue of the map editor (plan.md D1): the #editor address it opens from (it has no button), and the
// clipboard and window.prompt behind 导出 / 导入 — the only DOM it touches; the editor itself is drawn on the canvas.

/** The address fragment that opens the map editor. */
export const EDITOR_HASH = '#editor';

/** Whether the page's address asks for the map editor. */
export function wantsEditor(): boolean {
  return location.hash === EDITOR_HASH;
}

/**
 * Drops #editor from the address without a reload or a new history entry (no hashchange either), so that typing it
 * again later opens the editor again.
 */
export function leaveEditorAddress(): void {
  try {
    if (wantsEditor()) history.replaceState(history.state, '', location.pathname + location.search);
  } catch {
    // Some embedded browsers refuse replaceState: the address just keeps its #editor.
  }
}

/**
 * Copies `text` to the clipboard. False when the browser has no clipboard API (an http:// address on the LAN, old
 * in-app browsers) or refuses it; the caller then shows the text in a prompt instead.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** window.prompt: what was typed or pasted, or null when it was cancelled (or the browser has no prompt). */
export function askText(message: string, initial = ''): string | null {
  try {
    return window.prompt(message, initial);
  } catch {
    return null;
  }
}
