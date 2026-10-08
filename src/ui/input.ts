// Turns DOM pointer events (mouse + touch) on the stage canvas into tap / drag / pinch / wheel gestures
// in design coordinates.
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
  /** Two fingers down: `center` is their midpoint, `dist` the distance between them. */
  pinchStart?(center: Pointer, dist: number): void;
  pinchMove?(center: Pointer, dist: number): void;
  pinchEnd?(): void;
  /** Mouse wheel / trackpad: positive deltaY = zoom out. */
  wheel?(p: Pointer, deltaY: number): void;
}

/** Movement (design px) before a press turns into a drag. */
const DRAG_THRESHOLD = 6;

export function attachGestures(stage: Stage, current: () => GestureHandlers): void {
  const canvas = stage.canvas;
  let activeId: number | null = null;
  let start: Pointer | null = null;
  let last: Pointer | null = null;
  let dragging = false;
  let secondId: number | null = null;
  let second: Pointer | null = null;
  let pinching = false;

  const toPointer = (e: { clientX: number; clientY: number; pointerType?: string }): Pointer => {
    const d = stage.toDesign(e.clientX, e.clientY);
    return { x: d.x, y: d.y, touch: e.pointerType === 'touch' };
  };
  const mid = (a: Pointer, b: Pointer): Pointer => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, touch: true });
  const span = (a: Pointer, b: Pointer): number => Math.hypot(a.x - b.x, a.y - b.y);

  const reset = () => {
    activeId = null;
    start = null;
    last = null;
    dragging = false;
    secondId = null;
    second = null;
    pinching = false;
  };

  const capture = (id: number) => {
    // Reason: capture keeps move/up events coming even when the pointer leaves the canvas mid-drag.
    try {
      canvas.setPointerCapture(id);
    } catch {
      // No capture (e.g. synthetic events): the window listeners below still end the gesture.
    }
  };

  canvas.addEventListener('pointerdown', (e) => {
    if (activeId !== null && secondId === null && e.pointerType === 'touch' && e.pointerId !== activeId && start) {
      // A second finger: the gesture becomes a pinch.
      e.preventDefault();
      secondId = e.pointerId;
      second = toPointer(e);
      pinching = true;
      capture(e.pointerId);
      const first = last ?? start;
      current().pinchStart?.(mid(first, second), span(first, second));
      return;
    }
    if (!e.isPrimary || activeId !== null) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    activeId = e.pointerId;
    start = toPointer(e);
    last = start;
    dragging = false;
    capture(e.pointerId);
    current().press?.(start);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId === secondId && second && last) {
      second = toPointer(e);
      current().pinchMove?.(mid(last, second), span(last, second));
      return;
    }
    if (e.pointerId !== activeId || !start) return;
    const p = toPointer(e);
    last = p;
    if (pinching && second) {
      current().pinchMove?.(mid(p, second), span(p, second));
      return;
    }
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
    if (pinching && (e.pointerId === secondId || e.pointerId === activeId)) {
      // Either finger lifting ends the pinch and the whole gesture.
      reset();
      current().pinchEnd?.();
      return;
    }
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

  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      current().wheel?.(toPointer(e), e.deltaY);
    },
    { passive: false },
  );
}
