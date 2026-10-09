// The chapter screen's layout at every design height: the ten chapter cards and, once open, the 每日挑战 and 无尽
// entries fit between the title row and the two hint lines without touching each other.
import { afterAll, describe, expect, it } from 'vitest';
import { L, MAX_H, MIN_H, setDesignHeight, W, type Rect } from '../src/render/layout.ts';
import { chapterRect, entryRect, HINTS_TOP } from '../src/ui/chapter-layout.ts';

const overlap = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
/** Bottom of the title row: the 返回 and 法宝 buttons end at y = 52. */
const TITLE_ROW = 52;

afterAll(() => setDesignHeight(MIN_H));

describe('chapter screen layout', () => {
  it('keeps the grid exactly as before while the entry row is hidden', () => {
    for (const h of [MIN_H, 700, 731, MAX_H]) {
      setDesignHeight(h);
      const extra = h - 640;
      const height = Math.round(92 + extra * 0.125);
      const top = Math.round(72 + extra * 0.2);
      expect(chapterRect(0, false)).toEqual({ x: 14, y: top, w: 160, h: height });
      expect(chapterRect(9, false)).toEqual({ x: 186, y: top + 4 * (height + 10), w: 160, h: height });
    }
  });

  it('fits the ten cards and the two entries between the title row and the hints at every design height', () => {
    for (let h = MIN_H; h <= MAX_H; h++) {
      setDesignHeight(h);
      const rects = [...Array.from({ length: 10 }, (_, i) => chapterRect(i, true)), entryRect(0), entryRect(1)];
      for (const r of rects) {
        expect(r.y, `H ${h}`).toBeGreaterThan(TITLE_ROW + 8);
        expect(r.y + r.h, `H ${h}`).toBeLessThanOrEqual(L.H - HINTS_TOP - 8);
        expect(r.x >= 0 && r.x + r.w <= W, `H ${h}`).toBe(true);
      }
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) expect(overlap(rects[i], rects[j]), `H ${h}: ${i} and ${j}`).toBe(false);
      }
      // The cards give up only a little height (92..112 without the row) and the entries line up with the columns.
      expect(chapterRect(0, true).h, `H ${h}`).toBeGreaterThanOrEqual(80);
      expect(chapterRect(0, true).h).toBeLessThanOrEqual(chapterRect(0, false).h);
      expect([entryRect(0).x, entryRect(1).x]).toEqual([chapterRect(0, true).x, chapterRect(1, true).x]);
    }
  });
});
