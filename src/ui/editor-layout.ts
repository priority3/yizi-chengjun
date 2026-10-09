// Layout of the map editor in design units: the top bar (返回 and the live check), the map viewport, then at the
// bottom the hint line, the brush palette and the row of action buttons; plus the 尺寸 panel (over the palette) and
// the 载入 panel (the chapter screen's card grid). Pure (no drawing), so the fit at every design height is unit-tested.
import { L, W, type Rect } from '../render/layout.ts';
import { chapterRect } from './chapter-layout.ts';
import { BRUSHES } from './editor-model.ts';

/** Height of the top bar. */
export const TOP_H = 50;
/** 返回, top left. */
export const BACK_BTN: Rect = { x: 6, y: 9, w: 56, h: 32 };
/** The live check right of 返回: two lines of figures, or the red banner of a map that doesn't build. */
export const INFO: Rect = { x: 68, y: 5, w: W - 74, h: 40 };

/** Palette entries: every brush, then the pan tool. */
export const PALETTE_SIZE = BRUSHES.length + 1;
/** Palette index of the pan tool. */
export const PAN_TOOL = BRUSHES.length;
/** Palette entries per row. */
export const PALETTE_COLS = 10;

const MARGIN = 6;
const CELL_H = 44;
const HINT_H = 18;
const ACTION_H = 38;
const ACTION_GAP = 4;

export type ActionId = 'undo' | 'clear' | 'size' | 'load' | 'export' | 'import' | 'play';

/** The action buttons, left to right. */
export const ACTIONS: ReadonlyArray<{ id: ActionId; label: string }> = [
  { id: 'undo', label: '撤销' },
  { id: 'clear', label: '清空' },
  { id: 'size', label: '尺寸' },
  { id: 'load', label: '载入' },
  { id: 'export', label: '导出' },
  { id: 'import', label: '导入' },
  { id: 'play', label: '试玩' },
];

/** Rows of the palette. */
export function paletteRows(): number {
  return Math.ceil(PALETTE_SIZE / PALETTE_COLS);
}

/** Top of the bottom panel (hint line, palette, actions). */
export function bottomTop(): number {
  return L.H - (MARGIN + ACTION_H + MARGIN + paletteRows() * CELL_H + HINT_H + 4);
}

/** The part of the screen that shows the map. */
export function mapView(): Rect {
  return { x: 0, y: TOP_H, w: W, h: bottomTop() - TOP_H };
}

/** The line naming the selected brush, at the top of the bottom panel. */
export function hintRect(): Rect {
  return { x: MARGIN, y: bottomTop() + 4, w: W - 2 * MARGIN, h: HINT_H };
}

/** The whole palette. */
export function paletteArea(): Rect {
  return { x: MARGIN, y: bottomTop() + 4 + HINT_H, w: W - 2 * MARGIN, h: paletteRows() * CELL_H };
}

/** Palette entry `i` (row-major). */
export function paletteRect(i: number): Rect {
  const a = paletteArea();
  const w = a.w / PALETTE_COLS;
  return { x: a.x + (i % PALETTE_COLS) * w, y: a.y + Math.floor(i / PALETTE_COLS) * CELL_H, w, h: CELL_H };
}

/** Action button `i` of ACTIONS. */
export function actionRect(i: number): Rect {
  const w = (W - 2 * MARGIN - (ACTIONS.length - 1) * ACTION_GAP) / ACTIONS.length;
  return { x: MARGIN + i * (w + ACTION_GAP), y: L.H - MARGIN - ACTION_H, w, h: ACTION_H };
}

/** The 尺寸 panel: it covers the palette while open. */
export function sizePanel(): Rect {
  return paletteArea();
}

/** The 尺寸 panel's buttons: − and + for the columns and for the rows, and 完成. */
export function sizeButtons(): { cols: [Rect, Rect]; rows: [Rect, Rect]; done: Rect } {
  const p = sizePanel();
  const pair = (x0: number): [Rect, Rect] => [
    { x: x0 + 28, y: p.y + 8, w: 40, h: 34 },
    { x: x0 + 108, y: p.y + 8, w: 40, h: 34 },
  ];
  return { cols: pair(p.x), rows: pair(p.x + p.w / 2), done: { x: p.x + p.w - 92, y: p.y + p.h - 40, w: 84, h: 32 } };
}

/** Chapter `i`'s card on the 载入 panel: where the chapter screen puts it (so their thumbnails are shared). */
export function loadCard(i: number): Rect {
  return chapterRect(i, false);
}
