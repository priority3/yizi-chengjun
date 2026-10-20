// HUD and bottom panels in the 宣纸卷轴 style: a paper strip on top with the chapter title, 铜钱, camp HP with 师父 and
// the wave nodes; the shop as a handscroll of paper slips; a paper battle bar; banners. Endless and daily runs show
// their mode and wave as the title and a wave counter instead of the nodes.
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
import { drawCoin, fitPx, outlined, roundRect, text } from './draw.ts';
import { brush, sans } from './fonts.ts';
import { drawPortrait } from './heroes-art.ts';
import { L, W, type Rect } from './layout.ts';
import { blit } from './sprites.ts';
import type { Banner, Vfx } from './vfx.ts';
import { CINNABAR, GILT, ink, INK, inkBar, PAPER } from './ink.ts';
import { drawButton, drawHandscroll, drawIconButton, drawIconPlate, drawTrash } from './widgets.ts';

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

/** The HUD mute toggle: a paper plate with a speaker and two sound waves in ink, or the speaker struck through when muted. */
function drawSoundButton(ctx: CanvasRenderingContext2D, r: Rect, muted: boolean, pressed: boolean): void {
  const dy = pressed ? 1 : 0;
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2 + dy;
  drawIconPlate(ctx, r, pressed);
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
  ctx.fillStyle = muted ? ink(0.4) : INK;
  ctx.fill();
  ctx.lineCap = 'round';
  if (muted) {
    // A cinnabar slash across the whole icon, edged in paper so it reads on the speaker.
    for (const [color, width] of [[PAPER, 4], [CINNABAR, 2]] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(cx - 9, cy - 8);
      ctx.lineTo(cx + 9, cy + 8);
      ctx.stroke();
    }
  } else {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    for (const radius of [4, 7.5]) {
      ctx.beginPath();
      ctx.arc(cx + 0.5, cy, radius, -0.8, 0.8);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/**
 * A strip of paper across the screen from `y` to `y + h`, shading darker towards the map, with a wavering ink edge on
 * the side that meets it (`edge` 'bottom' for the HUD, 'top' for the battle bar).
 */
function paperStrip(ctx: CanvasRenderingContext2D, y: number, h: number, edge: 'top' | 'bottom'): void {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(edge === 'bottom' ? 0 : 1, '#f3e6c8');
  g.addColorStop(edge === 'bottom' ? 1 : 0, '#e6d3aa');
  ctx.fillStyle = g;
  ctx.fillRect(0, y, W, h);
  const ey = edge === 'bottom' ? y + h - 1 : y + 1;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 10) ctx.lineTo(x, ey + Math.sin(x * 0.31) * 0.9);
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

/** One wave node at (x, 45): done in ink, the one being fought a larger cinnabar dot, the ones ahead paper. */
function waveNode(ctx: CanvasRenderingContext2D, x: number, done: boolean, current: boolean): void {
  ctx.beginPath();
  ctx.arc(x, 45, current ? 6.5 : 5, 0, Math.PI * 2);
  ctx.fillStyle = done ? INK : current ? CINNABAR : PAPER;
  ctx.fill();
  if (!done) {
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }
}

/** The boss node: a seal with 王, cinnabar until the boss is beaten, then ink. */
function bossNode(ctx: CanvasRenderingContext2D, x: number, done: boolean, current: boolean): void {
  const half = current ? 9 : 8;
  roundRect(ctx, x - half, 45 - half, half * 2, half * 2, 2);
  ctx.fillStyle = done ? INK : CINNABAR;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = INK;
  ctx.stroke();
  text(ctx, '王', x, 45.5, brush(current ? 12 : 11), PAPER);
}

/** The line the wave nodes sit on. */
function waveLine(ctx: CanvasRenderingContext2D, x0: number, x1: number): void {
  ctx.strokeStyle = ink(0.5);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x0, 45);
  ctx.lineTo(x1, 45);
  ctx.stroke();
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
 * boss cycle as nodes (done in ink, the one being fought cinnabar, the boss a 王 seal).
 */
function drawWaveCounter(ctx: CanvasRenderingContext2D, g: GameState): void {
  text(ctx, `撑过 ${wavesSurvived(g)} 波`, 196, 45.5, sans(11, 800), INK, 'left');
  const n = ENDLESS.bossEvery;
  const first = Math.floor((currentWave(g) - 1) / n) * n + 1;
  const x1 = W - 16;
  const step = 15;
  const x0 = x1 - step * (n - 1);
  waveLine(ctx, x0, x1);
  for (let i = 0; i < n; i++) {
    const w = first + i;
    const done = w < g.wave || (w === g.wave && g.phase !== 'battle');
    const current = w === g.wave && g.phase === 'battle';
    if (i === n - 1) bossNode(ctx, x0 + step * i, done, current);
    else waveNode(ctx, x0 + step * i, done, current);
  }
}

export function drawHud(ctx: CanvasRenderingContext2D, g: GameState, ui: PanelUi, vfx: Vfx): void {
  paperStrip(ctx, 0, L.hud.h, 'bottom');
  drawIconButton(ctx, L.btnPause, 'pause', ui.pressed === 'pause');
  drawIconButton(ctx, L.btnSpeed, ui.speed === 2 ? 'x2' : 'x1', ui.pressed === 'speed');
  drawSoundButton(ctx, L.btnSound, ui.muted, ui.pressed === 'sound');
  const title = hudTitle(g);
  // Reason: the title stays centred, so it must clear the sound button on the left (and as much on the right).
  const titleW = W - 2 * (L.btnSound.x + L.btnSound.w + 6);
  text(ctx, title, W / 2, 20, brush(fitPx(ctx, title, titleW, 18, brush, 12)), INK);
  drawCoin(ctx, W - 74, 20, 9);
  text(ctx, String(g.gongde), W - 60, 21, sans(16, 800), INK, 'left');

  // Camp HP with 师父's portrait: a cinnabar bar in a groove, paling while the camp is being hit.
  const flash = vfx.campFlash > 0;
  const hp = g.campHp / g.campMax;
  drawPortrait(ctx, 'master', 22, 44, 11);
  inkBar(ctx, 38, 39, 132, 11, hp, flash ? '#e0806c' : hp > 0.35 ? CINNABAR : '#e0301e', ink(0.12));
  outlined(ctx, `阵地 ${Math.ceil(g.campHp)}/${g.campMax}`, 104, 45, sans(9, 700), PAPER, '#6b1d14', 2.4);

  if (g.totalWaves === UNLIMITED) {
    drawWaveCounter(ctx, g);
    return;
  }
  // Wave progress nodes; the last is the boss.
  const n = g.totalWaves;
  const x0 = 196;
  const x1 = W - 16;
  waveLine(ctx, x0, x1);
  for (let i = 1; i <= n; i++) {
    const x = x0 + ((x1 - x0) * (i - 1)) / (n - 1);
    const done = i < g.wave || (i === g.wave && g.phase !== 'battle');
    const current = i === g.wave && g.phase === 'battle';
    if (i === n) bossNode(ctx, x, done, current);
    else waveNode(ctx, x, done, current);
  }
}

/** One offer: a paper slip with the card on it, its label and its price (cinnabar when it is more than you have). */
function drawOffer(ctx: CanvasRenderingContext2D, g: GameState, i: number, ui: PanelUi): void {
  const r = L.shopCards[i];
  const o = g.shop[i];
  const cx = r.x + r.w / 2;
  const empty = !o || o.sold || ui.draggingOffer === i;
  roundRect(ctx, r.x + 2, r.y + 3, r.w, r.h, 3);
  ctx.fillStyle = ink(empty ? 0.06 : 0.14);
  ctx.fill();
  roundRect(ctx, r.x, r.y, r.w, r.h, 3);
  ctx.fillStyle = empty ? 'rgba(253,248,234,0.55)' : '#fdf8ea';
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = empty ? ink(0.35) : INK;
  if (empty) ctx.setLineDash([4, 3]);
  ctx.stroke();
  ctx.setLineDash([]);
  if (empty) {
    text(ctx, o?.sold ? '已买' : '', cx, r.y + r.h / 2, brush(18), ink(0.35));
    return;
  }
  ctx.beginPath();
  ctx.moveTo(r.x + 6, r.y + 6);
  ctx.lineTo(r.x + r.w - 6, r.y + 6);
  ctx.lineWidth = 0.7;
  ctx.strokeStyle = ink(0.35);
  ctx.stroke();
  const price = offerPrice(g, o);
  const afford = g.gongde >= price;
  const discounted = g.shopDiscount < 1;
  const { img, size } = cardSprite(o.id, 1, false, 58);
  ctx.save();
  if (!afford) ctx.globalAlpha = 0.55;
  blit(ctx, img, cx, r.y + 38, size, size);
  ctx.restore();
  text(ctx, UNITS[o.id].label, cx, r.y + 73, sans(10, 500), ink(0.7));
  drawCoin(ctx, cx - 14, r.y + 87, 6);
  text(ctx, String(price), cx - 5, r.y + 87.5, sans(13, 800), !afford ? CINNABAR : discounted ? '#1b7a5a' : INK, 'left');
  if (discounted) {
    // 货郎摆摊: a little "半价" seal on every card.
    roundRect(ctx, r.x + r.w - 30, r.y + 9, 26, 14, 2);
    ctx.fillStyle = '#2f7a64';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = INK;
    ctx.stroke();
    text(ctx, '半价', r.x + r.w - 17, r.y + 16.5, sans(8, 800), '#f2fffb');
  }
}

export function drawShop(ctx: CanvasRenderingContext2D, g: GameState, ui: PanelUi): void {
  const s = L.shop;
  ctx.save();
  drawHandscroll(ctx, s);
  // The title: a cinnabar seal sitting on the scroll's top edge.
  roundRect(ctx, W / 2 - 32, s.y - 9, 64, 26, 3);
  ctx.fillStyle = CINNABAR;
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = INK;
  ctx.stroke();
  text(ctx, '商店', W / 2, s.y + 4.5, brush(17), PAPER);
  ctx.restore();
  for (let i = 0; i < L.shopCards.length; i++) drawOffer(ctx, g, i, ui);
  const cost = currentRefreshCost(g);
  drawButton(ctx, L.btnRefresh, '刷新', g.gongde >= cost ? 'jade' : 'disabled', cost === 0 ? '免费' : `${cost} ${CURRENCY}`, ui.pressed === 'refresh');
  drawButton(ctx, L.btnStart, '出战', 'primary', `迎战第 ${g.wave + 1} 波`, ui.pressed === 'start');
  drawTrash(ctx, L.trash, ui.hoverTrash);
  // One line under the seal: drag help, or what the chosen encounter queued for the next wave.
  const queued = modsLabel(g.waveMods);
  const hint = ui.dragging ? '拖到阵地空格上 · 叠到同名卡上升级' : queued ? `下一波：${queued}` : g.chest ? '宝箱：打完下一波开出一张卡' : '';
  if (hint) {
    // Reason: 7 px was unreadable on a phone. The floor is the ceiling here — the line holds whatever the encounter
    // modifiers produce, so it shrinks no further than the size it is drawn at today.
    const px = fitPx(ctx, hint, s.w - 120, 9, (n) => sans(n, 600), 9);
    text(ctx, hint, W / 2, s.y + 24, sans(px, 600), queued && !ui.dragging ? CINNABAR : ink(0.65));
  }
}

export function drawBattleBar(ctx: CanvasRenderingContext2D, g: GameState, ui: PanelUi): void {
  const b = L.bar;
  paperStrip(ctx, b.y, b.h, 'top');
  const left = g.enemies.length + g.spawns.length;
  const wave = g.totalWaves === UNLIMITED ? `第 ${g.wave} 波` : `第 ${g.wave}/${g.totalWaves} 波`;
  text(ctx, wave, 16, b.y + 18, brush(17), INK, 'left');
  // A berserk endless wave says so for as long as it lasts, ahead of the encounter modifiers.
  const rage = enraged(g);
  const active = [rage ? '妖怪狂暴：不吃眩晕减速击退' : '', modsLabel(g.activeMods)].filter(Boolean).join(' · ');
  const info = active ? `剩余妖怪 ${left} · ${active}` : `剩余妖怪 ${left}`;
  const px = fitPx(ctx, info, W - 160, 11, (n) => sans(n, 600), 8);
  text(ctx, info, 16, b.y + 37, sans(px, 600), rage ? CINNABAR : active ? '#a0521e' : ink(0.7), 'left');
  text(ctx, ui.dragging ? '拖到垃圾桶卖出 →' : '可以随时拖动场上的字', W - 64, b.y + 26, sans(10, 600), ink(0.6), 'right');
  drawTrash(ctx, L.barTrash, ui.hoverTrash);
}

export function drawBanner(ctx: CanvasRenderingContext2D, b: Banner): void {
  const fade = Math.min(1, b.t / 0.18, (b.life - b.t) / 0.35);
  const y = L.hud.h + (b.portrait ? 200 : 40);
  const h = b.portrait ? 92 : b.sub ? 58 : 40;
  ctx.save();
  ctx.globalAlpha = Math.max(0, fade);
  const slide = (1 - Math.min(1, b.t / 0.18)) * 30;
  // An ink-dark band with a gold rule, so the banner's light lettering reads over the paper-coloured map.
  roundRect(ctx, 24 - slide, y - h / 2, W - 48, h, 6);
  ctx.fillStyle = 'rgba(43,36,32,0.88)';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = GILT;
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
