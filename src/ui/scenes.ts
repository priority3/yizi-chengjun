// Scene manager plus the title screen and the chapter select screen.
import { GAME_NAME, TAGLINE } from '../config/brand.ts';
import { CHAPTERS } from '../config/chapters.ts';
import { ENDLESS, ENDLESS_CHAPTER } from '../config/endless.ts';
import type { MapDef } from '../config/maps.ts';
import { dailyMapIndex, dayLabel } from '../core/modes.ts';
import { STAR_BONUS, THREE_STAR_PCT, TWO_STAR_PCT } from '../core/rating.ts';
import { dailyBest } from '../core/records.ts';
import type { GameMode } from '../core/types.ts';
import { platform, type Stage } from '../platform/env.ts';
import { loadProgress, saveProgress, type Progress } from '../platform/progress.ts';
import { clearRun, loadRun, peekRun, type RunInfo } from '../platform/save.ts';
import { todayKey } from '../platform/today.ts';
import { ChapterCards, thumbRect, type ChapterCard } from '../render/chapter-card.ts';
import { fitPx, outlined, text } from '../render/draw.ts';
import { brush, sans } from '../render/fonts.ts';
import { drawPortrait, type PortraitId } from '../render/heroes-art.ts';
import { inRect, L, W, type Rect } from '../render/layout.ts';
import { peekThumb, warmThumbs } from '../render/map-thumb.ts';
import { drawModeCard, type ModeCard } from '../render/mode-card.ts';
import { NUMERALS } from '../render/panels.ts';
import { drawUpdateBanner, updateBannerHit } from '../render/update-banner.ts';
import { BACK, backdrop, drawButton, drawPanel } from '../render/widgets.ts';
import { AboutScene } from './about-scene.ts';
import { chapterRect, entryRect } from './chapter-layout.ts';
import { GameScene } from './game-scene.ts';
import type { GestureHandlers, Pointer } from './input.ts';
import { SplashScene } from './splash-scene.ts';
import { ABOUT_BUTTON, continueButton, hintRows, startButton, versionAnchor } from './title-layout.ts';
import { TreasureScene } from './treasure-scene.ts';
import { versionLabel } from './version-label.ts';

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
  /** Starts a fresh endless run (chapter 10's map and rules, no last wave), discarding any saved unfinished run. */
  endless(): void;
  /** Starts today's daily challenge (today's map and seed, no 法宝), discarding any saved unfinished run. */
  daily(): void;
  /** Continues the saved unfinished run; false (and nothing changes) when there is no usable save. */
  resume(): boolean;
  /** The 法宝 (treasure) screen. */
  treasures(): void;
  save(): void;
  /** The map editor (plan.md D1), opened from the address …/#editor; does nothing in a build without it. */
  editor(): void;
  /**
   * The map editor's 试玩: a chapter-1 run on `def` without 法宝. It is never saved and earns nothing, so the saved
   * unfinished run (if any) stays; its menus lead back to the editor.
   */
  tryMap(def: MapDef): void;
}

/** How the game opens. */
export interface SceneOptions {
  /**
   * The launch splash (健康游戏忠告 and the 12+ 适龄提示) shows before the title screen, on every launch (plan.md
   * v0.9); main.ts leaves it out when the page opens the map editor. Default true.
   */
  splash?: boolean;
  /**
   * Makes the map editor, a web-only screen (ui/editor-scene.ts): main.ts passes it, so the shared scenes never import
   * the editor and a mini-game build leaves it out. Without it editor() does nothing.
   */
  editor?: (nav: Nav, stage: Stage) => Scene;
}

export class SceneManager implements Nav {
  readonly progress: Progress;
  current: Scene;
  private readonly stage: Stage;
  private readonly makeEditor: SceneOptions['editor'];
  /** The map editor, made the first time it opens. */
  private editorScene: Scene | null = null;

  constructor(stage: Stage, options: SceneOptions = {}) {
    this.stage = stage;
    this.makeEditor = options.editor;
    this.progress = loadProgress(CHAPTERS.length);
    const title = new TitleScene(this, stage);
    this.current = options.splash === false ? title : this.splash(title);
  }

  /**
   * The launch splash in front of `title`, handing that same title screen over once it has faded into it.
   * Reason: title(), chapters(), play(n) or editor() (the console handle, external screenshot scripts) may replace
   * the splash at any moment; a replaced splash is no longer updated, so it never takes the screen back.
   */
  private splash(title: Scene): Scene {
    const splash: Scene = new SplashScene(title, () => {
      if (this.current === splash) this.current = title;
    });
    return splash;
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

  endless(): void {
    this.openRun('endless');
  }

  daily(): void {
    this.openRun('daily');
  }

  /** A fresh endless or daily run (both play chapter 10's rules), replacing any unfinished one like play() does. */
  private openRun(mode: GameMode): void {
    clearRun();
    this.current = new GameScene(this.stage, ENDLESS_CHAPTER, this, undefined, mode);
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

  /** The 关于 screen (隐私政策, 用户协议, 适龄提示, 健康游戏忠告, version and contact), opened from the title screen. */
  about(): void {
    this.current = new AboutScene(this, this.stage);
  }

  save(): void {
    saveProgress(this.progress);
  }

  /** One editor per page: coming back from 试玩 (or reopening it) finds its undo steps and view as they were. */
  editor(): void {
    if (!this.makeEditor) return;
    this.editorScene ??= this.makeEditor(this, this.stage);
    this.current = this.editorScene;
  }

  /** Whether the map editor is on screen (main.ts closes it when the address drops #editor). */
  inEditor(): boolean {
    return this.editorScene !== null && this.current === this.editorScene;
  }

  tryMap(def: MapDef): void {
    // Reason: unlike play(), no clearRun(): a 试玩 is never saved, so the unfinished run it would replace stays resumable.
    this.current = new GameScene(this.stage, 1, this, undefined, 'chapter', def);
  }
}

const HEROES: PortraitId[] = ['悟空', '八戒', '沙僧', '白龙'];

/** Where a saved run stands, e.g. 第三章 · 第 4 波, 无尽 · 第 12 波, 每日挑战 · 第 7 波. */
function runLabel(run: RunInfo): string {
  const where = run.mode === 'endless' ? '无尽' : run.mode === 'daily' ? '每日挑战' : `第${NUMERALS[run.chapter - 1]}章`;
  return `${where} · 第 ${run.wave} 波`;
}

/** What the title screen opens besides the screens every menu reaches: the 关于 screen. */
interface TitleNav extends Nav {
  about(): void;
}

class TitleScene implements Scene {
  private readonly nav: TitleNav;
  private readonly stage: Stage;
  private t = 0;
  /** The unfinished run 继续上次 offers, read once when the screen opens. */
  private run: RunInfo | null;

  constructor(nav: TitleNav, stage: Stage) {
    this.nav = nav;
    this.stage = stage;
    this.run = peekRun();
  }

  /** 开始游戏: smaller, under 继续上次, while a run is saved (title-layout.ts). */
  private startRect(): Rect {
    return startButton(this.run !== null);
  }

  private continueRect(): Rect {
    return continueButton();
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
    outlined(ctx, GAME_NAME, W / 2, ty, brush(66), '#ffd66b', 'rgba(40,14,4,0.95)', 6);
    ctx.restore();
    outlined(ctx, TAGLINE, W / 2, ty + 54, brush(22), '#fbeed2', 'rgba(40,14,4,0.9)', 4);
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
    const [hint1, hint2] = hintRows();
    text(ctx, '商店买字拖上阵地 · 同字合成升级 · 凑齐名字觉醒英雄', W / 2, hint1, sans(11, 500), '#e8d5b0');
    text(ctx, '英雄攒满怒气放大招 · 波间奇遇三选一 · 通关得灵石炼法宝', W / 2, hint2, sans(11, 500), '#e8d5b0');
    // Faint version label for telling deployments apart when something needs debugging (version-label.ts).
    const v = versionAnchor();
    text(ctx, versionLabel(), v.x, v.y, sans(9, 500), 'rgba(255,240,210,0.45)', 'right');
    drawButton(ctx, ABOUT_BUTTON, '关于', 'ghost');
    // A newer build is installed and waiting (web production builds only, see platform/pwa.ts).
    const update = platform().update;
    if (update?.ready()) drawUpdateBanner(ctx, this.t, update.applying());
  }

  tap(p: Pointer): void {
    const update = platform().update;
    if (update?.ready() && inRect(p.x, p.y, updateBannerHit())) {
      update.apply();
      return;
    }
    if (inRect(p.x, p.y, ABOUT_BUTTON)) {
      this.nav.about();
      return;
    }
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
  /** The unfinished run a new one would overwrite, read once when the screen opens. */
  private run: RunInfo | null;
  /** The run tapped while one is saved, started if the prompt's 开新局 is chosen; null while the prompt is closed. */
  private asking: (() => void) | null = null;
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

  /** The row with the 每日挑战 and 无尽 entries shows once the daily challenge is open: from chapter 1's first clear. */
  private entries(): boolean {
    const { wins } = this.nav.progress;
    return wins[0] > 0 || wins[ENDLESS_CHAPTER - 1] > 0;
  }

  update(dt: number): void {
    this.t += dt;
    // Thumbnails still missing at the current size get painted a couple per frame; placeholders show meanwhile.
    const tr = thumbRect(chapterRect(0, this.entries()));
    for (const ch of warmThumbs(CHAPTER_IDS, tr.w, tr.h, this.stage.pixelRatio)) this.paintedAt.set(ch, this.t);
  }

  render(ctx: CanvasRenderingContext2D): void {
    backdrop(ctx, this.stage, 0.62);
    drawButton(ctx, BACK, '返回', 'ghost');
    outlined(ctx, '选择章节', W / 2, 33, brush(26), '#ffd66b', 'rgba(40,14,4,0.9)', 4);
    const { unlocked, wins, stars, vault } = this.nav.progress;
    drawButton(ctx, TREASURES, '法宝', 'jade', `${vault.stones} 灵石`);
    const entries = this.entries();
    // The first open chapter without a clear is the one to play next.
    const next = CHAPTER_IDS.find((id) => id <= unlocked && !(wins[id - 1] > 0)) ?? 0;
    const cards = CHAPTERS.map((ch, i) => {
      const r = chapterRect(i, entries);
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
    if (entries) this.drawEntries(ctx);
    text(ctx, `通关时阵地血量剩 ${THREE_STAR_PCT}% 以上得三星，${TWO_STAR_PCT}% 以上得两星`, W / 2, L.H - 38, sans(10, 500), '#b9a585');
    text(ctx, `每章第一次拿到三星，额外奖励 ${STAR_BONUS} 灵石`, W / 2, L.H - 22, sans(10, 500), '#b9a585');
    if (this.asking && this.run) this.drawPrompt(ctx, this.run);
  }

  /**
   * The 每日挑战 entry (today's date, map and best) and the 无尽 entry (locked until chapter 10 is cleared) under the grid.
   * Reason: their thumbnails are the chapter cards' ones, scaled into the smaller box, since map-thumb.ts keeps one size
   * per chapter: painting another size for the entries would repaint both every frame.
   */
  private drawEntries(ctx: CanvasRenderingContext2D): void {
    const p = this.nav.progress;
    const tr = thumbRect(chapterRect(0, true));
    const thumb = (chapter: number) => peekThumb(chapter, tr.w, tr.h, this.stage.pixelRatio);
    // Read every frame, so the entry turns to the new day's challenge at midnight.
    const day = todayKey();
    const map = dailyMapIndex(day) + 1;
    const dailyOpen = p.wins[0] > 0;
    const daily: ModeCard = {
      title: '每日挑战',
      color: '#1b7a5a',
      info: dailyOpen ? `${dayLabel(day)} · ${CHAPTERS[map - 1].name}` : '通关第一章开启',
      record: !dailyOpen ? '' : p.daily.key === day ? `今日最佳 撑过 ${dailyBest(p, day)} 波` : '今天还没挑战',
      hot: p.daily.key !== day,
      open: dailyOpen,
      chapter: map,
      thumb: thumb(map),
      t: this.t,
    };
    const endlessOpen = p.wins[ENDLESS_CHAPTER - 1] > 0;
    const endless: ModeCard = {
      title: '无尽',
      color: '#8a3a22',
      info: endlessOpen ? `每 ${ENDLESS.bossEvery} 波来一个 Boss` : `通关第${NUMERALS[ENDLESS_CHAPTER - 1]}章开启`,
      record: !endlessOpen ? '' : p.endlessBest > 0 ? `最佳 撑过 ${p.endlessBest} 波` : '还没打过',
      hot: p.endlessBest === 0,
      open: endlessOpen,
      chapter: ENDLESS_CHAPTER,
      thumb: thumb(ENDLESS_CHAPTER),
      t: this.t,
    };
    drawModeCard(ctx, entryRect(0), daily);
    drawModeCard(ctx, entryRect(1), endless);
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

  /** Starts a run (`start`), or first asks what to do with the unfinished run a new one would overwrite. */
  private open(start: () => void): void {
    if (this.run) this.asking = start;
    else start();
  }

  private tapPrompt(p: Pointer): void {
    const [fresh, resume, cancel] = promptButtons();
    if (inRect(p.x, p.y, fresh)) {
      // nav.play(), endless() and daily() clear the saved run before starting the new one.
      this.asking?.();
    } else if (inRect(p.x, p.y, resume)) {
      // Reason: resume() only fails if the save went bad since the screen opened; then forget it and close.
      if (!this.nav.resume()) {
        this.run = null;
        this.asking = null;
      }
    } else if (inRect(p.x, p.y, cancel)) {
      this.asking = null;
    }
  }

  tap(p: Pointer): void {
    // While the prompt is open, only its buttons respond.
    if (this.asking) {
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
    const { unlocked, wins } = this.nav.progress;
    const entries = this.entries();
    CHAPTERS.forEach((ch, i) => {
      if (inRect(p.x, p.y, chapterRect(i, entries)) && ch.id <= unlocked) this.open(() => this.nav.play(ch.id));
    });
    if (!entries) return;
    if (inRect(p.x, p.y, entryRect(0)) && wins[0] > 0) this.open(() => this.nav.daily());
    if (inRect(p.x, p.y, entryRect(1)) && wins[ENDLESS_CHAPTER - 1] > 0) this.open(() => this.nav.endless());
  }
}
