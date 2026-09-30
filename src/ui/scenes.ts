// Scene manager plus the title screen and the chapter select screen.
import { CHAPTERS } from '../config/chapters.ts';
import { ENEMIES } from '../config/enemies.ts';
import { loadProgress, saveProgress, type Progress, type Stage } from '../platform/web.ts';
import { paintBackground } from '../render/background.ts';
import { fitPx, outlined, roundRect, text } from '../render/draw.ts';
import { brush, sans } from '../render/fonts.ts';
import { drawPortrait, type PortraitId } from '../render/heroes-art.ts';
import { inRect, L, W, type Rect } from '../render/layout.ts';
import { monsterSprite } from '../render/monsters-art.ts';
import { NUMERALS } from '../render/panels.ts';
import { blit, sprites } from '../render/sprites.ts';
import { drawButton } from '../render/widgets.ts';
import { GameScene } from './game-scene.ts';
import type { GestureHandlers, Pointer } from './input.ts';

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
  play(chapter: number): void;
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
    this.current = new GameScene(this.stage, chapter, this);
  }

  save(): void {
    saveProgress(this.progress);
  }
}

/** The painted battlefield, darkened, behind menus. */
function backdrop(ctx: CanvasRenderingContext2D, stage: Stage, dim: number): void {
  const img = sprites.get(`bg:${stage.pixelRatio}:${L.H}`, W, L.H, (c) => paintBackground(c, L.H));
  ctx.drawImage(img, 0, 0, W, L.H);
  ctx.fillStyle = `rgba(28,14,6,${dim})`;
  ctx.fillRect(0, 0, W, L.H);
}

const HEROES: PortraitId[] = ['悟空', '八戒', '沙僧', '白龙'];

class TitleScene implements Scene {
  private readonly nav: Nav;
  private readonly stage: Stage;
  private t = 0;

  constructor(nav: Nav, stage: Stage) {
    this.nav = nav;
    this.stage = stage;
  }

  private startRect(): Rect {
    return { x: 90, y: L.H * 0.66, w: 180, h: 56 };
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
    drawButton(ctx, this.startRect(), '开始游戏', 'primary');
    text(ctx, '商店买字拖上阵地 · 同字合成升级 · 凑齐名字觉醒英雄', W / 2, L.H * 0.66 + 82, sans(11, 500), '#e8d5b0');
  }

  tap(p: Pointer): void {
    if (inRect(p.x, p.y, this.startRect())) this.nav.chapters();
  }
}

const BACK: Rect = { x: 12, y: 16, w: 66, h: 34 };

function chapterRect(i: number): Rect {
  const col = i % 2;
  const row = Math.floor(i / 2);
  const top = 72 + Math.max(0, (L.H - 640) * 0.35);
  return { x: 14 + col * 172, y: top + row * 102, w: 160, h: 92 };
}

class ChapterScene implements Scene {
  private readonly nav: Nav;
  private readonly stage: Stage;

  constructor(nav: Nav, stage: Stage) {
    this.nav = nav;
    this.stage = stage;
  }

  update(): void {}

  render(ctx: CanvasRenderingContext2D): void {
    backdrop(ctx, this.stage, 0.62);
    drawButton(ctx, BACK, '返回', 'ghost');
    outlined(ctx, '选择章节', W / 2, 33, brush(26), '#ffd66b', 'rgba(40,14,4,0.9)', 4);
    const { unlocked, wins } = this.nav.progress;
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
  }

  tap(p: Pointer): void {
    if (inRect(p.x, p.y, BACK)) {
      this.nav.title();
      return;
    }
    CHAPTERS.forEach((ch, i) => {
      if (inRect(p.x, p.y, chapterRect(i)) && ch.id <= this.nav.progress.unlocked) this.nav.play(ch.id);
    });
  }
}
