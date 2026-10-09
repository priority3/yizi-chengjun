// Turns the platform's pointer input (platform/env.ts PointerSink: mouse and touch on the web, touches on mini-games)
// into tap / drag / pinch / wheel gestures in design coordinates.
import { platform, type PointerSample, type PointerSink, type Stage } from '../platform/env.ts';

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

/** Feeds the stage's pointer input, through the platform, into the gestures of the scene `current` returns. */
export function attachGestures(stage: Stage, current: () => GestureHandlers): void {
  platform().listenPointers(stage, gestureSink(current));
}

/** The gesture recognizer: takes pointer samples from the platform and calls the handlers of `current()`'s scene. */
export function gestureSink(current: () => GestureHandlers): PointerSink {
  let activeId: number | null = null;
  let start: Pointer | null = null;
  let last: Pointer | null = null;
  let dragging = false;
  let secondId: number | null = null;
  let second: Pointer | null = null;
  let pinching = false;

  const toPointer = (s: PointerSample): Pointer => ({ x: s.x, y: s.y, touch: s.touch });
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

  /**
   * Ends the gesture. A drag always ends with a drop at the last known point, even when the browser
   * cancelled the pointer or capture was lost: the player saw the card over that cell and let go.
   */
  const finish = (s: PointerSample, released: boolean) => {
    if (pinching && (s.id === secondId || s.id === activeId)) {
      // Either finger lifting ends the pinch and the whole gesture.
      reset();
      current().pinchEnd?.();
      return;
    }
    if (s.id !== activeId || !start) return;
    const h = current();
    const p = released ? toPointer(s) : (last ?? start);
    const wasDragging = dragging;
    // Reason: reset before calling out, so a handler that throws can never wedge the input state.
    reset();
    if (wasDragging) h.dragEnd?.(p);
    else if (released) h.tap?.(p);
  };

  return {
    down(s, claim) {
      if (activeId !== null && secondId === null && s.touch && s.id !== activeId && start) {
        // A second finger: the gesture becomes a pinch.
        secondId = s.id;
        second = toPointer(s);
        pinching = true;
        claim();
        const first = last ?? start;
        current().pinchStart?.(mid(first, second), span(first, second));
        return;
      }
      if (!s.primary || activeId !== null) return;
      activeId = s.id;
      start = toPointer(s);
      last = start;
      dragging = false;
      claim();
      current().press?.(start);
    },

    move(s) {
      if (s.id === secondId && second && last) {
        second = toPointer(s);
        current().pinchMove?.(mid(last, second), span(last, second));
        return;
      }
      if (s.id !== activeId || !start) return;
      const p = toPointer(s);
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
    },

    up: (s) => finish(s, true),
    cancel: (s) => finish(s, false),
    wheel: (s, deltaY) => current().wheel?.(toPointer(s), deltaY),
  };
}
