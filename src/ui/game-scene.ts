// The chapter screen: runs the fixed-step simulation, moves the camera (drag to pan, pinch or wheel to zoom),
// handles the shop, drag-and-drop onto the map's slots, encounters, pause and results.
import { CHAPTERS, unlockCost } from '../config/chapters.ts';
import { heroFor } from '../config/combos.ts';
import { ENEMIES } from '../config/enemies.ts';
import { ULTIMATES } from '../config/ultimates.ts';
import { UNITS } from '../config/units.ts';
import { previewDrop } from '../core/board.ts';
import { DT } from '../core/clock.ts';
import { act, createGame, step } from '../core/game.ts';
import { slotAt } from '../core/map.ts';
import { currentRefreshCost, offerPrice } from '../core/shop.ts';
import { tileDamage, tileRange } from '../core/stats.ts';
import { buildMods, clearRewards, type ClearRewards } from '../core/treasures.ts';
import type { Action, GameState, HeroId, RunMods, SimEvent, Tile } from '../core/types.ts';
import type { Stage } from '../platform/web.ts';
import { Camera } from '../render/camera.ts';
import { encounterCardRects } from '../render/encounter-panel.ts';
import { inRect, L, viewRect, type Rect } from '../render/layout.ts';
import { NUMERALS } from '../render/panels.ts';
import { GameRenderer, type DragUi, type GameUi } from '../render/renderer.ts';
import { Vfx } from '../render/vfx.ts';
import { drawPause, drawResult, pausePanel, resultPanel, tapButtons, type OverlayButton, type ResultInfo } from './game-overlays.ts';
import { Toasts } from './hud.ts';
import type { Pointer } from './input.ts';
import type { Nav, Scene } from './scenes.ts';

/** Seconds after the run ends before the result panel appears (let the last effects play). */
const RESULT_DELAY = 1;
/** How far above a finger a dragged card is drawn. */
const TOUCH_LIFT = 44;
/** Zoom step per wheel notch. */
const WHEEL_STEP = 1.12;

/** Reason: a function call instead of an inline check, because step() changes the phase behind TS's narrowing. */
function isOver(g: GameState): boolean {
  return g.phase === 'won' || g.phase === 'lost';
}

function describe(t: Pick<Tile, 'id' | 'level' | 'divine'>, mods: RunMods): string {
  const def = UNITS[t.id];
  const name = `${t.divine ? '神' : ''}${t.id}${t.level > 1 ? ` ${t.level}级` : ''}`;
  if (def.kind === 'hero') {
    const u = ULTIMATES[t.id as HeroId];
    const tile: Tile = { uid: 0, cd: 0, invested: 0, rage: 0, ...t };
    return `${name} · 大招「${u.name}」：${u.desc}（伤害 ${Math.round(tileDamage(tile, mods))}）`;
  }
  if (def.kind === 'attack') {
    const tile: Tile = { uid: 0, cd: 0, invested: 0, rage: 0, ...t };
    const range = tileRange(tile, mods);
    return `${name} · ${def.desc}（伤害 ${Math.round(tileDamage(tile, mods))}，射程 ${Number.isFinite(range) ? Math.round(range) : '全场'}）`;
  }
  return `${name} · ${def.desc}`;
}

export class GameScene implements Scene {
  private readonly nav: Nav;
  private readonly chapter: number;
  private readonly g: GameState;
  private readonly renderer: GameRenderer;
  private readonly vfx: Vfx;
  private readonly cam: Camera;
  private readonly toasts = new Toasts();
  private acc = 0;
  private speed = 1;
  private paused = false;
  private clock = 0;
  /** Seconds since the run ended; -1 while it is still running. */
  private endT = -1;
  /** Rewards banked when the chapter was cleared. */
  private rewards: ClearRewards | null = null;
  private drag: DragUi | null = null;
  private lift = 0;
  private hoverCell = -1;
  private hoverValid = false;
  private hoverTrash = false;
  private hoverHint: string | null = null;
  /** Camera position when a pan started, and where the finger was. */
  private pan: { x: number; y: number; sx: number; sy: number } | null = null;
  private pinch: { dist: number; x: number; y: number } | null = null;
  private pressed: string | null = null;
  private selected = -1;
  private selectedT = 0;
  private readonly tutorial: boolean;
  private told = new Set<string>();

  constructor(stage: Stage, chapter: number, nav: Nav) {
    this.nav = nav;
    this.chapter = chapter;
    const vault = nav.progress.vault;
    // Reason: Math.random is fine here — only the seed is random; the run itself stays deterministic.
    this.g = createGame({ seed: (Math.random() * 0x7fffffff) | 0, chapter, mods: buildMods(vault) });
    this.renderer = new GameRenderer(stage);
    this.vfx = new Vfx(this.g.map);
    this.cam = new Camera(this.g.map);
    this.cam.fit(this.view());
    this.tutorial = chapter === 1;
    const ch = CHAPTERS[chapter - 1];
    const gear = vault.equipped.length > 0 ? ` · 带了 ${vault.equipped.length} 件法宝` : '';
    this.vfx.showBanner(`第${NUMERALS[chapter - 1]}章 · ${ch.name}`, `别让妖怪走到唐僧的营地，打败${ENEMIES[ch.boss].name}${gear}`, '#ffd166', null, 2.6);
    this.tip('drag', '把商店里的卡拖到路边的石台上');
    this.tip('pan', '按住空地拖动地图，双指或滚轮缩放');
  }

  private tip(key: string, msg: string): void {
    if (!this.tutorial || this.told.has(key)) return;
    this.told.add(key);
    this.toasts.push(msg);
  }

  private view(): Rect {
    return viewRect(this.g.phase);
  }

  /** Slot under a screen point, or -1 (outside the viewport counts as nothing). */
  private slotUnder(x: number, y: number): number {
    const v = this.view();
    if (!inRect(x, y, v)) return -1;
    const w = this.cam.toWorld(x, y, v);
    return slotAt(this.g.map, w.x, w.y);
  }

  update(dt: number): void {
    this.clock += dt;
    this.vfx.update(dt);
    this.toasts.update(dt);
    this.selectedT = Math.max(0, this.selectedT - dt);
    if (this.selectedT === 0) this.selected = -1;
    // Reason: the viewport changes height between the shop and the battle bar; keep the camera on the map.
    this.cam.clamp(this.view());
    const g = this.g;
    if (isOver(g)) {
      if (this.endT < 0) this.onEnd();
      this.endT += dt;
      return;
    }
    if (this.paused) return;
    this.acc += dt * this.speed;
    const cap = 5 * this.speed;
    let steps = 0;
    while (this.acc >= DT && steps < cap && !isOver(g)) {
      step(g);
      this.handleEvents(g.events);
      this.acc -= DT;
      steps++;
    }
    // Reason: if the device can't keep up, drop the backlog instead of spiralling into ever-longer frames.
    if (steps >= cap) this.acc = 0;
  }

  render(ctx: CanvasRenderingContext2D): void {
    this.renderer.draw(ctx, this.g, this.ui(), this.vfx, this.clock, this.cam);
    this.toasts.draw(ctx, this.g.phase === 'build' ? L.shop.y - 24 : L.bar.y - 18);
    if (isOver(this.g)) {
      if (this.endT >= RESULT_DELAY) drawResult(ctx, this.resultInfo(), this.resultButtons());
    } else if (this.paused) {
      drawPause(ctx, this.pauseButtons());
    }
  }

  pause(): void {
    if (isOver(this.g)) return;
    this.paused = true;
    this.drag = null;
    this.pan = null;
    this.pinch = null;
  }

  private ui(): GameUi {
    return {
      pressed: this.pressed,
      speed: this.speed,
      hoverTrash: this.hoverTrash,
      draggingOffer: this.drag?.kind === 'shop' ? this.drag.index : -1,
      dragging: this.drag !== null,
      drag: this.drag,
      hoverCell: this.hoverCell,
      hoverValid: this.hoverValid,
      selected: this.selected,
      hoverHint: this.hoverHint,
    };
  }

  /** Pause panel, result panel or a pending encounter: the map and shop don't take input. */
  private overlayOpen(): boolean {
    return this.paused || isOver(this.g) || this.g.encounter !== null;
  }

  private buttonAt(p: Pointer): string | null {
    if (inRect(p.x, p.y, L.btnPause)) return 'pause';
    if (inRect(p.x, p.y, L.btnSpeed)) return 'speed';
    if (this.g.phase === 'build') {
      if (inRect(p.x, p.y, L.btnRefresh)) return 'refresh';
      if (inRect(p.x, p.y, L.btnStart)) return 'start';
    }
    return null;
  }

  // ---- input -------------------------------------------------------------

  press(p: Pointer): void {
    if (this.g.encounter && !this.paused && !isOver(this.g)) {
      const i = encounterCardRects().findIndex((r) => inRect(p.x, p.y, r));
      this.pressed = i >= 0 ? `enc:${i}` : null;
      return;
    }
    if (!this.overlayOpen()) this.pressed = this.buttonAt(p);
  }

  tap(p: Pointer): void {
    this.pressed = null;
    const g = this.g;
    if (isOver(g)) {
      if (this.endT >= RESULT_DELAY) tapButtons(p, resultPanel(this.resultInfo()), this.resultButtons());
      return;
    }
    if (this.paused) {
      tapButtons(p, pausePanel(), this.pauseButtons());
      return;
    }
    if (g.encounter) {
      if (this.buttonAt(p) === 'pause') {
        this.pause();
        return;
      }
      const i = encounterCardRects().findIndex((r) => inRect(p.x, p.y, r));
      if (i >= 0) this.doAct({ t: 'choose', option: i });
      return;
    }
    const button = this.buttonAt(p);
    if (button === 'pause') this.pause();
    else if (button === 'speed') this.speed = this.speed === 1 ? 2 : 1;
    else if (button === 'refresh') this.doAct({ t: 'refresh' }, `功德不够：刷新要 ${currentRefreshCost(g)}`);
    else if (button === 'start') this.startWave();
    else if (g.phase === 'build' && L.shopCards.some((r) => inRect(p.x, p.y, r))) {
      const i = L.shopCards.findIndex((r) => inRect(p.x, p.y, r));
      const o = g.shop[i];
      if (o && !o.sold) this.toasts.push(`${describe({ id: o.id, level: 1, divine: false }, g.mods)} · 拖到石台上购买`);
    } else {
      const cell = this.slotUnder(p.x, p.y);
      if (cell < 0) return;
      if (!g.unlocked[cell]) {
        this.doAct({ t: 'unlock', cell }, `功德不够：解锁这个石台要 ${unlockCost(g.unlockCount)}`);
      } else if (g.slots[cell]) {
        this.selected = cell;
        this.selectedT = 2.5;
        this.toasts.push(describe(g.slots[cell] as Tile, g.mods));
      }
    }
  }

  dragStart(start: Pointer, p: Pointer): void {
    this.pressed = null;
    if (this.overlayOpen()) return;
    const g = this.g;
    this.lift = p.touch ? TOUCH_LIFT : 0;
    if (g.phase === 'build') {
      const i = L.shopCards.findIndex((r) => inRect(start.x, start.y, r));
      const o = i >= 0 ? g.shop[i] : undefined;
      if (o && !o.sold) {
        this.drag = { kind: 'shop', index: i, unit: o.id, level: 1, divine: false, x: p.x, y: p.y - this.lift };
        this.updateHover();
        return;
      }
    }
    const cell = this.slotUnder(start.x, start.y);
    const t = cell >= 0 ? g.slots[cell] : null;
    if (t) {
      this.drag = { kind: 'cell', index: cell, unit: t.id, level: t.level, divine: t.divine, x: p.x, y: p.y - this.lift };
      this.updateHover();
      return;
    }
    // Empty ground: drag the map around.
    if (inRect(start.x, start.y, this.view())) this.pan = { x: this.cam.x, y: this.cam.y, sx: start.x, sy: start.y };
  }

  dragMove(p: Pointer): void {
    if (this.drag) {
      this.drag.x = p.x;
      this.drag.y = p.y - this.lift;
      this.updateHover();
    } else if (this.pan) {
      const v = this.view();
      this.cam.x = this.pan.x - (p.x - this.pan.sx) / this.cam.zoom;
      this.cam.y = this.pan.y - (p.y - this.pan.sy) / this.cam.zoom;
      this.cam.clamp(v);
    }
  }

  dragEnd(): void {
    this.pan = null;
    const d = this.drag;
    this.drag = null;
    const cell = this.hoverCell;
    const trash = this.hoverTrash;
    this.hoverCell = -1;
    this.hoverTrash = false;
    this.hoverHint = null;
    if (!d || this.overlayOpen()) return;
    if (d.kind === 'shop') {
      if (cell < 0) return;
      const o = this.g.shop[d.index];
      const price = o ? offerPrice(this.g, o) : 0;
      if (!this.g.unlocked[cell]) this.toasts.push('这个石台还没解锁：点它花功德解锁');
      else if (o && this.g.gongde < price) this.toasts.push(`功德不够：这张卡要 ${price}`);
      else this.doAct({ t: 'buy', offer: d.index, cell });
      return;
    }
    if (trash) this.doAct({ t: 'drop', from: d.index, to: 'sell' });
    else if (cell >= 0 && cell !== d.index) {
      if (!this.g.unlocked[cell]) this.toasts.push('这个石台还没解锁');
      else this.doAct({ t: 'drop', from: d.index, to: cell });
    }
  }

  pinchStart(c: Pointer, dist: number): void {
    if (this.overlayOpen()) return;
    // A second finger while holding a card drops it where it is, then the fingers zoom the map.
    if (this.drag) this.dragEnd();
    this.pan = null;
    this.pinch = { dist: Math.max(1, dist), x: c.x, y: c.y };
  }

  pinchMove(c: Pointer, dist: number): void {
    if (!this.pinch) return;
    const v = this.view();
    this.cam.zoomAt(this.pinch.x, this.pinch.y, Math.max(1, dist) / this.pinch.dist, v);
    this.cam.x -= (c.x - this.pinch.x) / this.cam.zoom;
    this.cam.y -= (c.y - this.pinch.y) / this.cam.zoom;
    this.cam.clamp(v);
    this.pinch = { dist: Math.max(1, dist), x: c.x, y: c.y };
  }

  pinchEnd(): void {
    this.pinch = null;
  }

  wheel(p: Pointer, deltaY: number): void {
    if (this.overlayOpen() || !inRect(p.x, p.y, this.view())) return;
    this.cam.zoomAt(p.x, p.y, deltaY < 0 ? WHEEL_STEP : 1 / WHEEL_STEP, this.view());
  }

  // ---- helpers -----------------------------------------------------------

  private updateHover(): void {
    const d = this.drag;
    if (!d) return;
    const g = this.g;
    const trashRect = g.phase === 'build' ? L.trash : L.barTrash;
    this.hoverTrash = d.kind === 'cell' && inRect(d.x, d.y, { x: trashRect.x - 10, y: trashRect.y - 10, w: trashRect.w + 20, h: trashRect.h + 20 });
    const cell = this.slotUnder(d.x, d.y);
    this.hoverCell = cell;
    this.hoverHint = null;
    if (cell < 0) {
      this.hoverValid = false;
      return;
    }
    const target = g.slots[cell];
    const outcome = previewDrop({ id: d.unit, level: d.level, divine: d.divine }, target);
    if (d.kind === 'shop') {
      const o = g.shop[d.index];
      const combines = outcome === 'empty' || outcome === 'merge' || outcome === 'hero' || outcome === 'divine';
      this.hoverValid = g.unlocked[cell] && combines && !!o && g.gongde >= offerPrice(g, o);
    } else {
      this.hoverValid = g.unlocked[cell] && outcome !== 'invalid' && cell !== d.index;
    }
    // Tell the player what letting go will do when the two cards combine.
    if (target && this.hoverValid) {
      if (outcome === 'merge') this.hoverHint = `松开合成 ${target.level + 1} 级`;
      else if (outcome === 'hero') this.hoverHint = `松开觉醒 ${heroFor(d.unit, target.id) ?? '英雄'}`;
      else if (outcome === 'divine') this.hoverHint = '松开附神';
    }
  }

  private doAct(a: Action, poorMsg = '功德不够'): void {
    const before = this.g.events.length;
    const r = act(this.g, a);
    if (r === 'poor') this.toasts.push(poorMsg);
    // Reason: g.events still holds the last step's events (already shown); only react to the new ones.
    this.handleEvents(this.g.events.slice(before));
  }

  private startWave(): void {
    const armed = this.g.slots.some((t) => t && (UNITS[t.id].kind === 'attack' || UNITS[t.id].kind === 'hero'));
    if (!armed) {
      this.toasts.push('路边还没有能打的字：先从商店拖几张卡到石台上');
      return;
    }
    this.doAct({ t: 'start' });
  }

  private handleEvents(events: readonly SimEvent[]): void {
    this.vfx.consume(events);
    for (const e of events) {
      if (e.t === 'invalid') this.toasts.push(e.msg);
      else if (e.t === 'buy') {
        this.tip('start', '准备好了就点「出战」');
        if (UNITS[e.unit].kind === 'fragment') this.tip('frag', '名字碎片：凑齐「悟」「空」这样的另一半就能觉醒英雄');
      } else if (e.t === 'waveClear') this.tip('merge', '两张同名同级的卡叠在一起会升级');
      else if (e.t === 'waveStart' && e.wave === 2) this.tip('trash', '不要的字可以拖到垃圾桶卖掉');
      else if (e.t === 'leak') this.tip('leak', '妖怪走到营地会伤到阵地：把火力摆在路的转弯处');
      else if (e.t === 'encounterOffer') this.tip('enc', '奇遇三选一：福缘立刻生效，劫难下一波生效但赏金更多');
      else if (e.t === 'hero') this.tip('rage', '英雄普攻十下攒满怒气，下一击就是大招');
    }
  }

  private onEnd(): void {
    this.endT = 0;
    this.drag = null;
    this.pan = null;
    if (this.g.phase !== 'won') return;
    const p = this.nav.progress;
    const firstClear = (p.wins[this.chapter - 1] ?? 0) === 0;
    p.unlocked = Math.max(p.unlocked, Math.min(CHAPTERS.length, this.chapter + 1));
    p.wins[this.chapter - 1] = (p.wins[this.chapter - 1] ?? 0) + 1;
    this.rewards = clearRewards(p.vault, this.chapter, firstClear);
    this.nav.save();
  }

  // ---- overlays ----------------------------------------------------------

  private resultInfo(): ResultInfo {
    return { g: this.g, chapter: this.chapter, rewards: this.rewards };
  }

  private pauseButtons(): OverlayButton[] {
    return [
      { label: '继续', go: () => (this.paused = false) },
      { label: '重新开始', go: () => this.nav.play(this.chapter) },
      { label: '返回选章', go: () => this.nav.chapters() },
    ];
  }

  private resultButtons(): OverlayButton[] {
    const out: OverlayButton[] = [];
    if (this.g.phase === 'won') {
      if (this.chapter < CHAPTERS.length) out.push({ label: '下一章', go: () => this.nav.play(this.chapter + 1) });
      out.push({ label: '再来一次', go: () => this.nav.play(this.chapter) });
    } else {
      out.push({ label: '再来一次', go: () => this.nav.play(this.chapter) });
      out.push({ label: '法宝炼器', go: () => this.nav.treasures() });
    }
    out.push({ label: '返回选章', go: () => this.nav.chapters() });
    return out;
  }
}
