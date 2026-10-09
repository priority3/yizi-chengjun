// The app icon's geometry (render/app-icon.ts): the maskable emblem must stay inside the launcher's safe zone.
import { describe, expect, it } from 'vitest';
import { iconLayout, MASKABLE_SAFE_RADIUS, paintAppIcon, paintIconEmblem } from '../src/render/app-icon.ts';

/**
 * A stand-in 2D context that records how far from (cx, cy) anything gets painted: path points, arcs and ellipses
 * by their radius, strokes widened by half the line width in effect when stroked, rectangles by their corners.
 */
function recorder(cx: number, cy: number) {
  let reach = 0;
  /** Farthest point of the current path. */
  let path = 0;
  const point = (x: number, y: number, r = 0) => {
    path = Math.max(path, Math.hypot(x - cx, y - cy) + r);
  };
  const rect = (x: number, y: number, w: number, h: number) => {
    for (const [px, py] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) point(px, py);
  };
  const TAU = Math.PI * 2;
  const mod = (a: number) => ((a % TAU) + TAU) % TAU;
  /**
   * An arc's farthest point from (cx, cy): the far side of its circle when the sweep covers it, else an end.
   * Reason: 悟空's 紧箍 is a short arc of a big circle; counting the whole circle would overstate the reach.
   */
  const arc = (x: number, y: number, r: number, a0: number, a1: number, ccw = false) => {
    const sweep = Math.abs(a1 - a0) >= TAU ? TAU : mod(ccw ? a0 - a1 : a1 - a0);
    const far = Math.atan2(y - cy, x - cx);
    if (mod(ccw ? a0 - far : far - a0) <= sweep) point(x, y, r);
    else for (const a of [a0, a1]) point(x + Math.cos(a) * r, y + Math.sin(a) * r);
  };
  const gradient = { addColorStop: () => {} };
  const ctx = {
    lineWidth: 1,
    beginPath: () => {
      path = 0;
    },
    closePath: () => {},
    moveTo: (x: number, y: number) => point(x, y),
    lineTo: (x: number, y: number) => point(x, y),
    quadraticCurveTo: (cpx: number, cpy: number, x: number, y: number) => {
      point(cpx, cpy);
      point(x, y);
    },
    arc,
    ellipse: (x: number, y: number, rx: number, ry: number) => point(x, y, Math.max(rx, ry)),
    roundRect: rect,
    fill: () => {
      reach = Math.max(reach, path);
    },
    stroke: () => {
      reach = Math.max(reach, path + ctx.lineWidth / 2);
    },
    fillRect: (x: number, y: number, w: number, h: number) => {
      const before = path;
      path = 0;
      rect(x, y, w, h);
      reach = Math.max(reach, path);
      path = before;
    },
    clearRect: () => {},
    clip: () => {},
    save: () => {},
    restore: () => {},
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, reach: () => reach };
}

const SIZES = [48, 180, 192, 512];

describe('app icon', () => {
  it('keeps the maskable emblem inside the central 80 % circle every launcher mask keeps', () => {
    for (const size of SIZES) {
      const l = iconLayout(size, true);
      const rec = recorder(l.cx, l.cy);
      paintIconEmblem(rec.ctx, l);
      expect(rec.reach()).toBeGreaterThan(0.35 * size);
      expect(rec.reach()).toBeLessThanOrEqual(MASKABLE_SAFE_RADIUS * size);
    }
  });

  it('keeps the plain icon\'s emblem inside the carved border of its seal', () => {
    for (const size of SIZES) {
      const l = iconLayout(size, false);
      const rec = recorder(l.cx, l.cy);
      paintIconEmblem(rec.ctx, l);
      const seal = l.seal;
      expect(seal).not.toBeNull();
      if (!seal) continue;
      // The border line sits 5 % of the size inside the seal's edge.
      expect(rec.reach()).toBeLessThan(seal.side / 2 - 0.05 * size);
      expect(seal.x).toBeGreaterThanOrEqual(0);
      expect(seal.x + seal.side).toBeLessThanOrEqual(size);
    }
  });

  it('bleeds the maskable background to every edge, and scales with the size', () => {
    expect(iconLayout(512, true).seal).toBeNull();
    const small = iconLayout(192, true);
    const big = iconLayout(512, true);
    expect(big.ringR / 512).toBeCloseTo(small.ringR / 192, 10);
    expect(big.faceR / 512).toBeCloseTo(small.faceR / 192, 10);
  });

  it('paints the whole icon at small and large sizes, both variants', () => {
    for (const size of [16, 48, 512]) {
      for (const maskable of [false, true]) {
        const rec = recorder(size / 2, size / 2);
        expect(() => paintAppIcon(rec.ctx, size, maskable)).not.toThrow();
        // The red is painted out to the canvas corners (the plain icon clips it to the seal's rounded square).
        expect(rec.reach()).toBeGreaterThanOrEqual(Math.SQRT1_2 * size);
      }
    }
  });
});
