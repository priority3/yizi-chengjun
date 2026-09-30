// Draws one match frame: cached static background, tiles, enemies, effects and both HUDs.
import { START_HEARTS } from '../config/levels.ts';
import { PATH_POINTS, SLOT_CELLS, SLOT_COUNT, SLOT_POS, type Pt } from '../core/board.ts';
import type { MatchState, RecruitResult, SideId } from '../core/types.ts';
import type { Stage } from '../platform/web.ts';
import { drawBubble, drawButton } from '../ui/hud.ts';
import { COLORS, drawEnemy, drawHeart, drawTile, drawToken, roundRect, text } from './draw.ts';
import type { Effects } from './effects.ts';
import {
  AI_EDGE,
  AI_HUD,
  BOARD_H,
  BOARD_W,
  BOARD_X,
  BTN_PAUSE,
  BTN_RECRUIT,
  BTN_SPEED,
  CELL,
  cellRect,
  H,
  MID_BAR,
  P_EDGE,
  P_HUD,
  PORTAL_POS,
  slotRect,
  TANG_POS,
  toScreen,
  W,
} from './layout.ts';

export const TILE_SIZE = 42;

/** UI state the renderer needs besides the simulation itself. */
export interface MatchUi {
  drag: { from: number; x: number; y: number } | null;
  /** Slot under the dragged tile, 'sell' over the sell zone, or -1. */
  dropTarget: number | 'sell';
  recruitState: RecruitResult;
  recruitCost: number;
  sellValue: number;
  speed: number;
  taunt: string | null;
  pressed: 'recruit' | 'speed' | 'pause' | null;
  levelName: string;
}

function strokePath(g: CanvasRenderingContext2D, pts: Pt[], width: number, color: string): void {
  g.beginPath();
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
  g.lineWidth = width;
  g.strokeStyle = color;
  g.stroke();
}

function drawBoardBackground(g: CanvasRenderingContext2D, side: SideId): void {
  const top = side === 0 ? P_EDGE : AI_EDGE - BOARD_H;
  g.fillStyle = side === 0 ? COLORS.paper : COLORS.paperAi;
  g.fillRect(BOARD_X - 6, top, BOARD_W + 12, BOARD_H);
  for (let i = 0; i < SLOT_COUNT; i++) {
    const [r, c] = SLOT_CELLS[i];
    const rc = cellRect(side, r, c);
    g.fillStyle = 'rgba(120,90,50,0.08)';
    roundRect(g, rc.x + 3, rc.y + 3, rc.w - 6, rc.h - 6, 7);
    g.fill();
  }
  const pts = PATH_POINTS.map(([x, y]) => toScreen(side, x, y));
  g.lineCap = 'round';
  g.lineJoin = 'round';
  strokePath(g, pts, CELL * 0.8, COLORS.roadEdge);
  strokePath(g, pts, CELL * 0.68, COLORS.road);
  g.setLineDash([6, 8]);
  strokePath(g, pts, 2, COLORS.roadLine);
  g.setLineDash([]);
}

/** Everything that never changes during a match, rendered once at device resolution. */
function buildBackground(pr: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.ceil(W * pr);
  c.height = Math.ceil(H * pr);
  const g = c.getContext('2d');
  if (!g) throw new Error('Canvas 2D is not supported in this browser');
  g.setTransform(pr, 0, 0, pr, 0, 0);
  g.fillStyle = COLORS.bg;
  g.fillRect(0, 0, W, H);
  for (const r of [AI_HUD, P_HUD]) {
    g.fillStyle = COLORS.hud;
    g.fillRect(r.x, r.y, r.w, r.h);
  }
  drawBoardBackground(g, 1);
  drawBoardBackground(g, 0);
  g.fillStyle = COLORS.bar;
  g.fillRect(MID_BAR.x, MID_BAR.y, MID_BAR.w, MID_BAR.h);
  g.fillStyle = COLORS.barEdge;
  g.fillRect(0, MID_BAR.y, W, 2);
  g.fillRect(0, MID_BAR.y + MID_BAR.h - 2, W, 2);
  drawToken(g, '洞', PORTAL_POS.x, PORTAL_POS.y, 12, '#240808', '#c8962c', '#ffcf66');
  return c;
}

export class MatchRenderer {
  private readonly stage: Stage;
  private bg: HTMLCanvasElement | null = null;
  private bgRatio = 0;

  constructor(stage: Stage) {
    this.stage = stage;
  }

  draw(ctx: CanvasRenderingContext2D, m: MatchState, ui: MatchUi, fx: Effects): void {
    const pr = this.stage.pixelRatio;
    if (!this.bg || this.bgRatio !== pr) {
      this.bg = buildBackground(pr);
      this.bgRatio = pr;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.bg, 0, 0);
    ctx.setTransform(pr, 0, 0, pr, 0, 0);

    this.drawTiles(ctx, m, ui, fx);
    if (ui.drag && typeof ui.dropTarget === 'number' && ui.dropTarget >= 0 && ui.dropTarget !== ui.drag.from) {
      const r = slotRect(0, ui.dropTarget);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      roundRect(ctx, r.x + 1, r.y + 1, r.w - 2, r.h - 2, 9);
      ctx.stroke();
    }
    for (const side of [0, 1] as const) {
      for (const e of m.sides[side].enemies) {
        const p = toScreen(side, e.x, e.y);
        drawEnemy(ctx, e, p.x, p.y);
      }
    }
    fx.drawWorld(ctx);
    this.drawAiHud(ctx, m, ui, fx);
    this.drawMidBar(ctx, m, ui);
    this.drawPlayerHud(ctx, m, ui, fx);
    if (ui.drag) {
      const t = m.sides[0].slots[ui.drag.from];
      if (t) {
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.45)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 4;
        drawTile(ctx, t, ui.drag.x, ui.drag.y, TILE_SIZE * 1.12);
        ctx.restore();
      }
    }
    fx.drawOverlay(ctx);
  }

  private drawTiles(ctx: CanvasRenderingContext2D, m: MatchState, ui: MatchUi, fx: Effects): void {
    for (const side of [0, 1] as const) {
      const slots = m.sides[side].slots;
      for (let i = 0; i < SLOT_COUNT; i++) {
        const t = slots[i];
        if (!t) continue;
        const p = toScreen(side, SLOT_POS[i].x, SLOT_POS[i].y);
        const pop = fx.pops[side][i];
        const shake = side === 0 ? fx.shakes[i] : 0;
        const x = p.x + (shake > 0 ? Math.sin(shake * 70) * 3 : 0);
        const dragging = side === 0 && ui.drag?.from === i;
        drawTile(ctx, t, x, p.y, TILE_SIZE * (1 + pop * 0.8), dragging ? 0.3 : 1);
      }
    }
  }

  private drawTang(ctx: CanvasRenderingContext2D, side: SideId, hearts: number, fx: Effects): void {
    const p = TANG_POS[side];
    const flash = fx.tangFlash[side] > 0;
    drawToken(ctx, '唐', p.x, p.y, 13, flash ? '#b3261e' : '#f6e7c1', '#c8962c', flash ? '#ffffff' : '#7a2d10');
    for (let i = 0; i < START_HEARTS; i++) drawHeart(ctx, p.x + 28 + i * 17, p.y, 14, i < hearts);
  }

  private drawAiHud(ctx: CanvasRenderingContext2D, m: MatchState, ui: MatchUi, fx: Effects): void {
    const ai = m.sides[1];
    this.drawTang(ctx, 1, ai.hearts, fx);
    text(ctx, ui.levelName, 12, 13, 11, COLORS.dim, 'left', 500);
    drawToken(ctx, '猴', 330, 32, 18, '#4a3a12', '#e0b040', '#ffe08a');
    text(ctx, '六耳猕猴', 304, 22, 13, COLORS.hudText, 'right');
    text(ctx, `功德 ${ai.gongde}`, 304, 42, 11, COLORS.dim, 'right', 500);
    if (ui.taunt) drawBubble(ctx, 244, 32, ui.taunt);
  }

  private drawMidBar(ctx: CanvasRenderingContext2D, m: MatchState, ui: MatchUi): void {
    const secs = Math.max(0, Math.ceil((m.nextWaveAt - m.tick) / 60));
    let label: string;
    if (m.phase === 'prep') label = `准备 · ${secs} 秒后出怪`;
    else if (m.phase === 'overtime') label = `加时 第 ${m.overtime} 波 · ${secs}s`;
    else if (m.wave >= 10) label = `最后一波 · ${secs}s 后加时`;
    else label = `第 ${m.wave}/10 波 · ${secs}s`;
    text(ctx, label, 186, 320, 13, COLORS.barText);
    drawButton(ctx, BTN_SPEED, ui.speed === 2 ? '×2' : '×1', ui.speed === 2 ? 'primary' : 'ghost', undefined, ui.pressed === 'speed');
    drawButton(ctx, BTN_PAUSE, 'Ⅱ', 'ghost', undefined, ui.pressed === 'pause');
  }

  private drawPlayerHud(ctx: CanvasRenderingContext2D, m: MatchState, ui: MatchUi, fx: Effects): void {
    const me = m.sides[0];
    this.drawTang(ctx, 0, me.hearts, fx);
    text(ctx, '功德', 20, 622, 12, COLORS.dim, 'left', 500);
    text(ctx, String(me.gongde), 50, 622, 18, COLORS.gold, 'left');
    if (ui.drag) {
      const over = ui.dropTarget === 'sell';
      drawButton(ctx, BTN_RECRUIT, '卖出', 'danger', `拖到这里 +${ui.sellValue} 功德`, over);
      if (over) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        roundRect(ctx, BTN_RECRUIT.x - 3, BTN_RECRUIT.y - 3, BTN_RECRUIT.w + 6, BTN_RECRUIT.h + 6, 12);
        ctx.stroke();
      }
      return;
    }
    const sub =
      ui.recruitState === 'full' ? '格子满了' : ui.recruitState === 'poor' ? `需 ${ui.recruitCost} 功德` : `${ui.recruitCost} 功德`;
    drawButton(ctx, BTN_RECRUIT, '化缘', ui.recruitState === 'ok' ? 'primary' : 'disabled', sub, ui.pressed === 'recruit');
  }
}
