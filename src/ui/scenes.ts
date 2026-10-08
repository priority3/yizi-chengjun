// Scene manager plus the title screen and the chapter select screen.
import { CHAPTERS } from '../config/chapters.ts';
import { ENEMIES } from '../config/enemies.ts';
import { clearRun, loadRun, peekRun, type RunInfo } from '../platform/save.ts';
import { loadProgress, saveProgress, type Progress, type Stage } from '../platform/web.ts';
import { fitPx, outlined, roundRect, text } from '../render/draw.ts';
import { brush, sans } from '../render/fonts.ts';
import { drawPortrait, type PortraitId } from '../render/heroes-art.ts';
import { inRect, L, W, type Rect } from '../render/layout.ts';
import { monsterSprite } from '../render/monsters-art.ts';
import { NUMERALS } from '../render/panels.ts';
import { blit } from '../render/sprites.ts';
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
    text(ctx, `v${__APP_VERSION__} · ${__APP_BUILD__}`, W - 8, L.H - 9, sans(9, 500), 'rgba(255,240,210,0.45)', 'right');
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

function chapterRect(i: number): Rect {
  const col = i % 2;
  const row = Math.floor(i / 2);
  const top = 72 + Math.max(0, (L.H - 640) * 0.35);
  return { x: 14 + col * 172, y: top + row * 102, w: 160, h: 92 };
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

  constructor(nav: Nav, stage: Stage) {
    this.nav = nav;
    this.stage = stage;
    this.run = peekRun();
  }

  update(): void {}

  render(ctx: CanvasRenderingContext2D): void {
    backdrop(ctx, this.stage, 0.62);
    drawButton(ctx, BACK, '返回', 'ghost');
    outlined(ctx, '选择章节', W / 2, 33, brush(26), '#ffd66b', 'rgba(40,14,4,0.9)', 4);
    const { unlocked, wins, vault } = this.nav.progress;
    drawButton(ctx, TREASURES, '法宝', 'jade', `${vault.stones} 灵石`);
    CHAPTERS.forEach((ch, i) => {
      const r = chapterRect(i);
      const open = ch.id <= unlocked;
      roundRect(ctx, r.x, r.y, r.w, r.h, 14);
      ctx.fillStyle = open ? '#f6ead0' : '#6a6058';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = open ? '#b8862c' : '#4a4440';
      ctx.stroke();
      const { img, box } = monsterSprite(ch.boss);
      ctx.save();
      if (!open) ctx.globalAlpha = 0.35;
      blit(ctx, img, r.x + 36, r.y + 48, box, box, 60 / box);
      ctx.restore();
      const ink = open ? '#3b2a1e' : '#b0a698';
      text(ctx, `第${NUMERALS[i]}章`, r.x + 72, r.y + 22, brush(15), open ? '#8a3a22' : ink, 'left');
      // Reason: four-character names (小雷音寺) would overflow the card at the default size.
      text(ctx, ch.name, r.x + 72, r.y + 48, brush(fitPx(ctx, ch.name, r.w - 80, 22, brush)), ink, 'left');
      const state = !open ? '未解锁' : wins[i] > 0 ? '已通关' : `Boss ${ENEMIES[ch.boss].name}`;
      text(ctx, state, r.x + 72, r.y + 73, sans(10, 700), !open ? '#b0a698' : wins[i] > 0 ? '#2f7d32' : '#b3261e', 'left');
    });
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
