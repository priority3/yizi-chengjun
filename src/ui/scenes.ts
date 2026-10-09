// Scene manager plus the title screen and the chapter select screen.
import { CHAPTERS } from '../config/chapters.ts';
import { STAR_BONUS, THREE_STAR_PCT, TWO_STAR_PCT } from '../core/rating.ts';
import { clearRun, loadRun, peekRun, type RunInfo } from '../platform/save.ts';
import { loadProgress, saveProgress, type Progress, type Stage } from '../platform/web.ts';
import { ChapterCards, thumbRect, type ChapterCard } from '../render/chapter-card.ts';
import { fitPx, outlined, text } from '../render/draw.ts';
import { brush, sans } from '../render/fonts.ts';
import { drawPortrait, type PortraitId } from '../render/heroes-art.ts';
import { inRect, L, W, type Rect } from '../render/layout.ts';
import { peekThumb, warmThumbs } from '../render/map-thumb.ts';
import { NUMERALS } from '../render/panels.ts';
import { BACK, backdrop, drawButton, drawPanel } from '../render/widgets.ts';
import { GameScene } from './game-scene.ts';
import type { GestureHandlers, Pointer } from './input.ts';
import { TreasureScene } from './treasure-scene.ts';

export interface Scene extends GestureHandlers {
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D): void;
  /** Called when the page is hidden; scenes with a running clock should pause. */
  pause?(): void;
}

export interface Nav {
  readonly progress: Progress;
  title(): void;
  chapters(): void;
  /** Starts a fresh run of `chapter`, discarding any saved unfinished run. */
  play(chapter: number): void;
  /** Continues the saved unfinished run; false (and nothing changes) when there is no usable save. */
  resume(): boolean;
  /** The 法宝 (treasure) screen. */
  treasures(): void;
  save(): void;
}

export class SceneManager implements Nav {
  readonly progress: Progress;
  current: Scene;
  private readonly stage: Stage;

  constructor(stage: Stage) {
    this.stage = stage;
    this.progress = loadProgress(CHAPTERS.length);
    this.current = new TitleScene(this, stage);
  }

  title(): void {
    this.current = new TitleScene(this, this.stage);
  }

  chapters(): void {
    this.current = new ChapterScene(this, this.stage);
  }

  play(chapter: number): void {
    // Reason: the new run replaces the unfinished one; keeping its save would offer a stale 继续上次 after a reload.
    clearRun();
    this.current = new GameScene(this.stage, chapter, this);
  }

  resume(): boolean {
    const run = loadRun();
    if (!run) return false;
    this.current = new GameScene(this.stage, run.g.chapter, this, run);
    return true;
  }

  treasures(): void {
    this.current = new TreasureScene(this, this.stage);
  }

  save(): void {
    saveProgress(this.progress);
  }
}

const HEROES: PortraitId[] = ['悟空', '八戒', '沙僧', '白龙'];

/** Where a saved run stands, e.g. 第三章 · 第 4 波. */
function runLabel(run: RunInfo): string {
  return `第${NUMERALS[run.chapter - 1]}章 · 第 ${run.wave} 波`;
}

class TitleScene implements Scene {
  private readonly nav: Nav;
  private readonly stage: Stage;
  private t = 0;
  /** The unfinished run 继续上次 offers, read once when the screen opens. */
  private run: RunInfo | null;

  constructor(nav: Nav, stage: Stage) {
    this.nav = nav;
    this.stage = stage;
    this.run = peekRun();
  }

  /**
   * Reason: with a saved run, 继续上次 sits on top and a smaller 开始游戏 just below it; both stay between the
   * hero portraits and the two hint lines at every design height (640..800).
   */
  private startRect(): Rect {
    return this.run ? { x: 90, y: L.H * 0.66 + 14, w: 180, h: 44 } : { x: 90, y: L.H * 0.66, w: 180, h: 56 };
  }

  private continueRect(): Rect {
    return { x: 90, y: L.H * 0.66 - 52, w: 180, h: 56 };
  }

  update(dt: number): void {
    this.t += dt;
  }

  render(ctx: CanvasRenderingContext2D): void {
    backdrop(ctx, this.stage, 0.5);
    const ty = L.H * 0.24;
    ctx.save();
    ctx.shadowColor = 'rgba(255,170,60,0.6)';
    ctx.shadowBlur = 22;
    outlined(ctx, '字斗西游', W / 2, ty, brush(66), '#ffd66b', 'rgba(40,14,4,0.95)', 6);
    ctx.restore();
    outlined(ctx, '西游文字塔防', W / 2, ty + 54, brush(22), '#fbeed2', 'rgba(40,14,4,0.9)', 4);
    HEROES.forEach((h, i) => {
      const x = 60 + i * 80;
      const y = L.H * 0.47 + Math.sin(this.t * 3 + i) * 4;
      ctx.beginPath();
      ctx.arc(x, y, 30, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,240,210,0.18)';
      ctx.fill();
      drawPortrait(ctx, h, x, y, 25);
      outlined(ctx, h, x, y + 42, brush(16), '#fbeed2', 'rgba(40,14,4,0.9)', 3);
    });
    if (this.run) {
      drawButton(ctx, this.continueRect(), '继续上次', 'primary', runLabel(this.run));
      drawButton(ctx, this.startRect(), '开始游戏', 'ghost');
    } else {
      drawButton(ctx, this.startRect(), '开始游戏', 'primary');
    }
    text(ctx, '商店买字拖上阵地 · 同字合成升级 · 凑齐名字觉醒英雄', W / 2, L.H * 0.66 + 82, sans(11, 500), '#e8d5b0');
    text(ctx, '英雄攒满怒气放大招 · 波间奇遇三选一 · 通关得灵石炼法宝', W / 2, L.H * 0.66 + 100, sans(11, 500), '#e8d5b0');
    // Faint version label for telling deployments apart when something needs debugging.
    // Reason: the host tells apart the entry points (vercel.app, a custom domain, localhost) when a player reports a bug.
    text(ctx, `v${__APP_VERSION__} · ${__APP_BUILD__} · ${location.host}`, W - 8, L.H - 9, sans(9, 500), 'rgba(255,240,210,0.45)', 'right');
  }

  tap(p: Pointer): void {
    if (this.run && inRect(p.x, p.y, this.continueRect())) {
      // Reason: resume() only fails if the save went bad since the screen opened; then drop the button.
      if (!this.nav.resume()) this.run = null;
      return;
    }
    if (inRect(p.x, p.y, this.startRect())) this.nav.chapters();
  }
}

/** 法宝 button, top right of the chapter screen. */
const TREASURES: Rect = { x: W - 84, y: 12, w: 72, h: 40 };
/** Every chapter number in grid order, the order the map thumbnails are painted in. */
const CHAPTER_IDS = CHAPTERS.map((c) => c.id);
/** Seconds a freshly painted thumbnail takes to fade in over its placeholder. */
const THUMB_FADE = 0.25;

/**
 * Card `i` of the 2 x 5 grid.
 * Reason: 92 high at the shortest design height (the grid keeps its old size there) and up to 112 on tall phones,
 * so the map thumbnails get the room; the grid always ends above the two hint lines at the bottom.
 */
function chapterRect(i: number): Rect {
  const col = i % 2;
  const row = Math.floor(i / 2);
  const extra = Math.max(0, L.H - 640);
  const h = Math.round(92 + extra * 0.125);
  const top = Math.round(72 + extra * 0.2);
  return { x: 14 + col * 172, y: top + row * (h + 10), w: 160, h };
}

/** The 有一局没打完 prompt, shown when a chapter is tapped while an unfinished run is saved. */
function promptPanel(): Rect {
  return { x: 36, y: L.H / 2 - 139, w: W - 72, h: 278 };
}

/** The prompt's buttons, top to bottom: 开新局, 继续上次, 取消. */
function promptButtons(): Rect[] {
  const p = promptPanel();
  return [0, 1, 2].map((i) => ({ x: p.x + 34, y: p.y + 108 + i * 52, w: p.w - 68, h: 42 }));
}

class ChapterScene implements Scene {
  private readonly nav: Nav;
  private readonly stage: Stage;
  /** The unfinished run a new chapter would overwrite, read once when the screen opens. */
  private run: RunInfo | null;
  /** Chapter tapped while a run is saved: the prompt is open for it (0 = closed). */
  private asking = 0;
  /** Animation clock (seconds): thumbnail fade-in, placeholder sheen, the next chapter's glow. */
  private t = 0;
  /** When each thumbnail painted during this visit became ready (chapter -> t), for its fade-in. */
  private readonly paintedAt = new Map<number, number>();
  /** Draws the cards, caching the settled ones (the cache goes with this screen). */
  private readonly cards = new ChapterCards();

  constructor(nav: Nav, stage: Stage) {
    this.nav = nav;
    this.stage = stage;
    this.run = peekRun();
  }

  update(dt: number): void {
    this.t += dt;
    // Thumbnails still missing at the current size get painted a couple per frame; placeholders show meanwhile.
    const tr = thumbRect(chapterRect(0));
    for (const ch of warmThumbs(CHAPTER_IDS, tr.w, tr.h, this.stage.pixelRatio)) this.paintedAt.set(ch, this.t);
  }

  render(ctx: CanvasRenderingContext2D): void {
    backdrop(ctx, this.stage, 0.62);
    drawButton(ctx, BACK, '返回', 'ghost');
    outlined(ctx, '选择章节', W / 2, 33, brush(26), '#ffd66b', 'rgba(40,14,4,0.9)', 4);
    const { unlocked, wins, stars, vault } = this.nav.progress;
    drawButton(ctx, TREASURES, '法宝', 'jade', `${vault.stones} 灵石`);
    // The first open chapter without a clear is the one to play next.
    const next = CHAPTER_IDS.find((id) => id <= unlocked && !(wins[id - 1] > 0)) ?? 0;
    const cards = CHAPTERS.map((ch, i) => {
      const r = chapterRect(i);
      const tr = thumbRect(r);
      const at = this.paintedAt.get(ch.id);
      const c: ChapterCard = {
        chapter: ch.id,
        open: ch.id <= unlocked,
        cleared: wins[i] > 0,
        stars: stars[i] ?? 0,
        next: ch.id === next,
        thumb: peekThumb(ch.id, tr.w, tr.h, this.stage.pixelRatio),
        fade: at === undefined ? 1 : Math.min(1, (this.t - at) / THUMB_FADE),
        t: this.t,
      };
      return { r, c };
    });
    this.cards.draw(ctx, cards);
    text(ctx, `通关时阵地血量剩 ${THREE_STAR_PCT}% 以上得三星，${TWO_STAR_PCT}% 以上得两星`, W / 2, L.H - 38, sans(10, 500), '#b9a585');
    text(ctx, `每章第一次拿到三星，额外奖励 ${STAR_BONUS} 灵石`, W / 2, L.H - 22, sans(10, 500), '#b9a585');
    if (this.asking > 0 && this.run) this.drawPrompt(ctx, this.run);
  }

  private drawPrompt(ctx: CanvasRenderingContext2D, run: RunInfo): void {
    const r = promptPanel();
    drawPanel(ctx, r);
    text(ctx, '有一局没打完', W / 2, r.y + 46, brush(28), '#6b1c1c');
    const msg = `${runLabel(run)}：开新局会覆盖它`;
    text(ctx, msg, W / 2, r.y + 84, sans(fitPx(ctx, msg, r.w - 40, 13, (n) => sans(n, 600)), 600), '#7a6248');
    const [fresh, resume, cancel] = promptButtons();
    drawButton(ctx, fresh, '开新局', 'danger');
    drawButton(ctx, resume, '继续上次', 'primary');
    drawButton(ctx, cancel, '取消', 'ghost');
  }

  /** Starts a chapter, or first asks what to do with the unfinished run a new one would overwrite. */
  private open(chapter: number): void {
    if (this.run) this.asking = chapter;
    else this.nav.play(chapter);
  }

  private tapPrompt(p: Pointer): void {
    const [fresh, resume, cancel] = promptButtons();
    if (inRect(p.x, p.y, fresh)) {
      // nav.play() clears the saved run before starting the new one.
      this.nav.play(this.asking);
    } else if (inRect(p.x, p.y, resume)) {
      // Reason: resume() only fails if the save went bad since the screen opened; then forget it and close.
      if (!this.nav.resume()) {
        this.run = null;
        this.asking = 0;
      }
    } else if (inRect(p.x, p.y, cancel)) {
      this.asking = 0;
    }
  }

  tap(p: Pointer): void {
    // While the prompt is open, only its buttons respond.
    if (this.asking > 0) {
      this.tapPrompt(p);
      return;
    }
    if (inRect(p.x, p.y, BACK)) {
      this.nav.title();
      return;
    }
    if (inRect(p.x, p.y, TREASURES)) {
      this.nav.treasures();
      return;
    }
    CHAPTERS.forEach((ch, i) => {
      if (inRect(p.x, p.y, chapterRect(i)) && ch.id <= this.nav.progress.unlocked) this.open(ch.id);
    });
  }
}
