// The map editor (plan.md D1), opened from the address …/#editor (no button leads there). Pick a brush in the palette,
// then tap or drag on the map to paint; the camp and each entrance move when placed again. Every edit is checked live:
// the map is painted exactly as a run paints it, or shown as raw squares under a red banner while it doesn't build.
// 撤销 / 清空 / 尺寸 / 载入 / 导出 / 导入 / 试玩 sit at the bottom; the draft is kept in localStorage ('zdxy:editor')
// and comes back the next time the editor opens.
import { MAPS, TILE } from '../config/maps.ts';
import { askText, copyText, leaveEditorAddress } from '../platform/editor-io.ts';
import { browserStorage } from '../platform/save.ts';
import type { Stage } from '../platform/web.ts';
import { Camera } from '../render/camera.ts';
import { thumbRect } from '../render/chapter-card.ts';
import { drawBestPads, drawEntranceTags, drawFaults, drawGridLines, drawPadMarks, drawRawGrid, PaintedMap } from '../render/editor-draw.ts';
import { inRect, L, W, type Rect } from '../render/layout.ts';
import { warmThumbs } from '../render/map-thumb.ts';
import { NUMERALS } from '../render/panels.ts';
import { checkDraft, type DraftCheck } from './editor-check.ts';
import { ACTIONS, actionRect, BACK_BTN, loadCard, mapView, PALETTE_SIZE, paletteRect, PAN_TOOL, sizeButtons, type ActionId } from './editor-layout.ts';
import {
  BRUSHES,
  cellsOf,
  clearDraft,
  colsOf,
  draftOf,
  ENTRANCES,
  History,
  isUnique,
  MAX_SIDE,
  MIN_SIDE,
  paint,
  paintLine,
  resize,
  sameDraft,
  type Cell,
  type Draft,
} from './editor-model.ts';
import { drawChrome, drawLoadPanel, drawSizePanel, loadPanelHit } from './editor-panels.ts';
import { exportRows, importDraft, loadDraft, saveDraft } from './editor-text.ts';
import { Toasts } from './hud.ts';
import type { Pointer } from './input.ts';
import { CameraControls } from './map-controls.ts';
import type { Nav, Scene } from './scenes.ts';

/** Seconds the painting must rest before the draft is checked and painted again (a stroke never repaints per move). */
const SETTLE = 0.1;
/** Every chapter number, for painting the 载入 thumbnails. */
const CHAPTER_IDS = MAPS.map((_, i) => i + 1);

type SizeKey = 'cols-' | 'cols+' | 'rows-' | 'rows+' | 'done';

/** A control on screen: what a press shows pressed and a tap acts on. */
type Control =
  | { t: 'back' }
  | { t: 'act'; id: ActionId }
  | { t: 'tool'; i: number }
  | { t: 'size'; key: SizeKey }
  | { t: 'load'; i: number | 'cancel' };

/** The key a control is drawn pressed by (EditorChrome.pressed and the panels compare against it). */
function keyOf(c: Control): string {
  switch (c.t) {
    case 'back':
      return 'back';
    case 'act':
      return `act:${c.id}`;
    case 'tool':
      return `tool:${c.i}`;
    case 'size':
      return `size:${c.key}`;
    case 'load':
      return `load:${c.i}`;
  }
}

/** A drag that paints. */
interface Stroke {
  /** The draft when it began: the undo step it makes, and the map a moved camp or entrance is placed on. */
  base: Draft;
  ch: string;
  /** The square it last reached. */
  at: Cell;
}

export class EditorScene implements Scene {
  private readonly nav: Nav;
  private readonly stage: Stage;
  private readonly store = browserStorage();
  private draft: Draft;
  private readonly history = new History();
  /** The last check, and the draft it was made of: squares edited since are drawn raw until the next check. */
  private check: DraftCheck;
  private checked: Draft;
  /** Clock time of the last edit not checked yet, or -1 when the check is up to date. */
  private editedAt = -1;
  /** The selected palette entry: an index into BRUSHES, or PAN_TOOL. */
  private tool = 0;
  private panel: 'size' | 'load' | null = null;
  private stroke: Stroke | null = null;
  private pressed: string | null = null;
  private t = 0;
  /** The map's size in world px, which the camera reads; changed in place when the map is resized. */
  private readonly size = { w: 0, h: 0 };
  private readonly cam: Camera;
  private readonly camCtl = new CameraControls();
  private readonly painted = new PaintedMap();
  private readonly toasts = new Toasts();

  constructor(nav: Nav, stage: Stage) {
    this.nav = nav;
    this.stage = stage;
    const kept = loadDraft(this.store);
    this.draft = kept ?? draftOf(MAPS[0]);
    this.checked = this.draft;
    this.check = checkDraft(this.draft);
    this.cam = new Camera(this.size);
    this.fit();
    this.toasts.push(kept ? '接着上次的草稿画' : '从第一章的地图开始改：选画笔，点或拖着画');
  }

  update(dt: number): void {
    this.t += dt;
    this.toasts.update(dt);
    // Reason: the view follows the screen's height; keep the camera on the map.
    this.cam.clamp(mapView());
    if (this.editedAt >= 0 && this.t - this.editedAt >= SETTLE) this.recheck();
    if (this.panel === 'load') {
      const tr = thumbRect(loadCard(0));
      warmThumbs(CHAPTER_IDS, tr.w, tr.h, this.stage.pixelRatio);
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const view = mapView();
    ctx.fillStyle = '#2b1e14';
    ctx.fillRect(0, 0, W, L.H);
    ctx.save();
    ctx.beginPath();
    ctx.rect(view.x, view.y, view.w, view.h);
    ctx.clip();
    this.cam.apply(ctx, view);
    this.drawWorld(ctx);
    ctx.restore();
    const { draft, check, tool, pressed, t } = this;
    drawChrome(ctx, { draft, check, pending: this.checked !== draft, tool, undo: this.history.size, pressed, t });
    if (this.panel === 'size') drawSizePanel(ctx, draft, pressed);
    this.toasts.draw(ctx, view.y + view.h - 48);
    if (this.panel === 'load') drawLoadPanel(ctx, this.stage.pixelRatio, t, pressed);
  }

  /** Called when the page is hidden: a stroke in progress is kept (and saved). */
  pause(): void {
    this.endStroke(true);
    this.camCtl.reset();
  }

  /**
   * The map in world units, under the square grid: painted like a run while it builds — the squares edited since the
   * last check drawn raw on top, then the locked pads, the best pads and the entrance numbers — or all raw squares,
   * with the squares at fault framed, while it doesn't.
   */
  private drawWorld(ctx: CanvasRenderingContext2D): void {
    const k = 1 / this.cam.zoom;
    const { draft, checked } = this;
    const map = this.check.map;
    const cols = colsOf(draft);
    if (!map || map.cols !== cols || map.rows !== draft.rows.length) {
      drawRawGrid(ctx, draft.rows, draft.theme);
      drawGridLines(ctx, cols, draft.rows.length, k);
      drawFaults(ctx, this.check.faults, this.t, k);
      return;
    }
    this.painted.draw(ctx, map, this.cam.zoom, this.stage.pixelRatio);
    if (checked !== draft) drawRawGrid(ctx, draft.rows, draft.theme, (c, r) => draft.rows[r][c] !== checked.rows[r][c]);
    drawGridLines(ctx, cols, draft.rows.length, k);
    drawPadMarks(ctx, map, this.t, k);
    drawBestPads(ctx, map, this.check.best, this.t, k);
    drawEntranceTags(ctx, ENTRANCES.flatMap((n) => cellsOf(draft, n).map((cell) => ({ ...cell, n }))), k);
  }

  // ---- input -------------------------------------------------------------

  press(p: Pointer): void {
    const c = this.controlAt(p);
    this.pressed = c ? keyOf(c) : null;
  }

  tap(p: Pointer): void {
    this.pressed = null;
    const c = this.controlAt(p);
    if (this.panel === 'load') {
      if (c?.t === 'load') this.pickChapter(c.i);
      return;
    }
    if (!c) {
      // Reason: a tap on the map while the 尺寸 panel is open only closes it, so it never paints by surprise.
      if (this.panel === 'size') this.panel = null;
      else if (this.tool !== PAN_TOOL) this.paintTap(p);
      return;
    }
    if (c.t === 'back') this.leave();
    else if (c.t === 'act') this.act(c.id);
    else if (c.t === 'tool') this.tool = c.i;
    else if (c.t === 'size') this.tapSize(c.key);
  }

  dragStart(start: Pointer, p: Pointer): void {
    this.pressed = null;
    if (this.panel !== null || !inRect(start.x, start.y, mapView())) return;
    const cell = this.tool === PAN_TOOL ? null : this.cellUnder(start);
    // The pan tool drags the map; so does a drag that starts off the map, beside it.
    if (!cell) {
      this.camCtl.beginPan(this.cam, start);
      return;
    }
    this.stroke = { base: this.draft, ch: BRUSHES[this.tool].ch, at: cell };
    this.strokeTo(cell);
    this.dragMove(p);
  }

  dragMove(p: Pointer): void {
    if (!this.stroke) {
      this.camCtl.movePan(this.cam, mapView(), p);
      return;
    }
    const cell = this.cellUnder(p);
    if (cell && (cell.c !== this.stroke.at.c || cell.r !== this.stroke.at.r)) this.strokeTo(cell);
  }

  dragEnd(): void {
    this.camCtl.reset();
    this.endStroke(true);
  }

  pinchStart(c: Pointer, dist: number): void {
    // Reason: a pinch begins with one finger, which may have moved far enough to start painting before the second
    // finger landed; the gesture is a zoom after all, so that stray stroke is taken back.
    this.endStroke(false);
    this.pressed = null;
    if (this.panel !== 'load') this.camCtl.beginPinch(c, dist);
  }

  pinchMove(c: Pointer, dist: number): void {
    this.camCtl.movePinch(this.cam, mapView(), c, dist);
  }

  pinchEnd(): void {
    this.camCtl.reset();
  }

  wheel(p: Pointer, deltaY: number): void {
    if (this.panel === 'load' || !inRect(p.x, p.y, mapView())) return;
    this.camCtl.wheel(this.cam, mapView(), p, deltaY);
  }

  /** The control under a point: the open panel's, else 返回, an action button or (with no panel over it) a palette entry. */
  private controlAt(p: Pointer): Control | null {
    if (this.panel === 'load') {
      const hit = loadPanelHit(p.x, p.y);
      return hit === null ? null : { t: 'load', i: hit };
    }
    if (this.panel === 'size') {
      const b = sizeButtons();
      const keys: Array<[Rect, SizeKey]> = [
        [b.cols[0], 'cols-'],
        [b.cols[1], 'cols+'],
        [b.rows[0], 'rows-'],
        [b.rows[1], 'rows+'],
        [b.done, 'done'],
      ];
      const hit = keys.find(([r]) => inRect(p.x, p.y, r));
      if (hit) return { t: 'size', key: hit[1] };
    }
    if (inRect(p.x, p.y, BACK_BTN)) return { t: 'back' };
    const a = ACTIONS.findIndex((_, i) => inRect(p.x, p.y, actionRect(i)));
    if (a >= 0) return { t: 'act', id: ACTIONS[a].id };
    if (this.panel === 'size') return null;
    for (let i = 0; i < PALETTE_SIZE; i++) if (inRect(p.x, p.y, paletteRect(i))) return { t: 'tool', i };
    return null;
  }

  /** The square under a screen point, or null outside the map view or off the map. */
  private cellUnder(p: Pointer): Cell | null {
    const view = mapView();
    if (!inRect(p.x, p.y, view)) return null;
    const w = this.cam.toWorld(p.x, p.y, view);
    const c = Math.floor(w.x / TILE);
    const r = Math.floor(w.y / TILE);
    return c >= 0 && r >= 0 && c < colsOf(this.draft) && r < this.draft.rows.length ? { c, r } : null;
  }

  // ---- editing -----------------------------------------------------------

  /** A tap paints one square: one undo step, checked once the painting rests. */
  private paintTap(p: Pointer): void {
    const cell = this.cellUnder(p);
    if (cell) this.commit(paint(this.draft, cell.c, cell.r, BRUSHES[this.tool].ch), true);
  }

  /**
   * Carries the stroke on to `cell`. A camp or entrance follows the finger — placed on the stroke's starting map, so
   * the squares it passes over keep what they had — while other brushes paint every square on the way.
   */
  private strokeTo(cell: Cell): void {
    const s = this.stroke;
    if (!s) return;
    const next = isUnique(s.ch) ? paint(s.base, cell.c, cell.r, s.ch) : paintLine(this.draft, s.at.c, s.at.r, cell.c, cell.r, s.ch);
    s.at = cell;
    if (next === this.draft) return;
    // No undo step and no save per move: endStroke records the whole stroke once.
    this.draft = next;
    this.editedAt = this.t;
  }

  /** Ends the stroke: kept as one undo step (and saved) when it changed anything, or taken back when `keep` is false. */
  private endStroke(keep: boolean): void {
    const s = this.stroke;
    if (!s) return;
    this.stroke = null;
    if (!keep) {
      this.draft = s.base;
      this.editedAt = this.t;
    } else if (!sameDraft(s.base, this.draft)) {
      this.history.push(s.base);
      saveDraft(this.draft, this.store);
    }
  }

  /** An edit: the current draft goes on the undo stack (when anything changed), then `next` is applied. */
  private commit(next: Draft, settle = false): boolean {
    if (sameDraft(next, this.draft)) return false;
    this.history.push(this.draft);
    this.apply(next, settle);
    return true;
  }

  /** Makes `next` the draft: saved, the whole map shown when its size changed, checked now or once edits settle. */
  private apply(next: Draft, settle: boolean): void {
    const resized = colsOf(next) !== colsOf(this.draft) || next.rows.length !== this.draft.rows.length;
    this.draft = next;
    saveDraft(next, this.store);
    if (resized) this.fit();
    if (settle) this.editedAt = this.t;
    else this.recheck();
  }

  /** Checks the current draft now (buildMap and the figures), unless that check is already made. */
  private recheck(): void {
    this.editedAt = -1;
    if (this.checked === this.draft) return;
    this.checked = this.draft;
    this.check = checkDraft(this.draft);
  }

  /** Shows the whole map: when the editor opens and whenever the map's size changes. */
  private fit(): void {
    this.size.w = colsOf(this.draft) * TILE;
    this.size.h = this.draft.rows.length * TILE;
    // clamp() lifts a zoom of 0 to the smallest zoom, the one that shows the whole map, and centres it.
    this.cam.zoom = 0;
    this.cam.clamp(mapView());
  }

  // ---- actions -----------------------------------------------------------

  private act(id: ActionId): void {
    if (id === 'undo') this.undo();
    else if (id === 'clear') this.toasts.push(this.commit(clearDraft(this.draft)) ? '已清空，可以撤销' : '已经是空地图了');
    else if (id === 'size') this.panel = this.panel === 'size' ? null : 'size';
    else if (id === 'load') this.panel = 'load';
    else if (id === 'export') void this.exportMap();
    else if (id === 'import') this.importMap();
    else this.play();
  }

  private undo(): void {
    const prev = this.history.undo();
    if (prev) this.apply(prev, false);
    else this.toasts.push('没有可以撤销的了');
  }

  /** − / + on the 尺寸 panel (columns on the right, rows at the bottom), or 完成. */
  private tapSize(key: SizeKey): void {
    if (key === 'done') {
      this.panel = null;
      return;
    }
    const dc = key === 'cols+' ? 1 : key === 'cols-' ? -1 : 0;
    const dr = key === 'rows+' ? 1 : key === 'rows-' ? -1 : 0;
    if (!this.commit(resize(this.draft, colsOf(this.draft) + dc, this.draft.rows.length + dr))) {
      this.toasts.push(`地图要 ${MIN_SIDE}～${MAX_SIDE} 格`);
    }
  }

  /** A card on the 载入 panel: that chapter's map becomes the draft (撤销 brings the old one back). */
  private pickChapter(i: number | 'cancel'): void {
    this.panel = null;
    if (i === 'cancel') return;
    if (this.commit(draftOf(MAPS[i]))) this.toasts.push(`载入了第${NUMERALS[i]}章的地图，可以撤销`);
    else this.toasts.push('现在画的就是这一章的地图');
  }

  /** 导出: the rows as a maps.ts array onto the clipboard; where that fails, shown in a prompt to copy by hand. */
  private async exportMap(): Promise<void> {
    const text = exportRows(this.draft);
    if (await copyText(text)) this.toasts.push(this.check.map ? '已复制：在 maps.ts 里替换 rows: 后面的 [ … ]' : '已复制（地图还有错，先别放进 maps.ts）');
    else askText('复制下面的地图，在 maps.ts 里替换 rows: 后面的 [ … ]', text);
  }

  /** 导入: a pasted map (the exported array, or bare rows) becomes the draft; 撤销 brings the old one back. */
  private importMap(): void {
    const text = askText('粘贴地图：「导出」的数组，或一行一行的地图字符');
    if (text === null || text.trim() === '') return;
    const next = importDraft(text, this.draft);
    if ('error' in next) this.toasts.push(next.error);
    else if (this.commit(next)) this.toasts.push(`导入了 ${colsOf(next)}×${next.rows.length} 的地图，可以撤销`);
    else this.toasts.push('和现在的地图一样');
  }

  /** 试玩: a chapter-1 run on the draft; refused while the map doesn't build or has no pad to build on. */
  private play(): void {
    this.endStroke(true);
    this.recheck();
    const { map, error } = this.check;
    if (!map) this.toasts.push(`先把地图修好：${error ?? ''}`);
    else if (map.slots.length === 0) this.toasts.push('先放几个石台再试玩');
    else {
      // The editor is kept for 返回编辑: it comes back as it was, minus an open panel.
      this.panel = null;
      this.nav.tryMap(this.draft);
    }
  }

  /** 返回: to the title screen. The draft is already kept; the address loses its #editor. */
  private leave(): void {
    this.endStroke(true);
    this.panel = null;
    leaveEditorAddress();
    this.nav.title();
  }
}
