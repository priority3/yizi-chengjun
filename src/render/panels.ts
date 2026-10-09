// HUD and bottom panels: chapter title, 铜钱, camp HP with 师父, wave nodes, the shop, the battle bar, banners.
// Endless and daily runs show their mode and wave as the title and a wave counter instead of the nodes.
import { CHAPTERS } from '../config/chapters.ts';
import { ENDLESS } from '../config/endless.ts';
import { CURRENCY } from '../config/terms.ts';
import { UNITS } from '../config/units.ts';
import { modsLabel } from '../core/encounters.ts';
import { dayLabel, enraged, UNLIMITED } from '../core/modes.ts';
import { wavesSurvived } from '../core/records.ts';
import { currentRefreshCost, offerPrice } from '../core/shop.ts';
import type { GameState } from '../core/types.ts';
import { cardSprite } from './cards.ts';
import { COLORS, drawBar, drawCoin, fitPx, outlined, roundRect, text } from './draw.ts';
import { brush, sans } from './fonts.ts';
import { drawPortrait } from './heroes-art.ts';
import { L, W, type Rect } from './layout.ts';
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
  /** Sound is off: the HUD speaker is crossed out. */
  muted: boolean;
}

/** The HUD mute toggle: drawIconButton's frame around a drawn speaker with two sound waves, or a slash when muted. */
function drawSoundButton(ctx: CanvasRenderingContext2D, r: Rect, muted: boolean, pressed: boolean): void {
  const dy = pressed ? 1 : 0;
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2 + dy;
  roundRect(ctx, r.x, r.y + dy, r.w, r.h, 9);
  ctx.fillStyle = 'rgba(255,245,225,0.16)';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255,230,190,0.55)';
  ctx.stroke();
  ctx.save();
  // Speaker: a small box and its cone.
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy - 3);
  ctx.lineTo(cx - 4.5, cy - 3);
  ctx.lineTo(cx, cy - 7);
  ctx.lineTo(cx, cy + 7);
  ctx.lineTo(cx - 4.5, cy + 3);
  ctx.lineTo(cx - 8, cy + 3);
  ctx.closePath();
  ctx.fillStyle = muted ? COLORS.dim : COLORS.hudText;
  ctx.fill();
  ctx.lineCap = 'round';
  if (muted) {
    // A slash across the whole icon, with a dark edge so it reads on the speaker.
    for (const [color, width] of [['rgba(20,10,4,0.9)', 4], ['#ff7a6a', 2]] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(cx - 9, cy - 8);
      ctx.lineTo(cx + 9, cy + 8);
      ctx.stroke();
    }
  } else {
    ctx.strokeStyle = COLORS.hudText;
    ctx.lineWidth = 1.6;
    for (const radius of [4, 7.5]) {
      ctx.beginPath();
      ctx.arc(cx + 0.5, cy, radius, -0.8, 0.8);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** The wave an endless or daily run is on: the one being fought, or the next one while building. */
function currentWave(g: GameState): number {
  return g.phase === 'build' ? g.wave + 1 : g.wave;
}

/** The HUD title: the chapter, or an endless / daily run's mode and wave (无尽 · 第 12 波, 每日 · 10月8日 · 第 3 波). */
function hudTitle(g: GameState): string {
  if (g.mode === 'endless') return `无尽 · 第 ${currentWave(g)} 波`;
  if (g.mode === 'daily') return `每日 · ${dayLabel(g.seed)} · 第 ${currentWave(g)} 波`;
  return `第${NUMERALS[g.chapter - 1]}章 · ${CHAPTERS[g.chapter - 1].name}`;
}

/**
 * Endless and daily runs, in place of the wave nodes: the waves survived so far, then the five waves of the current
 * boss cycle in the nodes' style (done gold, the one being fought white, the boss red with 王).
 */
function drawWaveCounter(ctx: CanvasRenderingContext2D, g: GameState): void {
  text(ctx, `撑过 ${wavesSurvived(g)} 波`, 196, 45.5, sans(11, 800), COLORS.gold, 'left');
  const n = ENDLESS.bossEvery;
  const first = Math.floor((currentWave(g) - 1) / n) * n + 1;
  const x1 = W - 16;
  const step = 15;
  const x0 = x1 - step * (n - 1);
  ctx.strokeStyle = 'rgba(255,235,200,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0, 45);
  ctx.lineTo(x1, 45);
  ctx.stroke();
  for (let i = 0; i < n; i++) {
    const w = first + i;
    const x = x0 + step * i;
    const done = w < g.wave || (w === g.wave && g.phase !== 'battle');
    const current = w === g.wave && g.phase === 'battle';
    const boss = i === n - 1;
    const r = boss ? 7 : 5;
    ctx.beginPath();
    ctx.arc(x, 45, current ? r + 1.5 : r, 0, Math.PI * 2);
    ctx.fillStyle = done ? COLORS.gold : current ? '#ffffff' : 'rgba(255,235,200,0.25)';
    if (boss && !done) ctx.fillStyle = current ? '#ff5a4a' : 'rgba(224,69,60,0.7)';
    ctx.fill();
    if (boss) text(ctx, '王', x, 45.5, brush(9), '#2a1a10');
  }
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
  drawSoundButton(ctx, L.btnSound, ui.muted, ui.pressed === 'sound');
  const title = hudTitle(g);
  // Reason: the title stays centred, so it must clear the sound button on the left (and as much on the right).
  const titleW = W - 2 * (L.btnSound.x + L.btnSound.w + 6);
  outlined(ctx, title, W / 2, 20, brush(fitPx(ctx, title, titleW, 18, brush, 12)), '#fbeed2', 'rgba(20,10,4,0.9)', 3);
  drawCoin(ctx, W - 74, 20, 9);
  text(ctx, String(g.gongde), W - 60, 21, sans(16, 800), COLORS.gold, 'left');

  // Camp HP with 师父's portrait.
  const flash = vfx.campFlash > 0;
  drawPortrait(ctx, 'master', 22, 44, 11);
  drawBar(ctx, 38, 39, 132, 11, g.campHp / g.campMax, flash ? '#ff9a8a' : g.campHp / g.campMax > 0.35 ? '#e0453c' : '#ff2a1a');
  text(ctx, `阵地 ${Math.ceil(g.campHp)}/${g.campMax}`, 104, 45, sans(9, 700), '#ffffff');

  if (g.totalWaves === UNLIMITED) {
    drawWaveCounter(ctx, g);
    return;
  }
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
  const price = offerPrice(g, o);
  const afford = g.gongde >= price;
  const discounted = g.shopDiscount < 1;
  const { img, size } = cardSprite(o.id, 1, false, 58);
  ctx.save();
  if (!afford) ctx.globalAlpha = 0.55;
  blit(ctx, img, cx, r.y + 36, size, size);
  ctx.restore();
  text(ctx, UNITS[o.id].label, cx, r.y + 73, sans(10, 600), '#6a4a26');
  drawCoin(ctx, cx - 14, r.y + 87, 6);
  text(ctx, String(price), cx - 5, r.y + 87.5, sans(13, 800), !afford ? '#c8322a' : discounted ? '#1b7a5a' : '#7a4a08', 'left');
  if (discounted) {
    // 货郎摆摊: a little "半价" tag on every card.
    roundRect(ctx, r.x + r.w - 30, r.y + 4, 26, 14, 4);
    ctx.fillStyle = '#2f9c86';
    ctx.fill();
    text(ctx, '半价', r.x + r.w - 17, r.y + 11.5, sans(8, 800), '#f2fffb');
  }
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
  const cost = currentRefreshCost(g);
  drawButton(ctx, L.btnRefresh, '刷新', g.gongde >= cost ? 'jade' : 'disabled', cost === 0 ? '免费' : `${cost} ${CURRENCY}`, ui.pressed === 'refresh');
  drawButton(ctx, L.btnStart, '出战', 'primary', `迎战第 ${g.wave + 1} 波`, ui.pressed === 'start');
  drawTrash(ctx, L.trash, ui.hoverTrash);
  // One line under the ribbon: drag help, or what the chosen encounter queued for the next wave.
  const queued = modsLabel(g.waveMods);
  const hint = ui.dragging ? '拖到阵地空格上 · 叠到同名卡上升级' : queued ? `下一波：${queued}` : g.chest ? '宝箱：打完下一波开出一张卡' : '';
  if (hint) {
    const px = fitPx(ctx, hint, s.w - 120, 9, (n) => sans(n, 600), 7);
    text(ctx, hint, W / 2, s.y + 24, sans(px, 600), queued && !ui.dragging ? '#b3261e' : '#8a5a2a');
  }
}

export function drawBattleBar(ctx: CanvasRenderingContext2D, g: GameState, ui: PanelUi): void {
  const b = L.bar;
  const bg = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
  bg.addColorStop(0, 'rgba(42,24,14,0.55)');
  bg.addColorStop(1, 'rgba(42,24,14,0.92)');
  ctx.fillStyle = bg;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  const left = g.enemies.length + g.spawns.length;
  const wave = g.totalWaves === UNLIMITED ? `第 ${g.wave} 波` : `第 ${g.wave}/${g.totalWaves} 波`;
  outlined(ctx, wave, 16, b.y + 17, brush(17), '#fbeed2', 'rgba(20,10,4,0.9)', 3, 'left');
  // A berserk endless wave says so for as long as it lasts, ahead of the encounter modifiers.
  const rage = enraged(g);
  const active = [rage ? '妖怪狂暴：不吃眩晕减速击退' : '', modsLabel(g.activeMods)].filter(Boolean).join(' · ');
  const info = active ? `剩余妖怪 ${left} · ${active}` : `剩余妖怪 ${left}`;
  const px = fitPx(ctx, info, W - 160, 11, (n) => sans(n, 600), 8);
  text(ctx, info, 16, b.y + 37, sans(px, 600), rage ? '#ff7a6a' : active ? '#ffb07a' : COLORS.dim, 'left');
  text(ctx, ui.dragging ? '拖到垃圾桶卖出 →' : '可以随时拖动场上的字', W - 64, b.y + 26, sans(10, 600), COLORS.dim, 'right');
  drawTrash(ctx, L.barTrash, ui.hoverTrash);
}

export function drawBanner(ctx: CanvasRenderingContext2D, b: Banner): void {
  const fade = Math.min(1, b.t / 0.18, (b.life - b.t) / 0.35);
  const y = L.hud.h + (b.portrait ? 200 : 40);
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
    const px = fitPx(ctx, b.sub, W - 48 - 118 + 24 - 12, 11, (n) => sans(n, 600), 8);
    text(ctx, b.sub, 118, y + 20, sans(px, 600), '#f3e6c8', 'left');
  } else {
    outlined(ctx, b.title, W / 2, y - (b.sub ? 9 : 0), brush(24), b.color, 'rgba(20,10,4,0.9)', 4);
    if (b.sub) {
      const px = fitPx(ctx, b.sub, W - 72, 11, (n) => sans(n, 600), 8);
      text(ctx, b.sub, W / 2, y + 17, sans(px, 600), '#f3e6c8');
    }
  }
  ctx.restore();
}
