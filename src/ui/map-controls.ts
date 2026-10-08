// Input helpers for the chapter screen: dragging cards between the shop, the map's slots and the trash,
// and moving the camera (drag empty ground to pan, pinch or wheel to zoom). Pure state machines; the scene
// owns them and turns their results into actions and toasts.
import { heroFor } from '../config/combos.ts';
import { previewDrop } from '../core/board.ts';
import { offerPrice } from '../core/shop.ts';
import type { Action, GameState } from '../core/types.ts';
import type { Camera } from '../render/camera.ts';
import { inRect, L, type Rect } from '../render/layout.ts';
import type { DragUi } from '../render/renderer.ts';
import type { Pointer } from './input.ts';

/** How far above a finger a dragged card is drawn. */
const TOUCH_LIFT = 44;
/** Zoom step per wheel notch. */
const WHEEL_STEP = 1.12;

/** Finds the slot under a screen point (-1 for none). */
export type SlotLocator = (x: number, y: number) => number;

/** What releasing a dragged card asks for. */
export type DropResult = { action: Action; poorMsg?: string } | { toast: string } | null;

export class CardDrag {
  drag: DragUi | null = null;
  /** Slot under the dragged card, or -1. */
  hoverCell = -1;
  /** Whether dropping on hoverCell would do something. */
  hoverValid = false;
  hoverTrash = false;
  /** What letting go does when the two cards combine (merge / awaken / 神). */
  hoverHint: string | null = null;
  private lift = 0;

  /** Starts dragging the shop card or the tile under `start`. False when there is nothing to pick up. */
  begin(g: GameState, slotUnder: SlotLocator, start: Pointer, p: Pointer): boolean {
    this.lift = p.touch ? TOUCH_LIFT : 0;
    if (g.phase === 'build') {
      const i = L.shopCards.findIndex((r) => inRect(start.x, start.y, r));
      const o = i >= 0 ? g.shop[i] : undefined;
      if (o && !o.sold) {
        this.drag = { kind: 'shop', index: i, unit: o.id, level: 1, divine: false, x: p.x, y: p.y - this.lift };
        this.updateHover(g, slotUnder);
        return true;
      }
    }
    const cell = slotUnder(start.x, start.y);
    const t = cell >= 0 ? g.slots[cell] : null;
    if (!t) return false;
    this.drag = { kind: 'cell', index: cell, unit: t.id, level: t.level, divine: t.divine, x: p.x, y: p.y - this.lift };
    this.updateHover(g, slotUnder);
    return true;
  }

  move(g: GameState, slotUnder: SlotLocator, p: Pointer): void {
    if (!this.drag) return;
    this.drag.x = p.x;
    this.drag.y = p.y - this.lift;
    this.updateHover(g, slotUnder);
  }

  /** Ends the drag and returns what it asks for. */
  finish(g: GameState): DropResult {
    const d = this.drag;
    const cell = this.hoverCell;
    const trash = this.hoverTrash;
    this.clear();
    if (!d) return null;
    if (d.kind === 'shop') {
      if (cell < 0) return null;
      const o = g.shop[d.index];
      const price = o ? offerPrice(g, o) : 0;
      if (!g.unlocked[cell]) return { toast: '这个石台还没解锁：点它花功德解锁' };
      if (o && g.gongde < price) return { toast: `功德不够：这张卡要 ${price}` };
      return { action: { t: 'buy', offer: d.index, cell } };
    }
    if (trash) return { action: { t: 'drop', from: d.index, to: 'sell' } };
    if (cell < 0 || cell === d.index) return null;
    if (!g.unlocked[cell]) return { toast: '这个石台还没解锁' };
    return { action: { t: 'drop', from: d.index, to: cell } };
  }

  clear(): void {
    this.drag = null;
    this.hoverCell = -1;
    this.hoverValid = false;
    this.hoverTrash = false;
    this.hoverHint = null;
  }

  private updateHover(g: GameState, slotUnder: SlotLocator): void {
    const d = this.drag;
    if (!d) return;
    const trashRect = g.phase === 'build' ? L.trash : L.barTrash;
    this.hoverTrash = d.kind === 'cell' && inRect(d.x, d.y, { x: trashRect.x - 10, y: trashRect.y - 10, w: trashRect.w + 20, h: trashRect.h + 20 });
    const cell = slotUnder(d.x, d.y);
    this.hoverCell = cell;
    this.hoverHint = null;
    if (cell < 0) {
      this.hoverValid = false;
      return;
    }
    const target = g.slots[cell];
    const outcome = previewDrop({ id: d.unit, level: d.level, divine: d.divine }, target);
    if (d.kind === 'shop') {
      const o = g.shop[d.index];
      const combines = outcome === 'empty' || outcome === 'merge' || outcome === 'hero' || outcome === 'divine';
      this.hoverValid = g.unlocked[cell] && combines && !!o && g.gongde >= offerPrice(g, o);
    } else {
      this.hoverValid = g.unlocked[cell] && outcome !== 'invalid' && cell !== d.index;
    }
    // Tell the player what letting go will do when the two cards combine.
    if (target && this.hoverValid) {
      if (outcome === 'merge') this.hoverHint = `松开合成 ${target.level + 1} 级`;
      else if (outcome === 'hero') this.hoverHint = `松开觉醒 ${heroFor(d.unit, target.id) ?? '英雄'}`;
      else if (outcome === 'divine') this.hoverHint = '松开附神';
    }
  }
}

export class CameraControls {
  /** Camera position when a pan started, and where the finger was. */
  private pan: { x: number; y: number; sx: number; sy: number } | null = null;
  private pinch: { dist: number; x: number; y: number } | null = null;

  beginPan(cam: Camera, start: Pointer): void {
    this.pan = { x: cam.x, y: cam.y, sx: start.x, sy: start.y };
  }

  movePan(cam: Camera, view: Rect, p: Pointer): void {
    if (!this.pan) return;
    cam.x = this.pan.x - (p.x - this.pan.sx) / cam.zoom;
    cam.y = this.pan.y - (p.y - this.pan.sy) / cam.zoom;
    cam.clamp(view);
  }

  beginPinch(c: Pointer, dist: number): void {
    this.pan = null;
    this.pinch = { dist: Math.max(1, dist), x: c.x, y: c.y };
  }

  movePinch(cam: Camera, view: Rect, c: Pointer, dist: number): void {
    if (!this.pinch) return;
    cam.zoomAt(this.pinch.x, this.pinch.y, Math.max(1, dist) / this.pinch.dist, view);
    // Reason: the fingers' midpoint can move during a pinch; follow it so the map stays under the fingers.
    cam.x -= (c.x - this.pinch.x) / cam.zoom;
    cam.y -= (c.y - this.pinch.y) / cam.zoom;
    cam.clamp(view);
    this.pinch = { dist: Math.max(1, dist), x: c.x, y: c.y };
  }

  wheel(cam: Camera, view: Rect, p: Pointer, deltaY: number): void {
    cam.zoomAt(p.x, p.y, deltaY < 0 ? WHEEL_STEP : 1 / WHEEL_STEP, view);
  }

  reset(): void {
    this.pan = null;
    this.pinch = null;
  }
}
