// Turns DOM pointer events (mouse + touch) on the stage canvas into tap / drag gestures in design coordinates.
import type { Stage } from '../platform/web.ts';

export interface Pointer {
  x: number;
  y: number;
  /** True for finger input — the dragged tile is drawn above the finger so it stays visible. */
  touch: boolean;
}

export interface GestureHandlers {
  press?(p: Pointer): void;
  tap?(p: Pointer): void;
  dragStart?(start: Pointer, p: Pointer): void;
  dragMove?(p: Pointer): void;
  dragEnd?(p: Pointer): void;
  dragCancel?(): void;
}

/** Movement (design px) before a press turns into a drag. */
const DRAG_THRESHOLD = 6;

export function attachGestures(stage: Stage, current: () => GestureHandlers): void {
  const canvas = stage.canvas;
  let activeId: number | null = null;
  let start: Pointer | null = null;
  let dragging = false;

  const toPointer = (e: PointerEvent): Pointer => {
    const d = stage.toDesign(e.clientX, e.clientY);
    return { x: d.x, y: d.y, touch: e.pointerType === 'touch' };
  };

  canvas.addEventListener('pointerdown', (e) => {
    // Reason: ignore second fingers so a stray touch can't hijack an ongoing drag.
    if (!e.isPrimary || activeId !== null) return;
    e.preventDefault();
    activeId = e.pointerId;
    canvas.setPointerCapture(e.pointerId);
    start = toPointer(e);
    dragging = false;
    current().press?.(start);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== activeId || !start) return;
    const p = toPointer(e);
    if (!dragging && Math.hypot(p.x - start.x, p.y - start.y) > DRAG_THRESHOLD) {
      dragging = true;
      current().dragStart?.(start, p);
    }
    if (dragging) current().dragMove?.(p);
  });

  const finish = (e: PointerEvent, cancelled: boolean) => {
    if (e.pointerId !== activeId || !start) return;
    const h = current();
    if (cancelled) {
      if (dragging) h.dragCancel?.();
    } else if (dragging) {
      h.dragEnd?.(toPointer(e));
    } else {
      h.tap?.(toPointer(e));
    }
    activeId = null;
    start = null;
    dragging = false;
  };

  canvas.addEventListener('pointerup', (e) => finish(e, false));
  canvas.addEventListener('pointercancel', (e) => finish(e, true));
  // Fires after pointerup too; by then activeId is cleared, so it only acts on genuine capture loss.
  canvas.addEventListener('lostpointercapture', (e) => finish(e, true));
}
