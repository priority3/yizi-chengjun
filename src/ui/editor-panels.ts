// The map editor's screen furniture (plan.md D1), kept apart from the scene so each file stays small: the top bar with
// 返回 and the live check (road lengths, hpScale and pads, or a red banner while the map doesn't build), the warning
// pill, the hint line, the brush palette, the action buttons, and the 尺寸 and 载入 panels. The rects come from
// editor-layout.ts, which the scene also hit-tests with.
import { CHAPTERS } from '../config/chapters.ts';
import { MAPS } from '../config/maps.ts';
import { fitPx, outlined, roundRect, text } from '../render/draw.ts';
import { drawSwatch } from '../render/editor-draw.ts';
import { drawThumb, thumbRect } from '../render/chapter-card.ts';
import { brush, sans } from '../render/fonts.ts';
import { inRect, L, W, type Rect } from '../render/layout.ts';
import { peekThumb } from '../render/map-thumb.ts';
import { NUMERALS } from '../render/panels.ts';
import { BACK, drawButton, type ButtonStyle } from '../render/widgets.ts';
import type { DraftCheck } from './editor-check.ts';
import {
  ACTIONS,
  actionRect,
  BACK_BTN,
  bottomTop,
  hintRect,
  INFO,
  loadCard,
  mapView,
  PALETTE_SIZE,
  paletteRect,
  PAN_TOOL,
  sizeButtons,
  sizePanel,
  TOP_H,
  type ActionId,
} from './editor-layout.ts';
import { BRUSHES, colsOf, MAX_SIDE, MIN_SIDE, type Draft } from './editor-model.ts';

/** What the scene hands over for one frame of furniture. */
export interface EditorChrome {
  draft: Draft;
  check: DraftCheck;
  /** The draft changed since `check` was made: its figures are a moment old. */
  pending: boolean;
  /** Selected palette entry (PAN_TOOL for the pan tool). */
  tool: number;
  /** Edits 撤销 can take back. */
  undo: number;
  /** The control under a finger that is still down ('back', 'act:clear', 'tool:3', 'size:cols+' ...), or null. */
  pressed: string | null;
  /** Animation clock, seconds. */
  t: number;
}

/** What the hint line says about the pan tool. */
const PAN_HINT = '平移 · 拖动地图；双指或滚轮缩放';

/** The top bar, the warning pill and the bottom panel (hint line, palette, actions). */
export function drawChrome(ctx: CanvasRenderingContext2D, c: EditorChrome): void {
  const bar = ctx.createLinearGradient(0, 0, 0, TOP_H);
  bar.addColorStop(0, 'rgba(42,24,14,0.96)');
  bar.addColorStop(1, 'rgba(42,24,14,0.86)');
  ctx.fillStyle = bar;
  ctx.fillRect(0, 0, W, TOP_H);
  drawButton(ctx, BACK_BTN, '返回', 'ghost', undefined, c.pressed === 'back');
  if (c.check.error) drawError(ctx, c.check.error);
  else drawFigures(ctx, c);
  if (c.check.warnings.length > 0) drawWarning(ctx, c.check.warnings.join('；'));
  const top = bottomTop();
  const panel = ctx.createLinearGradient(0, top, 0, L.H);
  panel.addColorStop(0, 'rgba(48,30,18,0.97)');
  panel.addColorStop(1, 'rgba(30,18,10,0.98)');
  ctx.fillStyle = panel;
  ctx.fillRect(0, top, W, L.H - top);
  ctx.fillStyle = 'rgba(240,194,74,0.55)';
  ctx.fillRect(0, top, W, 1.5);
  const h = hintRect();
  const hint = c.tool === PAN_TOOL ? PAN_HINT : `画笔 · ${BRUSHES[c.tool].hint}`;
  text(ctx, hint, h.x + 4, h.y + h.h / 2, sans(fitPx(ctx, hint, h.w - 8, 11, (n) => sans(n, 600)), 600), '#f3e6c8', 'left');
  drawPalette(ctx, c);
  drawActions(ctx, c);
}

/** The red banner of a map that doesn't build, in place of the figures. */
function drawError(ctx: CanvasRenderingContext2D, msg: string): void {
  const r = INFO;
  roundRect(ctx, r.x, r.y, r.w, r.h, 9);
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, '#c43a2c');
  g.addColorStop(1, '#8e2018');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#ffb0a0';
  ctx.stroke();
  text(ctx, '地图有错，还不能试玩', r.x + 10, r.y + 12, sans(10, 800), '#ffd8cc', 'left');
  text(ctx, msg, r.x + 10, r.y + 28, sans(fitPx(ctx, msg, r.w - 20, 12, (n) => sans(n, 700), 8), 700), '#ffffff', 'left');
}

/**
 * Road lengths (world px, entrance 1 first: the map numbers the entrances) and hpScale on the first line, the pads on
 * the second; dimmed while a fresh check is due.
 */
function drawFigures(ctx: CanvasRenderingContext2D, c: EditorChrome): void {
  const { roads, hpScale, pads } = c.check;
  const r = INFO;
  const knob = c.draft.hp === undefined ? '' : `（含手调 ×${c.draft.hp}）`;
  const line1 = `路程 ${roads.map((l) => Math.round(l)).join(' / ')} · hpScale ${hpScale.toFixed(2)}${knob}`;
  const line2 = `石台 ${pads.open + pads.locked}：开局 ${pads.open} · 待解锁 ${pads.locked} · 特殊 ${pads.special} · 金圈＝覆盖路最多`;
  ctx.save();
  if (c.pending) ctx.globalAlpha = 0.6;
  text(ctx, line1, r.x + 2, r.y + 12, sans(fitPx(ctx, line1, r.w - 4, 12, (n) => sans(n, 700), 8), 700), '#ffe9b0', 'left');
  text(ctx, line2, r.x + 2, r.y + 30, sans(fitPx(ctx, line2, r.w - 4, 11, (n) => sans(n, 600), 8), 600), '#e8d5b0', 'left');
  ctx.restore();
}

/** Things that build but play oddly, on a dark pill at the foot of the map view. */
function drawWarning(ctx: CanvasRenderingContext2D, msg: string): void {
  const v = mapView();
  const label = `注意：${msg}`;
  const px = fitPx(ctx, label, W - 40, 11, (n) => sans(n, 700), 8);
  ctx.font = sans(px, 700);
  const w = Math.min(W - 16, ctx.measureText(label).width + 22);
  roundRect(ctx, (W - w) / 2, v.y + v.h - 30, w, 22, 11);
  ctx.fillStyle = 'rgba(28,14,6,0.88)';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255,200,90,0.8)';
  ctx.stroke();
  text(ctx, label, W / 2, v.y + v.h - 18.5, sans(px, 700), '#ffd27a');
}

/** Swatch side inside a palette entry. */
const SWATCH = 26;

function drawPalette(ctx: CanvasRenderingContext2D, c: EditorChrome): void {
  for (let i = 0; i < PALETTE_SIZE; i++) {
    const r = paletteRect(i);
    const on = i === c.tool;
    const down = c.pressed === `tool:${i}`;
    const x = r.x + (r.w - SWATCH) / 2;
    const y = r.y + 4 + (down ? 1 : 0);
    if (on) {
      roundRect(ctx, r.x + 1, r.y + 1, r.w - 2, r.h - 2, 7);
      ctx.fillStyle = 'rgba(255,214,107,0.2)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffd166';
      ctx.stroke();
    }
    ctx.save();
    roundRect(ctx, x, y, SWATCH, SWATCH, 5);
    ctx.clip();
    if (i === PAN_TOOL) panIcon(ctx, x + SWATCH / 2, y + SWATCH / 2, SWATCH);
    else drawSwatch(ctx, BRUSHES[i].ch, x, y, SWATCH, c.draft.theme);
    if (i < PAN_TOOL && BRUSHES[i].kind === 'erase') eraserIcon(ctx, x + SWATCH / 2, y + SWATCH / 2, SWATCH);
    ctx.restore();
    roundRect(ctx, x, y, SWATCH, SWATCH, 5);
    ctx.lineWidth = 1;
    ctx.strokeStyle = on ? '#ffd166' : 'rgba(255,235,200,0.35)';
    ctx.stroke();
    const label = i === PAN_TOOL ? '平移' : BRUSHES[i].label;
    text(ctx, label, r.x + r.w / 2, r.y + r.h - 7, sans(fitPx(ctx, label, r.w - 2, 10, (n) => sans(n, 700), 7), 700), on ? '#ffe9a8' : '#d8c6a4');
  }
}

/** The pan tool: four arrows out of a dot, on dark ground. */
function panIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  ctx.fillStyle = '#3c2e26';
  ctx.fillRect(cx - s / 2, cy - s / 2, s, s);
  ctx.strokeStyle = '#f7ead0';
  ctx.fillStyle = '#f7ead0';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  const a = s * 0.36;
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + dx * a, cy + dy * a);
    ctx.stroke();
    // Arrow head: a small triangle at the tip.
    ctx.beginPath();
    ctx.moveTo(cx + dx * (a + 2), cy + dy * (a + 2));
    ctx.lineTo(cx + dx * (a - 3) - dy * 3, cy + dy * (a - 3) - dx * 3);
    ctx.lineTo(cx + dx * (a - 3) + dy * 3, cy + dy * (a - 3) + dx * 3);
    ctx.closePath();
    ctx.fill();
  }
}

/** The eraser: a tilted pink-and-white block over the ground swatch. */
function eraserIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.6);
  roundRect(ctx, -s * 0.32, -s * 0.15, s * 0.64, s * 0.3, 3);
  ctx.fillStyle = '#f3a4b4';
  ctx.fill();
  roundRect(ctx, s * 0.06, -s * 0.15, s * 0.26, s * 0.3, 3);
  ctx.fillStyle = '#fbf3e6';
  ctx.fill();
  roundRect(ctx, -s * 0.32, -s * 0.15, s * 0.64, s * 0.3, 3);
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#7a4a4a';
  ctx.stroke();
  ctx.restore();
}

/** Style of each action button: 撤销 greys out with nothing to undo, 试玩 while the map doesn't build. */
function actionStyle(id: ActionId, c: EditorChrome): ButtonStyle {
  if (id === 'undo') return c.undo > 0 ? 'ghost' : 'disabled';
  if (id === 'play') return c.check.map ? 'primary' : 'disabled';
  return id === 'export' || id === 'import' ? 'jade' : 'ghost';
}

function drawActions(ctx: CanvasRenderingContext2D, c: EditorChrome): void {
  ACTIONS.forEach((a, i) => {
    const sub = a.id === 'undo' ? `${c.undo} 步` : a.id === 'size' ? `${colsOf(c.draft)}×${c.draft.rows.length}` : undefined;
    drawButton(ctx, actionRect(i), a.label, actionStyle(a.id, c), sub, c.pressed === `act:${a.id}`);
  });
}

// ---- 尺寸 ---------------------------------------------------------------------------------------------------------

/** The 尺寸 panel over the palette: − / + for the columns and the rows (MIN_SIDE..MAX_SIDE), and 完成. */
export function drawSizePanel(ctx: CanvasRenderingContext2D, d: Draft, pressed: string | null): void {
  const p = sizePanel();
  roundRect(ctx, p.x, p.y, p.w, p.h, 10);
  const g = ctx.createLinearGradient(0, p.y, 0, p.y + p.h);
  g.addColorStop(0, '#fbf1d8');
  g.addColorStop(1, '#ecd8ae');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#b8862c';
  ctx.stroke();
  const b = sizeButtons();
  const sides: Array<[string, number, [Rect, Rect], string]> = [
    ['列', colsOf(d), b.cols, 'cols'],
    ['行', d.rows.length, b.rows, 'rows'],
  ];
  for (const [label, n, [minus, plus], key] of sides) {
    text(ctx, label, minus.x - 14, minus.y + minus.h / 2, sans(14, 800), '#6b1c1c');
    drawButton(ctx, minus, '−', n > MIN_SIDE ? 'ghost' : 'disabled', undefined, pressed === `size:${key}-`);
    text(ctx, String(n), (minus.x + minus.w + plus.x) / 2, minus.y + minus.h / 2 + 1, sans(18, 800), '#3b2a1e');
    drawButton(ctx, plus, '+', n < MAX_SIDE ? 'ghost' : 'disabled', undefined, pressed === `size:${key}+`);
  }
  text(ctx, `${MIN_SIDE}～${MAX_SIDE} 格；列在右边、行在下边加减`, p.x + 12, b.done.y + b.done.h / 2, sans(10, 600), '#7a6248', 'left');
  drawButton(ctx, b.done, '完成', 'primary', undefined, pressed === 'size:done');
}

// ---- 载入 ---------------------------------------------------------------------------------------------------------

/** The 载入 panel: the ten chapter maps as cards with their thumbnails (painted a few per frame by the scene). */
export function drawLoadPanel(ctx: CanvasRenderingContext2D, pixelRatio: number, t: number, pressed: string | null): void {
  ctx.fillStyle = 'rgba(20,10,4,0.9)';
  ctx.fillRect(0, 0, W, L.H);
  drawButton(ctx, BACK, '取消', 'ghost', undefined, pressed === 'load:cancel');
  outlined(ctx, '载入章节地图', W / 2, 33, brush(24), '#ffd66b', 'rgba(40,14,4,0.9)', 4);
  CHAPTERS.forEach((ch, i) => {
    const r = loadCard(i);
    const dy = pressed === `load:${i}` ? 2 : 0;
    roundRect(ctx, r.x, r.y + dy, r.w, r.h, 12);
    const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    g.addColorStop(0, '#f8edd4');
    g.addColorStop(1, '#ead5aa');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#b8862c';
    ctx.stroke();
    const tr = thumbRect(r);
    const thumb = peekThumb(ch.id, tr.w, tr.h, pixelRatio);
    drawThumb(ctx, { ...tr, y: tr.y + dy }, { chapter: ch.id, open: true, thumb, fade: 1, t });
    const x = tr.x + tr.w + 8;
    const w = r.x + r.w - 7 - x;
    const rows = MAPS[i].rows;
    text(ctx, `第${NUMERALS[i]}章`, x, r.y + dy + r.h * 0.22, brush(15), '#8a3a22', 'left');
    text(ctx, ch.name, x, r.y + dy + r.h * 0.5, brush(fitPx(ctx, ch.name, w, 22, brush)), '#3b2a1e', 'left');
    text(ctx, `${Math.max(...rows.map((row) => row.length))}×${rows.length}`, x, r.y + dy + r.h * 0.78, sans(11, 700), '#7a6248', 'left');
  });
  text(ctx, '载入会换掉现在的草稿，可以撤销', W / 2, L.H - 22, sans(11, 600), '#b9a585');
}

/** Which 载入 control a point is on: a chapter card (index), 'cancel', or null. */
export function loadPanelHit(x: number, y: number): number | 'cancel' | null {
  if (inRect(x, y, BACK)) return 'cancel';
  const i = CHAPTERS.findIndex((_, k) => inRect(x, y, loadCard(k)));
  return i >= 0 ? i : null;
}
