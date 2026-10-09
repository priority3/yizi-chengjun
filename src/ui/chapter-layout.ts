// Layout of the chapter screen, in design units: the 2 x 5 grid of chapter cards and, once the daily challenge is
// open, a row with the 每日挑战 and 无尽 entries under it — all above the two hint lines at the bottom of the screen.
// Pure (no drawing), so the fit at every design height is unit-tested.
import { L, type Rect } from '../render/layout.ts';

/** Height of the entry row. */
export const ENTRY_H = 56;
/** The two hint lines at the bottom (centred at L.H - 38 and L.H - 22, 10 px text) start this far above the bottom. */
export const HINTS_TOP = 44;
/** Gap between grid rows, between the grid and the entry row, and between that row and the hints. */
const GAP = 10;

/**
 * Card `i` of the 2 x 5 grid.
 * Reason: 92 high at the shortest design height and up to 112 on tall phones, so the map thumbnails get the room;
 * with the entry row on screen the cards give up just enough height (to 81..107) for the row to fit above the hints.
 */
export function chapterRect(i: number, entries: boolean): Rect {
  const col = i % 2;
  const row = Math.floor(i / 2);
  const extra = Math.max(0, L.H - 640);
  const top = Math.round(72 + extra * 0.2);
  let h = Math.round(92 + extra * 0.125);
  if (entries) h = Math.min(h, Math.floor((entryRect(0).y - GAP - top - 4 * GAP) / 5));
  return { x: 14 + col * 172, y: top + row * (h + GAP), w: 160, h };
}

/** Entry `i` of the row under the grid: 0 = 每日挑战 on the left, 1 = 无尽 on the right. */
export function entryRect(i: number): Rect {
  return { x: 14 + i * 172, y: L.H - HINTS_TOP - GAP - ENTRY_H, w: 160, h: ENTRY_H };
}
