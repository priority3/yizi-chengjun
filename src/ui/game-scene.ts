// The chapter screen: runs the fixed-step simulation, moves the camera (drag to pan, pinch or wheel to zoom),
// handles the shop, drag-and-drop onto the map's slots, encounters, pause and results.
import { CHAPTERS, unlockCost } from '../config/chapters.ts';
import { ENEMIES } from '../config/enemies.ts';
import { UNITS } from '../config/units.ts';
import { DT } from '../core/clock.ts';
import { act, createGame, step } from '../core/game.ts';
import { slotAt } from '../core/map.ts';
import { currentRefreshCost } from '../core/shop.ts';
import { buildMods, clearRewards, type ClearRewards } from '../core/treasures.ts';
import type { Action, GameState, SimEvent, Tile } from '../core/types.ts';
import type { Stage } from '../platform/web.ts';
import { Camera } from '../render/camera.ts';
import { encounterCardRects } from '../render/encounter-panel.ts';
import { inRect, L, viewRect, type Rect } from '../render/layout.ts';
import { NUMERALS } from '../render/panels.ts';
import { GameRenderer, type GameUi } from '../render/renderer.ts';
import { Vfx } from '../render/vfx.ts';
import { describe } from './describe.ts';
import { drawPause, drawResult, pausePanel, resultPanel, tapButtons, type OverlayButton, type ResultInfo } from './game-overlays.ts';
import { Toasts } from './hud.ts';
import type { Pointer } from './input.ts';
import { CameraControls, CardDrag } from './map-controls.ts';
import type { Nav, Scene } from './scenes.ts';
import { Tutorial } from './tutorial.ts';

/** Seconds after the run ends before the result panel appears (let the last effects play). */
const RESULT_DELAY = 1;
/** Starting zoom: map cards come out about the size of the shop cards. */
const START_ZOOM = 1;

/** Reason: a function call instead of an inline check, because step() changes the phase behind TS's narrowing. */
function isOver(g: GameState): boolean {
  return g.phase === 'won' || g.phase === 'lost';
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
  private readonly cards = new CardDrag();
  private readonly camCtl = new CameraControls();
  private readonly slotUnderFn = (x: number, y: number) => this.slotUnder(x, y);
  private pressed: string | null = null;
  private selected = -1;
  private selectedT = 0;
  private readonly tutorial: Tutorial;
  private readonly tips: boolean;
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
    // Reason: open on the starter card at 1:1 so cards on the map look the size they do in the shop.
    const starter = this.g.slots.findIndex((t) => t !== null);
    const focus = starter >= 0 ? this.g.map.slots[starter] : { x: this.g.map.w / 2, y: this.g.map.h / 2 };
    this.cam.lookAt(focus.x, focus.y, START_ZOOM, this.view());
    this.tips = chapter === 1;
    this.tutorial = new Tutorial(chapter === 1 && !nav.progress.tutorialDone);
    const ch = CHAPTERS[chapter - 1];
    const gear = vault.equipped.length > 0 ? ` · 带了 ${vault.equipped.length} 件法宝` : '';
    this.vfx.showBanner(`第${NUMERALS[chapter - 1]}章 · ${ch.name}`, `别让妖怪走到唐僧的营地，打败${ENEMIES[ch.boss].name}${gear}`, '#ffd166', null, 2.6);
  }

  private tip(key: string, msg: string): void {
    if (!this.tips || this.told.has(key)) return;
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
    this.tutorial.update(dt);
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
    if (!this.paused && !this.cards.drag) this.tutorial.draw(ctx, this.g, this.cam);
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
    this.cards.clear();
    this.camCtl.reset();
  }

  private ui(): GameUi {
    return {
      pressed: this.pressed,
      speed: this.speed,
      hoverTrash: this.cards.hoverTrash,
      draggingOffer: this.cards.drag?.kind === 'shop' ? this.cards.drag.index : -1,
      dragging: this.cards.drag !== null,
      drag: this.cards.drag,
      hoverCell: this.cards.hoverCell,
      hoverValid: this.cards.hoverValid,
      selected: this.selected,
      hoverHint: this.cards.hoverHint,
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
    if (this.cards.begin(this.g, this.slotUnderFn, start, p)) return;
    // Empty ground: drag the map around.
    if (inRect(start.x, start.y, this.view())) this.camCtl.beginPan(this.cam, start);
  }

  dragMove(p: Pointer): void {
    if (this.cards.drag) this.cards.move(this.g, this.slotUnderFn, p);
    else this.camCtl.movePan(this.cam, this.view(), p);
  }

  dragEnd(): void {
    this.camCtl.reset();
    const r = this.cards.finish(this.g);
    if (!r || this.overlayOpen()) return;
    if ('toast' in r) this.toasts.push(r.toast);
    else this.doAct(r.action, r.poorMsg);
  }

  pinchStart(c: Pointer, dist: number): void {
    if (this.overlayOpen()) return;
    // A second finger while holding a card drops it where it is, then the fingers zoom the map.
    if (this.cards.drag) this.dragEnd();
    this.camCtl.beginPinch(c, dist);
  }

  pinchMove(c: Pointer, dist: number): void {
    this.camCtl.movePinch(this.cam, this.view(), c, dist);
  }

  pinchEnd(): void {
    this.camCtl.reset();
  }

  wheel(p: Pointer, deltaY: number): void {
    if (this.overlayOpen() || !inRect(p.x, p.y, this.view())) return;
    this.camCtl.wheel(this.cam, this.view(), p, deltaY);
  }

  // ---- helpers -----------------------------------------------------------

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
        this.tutorial.notify('buy');
        if (UNITS[e.unit].kind === 'fragment') this.tip('frag', '名字碎片：凑齐「悟」「空」这样的另一半就能觉醒英雄');
      } else if (e.t === 'merge') this.tutorial.notify('merge');
      else if (e.t === 'waveClear') this.tutorial.notify('build');
      else if (e.t === 'waveStart') {
        this.tutorial.notify('waveStart');
        if (e.wave === 2) this.tip('trash', '不要的字可以拖到垃圾桶卖掉');
      }
      else if (e.t === 'leak') this.tip('leak', '妖怪走到营地会伤到阵地：把火力摆在路的转弯处');
      else if (e.t === 'encounterOffer') this.tip('enc', '奇遇三选一：福缘立刻生效，劫难下一波生效但赏金更多');
      else if (e.t === 'hero') this.tip('rage', '英雄普攻十下攒满怒气，下一击就是大招');
    }
  }

  private onEnd(): void {
    this.endT = 0;
    this.cards.clear();
    this.camCtl.reset();
    if (this.g.phase !== 'won') return;
    const p = this.nav.progress;
    p.tutorialDone = true;
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
