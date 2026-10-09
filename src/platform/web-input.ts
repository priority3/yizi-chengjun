// The web half of the input wiring: DOM pointer events (mouse, touch, pen) on the stage canvas, handed to the game's
// gesture recognizer (ui/input.ts) as PointerSamples in design coordinates. A mini-game platform does the same from
// its touch callbacks (onTouchStart / Move / End / Cancel), one sample per changed touch.
import type { PointerSample, PointerSink, Stage } from './env.ts';

/** Listens to the stage canvas (and the window, for releases outside it) and feeds every pointer event into `sink`. */
export function listenPointers(stage: Stage, sink: PointerSink): void {
  const canvas = stage.canvas;

  const sample = (e: PointerEvent): PointerSample => {
    const d = stage.toDesign(e.clientX, e.clientY);
    // Reason: a mouse press only starts a gesture with the main button; other buttons are left to the browser.
    const primary = e.isPrimary && !(e.pointerType === 'mouse' && e.button !== 0);
    return { id: e.pointerId, x: d.x, y: d.y, touch: e.pointerType === 'touch', primary };
  };

  const capture = (id: number) => {
    // Reason: capture keeps move/up events coming even when the pointer leaves the canvas mid-drag.
    try {
      canvas.setPointerCapture(id);
    } catch {
      // No capture (e.g. synthetic events): the window listeners below still end the gesture.
    }
  };

  canvas.addEventListener('pointerdown', (e) =>
    sink.down(sample(e), () => {
      e.preventDefault();
      capture(e.pointerId);
    }),
  );
  canvas.addEventListener('pointermove', (e) => sink.move(sample(e)));
  canvas.addEventListener('pointerup', (e) => sink.up(sample(e)));
  canvas.addEventListener('pointercancel', (e) => sink.cancel(sample(e)));
  // Fires after pointerup too; by then the gesture is over, so it only acts on genuine capture loss.
  canvas.addEventListener('lostpointercapture', (e) => sink.cancel(sample(e)));
  // Reason: without capture the release can land anywhere in the page; still finish the gesture.
  window.addEventListener('pointerup', (e) => sink.up(sample(e)));
  window.addEventListener('pointercancel', (e) => sink.cancel(sample(e)));

  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const d = stage.toDesign(e.clientX, e.clientY);
      sink.wheel({ id: -1, x: d.x, y: d.y, touch: false, primary: true }, e.deltaY);
    },
    { passive: false },
  );
}
