// Animated first-run guide for chapter 1: a hand shows how to pan and zoom, drags a card onto a pad,
// taps 出战, and later stacks two cards. Pure presentation; completion comes from the real game events.
import { UNITS } from '../config/units.ts';
import { coverage } from '../core/map.ts';
import type { GameState } from '../core/types.ts';
import type { Camera } from '../render/camera.ts';
import { roundRect, text } from '../render/draw.ts';
import { sans } from '../render/fonts.ts';
import { drawHand, drawPinch } from '../render/hand.ts';
import { inRect, L, viewRect } from '../render/layout.ts';
import { cardSprite } from '../render/cards.ts';
import { blit } from '../render/sprites.ts';

export type TutorialStep = 'look' | 'drag' | 'start' | 'merge' | 'done';

/** Seconds the pan/zoom pictogram shows before the card lesson. */
const LOOK_TIME = 4;
/** One drag demonstration, start to start. */
const LOOP = 2.6;

const LABEL: Record<TutorialStep, string> = {
  look: '按住空地拖动地图，双指或滚轮缩放',
  drag: '把商店里的卡拖到路边的石台上',
  start: '摆好了就点「出战」',
  merge: '同名同级的卡叠在一起会升级',
  done: '',
};

const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) * (1 - k));

export class Tutorial {
  step: TutorialStep;
  private t = 0;
  /** Build phases seen while waiting for a merge chance; the lesson gives up after a few. */
  private mergeTries = 0;

  constructor(enabled: boolean) {
    this.step = enabled ? 'look' : 'done';
  }

  get active(): boolean {
    return this.step !== 'done';
  }

  update(dt: number): void {
    this.t += dt;
    if (this.step === 'look' && this.t >= LOOK_TIME) this.advance('drag');
  }

  private advance(step: TutorialStep): void {
    this.step = step;
    this.t = 0;
  }

  /** The player did the thing the current lesson asks for. */
  notify(event: 'buy' | 'waveStart' | 'merge' | 'build'): void {
    if (this.step === 'done') return;
    if (event === 'buy' && (this.step === 'look' || this.step === 'drag')) this.advance('start');
    else if (event === 'waveStart' && this.step !== 'merge') this.advance('merge');
    else if (event === 'merge') this.advance('done');
    else if (event === 'build' && this.step === 'merge' && ++this.mergeTries > 3) this.advance('done');
  }

  /** Shop offer index and slot index for the drag lessons, or null when nothing fits right now. */
  private dragTargets(g: GameState): { offer: number; slot: number } | null {
    if (this.step === 'drag') {
      const offer = g.shop.findIndex((o) => !o.sold && UNITS[o.id].kind === 'attack');
      if (offer < 0) return null;
      let slot = -1;
      let best = -1;
      g.slots.forEach((t, i) => {
        if (t || !g.unlocked[i]) return;
        const c = coverage(g.map, i, 200);
        if (c > best) {
          best = c;
          slot = i;
        }
      });
      return slot >= 0 ? { offer, slot } : null;
    }
    if (this.step === 'merge') {
      for (let offer = 0; offer < g.shop.length; offer++) {
        const o = g.shop[offer];
        if (o.sold) continue;
        const slot = g.slots.findIndex((t) => t && t.id === o.id && t.level === 1 && UNITS[o.id].kind === 'attack');
        if (slot >= 0) return { offer, slot };
      }
    }
    return null;
  }

  private label(ctx: CanvasRenderingContext2D, msg: string, y: number): void {
    ctx.font = sans(12, 700);
    const w = ctx.measureText(msg).width + 28;
    roundRect(ctx, (L.hud.w - w) / 2, y - 14, w, 28, 14);
    ctx.fillStyle = 'rgba(28,14,6,0.9)';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#ffd166';
    ctx.stroke();
    text(ctx, msg, L.hud.w / 2, y + 1, sans(12, 700), '#ffe9a8');
  }

  draw(ctx: CanvasRenderingContext2D, g: GameState, cam: Camera): void {
    if (this.step === 'done' || g.phase !== 'build' || g.encounter) return;
    const view = viewRect(g.phase);
    const labelY = view.y + view.h - 26;
    if (this.step === 'look') {
      const spread = 24 + Math.sin(this.t * 2.2) * 14;
      drawPinch(ctx, view.x + view.w / 2, view.y + view.h * 0.42, spread);
      this.label(ctx, LABEL.look, labelY);
      return;
    }
    if (this.step === 'start') {
      const b = L.btnStart;
      const k = (this.t % 1.4) / 1.4;
      this.label(ctx, LABEL.start, labelY);
      drawHand(ctx, b.x + b.w / 2 + 10, b.y + b.h / 2 + 6, 26, k < 0.25);
      return;
    }
    const targets = this.dragTargets(g);
    if (!targets) return;
    const from = L.shopCards[targets.offer];
    const a = { x: from.x + from.w / 2, y: from.y + 36 };
    const b = cam.toScreen(g.map.slots[targets.slot].x, g.map.slots[targets.slot].y - 6, view);
    if (!inRect(b.x, b.y, view)) return;
    const k = (this.t % LOOP) / LOOP;
    this.label(ctx, LABEL[this.step], labelY);
    // Dashed trail from the card to the pad.
    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,230,150,0.7)';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
    // Phases: press (0-0.15), travel (0.15-0.7), release (0.7-0.85), rest.
    const travel = Math.max(0, Math.min(1, (k - 0.15) / 0.55));
    const e = ease(travel);
    const hx = a.x + (b.x - a.x) * e;
    const hy = a.y + (b.y - a.y) * e;
    if (k < 0.85) {
      const o = g.shop[targets.offer];
      const { img, size } = cardSprite(o.id, 1, false);
      ctx.save();
      ctx.globalAlpha = k < 0.15 ? 0.5 : 0.85;
      blit(ctx, img, hx, hy, size, size, 1.05);
      ctx.restore();
      drawHand(ctx, hx + 8, hy + 10, 26, k > 0.08 && k < 0.72);
    } else {
      const ring = (k - 0.85) / 0.15;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 18 + ring * 22, 0, Math.PI * 2);
      ctx.lineWidth = 3 * (1 - ring) + 0.5;
      ctx.strokeStyle = `rgba(255,210,90,${1 - ring})`;
      ctx.stroke();
    }
  }
}
