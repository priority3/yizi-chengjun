// The 关于 screen (plan.md v0.9 合规版 item 3), opened by the title screen's 关于 button: one scrolling parchment page
// with the 隐私政策, 用户协议, 适龄提示, 健康游戏忠告 and the version and contact address (laid out by about-layout.ts).
// Drag it or turn the wheel to scroll, tap a button at the top of the page to jump to a section; 返回 goes back to
// the title screen.
import { AGE_RATING } from '../config/legal.ts';
import type { Stage } from '../platform/env.ts';
import { drawAgeBadge } from '../render/age-badge.ts';
import { outlined, roundRect, text } from '../render/draw.ts';
import { brush } from '../render/fonts.ts';
import { inRect, W, type Rect } from '../render/layout.ts';
import { BACK, backdrop, drawButton, drawPanel } from '../render/widgets.ts';
import { ABOUT_FONT, aboutPanel, aboutView, itemSpan, JUMP_FONT, layoutAbout, TEXT_W, TEXT_X, type AboutItem, type AboutPage, type AboutStyle } from './about-layout.ts';
import type { Pointer } from './input.ts';
import type { Nav, Scene } from './scenes.ts';
import { Scroller } from './scroller.ts';
import { versionLabel } from './version-label.ts';

/** Colour of each kind of text on the parchment. */
const COLOR: Readonly<Record<AboutStyle, string>> = {
  title: '#6b1c1c',
  meta: '#8a6a48',
  heading: '#8a3a22',
  body: '#4a3426',
  advice: '#6b1c1c',
};

/** Height of the soft shadows that show more of the page hides past the view's top or bottom edge. */
const EDGE_SHADE = 12;

export class AboutScene implements Scene {
  private readonly nav: Nav;
  private readonly stage: Stage;
  private readonly scroller = new Scroller();
  private page: AboutPage | null = null;
  /** A drag is scrolling the page. */
  private dragging = false;

  constructor(nav: Nav, stage: Stage) {
    this.nav = nav;
    this.stage = stage;
  }

  /** How far the page is scrolled (0 = its top). */
  get scroll(): number {
    return this.scroller.offset;
  }

  /** The page, laid out on first use with the stage's context measuring the text. */
  content(): AboutPage {
    if (!this.page) {
      const ctx = this.stage.ctx;
      this.page = layoutAbout((s, font) => {
        ctx.font = font;
        return ctx.measureText(s).width;
      }, versionLabel());
    }
    return this.page;
  }

  /** Keeps the scroll range in step with the view, which changes with the design height (rotation, browser bars). */
  private fit(): void {
    this.scroller.setRange(this.content().height, aboutView().h);
  }

  update(dt: number): void {
    this.fit();
    this.scroller.update(dt);
  }

  render(ctx: CanvasRenderingContext2D): void {
    this.fit();
    backdrop(ctx, this.stage, 0.62);
    drawPanel(ctx, aboutPanel());
    drawButton(ctx, BACK, '返回', 'ghost');
    outlined(ctx, '关于', W / 2, 33, brush(26), '#ffd66b', 'rgba(40,14,4,0.9)', 4);
    const view = aboutView();
    const page = this.content();
    // Screen y of the page's top edge.
    const top = view.y - this.scroller.offset;
    ctx.save();
    ctx.beginPath();
    ctx.rect(view.x, view.y, view.w, view.h);
    ctx.clip();
    for (const item of page.items) {
      const [a, b] = itemSpan(item);
      if (top + b >= view.y && top + a <= view.y + view.h) drawItem(ctx, item, top);
    }
    ctx.restore();
    this.drawEdges(ctx, view, page.height);
  }

  /** Soft shadows where more of the page hides above or below, and a thin scroll bar along the right edge. */
  private drawEdges(ctx: CanvasRenderingContext2D, view: Rect, height: number): void {
    const max = this.scroller.maxOffset;
    if (max <= 0) return;
    const offset = this.scroller.offset;
    if (offset > 0.5) shade(ctx, view, view.y, 1);
    if (offset < max - 0.5) shade(ctx, view, view.y + view.h, -1);
    const thumbH = Math.max(28, (view.h * view.h) / height);
    const thumbY = view.y + ((view.h - thumbH) * offset) / max;
    roundRect(ctx, view.x + view.w - 6, thumbY, 3, thumbH, 1.5);
    ctx.fillStyle = 'rgba(120,80,30,0.38)';
    ctx.fill();
  }

  /** A finger on the page catches it mid-glide or mid-fling. */
  press(p: Pointer): void {
    if (inRect(p.x, p.y, aboutView())) this.scroller.hold();
  }

  dragStart(start: Pointer, p: Pointer): void {
    this.dragging = true;
    this.scroller.dragStart(start.y);
    // Reason: input.ts reports a drag only after a few pixels of movement; catch up on them at once.
    this.scroller.dragMove(p.y);
  }

  dragMove(p: Pointer): void {
    if (this.dragging) this.scroller.dragMove(p.y);
  }

  dragEnd(): void {
    if (!this.dragging) return;
    this.dragging = false;
    this.scroller.dragEnd();
  }

  /** A second finger turns the drag into a pinch (input.ts): the page just stops where it is. */
  pinchStart(): void {
    this.dragging = false;
    this.scroller.cancelDrag();
  }

  wheel(_p: Pointer, deltaY: number): void {
    this.scroller.wheel(deltaY);
  }

  tap(p: Pointer): void {
    if (inRect(p.x, p.y, BACK)) {
      this.nav.title();
      return;
    }
    const view = aboutView();
    if (!inRect(p.x, p.y, view)) return;
    const page = this.content();
    // The tap's height on the page.
    const y = p.y - view.y + this.scroller.offset;
    for (const item of page.items) {
      if (item.kind === 'jump' && inRect(p.x, y, item.rect)) {
        this.scroller.scrollTo(page.tops[item.id]);
        return;
      }
    }
  }
}

/** Draws one item of the page, whose top edge is at screen y `top`. */
function drawItem(ctx: CanvasRenderingContext2D, item: AboutItem, top: number): void {
  switch (item.kind) {
    case 'text':
      text(ctx, item.text, item.x, top + item.y, ABOUT_FONT[item.style], COLOR[item.style], item.center ? 'center' : 'left');
      return;
    case 'badge':
      drawAgeBadge(ctx, item.x, top + item.y, item.w, AGE_RATING);
      return;
    case 'jump': {
      const r = item.rect;
      const y = top + r.y;
      roundRect(ctx, r.x, y, r.w, r.h, r.h / 2);
      ctx.fillStyle = 'rgba(184,134,44,0.14)';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(184,134,44,0.8)';
      ctx.stroke();
      text(ctx, item.label, r.x + r.w / 2, y + r.h / 2 + 1, JUMP_FONT, '#6b1c1c');
      return;
    }
    case 'rule': {
      const y = top + item.y;
      ctx.fillStyle = 'rgba(160,110,40,0.35)';
      ctx.fillRect(TEXT_X, y, TEXT_W, 1);
      // A small diamond in the middle, like the knot on a scroll's cord.
      ctx.beginPath();
      ctx.moveTo(W / 2, y - 3.5);
      ctx.lineTo(W / 2 + 3.5, y + 0.5);
      ctx.lineTo(W / 2, y + 4.5);
      ctx.lineTo(W / 2 - 3.5, y + 0.5);
      ctx.closePath();
      ctx.fillStyle = 'rgba(184,134,44,0.7)';
      ctx.fill();
      return;
    }
  }
}

/** A soft shadow along the view's edge at screen y `edge`, fading inward (`dir` 1 = downward from the top edge). */
function shade(ctx: CanvasRenderingContext2D, view: Rect, edge: number, dir: 1 | -1): void {
  const g = ctx.createLinearGradient(0, edge, 0, edge + dir * EDGE_SHADE);
  g.addColorStop(0, 'rgba(110,70,20,0.22)');
  g.addColorStop(1, 'rgba(110,70,20,0)');
  ctx.fillStyle = g;
  ctx.fillRect(view.x, dir === 1 ? edge : edge - EDGE_SHADE, view.w, EDGE_SHADE);
}
