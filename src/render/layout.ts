// Screen layout in design units (360x640 portrait) and the board <-> screen mapping.
import { CELL_SLOT, COLS, ROWS, SLOT_CELLS, type Pt } from '../core/board.ts';
import type { SideId } from '../core/types.ts';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const W = 360;
export const H = 640;
export const CELL = 48;
export const BOARD_X = 12;
export const BOARD_W = COLS * CELL;
export const BOARD_H = ROWS * CELL;
/** Screen y where each board meets the centre bar. */
export const AI_EDGE = 304;
export const P_EDGE = 336;

export const AI_HUD: Rect = { x: 0, y: 0, w: W, h: AI_EDGE - BOARD_H };
export const MID_BAR: Rect = { x: 0, y: AI_EDGE, w: W, h: P_EDGE - AI_EDGE };
export const P_HUD: Rect = { x: 0, y: P_EDGE + BOARD_H, w: W, h: H - P_EDGE - BOARD_H };

export const BTN_RECRUIT: Rect = { x: 214, y: 584, w: 134, h: 48 };
export const BTN_SPEED: Rect = { x: 272, y: 307, w: 38, h: 26 };
export const BTN_PAUSE: Rect = { x: 316, y: 307, w: 36, h: 26 };

/** Board coordinates (cell units, y measured from the centre bar) -> screen design coordinates. */
export function toScreen(side: SideId, x: number, y: number, out: Pt = { x: 0, y: 0 }): Pt {
  out.x = BOARD_X + x * CELL;
  // Reason: the AI board is mirrored vertically so both roads flow outward from the shared 妖洞 in the centre bar.
  out.y = side === 0 ? P_EDGE + y * CELL : AI_EDGE - y * CELL;
  return out;
}

/** Screen rectangle of a board cell. */
export function cellRect(side: SideId, row: number, col: number): Rect {
  const y = side === 0 ? P_EDGE + row * CELL : AI_EDGE - (row + 1) * CELL;
  return { x: BOARD_X + col * CELL, y, w: CELL, h: CELL };
}

export function slotRect(side: SideId, slot: number): Rect {
  const [r, c] = SLOT_CELLS[slot];
  return cellRect(side, r, c);
}

/** Player-board slot under a screen point, or -1 (outside the board or on the road). */
export function hitPlayerSlot(px: number, py: number): number {
  const col = Math.floor((px - BOARD_X) / CELL);
  const row = Math.floor((py - P_EDGE) / CELL);
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return -1;
  return CELL_SLOT[row * COLS + col];
}

export function inRect(x: number, y: number, r: Rect): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

/** Where each side's 唐僧 stands, just past the end of its road. */
export const TANG_POS: readonly Pt[] = [toScreen(0, 1.5, 5.3), toScreen(1, 1.5, 5.3)];
/** The shared 妖洞 where both roads begin. */
export const PORTAL_POS: Pt = { x: BOARD_X + 1.5 * CELL, y: AI_EDGE + (P_EDGE - AI_EDGE) / 2 };
