// The launch splash (plan.md v0.9 合规版 item 3), shown on every launch before the title screen (main.ts leaves it out
// when the page opens the map editor): the game's name, the 12+ 适龄提示 badge and the 健康游戏忠告. It cross-fades
// into the title screen, which it draws underneath while fading out, then hands that same screen over so nothing
// jumps. Timing (tap after 1 s, by itself after 3 s) lives in splash-clock.ts.
import { GAME_NAME, TAGLINE } from '../config/brand.ts';
import { AGE_RATING, HEALTH_ADVICE } from '../config/legal.ts';
import { ageBadgeHeight, drawAgeBadge } from '../render/age-badge.ts';
import { outlined, roundRect, text } from '../render/draw.ts';
import { brush, sans } from '../render/fonts.ts';
import { L, W } from '../render/layout.ts';
import type { Scene } from './scenes.ts';
import { SplashClock, type SplashPhase } from './splash-clock.ts';

/** The page's own background (index.html), so the splash fades in from what showed while the game loaded. */
const INK = '#1d1714';
/** The 适龄提示 badge sits in the top-left corner, where the mark usually goes, this wide. */
const BADGE = { x: 24, y: 24, w: 64 };
/** Distance between the four lines of advice. */
const ADVICE_GAP = 28;

export class SplashScene implements Scene {
  private readonly clock = new SplashClock();
  /** The title screen: drawn underneath while the splash fades out, then handed over through `onDone`. */
  private readonly next: Scene;
  private readonly onDone: () => void;
  private finished = false;

  constructor(next: Scene, onDone: () => void) {
    this.next = next;
    this.onDone = onDone;
  }

  /** Where the splash is in its timing (the scene manager's tests follow it). */
  get phase(): SplashPhase {
    return this.clock.phase;
  }

  update(dt: number): void {
    this.clock.update(dt);
    // The title screen starts moving as soon as it shows through.
    if (this.clock.phase !== 'showing') this.next.update(dt);
    if (this.clock.phase === 'done' && !this.finished) {
      this.finished = true;
      this.onDone();
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const leaving = this.clock.phase !== 'showing';
    if (leaving) this.next.render(ctx);
    ctx.save();
    // Fading in, the dark page stays and only the content appears; fading out, the whole splash gives way.
    ctx.globalAlpha = leaving ? this.clock.alpha : 1;
    paintBackground(ctx);
    if (!leaving) ctx.globalAlpha = this.clock.alpha;
    paintContent(ctx, this.clock.hint, this.clock.t);
    ctx.restore();
  }

  /** A tap anywhere continues (once the splash has been up long enough). */
  tap(): void {
    this.clock.tap();
  }
}

/** The dark page with a warm glow behind the name and a thin gold frame. */
function paintBackground(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, L.H);
  const cy = L.H * 0.32;
  const glow = ctx.createRadialGradient(W / 2, cy, 10, W / 2, cy, 260);
  glow.addColorStop(0, 'rgba(255,170,60,0.16)');
  glow.addColorStop(1, 'rgba(255,170,60,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, L.H);
  roundRect(ctx, 12, 12, W - 24, L.H - 24, 14);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(240,185,58,0.25)';
  ctx.stroke();
}

/** The badge, the name and the advice; `hint` is the 点击任意处继续 line's opacity, `t` the splash's clock. */
function paintContent(ctx: CanvasRenderingContext2D, hint: number, t: number): void {
  drawAgeBadge(ctx, BADGE.x, BADGE.y, BADGE.w, AGE_RATING);
  const badgeMid = BADGE.y + ageBadgeHeight(BADGE.w) / 2;
  text(ctx, `适合 ${AGE_RATING} 周岁及以上用户`, BADGE.x + BADGE.w + 10, badgeMid, sans(12, 600), '#d9c7a4', 'left');

  const ty = L.H * 0.3;
  ctx.save();
  ctx.shadowColor = 'rgba(255,170,60,0.55)';
  ctx.shadowBlur = 20;
  outlined(ctx, GAME_NAME, W / 2, ty, brush(58), '#ffd66b', 'rgba(40,14,4,0.95)', 5);
  ctx.restore();
  outlined(ctx, TAGLINE, W / 2, ty + 48, brush(20), '#fbeed2', 'rgba(40,14,4,0.9)', 4);

  // 健康游戏忠告: a small heading between two short rules, then the four lines, large enough to read on a phone.
  const ay = L.H * 0.56;
  text(ctx, '健康游戏忠告', W / 2, ay, sans(13, 700), '#e8c27a');
  ctx.fillStyle = 'rgba(232,194,122,0.5)';
  ctx.fillRect(W / 2 - 96, ay, 44, 1);
  ctx.fillRect(W / 2 + 52, ay, 44, 1);
  HEALTH_ADVICE.forEach((line, i) => text(ctx, line, W / 2, ay + 36 + i * ADVICE_GAP, sans(15, 500), '#f6ead0'));

  if (hint > 0) {
    ctx.save();
    // A slow breath, so the line reads as an invitation rather than part of the advice.
    ctx.globalAlpha *= hint * (0.75 + 0.25 * Math.sin(t * 3));
    text(ctx, '点击任意处继续', W / 2, L.H - 46, sans(12, 500), 'rgba(251,238,210,0.7)');
    ctx.restore();
  }
}
