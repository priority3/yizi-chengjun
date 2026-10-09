// Input: the gesture recognizer (ui/input.ts) fed with the platform's pointer samples — taps, drags, the drop of a
// cancelled drag, pinches, the wheel — and the web platform's wiring (platform/web-input.ts) that turns DOM pointer
// events on the canvas and the window into those samples.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PointerSample, PointerSink, Stage } from '../src/platform/env.ts';
import { listenPointers } from '../src/platform/web-input.ts';
import { gestureSink, type GestureHandlers, type Pointer } from '../src/ui/input.ts';

/** A pointer sample: a primary finger unless told otherwise. */
const at = (id: number, x: number, y: number, touch = true, primary = true): PointerSample => ({ id, x, y, touch, primary });

const pt = (p: Pointer) => `${p.x},${p.y}`;

/** Handlers that log every gesture as a line of text. */
function recorder(): { calls: string[]; h: GestureHandlers } {
  const calls: string[] = [];
  const h: GestureHandlers = {
    press: (p) => calls.push(`press ${pt(p)}`),
    tap: (p) => calls.push(`tap ${pt(p)}`),
    dragStart: (s, p) => calls.push(`dragStart ${pt(s)} ${pt(p)}`),
    dragMove: (p) => calls.push(`dragMove ${pt(p)}`),
    dragEnd: (p) => calls.push(`dragEnd ${pt(p)}`),
    pinchStart: (c, d) => calls.push(`pinchStart ${pt(c)} ${d}`),
    pinchMove: (c, d) => calls.push(`pinchMove ${pt(c)} ${d}`),
    pinchEnd: () => calls.push('pinchEnd'),
    wheel: (p, dy) => calls.push(`wheel ${pt(p)} ${dy} ${p.touch}`),
  };
  return { calls, h };
}

describe('gesture recognizer', () => {
  it('turns a press and release into a tap, claiming the pointer', () => {
    const { calls, h } = recorder();
    const sink = gestureSink(() => h);
    const claim = vi.fn();
    sink.down(at(1, 10, 10), claim);
    expect(claim).toHaveBeenCalledTimes(1);
    // Under the drag threshold (6 design px): still a tap.
    sink.move(at(1, 14, 10));
    sink.up(at(1, 14, 11));
    expect(calls).toEqual(['press 10,10', 'tap 14,11']);
  });

  it('drags past the threshold and drops where the pointer is released', () => {
    const { calls, h } = recorder();
    const sink = gestureSink(() => h);
    sink.down(at(1, 10, 10), () => {});
    sink.move(at(1, 20, 10));
    sink.move(at(1, 30, 12));
    sink.up(at(1, 31, 12));
    expect(calls).toEqual(['press 10,10', 'dragStart 10,10 20,10', 'dragMove 20,10', 'dragMove 30,12', 'dragEnd 31,12']);
  });

  it('drops a cancelled drag at its last known point, and a cancelled press is no tap', () => {
    const { calls, h } = recorder();
    const sink = gestureSink(() => h);
    sink.down(at(1, 10, 10), () => {});
    sink.move(at(1, 40, 10));
    sink.cancel(at(1, 999, 999));
    sink.down(at(2, 5, 5), () => {});
    sink.cancel(at(2, 5, 5));
    expect(calls).toEqual(['press 10,10', 'dragStart 10,10 40,10', 'dragMove 40,10', 'dragEnd 40,10', 'press 5,5']);
  });

  it('ignores pointers that may not start a gesture and pointers it does not follow', () => {
    const { calls, h } = recorder();
    const sink = gestureSink(() => h);
    const claim = vi.fn();
    sink.down(at(1, 10, 10, false, false), claim);
    expect(claim).not.toHaveBeenCalled();
    sink.down(at(2, 10, 10, false), () => {});
    // A second mouse or pen is no pinch, and stray moves and releases of other pointers change nothing.
    sink.down(at(3, 50, 50, false), claim);
    sink.move(at(7, 80, 80));
    sink.up(at(7, 80, 80));
    expect(claim).not.toHaveBeenCalled();
    sink.up(at(2, 11, 10));
    expect(calls).toEqual(['press 10,10', 'tap 11,10']);
  });

  it('turns a second finger into a pinch that either finger ends', () => {
    const { calls, h } = recorder();
    const sink = gestureSink(() => h);
    sink.down(at(1, 0, 0), () => {});
    const claim = vi.fn();
    sink.down(at(2, 100, 0, true, false), claim);
    expect(claim).toHaveBeenCalledTimes(1);
    sink.move(at(2, 100, 40));
    sink.move(at(1, 10, 0));
    sink.up(at(2, 100, 40));
    // The pinch ended the whole gesture: the first finger's release is no tap.
    sink.up(at(1, 10, 0));
    expect(calls).toEqual([
      'press 0,0',
      'pinchStart 50,0 100',
      `pinchMove 50,20 ${Math.hypot(100, 40)}`,
      `pinchMove 55,20 ${Math.hypot(90, 40)}`,
      'pinchEnd',
    ]);
  });

  it('passes the wheel through with its point and delta', () => {
    const { calls, h } = recorder();
    gestureSink(() => h).wheel(at(-1, 5, 6, false), 120);
    expect(calls).toEqual(['wheel 5,6 120 false']);
  });

  it('calls the scene that is current at each event, and survives a handler that throws', () => {
    const first = recorder();
    const second = recorder();
    let current = first.h;
    const sink = gestureSink(() => current);
    sink.down(at(1, 10, 10), () => {});
    current = second.h;
    sink.up(at(1, 10, 10));
    expect(first.calls).toEqual(['press 10,10']);
    expect(second.calls).toEqual(['tap 10,10']);
    const broken: GestureHandlers = {
      tap: () => {
        throw new Error('scene bug');
      },
    };
    current = broken;
    sink.down(at(2, 1, 1), () => {});
    expect(() => sink.up(at(2, 1, 1))).toThrow('scene bug');
    // Reason: the state was reset before the handler ran, so the next gesture starts clean.
    current = second.h;
    sink.down(at(3, 2, 2), () => {});
    sink.up(at(3, 2, 2));
    expect(second.calls).toEqual(['tap 10,10', 'press 2,2', 'tap 2,2']);
  });
});

/** A DOM-like pointer event (Node has Event and EventTarget, but no PointerEvent). */
function pointerEvent(type: string, init: { id?: number; x?: number; y?: number; kind?: string; primary?: boolean; button?: number }): Event {
  return Object.assign(new Event(type, { cancelable: true }), {
    pointerId: init.id ?? 1,
    clientX: init.x ?? 0,
    clientY: init.y ?? 0,
    pointerType: init.kind ?? 'touch',
    isPrimary: init.primary ?? true,
    button: init.button ?? 0,
  });
}

/** The stage canvas as an event target that records pointer capture; client pixels are twice the design units. */
function webStage(capture: (id: number) => void = () => {}): { stage: Stage; canvas: EventTarget } {
  const canvas = Object.assign(new EventTarget(), { setPointerCapture: capture });
  const stage: Stage = {
    canvas: canvas as unknown as HTMLCanvasElement,
    ctx: {} as CanvasRenderingContext2D,
    pixelRatio: 1,
    toDesign: (x, y) => ({ x: x / 2, y: y / 2 }),
  };
  return { stage, canvas };
}

/** A sink that logs what reaches it and claims every press when `claims` is set. */
function spySink(claims: boolean): { log: string[]; sink: PointerSink } {
  const log: string[] = [];
  const s = (p: PointerSample) => `${p.id} ${p.x},${p.y} ${p.touch ? 'touch' : 'mouse'}${p.primary ? ' primary' : ''}`;
  const sink: PointerSink = {
    down: (p, claim) => {
      log.push(`down ${s(p)}`);
      if (claims) claim();
    },
    move: (p) => log.push(`move ${s(p)}`),
    up: (p) => log.push(`up ${s(p)}`),
    cancel: (p) => log.push(`cancel ${s(p)}`),
    wheel: (p, dy) => log.push(`wheel ${p.x},${p.y} ${dy}`),
  };
  return { log, sink };
}

describe('web pointer wiring', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('hands canvas pointer events to the sink in design coordinates; a claim cancels the default and captures', () => {
    vi.stubGlobal('window', new EventTarget());
    const captured: number[] = [];
    const { stage, canvas } = webStage((id) => captured.push(id));
    const { log, sink } = spySink(true);
    listenPointers(stage, sink);
    const down = pointerEvent('pointerdown', { id: 3, x: 100, y: 50 });
    canvas.dispatchEvent(down);
    canvas.dispatchEvent(pointerEvent('pointermove', { id: 3, x: 120, y: 50 }));
    canvas.dispatchEvent(pointerEvent('pointerup', { id: 3, x: 120, y: 60 }));
    expect(log).toEqual(['down 3 50,25 touch primary', 'move 3 60,25 touch primary', 'up 3 60,30 touch primary']);
    expect(down.defaultPrevented).toBe(true);
    expect(captured).toEqual([3]);
  });

  it('leaves unclaimed presses to the browser, and only the main mouse button is primary', () => {
    vi.stubGlobal('window', new EventTarget());
    const { stage, canvas } = webStage();
    const { log, sink } = spySink(false);
    listenPointers(stage, sink);
    const right = pointerEvent('pointerdown', { id: 1, kind: 'mouse', button: 2 });
    canvas.dispatchEvent(right);
    canvas.dispatchEvent(pointerEvent('pointerdown', { id: 1, kind: 'mouse', button: 0 }));
    canvas.dispatchEvent(pointerEvent('pointerdown', { id: 4, kind: 'touch', primary: false }));
    expect(log).toEqual(['down 1 0,0 mouse', 'down 1 0,0 mouse primary', 'down 4 0,0 touch']);
    expect(right.defaultPrevented).toBe(false);
  });

  it('still takes a press whose pointer capture is refused (synthetic events)', () => {
    vi.stubGlobal('window', new EventTarget());
    const { stage, canvas } = webStage(() => {
      throw new Error('InvalidPointerId');
    });
    const { log, sink } = spySink(true);
    listenPointers(stage, sink);
    const down = pointerEvent('pointerdown', { id: 9, x: 2, y: 2 });
    canvas.dispatchEvent(down);
    expect(log).toEqual(['down 9 1,1 touch primary']);
    expect(down.defaultPrevented).toBe(true);
  });

  it('ends a gesture released outside the canvas, and drops a drag whose capture was lost', () => {
    const win = new EventTarget();
    vi.stubGlobal('window', win);
    const { stage, canvas } = webStage();
    const { calls, h } = recorder();
    listenPointers(stage, gestureSink(() => h));
    canvas.dispatchEvent(pointerEvent('pointerdown', { id: 1, x: 20, y: 20 }));
    win.dispatchEvent(pointerEvent('pointerup', { id: 1, x: 22, y: 20 }));
    canvas.dispatchEvent(pointerEvent('pointerdown', { id: 2, x: 20, y: 20 }));
    canvas.dispatchEvent(pointerEvent('pointermove', { id: 2, x: 80, y: 20 }));
    canvas.dispatchEvent(pointerEvent('lostpointercapture', { id: 2, x: 0, y: 0 }));
    win.dispatchEvent(pointerEvent('pointercancel', { id: 2 }));
    expect(calls).toEqual(['press 10,10', 'tap 11,10', 'press 10,10', 'dragStart 10,10 40,10', 'dragMove 40,10', 'dragEnd 40,10']);
  });

  it('turns the wheel into a zoom at the pointer, without scrolling the page', () => {
    vi.stubGlobal('window', new EventTarget());
    const { stage, canvas } = webStage();
    const { log, sink } = spySink(false);
    listenPointers(stage, sink);
    const wheel = Object.assign(new Event('wheel', { cancelable: true }), { clientX: 40, clientY: 30, deltaY: -100 });
    canvas.dispatchEvent(wheel);
    expect(log).toEqual(['wheel 20,15 -100']);
    expect(wheel.defaultPrevented).toBe(true);
  });
});
