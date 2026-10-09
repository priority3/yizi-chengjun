// Pause and result panels of the chapter screen (kept apart from the scene so each file stays small).
import { CHAPTERS } from '../config/chapters.ts';
import { ENEMIES } from '../config/enemies.ts';
import { MAX_STARS, THREE_STAR_PCT, type StarAward } from '../core/rating.ts';
import { effectText, type ClearRewards } from '../core/treasures.ts';
import type { GameState } from '../core/types.ts';
import { roundRect, text } from '../render/draw.ts';
import { brush, sans } from '../render/fonts.ts';
import { inRect, L, W, type Rect } from '../render/layout.ts';
import { drawRatingStar } from '../render/rating-art.ts';
import { drawSeal } from '../render/share-art.ts';
import { drawStone, drawTreasureToken } from '../render/treasure-art.ts';
import { drawButton, drawPanel } from '../render/widgets.ts';
import type { Pointer } from './input.ts';
import { isSharing } from './share-result.ts';

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

/** Height of the pause panel above its buttons: title and subtitle, clear of the first button. */
const PAUSE_TOP = 144;

/** The pause panel, tall enough for `buttons` stacked buttons below its title. */
export function pausePanel(buttons: number): Rect {
  return panelRect(PAUSE_TOP + buttons * (BUTTON_H + BUTTON_GAP));
}

export function drawPause(ctx: CanvasRenderingContext2D, buttons: readonly OverlayButton[]): void {
  const r = pausePanel(buttons.length);
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
  /** The stars this clear earned and its three-star bonus (null after a loss). */
  award: StarAward | null;
  /** Seconds since the panel appeared: the stars pop in one after another. */
  t: number;
}

/** Result panel heights; a win's panel grows by one line when it pays the three-star bonus. */
const WON_H = 464;
const LOST_H = 330;
const BONUS_LINE = 22;

export function resultPanel(info: ResultInfo): Rect {
  if (info.g.phase !== 'won') return panelRect(LOST_H);
  return panelRect(WON_H + ((info.award?.bonus ?? 0) > 0 ? BONUS_LINE : 0));
}

/** Result stars: distance between their centres, and the timing of their pop-in (seconds). */
const STAR_GAP = 50;
/** The first star starts growing this long after the panel appears... */
const STAR_FIRST = 0.25;
/** ...each next one this much later... */
const STAR_EVERY = 0.35;
/** ...and each takes this long to reach full size. */
const STAR_POP = 0.3;
/** How long the ring of light around a landing star lasts. */
const STAR_RING = 0.45;
/** When the last of `earned` stars has landed. */
const starsDone = (earned: number) => STAR_FIRST + (earned - 1) * STAR_EVERY + STAR_POP;

/** Ease-out with a little overshoot (0 -> 1, peaking near 1.1), so a star pops rather than slides in. */
function popScale(k: number): number {
  if (k <= 0) return 0;
  if (k >= 1) return 1;
  const c = 1.70158;
  const x = k - 1;
  return 1 + (c + 1) * x * x * x + c * x * x;
}

/** The three star sockets, the earned ones popping in one after another with a ring of light as each lands. */
function drawResultStars(ctx: CanvasRenderingContext2D, y: number, earned: number, t: number): void {
  for (let i = 0; i < MAX_STARS; i++) {
    const mid = i === 1;
    const x = W / 2 + (i - 1) * STAR_GAP;
    const sy = mid ? y - 6 : y;
    const r = mid ? 23 : 19;
    drawRatingStar(ctx, x, sy, r, false);
    if (i >= earned) continue;
    const start = STAR_FIRST + i * STAR_EVERY;
    const ring = (t - start - STAR_POP * 0.6) / STAR_RING;
    if (ring > 0 && ring < 1) {
      ctx.beginPath();
      ctx.arc(x, sy, r * (1 + ring), 0, Math.PI * 2);
      ctx.lineWidth = 3 * (1 - ring) + 0.5;
      ctx.strokeStyle = `rgba(255,196,64,${0.85 * (1 - ring)})`;
      ctx.stroke();
    }
    drawRatingStar(ctx, x, sy, r, true, 'paper', popScale((t - start) / STAR_POP));
  }
}

/** 三星奖励 with a small gold star in front, fading in once the third star has landed. */
function drawStarBonus(ctx: CanvasRenderingContext2D, y: number, bonus: number, t: number): void {
  const label = `三星奖励 +${bonus} 灵石`;
  ctx.font = sans(12, 800);
  const left = W / 2 - (ctx.measureText(label).width + 19) / 2;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, (t - starsDone(MAX_STARS)) / 0.25));
  drawRatingStar(ctx, left + 7, y, 7, true);
  text(ctx, label, left + 19, y + 1, sans(12, 800), '#b86a06', 'left');
  ctx.restore();
}

function drawRewards(ctx: CanvasRenderingContext2D, r: Rect, rw: ClearRewards, award: StarAward | null, t: number): void {
  let y = r.y + 202;
  drawStone(ctx, W / 2 - 44, y, 9);
  text(ctx, `灵石 +${rw.stones}`, W / 2 - 30, y + 1, sans(14, 800), '#1b7a5a', 'left');
  if (award && award.bonus > 0) {
    y += BONUS_LINE;
    drawStarBonus(ctx, y, award.bonus, t);
  }
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
  if (won) {
    // A win: the stars under the title push the rest down.
    const stars = info.award?.stars ?? 0;
    drawResultStars(ctx, r.y + 100, stars, info.t);
    text(ctx, `打败了${ENEMIES[ch.boss].name}`, W / 2, r.y + 140, sans(14, 600), '#6a4a26');
    text(ctx, `击杀 ${g.kills} · 阵地剩余 ${Math.ceil(g.campHp)}/${g.campMax}`, W / 2, r.y + 163, sans(12, 500), '#7a6248');
    if (stars < MAX_STARS) text(ctx, `阵地剩 ${THREE_STAR_PCT}% 以上通关可得三星`, W / 2, r.y + 182, sans(10, 600), '#9a7a52');
    if (rewards) drawRewards(ctx, r, rewards, info.award, info.t);
  } else {
    text(ctx, `坚持到第 ${g.wave}/${g.totalWaves} 波`, W / 2, r.y + 88, sans(14, 600), '#6a4a26');
    text(ctx, '多合成、多解锁格子；法宝页能炼器变强', W / 2, r.y + 116, sans(11, 500), '#7a6248');
  }
  drawShareSeal(ctx, r, info.t);
  drawButtons(ctx, r, buttons);
}

// ---- 分享战报 ---------------------------------------------------------------

/**
 * The 分享 seal: its size, and its centre's offset from the panel's top-right corner.
 * Reason: hung over the corner rather than inside the panel, so it stays clear of the title (even a five-character
 * one) and of the stars under it at every design height, without moving anything else on the panel.
 */
const SHARE_SEAL = { w: 64, h: 40, dx: -14, dy: 6 };
/** Room around the seal that still counts as a tap on it. */
const SHARE_SLOP = 8;
/** The seal stamps down this long after the panel appears, taking SEAL_STAMP seconds. */
const SEAL_AT = 0.1;
const SEAL_STAMP = 0.22;

/** Where a tap means 分享战报: the seal plus a finger's margin. */
export function shareButtonRect(panel: Rect): Rect {
  const cx = panel.x + panel.w + SHARE_SEAL.dx;
  const cy = panel.y + SHARE_SEAL.dy;
  const { w, h } = SHARE_SEAL;
  return { x: cx - w / 2 - SHARE_SLOP, y: cy - h / 2 - SHARE_SLOP, w: w + 2 * SHARE_SLOP, h: h + 2 * SHARE_SLOP };
}

/** 分享 as a red seal stamped onto the panel's corner just after it appears; dimmed while a share is under way. */
function drawShareSeal(ctx: CanvasRenderingContext2D, panel: Rect, t: number): void {
  const k = Math.min(1, (t - SEAL_AT) / SEAL_STAMP);
  if (k <= 0) return;
  const r = shareButtonRect(panel);
  const { w, h } = SHARE_SEAL;
  const tilt = -0.1;
  ctx.save();
  ctx.globalAlpha = k * (isSharing() ? 0.5 : 1);
  ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
  // Comes down from a little larger, like a stamp pressed onto the paper.
  ctx.scale(1.35 - 0.35 * k, 1.35 - 0.35 * k);
  ctx.save();
  ctx.rotate(tilt);
  roundRect(ctx, -w / 2 + 1, -h / 2 + 3, w, h, 5);
  ctx.fillStyle = 'rgba(30,10,5,0.35)';
  ctx.fill();
  ctx.restore();
  drawSeal(ctx, 0, 0, w, h, ['分享'], tilt);
  ctx.restore();
}

/** A tap on the result panel: 分享战报 on the seal (once it has stamped down), else one of the stacked buttons. */
export function tapResult(p: Pointer, info: ResultInfo, buttons: readonly OverlayButton[], share: () => void): void {
  const panel = resultPanel(info);
  if (info.t >= SEAL_AT && inRect(p.x, p.y, shareButtonRect(panel))) share();
  else tapButtons(p, panel, buttons);
}
