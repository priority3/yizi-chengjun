// The map editor's pure model (plan.md D1): brushes, painting with a unique camp and entrances, strokes, undo,
// resizing, and the 导出 / 导入 / localStorage formats — including that every chapter map survives 导出 + 导入 with
// the same buildMap result, and that the export pastes straight into config/maps.ts.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MAPS, PAD_LETTERS, SLOT_NAME } from '../src/config/maps.ts';
import { buildMap } from '../src/core/map.ts';
import {
  blankDraft,
  BRUSHES,
  cellsOf,
  clearDraft,
  colsOf,
  draftOf,
  History,
  LEGEND,
  MAX_SIDE,
  MIN_SIDE,
  paint,
  paintLine,
  resize,
  sameDraft,
  UNDO_STEPS,
  type Draft,
} from '../src/ui/editor-model.ts';
import { DRAFT_KEY, exportRows, importDraft, loadDraft, parseDraft, parsePaste, saveDraft, type DraftStore } from '../src/ui/editor-text.ts';

/** The draft `importDraft` returned, failing the test on an error. */
function mustImport(text: string, current: Draft): Draft {
  const d = importDraft(text, current);
  if ('error' in d) throw new Error(d.error);
  return d;
}

/** An in-memory localStorage. */
function memoryStore(): DraftStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

describe('editor brushes', () => {
  it('has one brush per legend character, the pads read from config/maps.ts', () => {
    const pads = Object.keys(PAD_LETTERS);
    expect(new Set(BRUSHES.map((b) => b.ch))).toEqual(new Set(['#', ...pads, 'E', '1', '2', '3', '4', '~', '^', 'T', '.']));
    expect(LEGEND.size).toBe(BRUSHES.length);
    for (const [ch, p] of Object.entries(PAD_LETTERS)) {
      const b = BRUSHES.find((x) => x.ch === ch);
      expect(b?.label, ch).toBe(SLOT_NAME[p.kind]);
      expect(b?.hint, ch).toContain(p.open ? '开局可用' : '花功德解锁');
    }
  });

  it('can draw every character the chapter maps use', () => {
    for (const def of MAPS) for (const ch of def.rows.join('')) expect(LEGEND.has(ch), ch).toBe(true);
  });
});

describe('editor painting', () => {
  it('paints one square into a new draft and leaves the old one alone', () => {
    const d = blankDraft(8, 8, 'ridge');
    const e = paint(d, 2, 3, '#');
    expect(e.rows[3]).toBe('..#.....');
    expect(d.rows[3]).toBe('........');
    expect(cellsOf(e, '#')).toEqual([{ c: 2, r: 3 }]);
    // Nothing to change: the very same draft comes back.
    expect(paint(e, 2, 3, '#')).toBe(e);
    for (const [c, r] of [
      [-1, 0],
      [8, 0],
      [0, -1],
      [0, 8],
    ]) {
      expect(paint(e, c, r, 'O')).toBe(e);
    }
  });

  it('moves the camp and each entrance when they are placed again', () => {
    let d = blankDraft(8, 8, 'ridge');
    d = paint(paint(paint(d, 1, 1, 'E'), 0, 0, '1'), 7, 0, '2');
    d = paint(d, 5, 5, 'E');
    expect(cellsOf(d, 'E')).toEqual([{ c: 5, r: 5 }]);
    expect(d.rows[1][1]).toBe('.');
    d = paint(d, 3, 0, '1');
    expect(cellsOf(d, '1')).toEqual([{ c: 3, r: 0 }]);
    expect(cellsOf(d, '2')).toEqual([{ c: 7, r: 0 }]);
    // Other brushes stack up as many as wanted.
    d = paint(paint(d, 0, 4, 'O'), 1, 4, 'O');
    expect(cellsOf(d, 'O')).toHaveLength(2);
  });

  it('drags a road at any angle as touching squares that buildMap can trace', () => {
    for (const [c0, r0, c1, r1] of [
      [0, 0, 6, 4],
      [6, 4, 0, 0],
      [0, 7, 7, 0],
      [3, 0, 3, 7],
      [0, 2, 7, 2],
    ]) {
      const road = paintLine(blankDraft(8, 8, 'ridge'), c0, r0, c1, r1, '#');
      // Every step goes sideways or down: |dc| + |dr| + 1 squares, no corners touching diagonally.
      expect(cellsOf(road, '#'), `${c0},${r0} -> ${c1},${r1}`).toHaveLength(Math.abs(c1 - c0) + Math.abs(r1 - r0) + 1);
      const d = paint(paint(road, c0, r0, '1'), c1, r1, 'E');
      expect(() => buildMap(d), `${c0},${r0} -> ${c1},${r1}`).not.toThrow();
    }
  });

  it('keeps the last UNDO_STEPS edits, newest first', () => {
    const h = new History();
    const drafts = Array.from({ length: UNDO_STEPS + 5 }, (_, i) => paint(blankDraft(8, 8, 'ridge'), i % 8, Math.floor(i / 8), '#'));
    for (const d of drafts) h.push(d);
    expect(h.size).toBe(UNDO_STEPS);
    for (let i = drafts.length - 1; i >= drafts.length - UNDO_STEPS; i--) expect(h.undo()).toBe(drafts[i]);
    expect(h.undo()).toBeNull();
    expect(h.size).toBe(0);
  });

  it('resizes on the right and at the bottom, keeping everything that still fits', () => {
    const d = draftOf(MAPS[0]);
    const big = resize(d, 14, 18);
    expect([colsOf(big), big.rows.length]).toEqual([14, 18]);
    d.rows.forEach((row, r) => expect(big.rows[r].slice(0, 12)).toBe(row));
    expect(big.rows.slice(16).join('') + big.rows.map((row) => row.slice(12)).join('')).toMatch(/^\.+$/);
    expect([big.theme, big.hp]).toEqual([d.theme, d.hp]);
    // Growing and shrinking back loses nothing.
    expect(sameDraft(resize(big, 12, 16), d)).toBe(true);
    const small = resize(d, 9, 10);
    expect(small.rows).toEqual(d.rows.slice(0, 10).map((row) => row.slice(0, 9)));
    // Never below MIN_SIDE or above MAX_SIDE squares.
    const clamped = resize(d, 3, 99);
    expect([colsOf(clamped), clamped.rows.length]).toEqual([MIN_SIDE, MAX_SIDE]);
  });

  it('clears to plain ground of the same size and theme, without the chapter HP tuning', () => {
    const d = clearDraft(draftOf(MAPS[7]));
    expect([colsOf(d), d.rows.length, d.theme, d.hp]).toEqual([14, 18, 'flame', undefined]);
    expect(d.rows.join('')).toMatch(/^\.+$/);
  });
});

describe('editor 导出 / 导入', () => {
  const source = readFileSync(new URL('../src/config/maps.ts', import.meta.url), 'utf8');

  it('exports every chapter map exactly as config/maps.ts writes it', () => {
    MAPS.forEach((def, i) => expect(source, `chapter ${i + 1}`).toContain(`    rows: ${exportRows(draftOf(def))},\n`));
  });

  it('brings every chapter map back from its export with the same buildMap result', () => {
    MAPS.forEach((def, i) => {
      const d = draftOf(def);
      const back = mustImport(exportRows(d), d);
      expect(sameDraft(back, d), `chapter ${i + 1}`).toBe(true);
      expect(buildMap(back), `chapter ${i + 1}`).toEqual(buildMap(def));
    });
  });

  it('takes the theme and HP tuning from a whole pasted maps.ts entry', () => {
    const def = MAPS[7];
    const entry = `{\n    theme: '${def.theme}',\n    hp: ${def.hp},\n    rows: ${exportRows(draftOf(def))},\n  },`;
    const back = mustImport(entry, blankDraft(8, 8, 'ridge'));
    // Reason: read from MAPS rather than written out, so retuning chapter 8's difficulty never breaks this test.
    expect([back.theme, back.hp]).toEqual(['flame', def.hp]);
    expect(buildMap(back)).toEqual(buildMap(def));
  });

  it('still reads an export whose line breaks a one-line prompt swallowed or turned into spaces', () => {
    const d = draftOf(MAPS[4]);
    for (const text of [exportRows(d).replace(/\n/g, ''), exportRows(d).replace(/\n/g, ' ')]) {
      expect(sameDraft(mustImport(text, d), d)).toBe(true);
    }
  });

  it('reads bare rows split by line breaks, spaces or commas, and pads a small map', () => {
    const d = draftOf(MAPS[2]);
    for (const sep of ['\n', '  ', ',']) expect(mustImport(d.rows.join(sep), d).rows).toEqual(d.rows);
    const tiny = mustImport('....O....\n1###E###2\n....o....', d);
    expect([colsOf(tiny), tiny.rows.length]).toEqual([9, MIN_SIDE]);
    expect(tiny.rows.slice(0, 3)).toEqual(['....O....', '1###E###2', '....o....']);
    expect(tiny.rows.slice(3).join('')).toMatch(/^\.+$/);
  });

  it('refuses unknown characters, maps over MAX_SIDE, rows run together and empty pastes', () => {
    const err = (text: string): string => {
      const p = parsePaste(text);
      return 'error' in p ? p.error : '';
    };
    expect(err("['..x..']")).toContain('「x」');
    expect(err(`['${'.'.repeat(MAX_SIDE + 1)}', '...']`)).toContain(`${MAX_SIDE + 1}×2`);
    expect(err(Array.from({ length: MAX_SIDE + 1 }, () => "'........'").join(','))).toContain(`8×${MAX_SIDE + 1}`);
    expect(err('.'.repeat(60))).toContain('一整行');
    expect(err('  \n ')).toContain('没读到');
    // An import that fails leaves nothing half-done: it only reports.
    expect('error' in importDraft("['..x..']", draftOf(MAPS[0]))).toBe(true);
  });
});

describe('editor draft in localStorage', () => {
  it('keeps the draft and brings it back as it was', () => {
    const store = memoryStore();
    for (const d of [draftOf(MAPS[9]), blankDraft(MAX_SIDE, MIN_SIDE, 'web')]) {
      expect(saveDraft(d, store)).toBe(true);
      const back = loadDraft(store);
      expect(back && sameDraft(back, d)).toBe(true);
    }
    expect(store.data.has(DRAFT_KEY)).toBe(true);
  });

  it('reads nothing back from junk, and never throws', () => {
    const ok = draftOf(MAPS[0]);
    const junk = [
      '{',
      'null',
      '[]',
      JSON.stringify({ ...ok, theme: 'moon' }),
      JSON.stringify({ ...ok, rows: ok.rows.map((r) => r.replace('E', 'X')) }),
      JSON.stringify({ ...ok, rows: [...ok.rows.slice(0, 15), '...'] }),
      JSON.stringify({ ...ok, rows: ok.rows.slice(0, MIN_SIDE - 1) }),
      JSON.stringify({ ...ok, rows: ok.rows.map((r) => r.padEnd(MAX_SIDE + 1, '.')) }),
      JSON.stringify({ ...ok, rows: [1, 2, 3] }),
    ];
    for (const raw of junk) {
      const store = memoryStore();
      store.data.set(DRAFT_KEY, raw);
      expect(loadDraft(store), raw).toBeNull();
    }
    expect(loadDraft(null)).toBeNull();
    expect(loadDraft({ getItem: () => { throw new Error('blocked'); }, setItem: () => {} })).toBeNull();
    expect(saveDraft(ok, { getItem: () => null, setItem: () => { throw new Error('quota'); } })).toBe(false);
    expect(saveDraft(ok, null)).toBe(false);
    // A bad HP tuning is dropped, the map is kept.
    expect(parseDraft(JSON.stringify({ ...ok, hp: -2 }))?.hp).toBeUndefined();
  });
});
