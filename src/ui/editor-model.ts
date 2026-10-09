// The map editor's model (plan.md D1): the map being drawn as rows of legend characters (see config/maps.ts), the
// palette's brushes, painting (the camp and each entrance stay unique), resizing and the undo stack. Pure and
// DOM-free. Every edit returns a new draft and never changes the old one, so the undo stack simply keeps old drafts.
import { MAPS, PAD_LETTERS, SLOT_NAME, type MapDef, type MapTheme } from '../config/maps.ts';

/** Fewest and most squares across or down. */
export const MIN_SIDE = 8;
export const MAX_SIDE = 20;
/** How many edits 撤销 can take back. */
export const UNDO_STEPS = 20;
/** Plain ground: what the eraser paints and what new squares start as. */
export const GROUND = '.';
/** 唐僧's camp, where every road ends. */
export const CAMP = 'E';
/** The monster entrances, one road each. */
export const ENTRANCES: readonly string[] = ['1', '2', '3', '4'];
/** Every map theme (the ten chapter maps use each one once). */
export const MAP_THEMES: readonly MapTheme[] = [...new Set(MAPS.map((m) => m.theme))];

/** A map being edited: a MapDef whose rows are all exactly as wide as the first. Never changed in place. */
export interface Draft {
  readonly theme: MapTheme;
  /** The hand tuning (MapDef.hp) of the chapter map it was loaded from, so its hpScale reads as in that chapter. */
  readonly hp?: number;
  readonly rows: readonly string[];
}

/** A square of the grid: column and row. */
export interface Cell {
  c: number;
  r: number;
}

/** What a brush paints: the palette groups them, the hint line describes them. */
export type BrushKind = 'road' | 'pad' | 'camp' | 'entrance' | 'scenery' | 'erase';

export interface Brush {
  /** The legend character it paints. */
  ch: string;
  kind: BrushKind;
  /** Short label under its swatch. */
  label: string;
  /** What the hint line says while it is selected. */
  hint: string;
}

/** The pad brushes, read from config/maps.ts so a new pad kind shows up in the palette by itself. */
const PAD_BRUSHES: Brush[] = Object.entries(PAD_LETTERS).map(([ch, p]) => ({
  ch,
  kind: 'pad',
  label: SLOT_NAME[p.kind],
  hint: `${SLOT_NAME[p.kind]} · ${p.open ? '开局可用' : '花功德解锁'}（${ch}）`,
}));

/** Every legend character as a brush, in palette order. */
export const BRUSHES: readonly Brush[] = [
  { ch: '#', kind: 'road', label: '路', hint: '路 · 一格宽的走廊，从入口连到营地（#）' },
  ...PAD_BRUSHES,
  { ch: CAMP, kind: 'camp', label: '营地', hint: '营地 · 只有一个，再放一次就是移动（E）' },
  ...ENTRANCES.map((n): Brush => ({ ch: n, kind: 'entrance', label: `入口${n}`, hint: `入口 ${n} · 一个数字一条路，再放一次就是移动` })),
  { ch: '~', kind: 'scenery', label: '水', hint: '水 · 火焰主题里是岩浆（~）' },
  { ch: '^', kind: 'scenery', label: '岩石', hint: '岩石（^）' },
  { ch: 'T', kind: 'scenery', label: '树', hint: '树（T）' },
  { ch: GROUND, kind: 'erase', label: '擦除', hint: '擦除 · 变回空地（.）' },
];

/** Every character a map row may hold. */
export const LEGEND: ReadonlySet<string> = new Set(BRUSHES.map((b) => b.ch));

/** Number of squares across. */
export function colsOf(d: Draft): number {
  return d.rows[0]?.length ?? 0;
}

/** A side length kept within MIN_SIDE..MAX_SIDE. */
export function clampSide(n: number): number {
  return Math.max(MIN_SIDE, Math.min(MAX_SIDE, Math.round(n)));
}

/** A draft with the given rows, carrying `hp` only when there is one (so drafts compare and serialise cleanly). */
export function makeDraft(theme: MapTheme, rows: readonly string[], hp?: number): Draft {
  return hp === undefined ? { theme, rows } : { theme, hp, rows };
}

/** `cols` x `rows` squares of plain ground. */
export function blankDraft(cols: number, rows: number, theme: MapTheme): Draft {
  return makeDraft(theme, new Array<string>(clampSide(rows)).fill(GROUND.repeat(clampSide(cols))));
}

/** An editable copy of a map definition (a chapter map), its rows padded to the widest. */
export function draftOf(def: MapDef): Draft {
  const cols = Math.max(...def.rows.map((r) => r.length));
  return makeDraft(def.theme, def.rows.map((r) => r.padEnd(cols, GROUND)), def.hp);
}

/** Whether two drafts are the same map. */
export function sameDraft(a: Draft, b: Draft): boolean {
  return a.theme === b.theme && a.hp === b.hp && a.rows.length === b.rows.length && a.rows.every((row, i) => row === b.rows[i]);
}

/** The squares holding `ch`, row by row. */
export function cellsOf(d: Draft, ch: string): Cell[] {
  const out: Cell[] = [];
  d.rows.forEach((row, r) => {
    for (let c = row.indexOf(ch); c >= 0; c = row.indexOf(ch, c + 1)) out.push({ c, r });
  });
  return out;
}

/** Whether only one square may hold `ch` — the camp and each entrance — so placing it again moves it. */
export function isUnique(ch: string): boolean {
  return ch === CAMP || ENTRANCES.includes(ch);
}

/**
 * `d` with square (c, r) painted `ch`; the very same draft when nothing changes (outside the map, or already `ch`).
 * The camp and the entrances are unique: placing one clears its old square to plain ground.
 */
export function paint(d: Draft, c: number, r: number, ch: string): Draft {
  if (r < 0 || r >= d.rows.length || c < 0 || c >= colsOf(d) || d.rows[r][c] === ch) return d;
  const rows = isUnique(ch) ? d.rows.map((row) => row.replaceAll(ch, GROUND)) : [...d.rows];
  rows[r] = rows[r].slice(0, c) + ch + rows[r].slice(c + 1);
  return makeDraft(d.theme, rows, d.hp);
}

/**
 * Every square from (c0, r0) to (c1, r1) painted `ch`: the stretch a drag covered between two pointer samples.
 * Reason: the line only ever steps sideways or down, never diagonally, so a road dragged at an angle comes out as a
 * staircase of touching squares — a corridor buildMap can trace — instead of squares meeting at their corners.
 */
export function paintLine(d: Draft, c0: number, r0: number, c1: number, r1: number, ch: string): Draft {
  const nc = Math.abs(c1 - c0);
  const nr = Math.abs(r1 - r0);
  let c = c0;
  let r = r0;
  let out = paint(d, c, r, ch);
  for (let ic = 0, ir = 0; ic < nc || ir < nr; ) {
    // Reason: step along whichever axis keeps the squares closest to the straight line between the two samples.
    if ((ic + 0.5) / nc < (ir + 0.5) / nr) {
      c += Math.sign(c1 - c0);
      ic++;
    } else {
      r += Math.sign(r1 - r0);
      ir++;
    }
    out = paint(out, c, r, ch);
  }
  return out;
}

/**
 * `d` with `cols` x `rows` squares (each kept within MIN_SIDE..MAX_SIDE). Columns and rows come and go on the right
 * and at the bottom: new squares are plain ground, cut-off squares are lost (撤销 brings them back).
 */
export function resize(d: Draft, cols: number, rows: number): Draft {
  const w = clampSide(cols);
  const out = Array.from({ length: clampSide(rows) }, (_, r) => (d.rows[r] ?? '').slice(0, w).padEnd(w, GROUND));
  return makeDraft(d.theme, out, d.hp);
}

/** 清空: plain ground of the same size and theme. A new map has no chapter's HP tuning, so that goes too. */
export function clearDraft(d: Draft): Draft {
  return blankDraft(colsOf(d), d.rows.length, d.theme);
}

/** The undo stack: the drafts from before the last UNDO_STEPS edits, newest last. */
export class History {
  private readonly past: Draft[] = [];
  private readonly limit: number;

  constructor(limit = UNDO_STEPS) {
    this.limit = limit;
  }

  /** How many edits can be taken back. */
  get size(): number {
    return this.past.length;
  }

  /** Remembers the draft from before an edit; the oldest step falls off past the limit. */
  push(d: Draft): void {
    this.past.push(d);
    if (this.past.length > this.limit) this.past.shift();
  }

  /** The draft from before the last edit (taken off the stack), or null when there is nothing left to undo. */
  undo(): Draft | null {
    return this.past.pop() ?? null;
  }
}
