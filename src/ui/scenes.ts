// Scene manager plus the title and level-select screens.
import { LEVELS } from '../config/levels.ts';
import { loadProgress, saveProgress, type Progress, type Stage } from '../platform/web.ts';
import { drawToken, roundRect, text } from '../render/draw.ts';
import { H, inRect, W, type Rect } from '../render/layout.ts';
import { drawButton } from './hud.ts';
import type { GestureHandlers, Pointer } from './input.ts';
import { MatchScene } from './match-scene.ts';

export interface Scene extends GestureHandlers {
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D): void;
  /** Called when the page is hidden; scenes with a running clock should pause. */
  pause?(): void;
}

export interface Nav {
  readonly progress: Progress;
  title(): void;
  levels(): void;
  play(level: number): void;
  save(): void;
}

export class SceneManager implements Nav {
  readonly progress: Progress;
  current: Scene;
  private readonly stage: Stage;

  constructor(stage: Stage) {
    this.stage = stage;
    this.progress = loadProgress();
    this.current = new TitleScene(this);
  }

  title(): void {
    this.current = new TitleScene(this);
  }

  levels(): void {
    this.current = new LevelScene(this);
  }

  play(level: number): void {
    this.current = new MatchScene(this.stage, level, this);
  }

  save(): void {
    saveProgress(this.progress);
  }
}

function drawBackdrop(ctx: CanvasRenderingContext2D): void {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#3a1612');
  g.addColorStop(1, '#16100d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

const START_BTN: Rect = { x: 90, y: 430, w: 180, h: 56 };
const DRIFT_GLYPHS = '悟空八戒沙僧白龙棍箭火冰雷神速钱';
const RULES = [
  '① 点「化缘」抽字，字会落进空格',
  '② 同字同级拖到一起，升一级',
  '③ 凑齐「悟」「空」这样的名字，觉醒英雄',
  '④ 守住唐僧：六耳猕猴先倒，你就赢',
];

class TitleScene implements Scene {
  private readonly nav: Nav;
  private t = 0;

  constructor(nav: Nav) {
    this.nav = nav;
  }

  update(dt: number): void {
    this.t += dt;
  }

  render(ctx: CanvasRenderingContext2D): void {
    drawBackdrop(ctx);
    ctx.save();
    for (let i = 0; i < DRIFT_GLYPHS.length; i++) {
      const x = ((i * 53 + this.t * (8 + (i % 4) * 3)) % (W + 60)) - 30;
      const y = 50 + ((i * 97) % 540);
      ctx.globalAlpha = 0.07 + (i % 3) * 0.03;
      text(ctx, DRIFT_GLYPHS[i], x, y, 26 + (i % 3) * 10, '#ffd98a');
    }
    ctx.restore();
    ctx.save();
    ctx.shadowColor = 'rgba(255,170,60,0.55)';
    ctx.shadowBlur = 18;
    text(ctx, '字斗西游', W / 2, 190, 54, '#ffd66b');
    ctx.restore();
    text(ctx, '西游文字合成塔防 · 分屏对战', W / 2, 242, 14, '#e8d5b0', 'center', 500);
    RULES.forEach((r, i) => text(ctx, r, W / 2, 306 + i * 26, 12, '#cdb893', 'center', 500));
    drawButton(ctx, START_BTN, '开始游戏', 'primary');
    text(ctx, '六耳猕猴：你玩不过我吧？', W / 2, 530, 12, '#a8977c', 'center', 500);
  }

  tap(p: Pointer): void {
    if (inRect(p.x, p.y, START_BTN)) this.nav.levels();
  }
}

const BACK_BTN: Rect = { x: 12, y: 18, w: 64, h: 32 };
const NUMERALS = ['一', '二', '三', '四', '五'];

function cardRect(i: number): Rect {
  return { x: 24, y: 92 + i * 96, w: 312, h: 82 };
}

class LevelScene implements Scene {
  private readonly nav: Nav;

  constructor(nav: Nav) {
    this.nav = nav;
  }

  update(): void {}

  render(ctx: CanvasRenderingContext2D): void {
    drawBackdrop(ctx);
    drawButton(ctx, BACK_BTN, '返回', 'ghost');
    text(ctx, '选择关卡', W / 2, 34, 20, '#ffd66b');
    const { unlocked, wins } = this.nav.progress;
    LEVELS.forEach((lv, i) => {
      const r = cardRect(i);
      const open = lv.id <= unlocked;
      ctx.fillStyle = open ? '#f3e7cc' : '#5a514a';
      roundRect(ctx, r.x, r.y, r.w, r.h, 14);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = open ? '#b8862c' : '#3d3834';
      ctx.stroke();
      const ink = open ? '#3b2a1e' : '#a39a90';
      drawToken(ctx, NUMERALS[i], r.x + 38, r.y + r.h / 2, 22, open ? '#6b1c1c' : '#3d3834', open ? '#e0b040' : '#6a625c', open ? '#ffe08a' : '#a39a90');
      text(ctx, `第${NUMERALS[i]}关 · ${lv.name}`, r.x + 74, r.y + 30, 17, ink, 'left');
      text(ctx, `Boss：${lv.boss5} / ${lv.boss10}`, r.x + 74, r.y + 56, 12, open ? '#7a6248' : '#8c837a', 'left', 500);
      const state = !open ? '未解锁' : wins[i] > 0 ? `已胜 ${wins[i]} 场` : '挑战';
      text(ctx, state, r.x + r.w - 16, r.y + r.h / 2, 13, open ? (wins[i] > 0 ? '#2f7d32' : '#b3261e') : '#a39a90', 'right');
    });
    text(ctx, '通关一关才会解锁下一关', W / 2, 600, 12, '#a8977c', 'center', 500);
  }

  tap(p: Pointer): void {
    if (inRect(p.x, p.y, BACK_BTN)) {
      this.nav.title();
      return;
    }
    LEVELS.forEach((lv, i) => {
      if (inRect(p.x, p.y, cardRect(i)) && lv.id <= this.nav.progress.unlocked) this.nav.play(lv.id);
    });
  }
}
