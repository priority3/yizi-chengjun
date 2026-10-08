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
  /** The drag ended: a release, or the browser taking the pointer away (then `p` is the last known point). */
  dragEnd?(p: Pointer): void;
}

/** Movement (design px) before a press turns into a drag. */
const DRAG_THRESHOLD = 6;

export function attachGestures(stage: Stage, current: () => GestureHandlers): void {
  const canvas = stage.canvas;
  let activeId: number | null = null;
  let start: Pointer | null = null;
  let last: Pointer | null = null;
  let dragging = false;

  const toPointer = (e: PointerEvent): Pointer => {
    const d = stage.toDesign(e.clientX, e.clientY);
    return { x: d.x, y: d.y, touch: e.pointerType === 'touch' };
  };

  const reset = () => {
    activeId = null;
    start = null;
    last = null;
    dragging = false;
  };

  canvas.addEventListener('pointerdown', (e) => {
    // Reason: ignore second fingers and non-left mouse buttons so a stray touch or a right-click can't hijack a drag.
    if (!e.isPrimary || activeId !== null) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    activeId = e.pointerId;
    start = toPointer(e);
    last = start;
    dragging = false;
    // Reason: capture keeps move/up events coming even when the pointer leaves the canvas mid-drag.
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // No capture (e.g. synthetic events): the window listeners below still end the gesture.
    }
    current().press?.(start);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== activeId || !start) return;
    const p = toPointer(e);
    last = p;
    if (!dragging && Math.hypot(p.x - start.x, p.y - start.y) > DRAG_THRESHOLD) {
      dragging = true;
      current().dragStart?.(start, p);
    }
    if (dragging) current().dragMove?.(p);
  });

  /**
   * Ends the gesture. A drag always ends with a drop at the last known point, even when the browser
   * cancelled the pointer or capture was lost: the player saw the card over that cell and let go.
   */
  const finish = (e: PointerEvent, released: boolean) => {
    if (e.pointerId !== activeId || !start) return;
    const h = current();
    const p = released ? toPointer(e) : (last ?? start);
    const wasDragging = dragging;
    // Reason: reset before calling out, so a handler that throws can never wedge the input state.
    reset();
    if (wasDragging) h.dragEnd?.(p);
    else if (released) h.tap?.(p);
  };

  canvas.addEventListener('pointerup', (e) => finish(e, true));
  canvas.addEventListener('pointercancel', (e) => finish(e, false));
  // Fires after pointerup too; by then activeId is cleared, so it only acts on genuine capture loss.
  canvas.addEventListener('lostpointercapture', (e) => finish(e, false));
  // Reason: without capture the release can land anywhere in the page; still finish the gesture.
  window.addEventListener('pointerup', (e) => finish(e, true));
  window.addEventListener('pointercancel', (e) => finish(e, false));
}
