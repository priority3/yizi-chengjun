// The map editor's live check, its screen layout, and what its 试玩 does to a run: chapter maps check clean with the
// figures buildMap gives; broken maps say what is wrong and where; a 试玩 books nothing into the progress save; a map
// without an open fighter pad starts without the free 箭; the editor fits every design height.
import { afterAll, describe, expect, it } from 'vitest';
import { MAPS, type MapDef } from '../src/config/maps.ts';
import { createGame } from '../src/core/game.ts';
import { buildMap, coverage } from '../src/core/map.ts';
import { parseProgress, type Progress } from '../src/platform/progress.ts';
import { L, MAX_H, MIN_H, setDesignHeight, W, type Rect } from '../src/render/layout.ts';
import { BEST_COUNT, BEST_RANGE, checkDraft } from '../src/ui/editor-check.ts';
import {
  ACTIONS,
  actionRect,
  BACK_BTN,
  bottomTop,
  hintRect,
  INFO,
  loadCard,
  mapView,
  PALETTE_SIZE,
  paletteArea,
  paletteRect,
  sizeButtons,
  sizePanel,
  TOP_H,
} from '../src/ui/editor-layout.ts';
import { draftOf, makeDraft } from '../src/ui/editor-model.ts';
import { settleRun } from '../src/ui/run-end.ts';

const draft = (rows: string[]) => makeDraft('ridge', rows);

describe('editor check', () => {
  it('builds every chapter map and reports the figures buildMap gives', () => {
    MAPS.forEach((def, i) => {
      const at = `chapter ${i + 1}`;
      const c = checkDraft(draftOf(def));
      const m = buildMap(def);
      expect(c.error, at).toBeNull();
      expect(c.map, at).toEqual(m);
      expect(c.roads, at).toEqual(m.paths.map((p) => p.length));
      expect(c.hpScale, at).toBe(m.hpScale);
      expect([c.pads.open, c.pads.locked], at).toEqual([m.open.filter(Boolean).length, m.open.filter((o) => !o).length]);
      expect(c.pads.special, at).toBe(m.slotKind.filter((k) => k !== 'plain').length);
      expect(Object.values(c.pads.kinds).reduce((a, b) => a + b, 0), at).toBe(m.slots.length);
      // The five best pads by road coverage, best first: no pad left out covers more than the last one.
      expect(c.best, at).toHaveLength(BEST_COUNT);
      c.best.forEach((b, k) => {
        expect(b.cover, at).toBe(coverage(m, b.slot, BEST_RANGE));
        if (k > 0) expect(b.cover, at).toBeLessThanOrEqual(c.best[k - 1].cover);
      });
      const others = m.slots.map((_, s) => s).filter((s) => !c.best.some((b) => b.slot === s));
      for (const s of others) expect(coverage(m, s, BEST_RANGE), at).toBeLessThanOrEqual(c.best[BEST_COUNT - 1].cover);
      // Only chapter 7 has a loose road square: the stub mirroring the left side's corner at the top right.
      expect(c.warnings, at).toEqual(i === 6 ? ['有 1 格路不在任何一条路线上'] : []);
    });
  });

  it('says what keeps a map from building, and which squares are at fault', () => {
    const noCamp = checkDraft(draft(['1####...', '........']));
    expect([noCamp.map, noCamp.error]).toEqual([null, expect.stringContaining('还没有营地')]);
    expect(checkDraft(draft(['####E...', '........'])).error).toContain('还没有入口');
    const twoCamps = checkDraft(draft(['1##E##E.', '........']));
    expect(twoCamps.error).toContain('只能有一个');
    expect(twoCamps.faults).toEqual([
      { c: 3, r: 0 },
      { c: 6, r: 0 },
    ]);
    // Entrance 2's road stops one square short of the camp; entrance 1's is fine.
    const cut = checkDraft(draft(['1###E#.#2', '....O....']));
    expect(cut.error).toContain('入口 2 的路走不到营地');
    expect(cut.error).not.toContain('1');
    expect(cut.faults).toEqual([
      { c: 8, r: 0 },
      { c: 4, r: 0 },
    ]);
  });

  it('warns about layouts that build but play oddly', () => {
    expect(checkDraft(draft(['1##E....'])).warnings).toEqual(['还没有石台：放几个 O 才能试玩']);
    expect(checkDraft(draft(['1##E....', 'o.M.....'])).warnings).toEqual(['没有开局可用的兵字石台，开局送的箭没处放']);
    // The road's second row makes a 2 x 2 block, and the route only walks the first row.
    expect(checkDraft(draft(['1##E....', '.##.O...'])).warnings).toEqual(['有 1 处 2×2 的路块：路要一格宽', '有 2 格路不在任何一条路线上']);
    expect(checkDraft(draft(['1##E....', '...##.O.'])).warnings).toEqual(['有 2 格路不在任何一条路线上']);
    expect(checkDraft(draft(['1##E##1.', '..O.....'])).warnings).toEqual(['入口 1 不止一个']);
  });
});

describe('editor 试玩', () => {
  const fresh = (): Progress => {
    const p = parseProgress(JSON.stringify({ unlocked: 1, wins: [] }), MAPS.length);
    if (!p) throw new Error('progress did not parse');
    return p;
  };

  it('books nothing, and a won 试玩 only shows the stars it would have earned', () => {
    const p = fresh();
    const before = JSON.stringify(p);
    const g = createGame({ seed: 3, chapter: 1, map: draftOf(MAPS[4]) });
    g.phase = 'won';
    g.campHp = g.campMax;
    expect(settleRun(p, g, 1, true)).toEqual({ rewards: null, award: { stars: 3, best: 3, bonus: 0 }, endless: null, changed: false });
    g.phase = 'lost';
    expect(settleRun(p, g, 1, true)).toEqual({ rewards: null, award: null, endless: null, changed: false });
    expect(JSON.stringify(p)).toBe(before);
  });

  it('still books a real chapter clear as before', () => {
    const p = fresh();
    const g = createGame({ seed: 3, chapter: 1 });
    g.phase = 'won';
    g.campHp = g.campMax;
    const end = settleRun(p, g, 1, false);
    expect(end.changed).toBe(true);
    expect(end.award?.stars).toBe(3);
    expect(end.rewards?.stones).toBeGreaterThan(0);
    expect([p.unlocked, p.wins[0], p.stars[0], p.tutorialDone]).toEqual([2, 1, 3, true]);
  });

  it('starts without the free 箭 on a map with no open pad a fighter may stand on', () => {
    const map: MapDef = { theme: 'ridge', rows: ['1##E....', 'o.M.....'] };
    const g = createGame({ seed: 1, chapter: 1, map });
    expect(g.slots).toEqual([null, null]);
    expect(Object.keys(g.slots)).toEqual(['0', '1']);
  });
});

describe('editor layout', () => {
  afterAll(() => setDesignHeight(MIN_H));
  // Reason: palette cells are 34.8 wide, so neighbours' shared edges may differ by a rounding error.
  const E = 0.01;
  const inside = (r: Rect, box: Rect): boolean => r.x >= box.x - E && r.y >= box.y - E && r.x + r.w <= box.x + box.w + E && r.y + r.h <= box.y + box.h + E;
  const overlap = (a: Rect, b: Rect): boolean => a.x < b.x + b.w - E && b.x < a.x + a.w - E && a.y < b.y + b.h - E && b.y < a.y + a.h - E;

  it('fits the top bar, the map view, the palette and the actions at every design height', () => {
    for (let h = MIN_H; h <= MAX_H; h += 4) {
      setDesignHeight(h);
      const screen: Rect = { x: 0, y: 0, w: W, h: L.H };
      expect(inside(BACK_BTN, { x: 0, y: 0, w: W, h: TOP_H }) && inside(INFO, { x: 0, y: 0, w: W, h: TOP_H })).toBe(true);
      expect(overlap(BACK_BTN, INFO)).toBe(false);
      // The map gets most of the screen, between the top bar and the bottom panel.
      expect(mapView().y).toBe(TOP_H);
      expect(mapView().h, `H ${h}`).toBeGreaterThan(L.H * 0.6);
      expect(hintRect().y).toBeGreaterThanOrEqual(bottomTop());
      const palette = Array.from({ length: PALETTE_SIZE }, (_, i) => paletteRect(i));
      const actions = ACTIONS.map((_, i) => actionRect(i));
      for (const r of palette) expect(inside(r, paletteArea()), `H ${h}`).toBe(true);
      for (const r of [...palette, ...actions]) expect(inside(r, screen) && r.y >= bottomTop(), `H ${h}`).toBe(true);
      const all = [hintRect(), ...palette, ...actions];
      for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) expect(overlap(all[i], all[j]), `H ${h}: ${i} and ${j}`).toBe(false);
      }
      // The 尺寸 panel's buttons sit inside it, apart from one another.
      const b = sizeButtons();
      const buttons = [...b.cols, ...b.rows, b.done];
      for (const r of buttons) expect(inside(r, sizePanel())).toBe(true);
      for (let i = 0; i < buttons.length; i++) for (let j = i + 1; j < buttons.length; j++) expect(overlap(buttons[i], buttons[j])).toBe(false);
      // The 载入 cards fit on screen above the hint line at the bottom.
      for (let i = 0; i < MAPS.length; i++) expect(inside(loadCard(i), { x: 0, y: 52, w: W, h: L.H - 52 - 34 }), `H ${h} card ${i}`).toBe(true);
    }
  });
});
