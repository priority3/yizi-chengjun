// HUD and bottom panels: chapter title, 功德, camp HP with 唐僧, wave nodes, the shop, the battle bar, banners.
import { CHAPTERS, refreshCost } from '../config/chapters.ts';
import { UNITS } from '../config/units.ts';
import type { GameState } from '../core/types.ts';
import { cardSprite } from './cards.ts';
import { COLORS, drawBar, drawCoin, outlined, roundRect, text } from './draw.ts';
import { brush, sans } from './fonts.ts';
import { drawPortrait } from './heroes-art.ts';
import { L, W } from './layout.ts';
import { blit } from './sprites.ts';
import type { Banner, Vfx } from './vfx.ts';
import { drawButton, drawIconButton, drawTrash } from './widgets.ts';

export const NUMERALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

export interface PanelUi {
  pressed: string | null;
  speed: number;
  hoverTrash: boolean;
  /** Shop offer being dragged (drawn hollow in its slot), or -1. */
  draggingOffer: number;
  dragging: boolean;
}

export function drawHud(ctx: CanvasRenderingContext2D, g: GameState, ui: PanelUi, vfx: Vfx): void {
  const hud = L.hud;
  const bg = ctx.createLinearGradient(0, 0, 0, hud.h + 8);
  bg.addColorStop(0, 'rgba(42,24,14,0.92)');
  bg.addColorStop(1, 'rgba(42,24,14,0.55)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, hud.h + 8);
  drawIconButton(ctx, L.btnPause, 'pause', ui.pressed === 'pause');
  drawIconButton(ctx, L.btnSpeed, ui.speed === 2 ? 'x2' : 'x1', ui.pressed === 'speed');
  const ch = CHAPTERS[g.chapter - 1];
  outlined(ctx, `第${NUMERALS[g.chapter - 1]}章 · ${ch.name}`, W / 2, 20, brush(18), '#fbeed2', 'rgba(20,10,4,0.9)', 3);
  drawCoin(ctx, W - 74, 20, 9);
  text(ctx, String(g.gongde), W - 60, 21, sans(16, 800), COLORS.gold, 'left');

  // Camp HP with 唐僧's portrait.
  const flash = vfx.campFlash > 0;
  drawPortrait(ctx, '唐僧', 22, 44, 11);
  drawBar(ctx, 38, 39, 132, 11, g.campHp / g.campMax, flash ? '#ff9a8a' : g.campHp / g.campMax > 0.35 ? '#e0453c' : '#ff2a1a');
  text(ctx, `阵地 ${Math.ceil(g.campHp)}/${g.campMax}`, 104, 45, sans(9, 700), '#ffffff');

  // Wave progress nodes; the last is the boss.
  const n = g.totalWaves;
  const x0 = 196;
  const x1 = W - 16;
  ctx.strokeStyle = 'rgba(255,235,200,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0, 45);
  ctx.lineTo(x1, 45);
  ctx.stroke();
  for (let i = 1; i <= n; i++) {
    const x = x0 + ((x1 - x0) * (i - 1)) / (n - 1);
    const done = i < g.wave || (i === g.wave && g.phase !== 'battle');
    const current = i === g.wave && g.phase === 'battle';
    const boss = i === n;
    const r = boss ? 7 : 5;
    ctx.beginPath();
    ctx.arc(x, 45, current ? r + 1.5 : r, 0, Math.PI * 2);
    ctx.fillStyle = done ? COLORS.gold : current ? '#ffffff' : 'rgba(255,235,200,0.25)';
    if (boss && !done) ctx.fillStyle = current ? '#ff5a4a' : 'rgba(224,69,60,0.7)';
    ctx.fill();
    if (boss) text(ctx, '王', x, 45.5, brush(9), '#2a1a10');
  }
}

function drawOffer(ctx: CanvasRenderingContext2D, g: GameState, i: number, ui: PanelUi): void {
  const r = L.shopCards[i];
  const o = g.shop[i];
  roundRect(ctx, r.x, r.y, r.w, r.h, 12);
  ctx.fillStyle = 'rgba(120,80,40,0.16)';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(140,95,45,0.45)';
  ctx.stroke();
  const cx = r.x + r.w / 2;
  if (!o || o.sold || ui.draggingOffer === i) {
    text(ctx, o?.sold ? '已买' : '', cx, r.y + r.h / 2, brush(18), 'rgba(120,80,40,0.45)');
    return;
  }
  const afford = g.gongde >= o.price;
  const { img, size } = cardSprite(o.id, 1, false, 58);
  ctx.save();
  if (!afford) ctx.globalAlpha = 0.55;
  blit(ctx, img, cx, r.y + 36, size, size);
  ctx.restore();
  text(ctx, UNITS[o.id].label, cx, r.y + 73, sans(10, 600), '#6a4a26');
  drawCoin(ctx, cx - 14, r.y + 87, 6);
  text(ctx, String(o.price), cx - 5, r.y + 87.5, sans(13, 800), afford ? '#7a4a08' : '#c8322a', 'left');
}

export function drawShop(ctx: CanvasRenderingContext2D, g: GameState, ui: PanelUi): void {
  const s = L.shop;
  ctx.save();
  roundRect(ctx, s.x, s.y + 3, s.w, s.h, 16);
  ctx.fillStyle = 'rgba(30,15,5,0.35)';
  ctx.fill();
  roundRect(ctx, s.x, s.y, s.w, s.h, 16);
  const bg = ctx.createLinearGradient(0, s.y, 0, s.y + s.h);
  bg.addColorStop(0, '#f7ead0');
  bg.addColorStop(1, '#e6cfa2');
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#a8742a';
  ctx.stroke();
  // Scroll ribbon title.
  const rw = 96;
  roundRect(ctx, W / 2 - rw / 2, s.y - 10, rw, 26, 8);
  ctx.fillStyle = '#8a3a22';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#f0c24a';
  ctx.stroke();
  text(ctx, '商  店', W / 2, s.y + 3.5, brush(17), '#fbeed2');
  ctx.restore();
  for (let i = 0; i < L.shopCards.length; i++) drawOffer(ctx, g, i, ui);
  const cost = refreshCost(g.refreshes);
  drawButton(ctx, L.btnRefresh, '刷新', g.gongde >= cost ? 'jade' : 'disabled', `${cost} 功德`, ui.pressed === 'refresh');
  drawButton(ctx, L.btnStart, '出战', 'primary', `迎战第 ${g.wave + 1} 波`, ui.pressed === 'start');
  drawTrash(ctx, L.trash, ui.hoverTrash);
  if (ui.dragging) text(ctx, '拖到阵地空格上 · 叠到同名卡上升级', W / 2, s.y + 24, sans(9, 600), '#8a5a2a');
}

export function drawBattleBar(ctx: CanvasRenderingContext2D, g: GameState, ui: PanelUi): void {
  const b = L.bar;
  const bg = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
  bg.addColorStop(0, 'rgba(42,24,14,0.55)');
  bg.addColorStop(1, 'rgba(42,24,14,0.92)');
  ctx.fillStyle = bg;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  const left = g.enemies.length + g.spawns.length;
  outlined(ctx, `第 ${g.wave}/${g.totalWaves} 波`, 16, b.y + 17, brush(17), '#fbeed2', 'rgba(20,10,4,0.9)', 3, 'left');
  text(ctx, `剩余妖怪 ${left}`, 16, b.y + 37, sans(11, 600), COLORS.dim, 'left');
  text(ctx, ui.dragging ? '拖到垃圾桶卖出 →' : '可以随时拖动场上的字', W - 64, b.y + 26, sans(10, 600), COLORS.dim, 'right');
  drawTrash(ctx, L.barTrash, ui.hoverTrash);
}

export function drawBanner(ctx: CanvasRenderingContext2D, b: Banner): void {
  const fade = Math.min(1, b.t / 0.18, (b.life - b.t) / 0.35);
  const y = L.worldY + (b.portrait ? 250 : 74);
  const h = b.portrait ? 92 : b.sub ? 58 : 40;
  ctx.save();
  ctx.globalAlpha = Math.max(0, fade);
  const slide = (1 - Math.min(1, b.t / 0.18)) * 30;
  roundRect(ctx, 24 - slide, y - h / 2, W - 48, h, 14);
  ctx.fillStyle = 'rgba(28,14,6,0.84)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(240,194,74,0.8)';
  ctx.stroke();
  if (b.portrait) {
    const pulse = 1 + Math.sin(b.t * 12) * 0.04;
    drawPortrait(ctx, b.portrait, 72, y, 30 * pulse);
    outlined(ctx, b.title, 118, y - 12, brush(28), b.color, 'rgba(20,10,4,0.9)', 4, 'left');
    text(ctx, b.sub, 118, y + 20, sans(11, 600), '#f3e6c8', 'left');
  } else {
    outlined(ctx, b.title, W / 2, y - (b.sub ? 9 : 0), brush(24), b.color, 'rgba(20,10,4,0.9)', 4);
    if (b.sub) text(ctx, b.sub, W / 2, y + 17, sans(11, 600), '#f3e6c8');
  }
  ctx.restore();
}
