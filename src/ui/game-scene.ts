// The chapter screen: runs the fixed-step simulation, moves the camera (drag to pan, pinch or wheel to zoom),
// handles the shop, drag-and-drop onto the map's slots, encounters, pause and results.
import { CHAPTERS, unlockCost } from '../config/chapters.ts';
import { ENEMIES } from '../config/enemies.ts';
import { UNITS } from '../config/units.ts';
import { DT } from '../core/clock.ts';
import { act, createGame, step } from '../core/game.ts';
import { slotAt } from '../core/map.ts';
import { awardStars, starRating, type StarAward } from '../core/rating.ts';
import { settleEndless, type EndlessAward } from '../core/records.ts';
import { currentRefreshCost } from '../core/shop.ts';
import { isFighter, slotKindOf } from '../core/slots.ts';
import { buildMods, clearRewards, type ClearRewards } from '../core/treasures.ts';
import type { Action, ActionResult, GameMode, GameState, SimEvent, Tile } from '../core/types.ts';
import { isBossWave } from '../core/waves.ts';
import { audio } from '../platform/audio.ts';
import { music, type MusicMode } from '../platform/music.ts';
import { clearRun, saveRun, type CameraPos, type SavedRun } from '../platform/save.ts';
import { todayKey } from '../platform/today.ts';
import type { Stage } from '../platform/web.ts';
import { Camera } from '../render/camera.ts';
import { encounterCardRects } from '../render/encounter-panel.ts';
import { inRect, L, viewRect, type Rect } from '../render/layout.ts';
import { NUMERALS } from '../render/panels.ts';
import { GameRenderer, type GameUi } from '../render/renderer.ts';
import { Sfx } from '../render/sfx.ts';
import type { ShareInfo } from '../render/share-card.ts';
import { Vfx } from '../render/vfx.ts';
import { AIM_LABEL, describe } from './describe.ts';
import { drawPause, drawResult, pausePanel, tapButtons, tapResult, type OverlayButton, type ResultInfo } from './game-overlays.ts';
import { Toasts } from './hud.ts';
import type { Pointer } from './input.ts';
import { CameraControls, CardDrag } from './map-controls.ts';
import { openEndedBanner, resumeBanner, type BannerText } from './run-banners.ts';
import type { Nav, Scene } from './scenes.ts';
import { runShareInfo, shareResult } from './share-result.ts';
import { Tutorial } from './tutorial.ts';

/** Seconds after the run ends before the result panel appears (let the last effects play). */
const RESULT_DELAY = 1;
/** Starting zoom: map cards come out about the size of the shop cards. */
const START_ZOOM = 1;
/** Action results that changed the run: each one is autosaved while the run is in its build phase. */
const CHANGED: ReadonlySet<ActionResult> = new Set<ActionResult>(['ok', 'merge', 'hero', 'divine', 'move', 'swap', 'sold']);

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
  private readonly sfx = new Sfx();
  private acc = 0;
  private speed = 1;
  private paused = false;
  private clock = 0;
  /** Seconds since the run ended; -1 while it is still running. */
  private endT = -1;
  /** Rewards banked when the chapter was cleared. */
  private rewards: ClearRewards | null = null;
  /** Stars earned when the chapter was cleared, and the three-star bonus if this was the first time. */
  private award: StarAward | null = null;
  /** What an ended endless or daily run earned: waves survived, the record, 灵石 (null in chapter runs). */
  private endless: EndlessAward | null = null;
  private readonly cards = new CardDrag();
  private readonly camCtl = new CameraControls();
  private readonly slotUnderFn = (x: number, y: number) => this.slotUnder(x, y);
  private pressed: string | null = null;
  private selected = -1;
  private selectedT = 0;
  private readonly tutorial: Tutorial;
  private readonly tips: boolean;
  private told = new Set<string>();

  /**
   * `resumed`: a saved unfinished run of `chapter` to continue instead of starting a fresh one. `mode`: what a fresh
   * run is — endless and daily runs are passed chapter 10, whose rules they play by.
   */
  constructor(stage: Stage, chapter: number, nav: Nav, resumed?: SavedRun, mode: GameMode = 'chapter') {
    this.nav = nav;
    this.chapter = chapter;
    const vault = nav.progress.vault;
    // Reason: Math.random is fine here — only the seed is random; the run itself stays deterministic. The daily
    // challenge's seed is today's date instead, so everyone plays the same run that day (createGame drops its 法宝).
    // A resumed run is used as saved: its 法宝 modifiers stay what they were, whatever the vault holds now.
    const seed = mode === 'daily' ? todayKey() : (Math.random() * 0x7fffffff) | 0;
    this.g = resumed?.g ?? createGame({ seed, chapter, mods: buildMods(vault), mode });
    this.renderer = new GameRenderer(stage);
    this.vfx = new Vfx(this.g.map);
    this.cam = new Camera(this.g.map);
    // Reason: open on the starter card at 1:1 so cards on the map look the size they do in the shop.
    const starter = this.g.slots.findIndex((t) => t !== null);
    const focus = starter >= 0 ? this.g.map.slots[starter] : { x: this.g.map.w / 2, y: this.g.map.h / 2 };
    this.cam.lookAt(focus.x, focus.y, START_ZOOM, this.view());
    // Tips and the first-run guide belong to chapter 1 (endless and daily runs play chapter 10 anyway).
    const first = chapter === 1 && this.g.mode === 'chapter';
    this.tips = first;
    this.tutorial = new Tutorial(!resumed && first && !nav.progress.tutorialDone);
    const ch = CHAPTERS[chapter - 1];
    const gear = vault.equipped.length > 0 ? ` · 带了 ${vault.equipped.length} 件法宝` : '';
    if (resumed) this.resumeView(resumed.camera);
    else if (this.g.mode !== 'chapter') this.showBanner(openEndedBanner(this.g, gear));
    else this.vfx.showBanner(`第${NUMERALS[chapter - 1]}章 · ${ch.name}`, `别让妖怪走到唐僧的营地，打败${ENEMIES[ch.boss].name}${gear}`, '#ffd166', null, 2.6);
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
    // Reason: the animation clock (walk cycles, auras, spinning hints) freezes while paused and runs at the game
    // speed in battle, so monsters don't tread on the spot or slide along at ×2.
    if (!this.paused) this.clock += this.g.phase === 'battle' ? dt * this.speed : dt;
    if (!this.paused) this.vfx.update(dt);
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
    music.want(this.musicMode(), this.chapter);
    this.acc += dt * this.speed;
    const cap = 5 * this.speed;
    let steps = 0;
    while (this.acc >= DT && steps < cap && !isOver(g)) {
      step(g);
      this.handleEvents(g.events);
      // A cleared wave puts the run back in its build phase (a pending encounter or an opened chest included): autosave it.
      if (g.events.some((e) => e.t === 'waveClear')) this.persist();
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
    // Also called when the page is hidden: the tab may never come back, so keep the latest camera too.
    this.persist();
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
      hoverPad: this.cards.hoverPad,
      muted: this.nav.progress.sound.muted,
    };
  }

  /** Pause panel, result panel or a pending encounter: the map and shop don't take input. */
  private overlayOpen(): boolean {
    return this.paused || isOver(this.g) || this.g.encounter !== null;
  }

  private buttonAt(p: Pointer): string | null {
    if (inRect(p.x, p.y, L.btnPause)) return 'pause';
    if (inRect(p.x, p.y, L.btnSpeed)) return 'speed';
    if (inRect(p.x, p.y, L.btnSound)) return 'sound';
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
      if (this.endT >= RESULT_DELAY) tapResult(p, this.resultInfo(), this.resultButtons(), () => void shareResult(this.shareInfo()));
      return;
    }
    if (this.paused) {
      const buttons = this.pauseButtons();
      tapButtons(p, pausePanel(buttons.length), buttons);
      return;
    }
    if (g.encounter) {
      if (this.buttonAt(p) === 'pause') {
        this.pause();
        return;
      }
      if (this.buttonAt(p) === 'sound') {
        this.toggleMute();
        return;
      }
      const i = encounterCardRects().findIndex((r) => inRect(p.x, p.y, r));
      if (i >= 0) this.doAct({ t: 'choose', option: i });
      return;
    }
    const button = this.buttonAt(p);
    if (button === 'pause') this.pause();
    else if (button === 'speed') this.speed = this.speed === 1 ? 2 : 1;
    else if (button === 'sound') this.toggleMute();
    else if (button === 'refresh') this.doAct({ t: 'refresh' }, `功德不够：刷新要 ${currentRefreshCost(g)}`);
    else if (button === 'start') this.startWave();
    else if (g.phase === 'build' && L.shopCards.some((r) => inRect(p.x, p.y, r))) {
      const i = L.shopCards.findIndex((r) => inRect(p.x, p.y, r));
      const o = g.shop[i];
      if (o && !o.sold) this.toasts.push(`${describe({ id: o.id, level: 1, divine: false }, g.mods, 'plain', { g, cell: -1 })} · 拖到石台上购买`);
    } else {
      const cell = this.slotUnder(p.x, p.y);
      if (cell < 0) return;
      if (!g.unlocked[cell]) {
        this.doAct({ t: 'unlock', cell }, `功德不够：解锁这个石台要 ${unlockCost(g.unlockCount)}`);
      } else if (g.slots[cell]) {
        const t = g.slots[cell] as Tile;
        // Tapping the fighter that is still selected switches its 瞄准 (the 'mode' event toasts the new one).
        if (cell === this.selected && isFighter(t.id)) {
          this.selectedT = 2.5;
          this.doAct({ t: 'mode', cell });
          return;
        }
        this.selected = cell;
        this.selectedT = 2.5;
        this.toasts.push(describe(t, g.mods, slotKindOf(g, cell), { g, cell }));
        // Once per run, say how to switch it.
        if (isFighter(t.id) && !this.told.has('aim')) {
          this.told.add('aim');
          this.toasts.push('再点一下这张字，可以切换瞄准');
        }
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
    // A purchase refused for lack of 功德 has no sim event; it gets the same buzz as an invalid drop.
    if (r === 'poor') this.sfx.play('invalid');
    // Reason: g.events still holds the last step's events (already shown); only react to the new ones.
    this.handleEvents(this.g.events.slice(before));
    if (CHANGED.has(r)) this.persist();
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
    this.sfx.consume(events);
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
      else if (e.t === 'mode') this.toasts.push(`瞄准：${AIM_LABEL[e.mode]}`);
    }
  }

  private onEnd(): void {
    this.endT = 0;
    this.cards.clear();
    this.camCtl.reset();
    // Won or lost, the run is over: nothing left to resume.
    clearRun();
    if (this.g.mode !== 'chapter') {
      // An endless or daily run always ends with the camp falling: it pays its 灵石 and may set a record.
      this.endless = settleEndless(this.nav.progress, this.nav.progress.vault, this.g);
      this.nav.save();
      return;
    }
    if (this.g.phase !== 'won') return;
    const p = this.nav.progress;
    p.tutorialDone = true;
    const firstClear = (p.wins[this.chapter - 1] ?? 0) === 0;
    p.unlocked = Math.max(p.unlocked, Math.min(CHAPTERS.length, this.chapter + 1));
    p.wins[this.chapter - 1] = (p.wins[this.chapter - 1] ?? 0) + 1;
    this.rewards = clearRewards(p.vault, this.chapter, firstClear);
    this.award = awardStars(p, p.vault, this.chapter, starRating(this.g.campHp, this.g.campMax));
    this.nav.save();
  }

  // ---- 局中存档 ------------------------------------------------------------

  /** Autosaves the run in its build phase; battles are never saved, so a reload replays the wave from its build phase. */
  private persist(): void {
    if (this.g.phase === 'build') saveRun(this.g, this.cam);
  }

  /** A resumed run: the camera goes back where the player left it, and a banner says which wave comes next. */
  private resumeView(camera: CameraPos): void {
    this.cam.x = camera.x;
    this.cam.y = camera.y;
    this.cam.zoom = camera.zoom;
    // Reason: the screen may be another height than when the run was saved; keep the view on the map.
    this.cam.clamp(this.view());
    this.showBanner(resumeBanner(this.g));
  }

  /** The banner a run opens with: an endless or daily run's, or where a resumed run stands. */
  private showBanner(b: BannerText): void {
    this.vfx.showBanner(b.title, b.sub, '#ffd166', null, 2.6);
  }

  /** Starts this run's kind afresh: the same chapter, a new endless run, or today's daily challenge. */
  private restart(): void {
    if (this.g.mode === 'endless') this.nav.endless();
    else if (this.g.mode === 'daily') this.nav.daily();
    else this.nav.play(this.chapter);
  }

  /** 返回选章 from the pause menu gives the run up, so its save goes too (重新开始 clears it through nav.play). */
  private abandon(): void {
    clearRun();
    this.nav.chapters();
  }

  // ---- overlays ----------------------------------------------------------

  private resultInfo(): ResultInfo {
    const { g, chapter, rewards, award, endless } = this;
    return { g, chapter, rewards, award, endless, buttons: this.resultButtons().length, t: this.endT - RESULT_DELAY };
  }

  /** What the 战报 card shows for this run (分享战报; the dev console's `__zdxyShare()` reads it too). */
  shareInfo(): ShareInfo {
    return runShareInfo(this.g, new Date());
  }

  /** Background music for the moment: calm while building, faster in battle, darker for a boss wave. */
  private musicMode(): MusicMode {
    if (this.g.phase !== 'battle') return 'build';
    return isBossWave(this.g, this.g.wave) ? 'boss' : 'battle';
  }

  private toggleMute(): void {
    const s = this.nav.progress.sound;
    s.muted = !s.muted;
    audio.setMuted(s.muted);
    this.nav.save();
    this.toasts.push(s.muted ? '已静音' : '声音已打开');
  }

  private toggleMusic(): void {
    const s = this.nav.progress.sound;
    s.music = !s.music;
    audio.setMusicOn(s.music);
    this.nav.save();
  }

  private pauseButtons(): OverlayButton[] {
    return [
      { label: '继续', go: () => (this.paused = false) },
      { label: this.nav.progress.sound.music ? '音乐：开' : '音乐：关', go: () => this.toggleMusic() },
      { label: '重新开始', go: () => this.restart() },
      { label: '返回选章', go: () => this.abandon() },
    ];
  }

  private resultButtons(): OverlayButton[] {
    const out: OverlayButton[] = [];
    // An endless or daily run: 再来一次 and 返回选章 (below).
    if (this.g.mode !== 'chapter') out.push({ label: '再来一次', go: () => this.restart() });
    else if (this.g.phase === 'won') {
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
