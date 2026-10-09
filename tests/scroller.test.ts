// Scrolling a long page (ui/scroller.ts): the page follows a drag, coasts on after a flick and slows to a stop, stops
// when caught or when the finger rested before lifting, glides to wheel steps and jump targets, and never leaves the
// page at either end.
import { describe, expect, it } from 'vitest';
import { Scroller } from '../src/ui/scroller.ts';

const FRAME = 1 / 60;

/** A page 2000 tall seen through a 500 tall view: offsets 0..1500. */
function page(): Scroller {
  const s = new Scroller();
  s.setRange(2000, 500);
  return s;
}

function run(s: Scroller, seconds: number): void {
  for (let i = 0; i < Math.round(seconds / FRAME); i++) s.update(FRAME);
}

/** A finger moving from screen height `from` by `step` per frame for `frames` frames, then lifting. */
function flick(s: Scroller, from: number, step: number, frames: number): void {
  s.dragStart(from);
  for (let i = 1; i <= frames; i++) {
    s.update(FRAME);
    s.dragMove(from + step * i);
  }
  s.dragEnd();
}

describe('Scroller', () => {
  it('keeps the offset inside the page as the range changes', () => {
    const s = page();
    expect(s.maxOffset).toBe(1500);
    s.scrollTo(1400);
    run(s, 2);
    expect(s.offset).toBe(1400);
    s.setRange(1200, 500);
    expect(s.offset).toBe(700);
    s.setRange(300, 500);
    expect([s.maxOffset, s.offset]).toEqual([0, 0]);
  });

  it('follows a drag: the finger moving up shows more of the page below, never past either end', () => {
    const s = page();
    s.dragStart(400);
    s.dragMove(250);
    expect(s.offset).toBe(150);
    s.dragMove(600);
    expect(s.offset).toBe(0);
    s.dragMove(400 - 5000);
    expect(s.offset).toBe(1500);
    s.dragMove(400 - 1000);
    expect(s.offset).toBe(1000);
  });

  it('coasts on after a flick, slowing down to a stop', () => {
    const s = page();
    // 12 px a frame upwards: 720 px/s.
    flick(s, 500, -12, 8);
    const lifted = s.offset;
    expect(lifted).toBeCloseTo(96, 6);
    expect(s.moving).toBe(true);
    s.update(FRAME);
    const step = s.offset - lifted;
    expect(step).toBeGreaterThan(8);
    expect(step).toBeLessThan(16);
    run(s, 3);
    expect(s.moving).toBe(false);
    const rest = s.offset;
    // About speed / friction further on.
    expect(rest - lifted).toBeGreaterThan(100);
    expect(rest - lifted).toBeLessThan(250);
    run(s, 1);
    expect(s.offset).toBe(rest);
  });

  it('stops a fling at the end of the page', () => {
    const s = page();
    s.scrollTo(1450);
    run(s, 2);
    flick(s, 500, -20, 6);
    run(s, 1);
    expect(s.offset).toBe(1500);
    expect(s.moving).toBe(false);
  });

  it('stops where it is when caught by a press', () => {
    const s = page();
    flick(s, 500, -20, 6);
    run(s, 0.1);
    s.hold();
    const caught = s.offset;
    run(s, 1);
    expect(s.offset).toBe(caught);
  });

  it('does not fling when the finger rested before lifting, or when a pinch took over', () => {
    const s = page();
    s.dragStart(500);
    s.update(FRAME);
    s.dragMove(400);
    run(s, 0.3);
    s.dragEnd();
    expect(s.moving).toBe(false);
    s.dragStart(500);
    s.update(FRAME);
    s.dragMove(450);
    s.cancelDrag();
    run(s, 1);
    expect(s.offset).toBe(150);
  });

  it('glides to wheel steps, adding up quick steps and keeping inside the page', () => {
    const s = page();
    s.wheel(100);
    s.wheel(100);
    expect(s.moving).toBe(true);
    run(s, 1);
    expect(s.offset).toBe(200);
    // A huge delta from one notch moves only a large step.
    s.wheel(100000);
    run(s, 1);
    expect(s.offset).toBeLessThan(500);
    s.wheel(-1000);
    s.wheel(-1000);
    s.wheel(-1000);
    run(s, 1);
    expect(s.offset).toBe(0);
  });

  it('glides to a jump target, clamped to the page', () => {
    const s = page();
    s.scrollTo(900);
    run(s, 0.05);
    expect(s.offset).toBeGreaterThan(0);
    expect(s.offset).toBeLessThan(900);
    run(s, 1);
    expect(s.offset).toBe(900);
    s.scrollTo(99999);
    run(s, 1);
    expect(s.offset).toBe(1500);
  });
});
