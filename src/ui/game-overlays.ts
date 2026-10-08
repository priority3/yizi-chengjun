// Pause and result panels of the chapter screen (kept apart from the scene so each file stays small).
import { CHAPTERS } from '../config/chapters.ts';
import { ENEMIES } from '../config/enemies.ts';
import { effectText, type ClearRewards } from '../core/treasures.ts';
import type { GameState } from '../core/types.ts';
import { text } from '../render/draw.ts';
import { brush, sans } from '../render/fonts.ts';
import { inRect, L, W, type Rect } from '../render/layout.ts';
import { drawStone, drawTreasureToken } from '../render/treasure-art.ts';
import { drawButton, drawPanel } from '../render/widgets.ts';
import type { Pointer } from './input.ts';

export interface OverlayButton {
  label: string;
  go: () => void;
}

const BUTTON_H = 42;
const BUTTON_GAP = 10;

function panelRect(h: number): Rect {
  return { x: 36, y: L.H / 2 - h / 2, w: W - 72, h };
}

/** Button rows stacked at the bottom of a panel. */
function panelButtons(p: Rect, n: number): Rect[] {
  const y0 = p.y + p.h - 26 - n * (BUTTON_H + BUTTON_GAP) + BUTTON_GAP;
  return Array.from({ length: n }, (_, i) => ({ x: p.x + 34, y: y0 + i * (BUTTON_H + BUTTON_GAP), w: p.w - 68, h: BUTTON_H }));
}

export function tapButtons(p: Pointer, panel: Rect, buttons: readonly OverlayButton[]): void {
  const rects = panelButtons(panel, buttons.length);
  buttons.forEach((b, i) => {
    if (inRect(p.x, p.y, rects[i])) b.go();
  });
}

function drawButtons(ctx: CanvasRenderingContext2D, panel: Rect, buttons: readonly OverlayButton[]): void {
  const rects = panelButtons(panel, buttons.length);
  buttons.forEach((b, i) => drawButton(ctx, rects[i], b.label, i === 0 ? 'primary' : 'ghost'));
}

export function pausePanel(): Rect {
  return panelRect(300);
}

export function drawPause(ctx: CanvasRenderingContext2D, buttons: readonly OverlayButton[]): void {
  const r = pausePanel();
  drawPanel(ctx, r);
  text(ctx, '暂停', W / 2, r.y + 52, brush(34), '#6b1c1c');
  text(ctx, '妖怪也在原地等你', W / 2, r.y + 94, sans(13, 500), '#7a6248');
  drawButtons(ctx, r, buttons);
}

export interface ResultInfo {
  g: GameState;
  chapter: number;
  /** Rewards banked for this clear (null after a loss). */
  rewards: ClearRewards | null;
}

export function resultPanel(info: ResultInfo): Rect {
  return panelRect(info.g.phase === 'won' ? 400 : 330);
}

function drawRewards(ctx: CanvasRenderingContext2D, r: Rect, rw: ClearRewards): void {
  const y = r.y + 150;
  drawStone(ctx, W / 2 - 44, y, 9);
  text(ctx, `灵石 +${rw.stones}`, W / 2 - 30, y + 1, sans(14, 800), '#1b7a5a', 'left');
  if (rw.treasure) {
    drawTreasureToken(ctx, rw.treasure, 1, r.x + 50, y + 42, 20);
    text(ctx, `首通法宝 · ${rw.treasure}`, r.x + 80, y + 33, sans(12, 800), '#8a3a22', 'left');
    text(ctx, effectText(rw.treasure, 1), r.x + 80, y + 52, sans(10, 600), '#6a4a26', 'left');
  } else {
    text(ctx, '法宝在选章页「法宝」用灵石炼器', W / 2, y + 36, sans(10, 600), '#7a6248');
  }
}

export function drawResult(ctx: CanvasRenderingContext2D, info: ResultInfo, buttons: readonly OverlayButton[]): void {
  const { g, chapter, rewards } = info;
  const r = resultPanel(info);
  const ch = CHAPTERS[chapter - 1];
  const won = g.phase === 'won';
  drawPanel(ctx, r);
  const title = won ? (chapter === CHAPTERS.length ? '取得真经！' : '章节通关！') : '阵地失守';
  text(ctx, title, W / 2, r.y + 46, brush(34), won ? '#b3261e' : '#4a3a2e');
  const sub = won ? `打败了${ENEMIES[ch.boss].name}` : `坚持到第 ${g.wave}/${g.totalWaves} 波`;
  text(ctx, sub, W / 2, r.y + 88, sans(14, 600), '#6a4a26');
  const stats = won ? `击杀 ${g.kills} · 阵地剩余 ${Math.ceil(g.campHp)}/${g.campMax}` : '多合成、多解锁格子；法宝页能炼器变强';
  text(ctx, stats, W / 2, r.y + 116, sans(won ? 12 : 11, 500), '#7a6248');
  if (won && rewards) drawRewards(ctx, r, rewards);
  drawButtons(ctx, r, buttons);
}
