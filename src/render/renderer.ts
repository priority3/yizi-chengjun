// Composes one frame: painted background, camp cells, cards, monsters, projectiles, effects, HUD and panels.
import { unlockCost } from '../config/chapters.ts';
import { ENEMIES } from '../config/enemies.ts';
import { UNITS } from '../config/units.ts';
import { CELL, CELL_COUNT, CELL_POS } from '../core/grid.ts';
import { tileRange } from '../core/stats.ts';
import type { Enemy, GameState, Tile, UnitId } from '../core/types.ts';
import type { Stage } from '../platform/web.ts';
import { paintBackground } from './background.ts';
import { CARD, cardSprite } from './cards.ts';
import { drawBar, drawCoin, drawStar, outlined, roundRect, text } from './draw.ts';
import { brush, sans } from './fonts.ts';
import { L, W, wy } from './layout.ts';
import { monsterSprite } from './monsters-art.ts';
import { drawBanner, drawBattleBar, drawHud, drawShop, type PanelUi } from './panels.ts';
import { blit, sprites } from './sprites.ts';
import type { Vfx } from './vfx.ts';

/** A small drawn snowflake (no emoji: they render differently on every phone). */
function snowflake(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.save();
  ctx.strokeStyle = '#dff6ff';
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI) / 3;
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(a) * r, y - Math.sin(a) * r);
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    ctx.stroke();
  }
  ctx.restore();
}

export interface DragUi {
  kind: 'shop' | 'cell';
  index: number;
  unit: UnitId;
  level: number;
  divine: boolean;
  x: number;
  y: number;
}

export interface GameUi extends PanelUi {
  drag: DragUi | null;
  /** Cell under the dragged card, or -1. */
  hoverCell: number;
  /** Whether dropping on hoverCell would do something. */
  hoverValid: boolean;
  /** Tapped tile whose range is shown, or -1. */
  selected: number;
}

export class GameRenderer {
  private readonly stage: Stage;
  private bg: HTMLCanvasElement | null = null;
  private bgKey = '';

  constructor(stage: Stage) {
    this.stage = stage;
  }

  private background(): HTMLCanvasElement {
    const key = `${this.stage.pixelRatio}:${L.H}`;
    if (!this.bg || this.bgKey !== key) {
      this.bg = sprites.get(`bg:${key}`, W, L.H, (ctx) => paintBackground(ctx, L.H));
      this.bgKey = key;
    }
    return this.bg;
  }

  draw(ctx: CanvasRenderingContext2D, g: GameState, ui: GameUi, vfx: Vfx, time: number): void {
    ctx.drawImage(this.background(), 0, 0, W, L.H);
    ctx.save();
    if (vfx.shake > 0) ctx.translate((Math.random() - 0.5) * vfx.shake, (Math.random() - 0.5) * vfx.shake);
    this.drawCells(ctx, g, ui, vfx);
    this.drawTiles(ctx, g, ui, vfx);
    this.drawEnemies(ctx, g, vfx, time);
    vfx.trail(g.projectiles);
    vfx.drawProjectiles(ctx, g.projectiles);
    vfx.drawWorld(ctx);
    vfx.drawFloaters(ctx);
    ctx.restore();
    drawHud(ctx, g, ui, vfx);
    if (g.phase === 'build') drawShop(ctx, g, ui);
    else drawBattleBar(ctx, g, ui);
    if (ui.drag) this.drawDragged(ctx, ui.drag);
    if (vfx.banner) drawBanner(ctx, vfx.banner);
  }

  private drawCells(ctx: CanvasRenderingContext2D, g: GameState, ui: GameUi, vfx: Vfx): void {
    const price = unlockCost(g.unlockCount);
    for (let i = 0; i < CELL_COUNT; i++) {
      const p = CELL_POS[i];
      const x = p.x - CELL / 2 + 3;
      const y = wy(p.y) - CELL / 2 + 3;
      const s = CELL - 6;
      roundRect(ctx, x, y, s, s, 8);
      if (g.unlocked[i]) {
        ctx.fillStyle = 'rgba(250,236,205,0.55)';
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(110,75,35,0.35)';
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(70,45,20,0.35)';
        ctx.fill();
        text(ctx, '+', p.x, wy(p.y) - 5, sans(22, 800), 'rgba(255,235,200,0.75)');
        drawCoin(ctx, p.x - 9, wy(p.y) + 13, 4.5);
        text(ctx, String(price), p.x - 3, wy(p.y) + 13.5, sans(10, 800), g.gongde >= price ? '#ffe9b0' : 'rgba(255,200,190,0.8)', 'left');
      }
    }
    if (vfx.campFlash > 0) {
      const p0 = CELL_POS[0];
      roundRect(ctx, p0.x - CELL / 2 - 8, wy(p0.y) - CELL / 2 - 8, CELL * 4 + 16, CELL * 4 + 16, 12);
      ctx.fillStyle = `rgba(230,50,30,${vfx.campFlash * 0.9})`;
      ctx.fill();
    }
    // Range preview for the dragged card (over a cell) or a tapped tile.
    const rangeOf = (unit: UnitId, level: number, divine: boolean) => {
      const t: Tile = { uid: 0, id: unit, level, divine, cd: 0, invested: 0 };
      return tileRange(t);
    };
    let ringCell = -1;
    let ringRange = 0;
    if (ui.drag && ui.hoverCell >= 0) {
      ringCell = ui.hoverCell;
      ringRange = rangeOf(ui.drag.unit, ui.drag.level, ui.drag.divine);
    } else if (ui.selected >= 0 && g.slots[ui.selected]) {
      const t = g.slots[ui.selected] as Tile;
      ringCell = ui.selected;
      ringRange = tileRange(t);
    }
    if (ringCell >= 0 && ringRange > 0 && Number.isFinite(ringRange)) {
      const p = CELL_POS[ringCell];
      ctx.beginPath();
      ctx.arc(p.x, wy(p.y), ringRange, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,245,210,0.12)';
      ctx.fill();
      ctx.setLineDash([6, 5]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(255,245,210,0.75)';
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (ui.drag && ui.hoverCell >= 0) {
      const p = CELL_POS[ui.hoverCell];
      roundRect(ctx, p.x - CELL / 2 + 1, wy(p.y) - CELL / 2 + 1, CELL - 2, CELL - 2, 10);
      ctx.lineWidth = 3;
      ctx.strokeStyle = ui.hoverValid ? '#7dff9a' : '#ff6a5a';
      ctx.stroke();
    }
  }

  private drawTiles(ctx: CanvasRenderingContext2D, g: GameState, ui: GameUi, vfx: Vfx): void {
    for (let i = 0; i < CELL_COUNT; i++) {
      const t = g.slots[i];
      if (!t) continue;
      const p = CELL_POS[i];
      const shake = vfx.shakes[i] > 0 ? Math.sin(vfx.shakes[i] * 80) * 3 : 0;
      const scale = 1 + vfx.pops[i] * 0.9 + vfx.recoil[i] * 0.7;
      const { img, size } = cardSprite(t.id, t.level, t.divine);
      const dragging = ui.drag?.kind === 'cell' && ui.drag.index === i;
      ctx.save();
      if (dragging) ctx.globalAlpha = 0.3;
      blit(ctx, img, p.x + shake, wy(p.y), size, size, scale);
      ctx.restore();
    }
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, vfx: Vfx, time: number): void {
    const def = ENEMIES[e.def];
    const { img, flash, box } = monsterSprite(e.def);
    const x = e.x;
    const y = wy(e.y);
    const walking = Math.abs(e.stopY - e.y) > 0.5 && e.stunT <= 0;
    const bob = walking ? Math.abs(Math.sin(time * 9 + e.uid)) * -3 : Math.sin(time * 14 + e.uid) * 1.2;
    // Ground shadow.
    ctx.beginPath();
    ctx.ellipse(x, y + def.radius * 0.95, def.radius * 0.9, def.radius * 0.28, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(40,20,5,0.25)';
    ctx.fill();
    if (def.boss) {
      ctx.beginPath();
      ctx.arc(x, y, def.radius * (1.25 + Math.sin(time * 4) * 0.05), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,90,40,0.16)';
      ctx.fill();
    }
    blit(ctx, img, x, y + bob, box, box);
    const f = vfx.flash.get(e.uid);
    if (f !== undefined) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, f / 0.12) * 0.85;
      blit(ctx, flash, x, y + bob, box, box);
      ctx.restore();
    }
    if (e.slowT > 0) {
      ctx.beginPath();
      ctx.ellipse(x, y + def.radius * 0.9, def.radius * 1.05, def.radius * 0.36, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(150,225,255,0.9)';
      ctx.lineWidth = 2;
      ctx.stroke();
      snowflake(ctx, x + def.radius * 0.9, y - def.radius * 0.9, 5);
    }
    if (e.stunT > 0) {
      for (let i = 0; i < 3; i++) {
        const a = time * 6 + (i * Math.PI * 2) / 3;
        drawStar(ctx, x + Math.cos(a) * def.radius * 0.8, y - def.radius * 1.2 + Math.sin(a) * 3, 3.5, '#ffe45a');
      }
    }
    const barW = Math.max(22, def.radius * 2);
    drawBar(ctx, x - barW / 2, y - def.radius - 9, barW, 4, e.hp / e.maxHp, def.boss ? '#ff5a3a' : '#6fdc5a');
    if (def.boss || def.elite) {
      outlined(ctx, def.name, x, y + def.radius + 12, brush(def.boss ? 14 : 12), def.boss ? '#ffd166' : '#ffb0a0', 'rgba(20,10,4,0.9)', 3);
    }
  }

  private drawEnemies(ctx: CanvasRenderingContext2D, g: GameState, vfx: Vfx, time: number): void {
    // Reason: draw in y order so monsters further down overlap the ones behind them.
    const list = [...g.enemies].sort((a, b) => a.y - b.y);
    for (const e of list) this.drawEnemy(ctx, e, vfx, time);
  }

  private drawDragged(ctx: CanvasRenderingContext2D, d: DragUi): void {
    const { img, size } = cardSprite(d.unit, d.level, d.divine);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 6;
    blit(ctx, img, d.x, d.y, size, size, 1.12);
    ctx.restore();
    if (UNITS[d.unit].kind === 'fragment') outlined(ctx, '拖到另一半上', d.x, d.y + CARD * 0.78, sans(10, 700), '#fff4d6');
  }
}
