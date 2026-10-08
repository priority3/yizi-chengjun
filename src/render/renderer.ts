// Composes one frame: the map through the camera (roads, pads, cards, monsters, effects), then the HUD,
// the shop or battle bar, the dragged card and any banner or modal in screen space.
import { unlockCost } from '../config/chapters.ts';
import { ENEMIES } from '../config/enemies.ts';
import { UNITS } from '../config/units.ts';
import type { Pt } from '../core/map.ts';
import { tileRange } from '../core/stats.ts';
import type { Enemy, GameState, Tile, UnitId } from '../core/types.ts';
import type { Stage } from '../platform/web.ts';
import type { Camera } from './camera.ts';
import { CARD, cardSprite } from './cards.ts';
import { drawBar, drawCoin, drawStar, outlined, roundRect, text } from './draw.ts';
import { drawEncounterPanel } from './encounter-panel.ts';
import { brush, sans } from './fonts.ts';
import { L, viewRect, W } from './layout.ts';
import { drawMap, PAD_R } from './map-art.ts';
import { monsterSprite } from './monsters-art.ts';
import { drawBanner, drawBattleBar, drawHud, drawShop, type PanelUi } from './panels.ts';
import { blit } from './sprites.ts';
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

/** A card being dragged, in screen coordinates. */
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
  /** Slot under the dragged card, or -1. */
  hoverCell: number;
  /** Whether dropping on hoverCell would do something. */
  hoverValid: boolean;
  /** Tapped tile whose range is shown, or -1. */
  selected: number;
  /** What releasing on hoverCell does when it combines (merge / awaken / 神), shown next to the slot. */
  hoverHint: string | null;
}

export class GameRenderer {
  private readonly stage: Stage;

  constructor(stage: Stage) {
    this.stage = stage;
  }

  draw(ctx: CanvasRenderingContext2D, g: GameState, ui: GameUi, vfx: Vfx, time: number, cam: Camera): void {
    const view = viewRect(g.phase);
    ctx.fillStyle = '#2b1e14';
    ctx.fillRect(0, 0, W, L.H);
    ctx.save();
    ctx.beginPath();
    ctx.rect(view.x, view.y, view.w, view.h);
    ctx.clip();
    if (vfx.shake > 0) ctx.translate((Math.random() - 0.5) * vfx.shake, (Math.random() - 0.5) * vfx.shake);
    cam.apply(ctx, view);
    drawMap(ctx, g.map, cam.zoom, this.stage.pixelRatio);
    this.drawSlots(ctx, g, ui, time, 1 / cam.zoom);
    this.drawTiles(ctx, g, ui, vfx, time);
    this.drawEnemies(ctx, g, vfx, time);
    vfx.trail(g.projectiles);
    vfx.drawProjectiles(ctx, g.projectiles);
    vfx.drawWorld(ctx);
    vfx.drawFloaters(ctx, 1 / cam.zoom);
    ctx.restore();
    drawHud(ctx, g, ui, vfx);
    if (g.phase === 'build') drawShop(ctx, g, ui);
    else drawBattleBar(ctx, g, ui);
    if (ui.drag) this.drawDragged(ctx, ui.drag);
    if (vfx.banner) drawBanner(ctx, vfx.banner);
    if (g.encounter) drawEncounterPanel(ctx, g.encounter, ui.pressed);
  }

  /** Locked pads with their price, the range preview and the drop target. `k` = 1 / zoom keeps labels readable. */
  private drawSlots(ctx: CanvasRenderingContext2D, g: GameState, ui: GameUi, time: number, k: number): void {
    const price = unlockCost(g.unlockCount);
    g.map.slots.forEach((p, i) => {
      if (g.unlocked[i]) return;
      ctx.beginPath();
      ctx.arc(p.x, p.y, PAD_R - 1, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(45,28,12,0.6)';
      ctx.fill();
      text(ctx, '+', p.x, p.y - 6 * k, sans(Math.round(18 * k), 800), 'rgba(255,235,200,0.85)');
      drawCoin(ctx, p.x - 8 * k, p.y + 9 * k, 4 * k);
      text(ctx, String(price), p.x - 3 * k, p.y + 9.5 * k, sans(Math.round(9 * k), 800), g.gongde >= price ? '#ffe9b0' : 'rgba(255,200,190,0.85)', 'left');
    });
    // Range preview for the dragged card (over a slot) or a tapped tile.
    let ringCell = -1;
    let ringRange = 0;
    if (ui.drag && ui.hoverCell >= 0) {
      ringCell = ui.hoverCell;
      const t: Tile = { uid: 0, id: ui.drag.unit, level: ui.drag.level, divine: ui.drag.divine, cd: 0, invested: 0, rage: 0 };
      ringRange = tileRange(t, g.mods);
    } else if (ui.selected >= 0 && g.slots[ui.selected]) {
      ringCell = ui.selected;
      ringRange = tileRange(g.slots[ui.selected] as Tile, g.mods);
    }
    if (ringCell >= 0 && ringRange > 0 && Number.isFinite(ringRange)) {
      const p = g.map.slots[ringCell];
      ctx.beginPath();
      ctx.arc(p.x, p.y, ringRange, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,245,210,0.12)';
      ctx.fill();
      ctx.setLineDash([6 * k, 5 * k]);
      ctx.lineWidth = 1.5 * k;
      ctx.strokeStyle = 'rgba(255,245,210,0.75)';
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (ui.drag && ui.hoverCell >= 0) {
      const p = g.map.slots[ui.hoverCell];
      if (ui.hoverHint) this.drawCombineHint(ctx, p, ui.hoverHint, time, k);
      else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, PAD_R + 3, 0, Math.PI * 2);
        ctx.lineWidth = 3 * k;
        ctx.strokeStyle = ui.hoverValid ? '#7dff9a' : '#ff6a5a';
        ctx.stroke();
      }
    }
  }

  /** A spinning golden ring around the target card plus a label saying what releasing will do. */
  private drawCombineHint(ctx: CanvasRenderingContext2D, p: Pt, hint: string, time: number, k: number): void {
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, PAD_R + 6, 0, Math.PI * 2);
    ctx.setLineDash([9 * k, 7 * k]);
    ctx.lineDashOffset = -time * 45 * k;
    ctx.lineWidth = 3.5 * k;
    ctx.strokeStyle = '#ffd166';
    ctx.shadowColor = 'rgba(255,200,60,0.9)';
    ctx.shadowBlur = (10 + Math.sin(time * 8) * 4) * k;
    ctx.stroke();
    ctx.restore();
    const cy = p.y - PAD_R - 16 * k;
    ctx.font = sans(Math.round(10 * k), 800);
    const w = ctx.measureText(hint).width + 18 * k;
    roundRect(ctx, p.x - w / 2, cy - 10 * k, w, 20 * k, 10 * k);
    ctx.fillStyle = 'rgba(28,14,6,0.9)';
    ctx.fill();
    ctx.lineWidth = 1.5 * k;
    ctx.strokeStyle = '#ffd166';
    ctx.stroke();
    text(ctx, hint, p.x, cy + 0.5 * k, sans(Math.round(10 * k), 800), '#ffe9a8');
  }

  private drawTiles(ctx: CanvasRenderingContext2D, g: GameState, ui: GameUi, vfx: Vfx, time: number): void {
    g.slots.forEach((t, i) => {
      if (!t) return;
      const p = g.map.slots[i];
      const x = p.x;
      // Reason: cards stand a little above the pad's centre so the pad shows underneath like a plinth.
      const y = p.y - 6;
      const shake = vfx.shakes[i] > 0 ? Math.sin(vfx.shakes[i] * 80) * 3 : 0;
      const scale = 1 + vfx.pops[i] * 0.9 + vfx.recoil[i] * 0.7;
      const { img, size } = cardSprite(t.id, t.level, t.divine);
      const dragging = ui.drag?.kind === 'cell' && ui.drag.index === i;
      const hero = UNITS[t.id].kind === 'hero';
      const ready = hero && t.rage >= 1;
      ctx.save();
      if (dragging) ctx.globalAlpha = 0.3;
      if (ready) {
        // Full rage: the card glows until the next attack unleashes the ultimate.
        ctx.shadowColor = 'rgba(255,200,60,1)';
        ctx.shadowBlur = 16 + Math.sin(time * 9) * 6;
        roundRect(ctx, x - CARD / 2, y - CARD / 2, CARD, CARD, 9);
        ctx.fillStyle = 'rgba(255,215,90,0.8)';
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      blit(ctx, img, x + shake, y, size, size, scale);
      if (hero) drawBar(ctx, x - 19, y + CARD / 2 - 5, 38, 4.5, t.rage, ready ? '#ffd166' : '#ff7a2a');
      ctx.restore();
    });
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, vfx: Vfx, time: number): void {
    const def = ENEMIES[e.def];
    const { img, flash, box } = monsterSprite(e.def);
    const x = e.x;
    const y = e.y;
    const walking = e.stunT <= 0;
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
    const list = g.enemies.filter((e) => !e.gone).sort((a, b) => a.y - b.y);
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
