// Layout of the title screen, in design units: the 继续上次 / 开始游戏 buttons, the two hint lines under them, the
// faint version label at the bottom right and the 关于 button at the top right (the 有新版本 banner at the bottom is
// render/update-banner.ts). Pure (no drawing), so tests/title-layout.test.ts checks at every design height that the
// 关于 button stays on screen and clear of everything else.
import { L, W, type Rect } from '../render/layout.ts';

/**
 * 开始游戏. Reason: with a saved run, 继续上次 sits on top and a smaller 开始游戏 just below it; both stay between the
 * hero portraits and the two hint lines at every design height (640..800).
 */
export function startButton(hasRun: boolean): Rect {
  return hasRun ? { x: 90, y: L.H * 0.66 + 14, w: 180, h: 44 } : { x: 90, y: L.H * 0.66, w: 180, h: 56 };
}

/** 继续上次, above 开始游戏 while an unfinished run is saved. */
export function continueButton(): Rect {
  return { x: 90, y: L.H * 0.66 - 52, w: 180, h: 56 };
}

/** Centre heights of the two hint lines under the buttons (11 px text). */
export function hintRows(): [number, number] {
  return [L.H * 0.66 + 82, L.H * 0.66 + 100];
}

/** Where the version label is drawn: its right end and the centre of its 9 px line. */
export function versionAnchor(): { x: number; y: number } {
  return { x: W - 8, y: L.H - 9 };
}

/**
 * The 关于 button, mirroring the menus' 返回 (top left) at the top right.
 * Reason: up there it is far from everything the bottom half holds (the buttons, the hints, the version label and
 * the update banner) at every design height, and well above the glow of the game's name.
 */
export const ABOUT_BUTTON: Rect = { x: W - 78, y: 16, w: 66, h: 34 };
