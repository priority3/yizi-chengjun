// The versus match screen: runs the fixed-step simulation, handles drag-and-drop, pause and results.
import { LEVELS, recruitCost, SELL_REFUND } from '../config/levels.ts';
import { UNITS } from '../config/units.ts';
import { recruitStatus } from '../core/board.ts';
import { DT } from '../core/combat.ts';
import { act, createMatch, step } from '../core/match.ts';
import type { MatchState, SimEvent, Tile } from '../core/types.ts';
import type { Stage } from '../platform/web.ts';
import { text } from '../render/draw.ts';
import { Effects } from '../render/effects.ts';
import { BTN_PAUSE, BTN_RECRUIT, BTN_SPEED, hitPlayerSlot, inRect, W, type Rect } from '../render/layout.ts';
import { MatchRenderer, type MatchUi } from '../render/renderer.ts';
import { drawButton, drawPanel, Toasts } from './hud.ts';
import type { Pointer } from './input.ts';
import type { Nav, Scene } from './scenes.ts';

const TAUNT_LIFE = 2.6;
const TAUNT_COOLDOWN = 4;
/** Seconds after the match ends before the result panel appears (let the last effects play). */
const RESULT_DELAY = 0.9;
/** How far above a finger the dragged tile is drawn. */
const TOUCH_LIFT = 30;
const PANEL: Rect = { x: 40, y: 170, w: 280, h: 320 };
const PANEL_BTNS: Rect[] = [
  { x: 70, y: 318, w: 220, h: 42 },
  { x: 70, y: 370, w: 220, h: 42 },
  { x: 70, y: 422, w: 220, h: 42 },
];
const TUTORIAL = [
  { at: 0.6, msg: '点右下角「化缘」抽字' },
  { at: 3.8, msg: '相同的字拖到一起能升级' },
  { at: 7, msg: '凑齐「悟」「空」可以觉醒悟空' },
];

function describe(t: Tile): string {
  const def = UNITS[t.id];
  const lv = t.level > 1 ? ` ${t.level}级` : '';
  return `${t.divine ? '神' : ''}${t.id}${lv} · ${def.label}：${def.desc}`;
}

export class MatchScene implements Scene {
  private readonly nav: Nav;
  private readonly level: number;
  private readonly m: MatchState;
  private readonly renderer: MatchRenderer;
  private readonly fx = new Effects();
  private readonly toasts = new Toasts();
  private acc = 0;
  private speed = 1;
  private paused = false;
  private clock = 0;
  private tips = [...TUTORIAL];
  private drag: { from: number; x: number; y: number } | null = null;
  private lift = 0;
  private pressed: MatchUi['pressed'] = null;
  private taunt: { msg: string; t: number } | null = null;
  private tauntCooldown = 0;
  /** Seconds since the match ended; -1 while it is still running. */
  private endT = -1;

  constructor(stage: Stage, level: number, nav: Nav) {
    this.nav = nav;
    this.level = level;
    // Reason: Math.random is fine here — only the seed is random; the match itself stays deterministic.
    this.m = createMatch({ seed: (Math.random() * 0x7fffffff) | 0, level, ai: [null, LEVELS[level - 1].ai] });
    this.renderer = new MatchRenderer(stage);
    if (level !== 1) this.tips = [];
    this.say('你玩不过我吧？', true);
  }

  update(dt: number): void {
    this.fx.update(dt);
    this.toasts.update(dt);
    if (this.taunt) {
      this.taunt.t += dt;
      if (this.taunt.t > TAUNT_LIFE) this.taunt = null;
    }
    this.tauntCooldown = Math.max(0, this.tauntCooldown - dt);
    if (this.m.winner !== null) {
      if (this.endT < 0) this.onEnd();
      this.endT += dt;
      return;
    }
    if (this.paused) return;
    this.clock += dt;
    while (this.tips.length > 0 && this.tips[0].at <= this.clock) {
      const tip = this.tips.shift();
      if (tip) this.toasts.push(tip.msg);
    }
    this.acc += dt * this.speed;
    const cap = 5 * this.speed;
    let steps = 0;
    while (this.acc >= DT && steps < cap && this.m.winner === null) {
      step(this.m);
      this.handleEvents(this.m.events);
      this.acc -= DT;
      steps++;
    }
    // Reason: if the device can't keep up, drop the backlog instead of spiralling into ever-longer frames.
    if (steps >= cap) this.acc = 0;
  }

  render(ctx: CanvasRenderingContext2D): void {
    this.renderer.draw(ctx, this.m, this.ui(), this.fx);
    this.toasts.draw(ctx);
    if (this.m.winner !== null) {
      if (this.endT >= RESULT_DELAY) this.drawResult(ctx);
    } else if (this.paused) {
      this.drawPause(ctx);
    }
  }

  pause(): void {
    if (this.m.winner !== null) return;
    this.paused = true;
    this.drag = null;
  }

  // ---- input -------------------------------------------------------------

  press(p: Pointer): void {
    if (this.overlayOpen()) return;
    if (inRect(p.x, p.y, BTN_RECRUIT)) this.pressed = 'recruit';
    else if (inRect(p.x, p.y, BTN_SPEED)) this.pressed = 'speed';
    else if (inRect(p.x, p.y, BTN_PAUSE)) this.pressed = 'pause';
  }

  tap(p: Pointer): void {
    this.pressed = null;
    if (this.m.winner !== null) {
      if (this.endT >= RESULT_DELAY) this.tapResult(p);
      return;
    }
    if (this.paused) {
      this.tapPause(p);
      return;
    }
    if (inRect(p.x, p.y, BTN_RECRUIT)) this.recruit();
    else if (inRect(p.x, p.y, BTN_SPEED)) this.speed = this.speed === 1 ? 2 : 1;
    else if (inRect(p.x, p.y, BTN_PAUSE)) this.pause();
    else {
      const slot = hitPlayerSlot(p.x, p.y);
      const t = slot >= 0 ? this.m.sides[0].slots[slot] : null;
      if (t) this.toasts.push(describe(t));
    }
  }

  dragStart(start: Pointer, p: Pointer): void {
    this.pressed = null;
    if (this.overlayOpen()) return;
    const slot = hitPlayerSlot(start.x, start.y);
    if (slot < 0 || !this.m.sides[0].slots[slot]) return;
    this.lift = p.touch ? TOUCH_LIFT : 0;
    this.drag = { from: slot, x: p.x, y: p.y - this.lift };
  }

  dragMove(p: Pointer): void {
    if (!this.drag) return;
    this.drag.x = p.x;
    this.drag.y = p.y - this.lift;
  }

  dragEnd(p: Pointer): void {
    const d = this.drag;
    this.drag = null;
    if (!d || this.overlayOpen()) return;
    const to = this.dropTarget(p.x, p.y - this.lift);
    // Dropped outside the board: the tile simply snaps back.
    if (to === -1) return;
    const before = this.m.events.length;
    act(this.m, 0, { t: 'drop', from: d.from, to });
    this.handleEvents(this.m.events.slice(before));
  }

  dragCancel(): void {
    this.drag = null;
    this.pressed = null;
  }

  // ---- helpers -----------------------------------------------------------

  private overlayOpen(): boolean {
    return this.paused || this.m.winner !== null;
  }

  private dropTarget(x: number, y: number): number | 'sell' {
    return inRect(x, y, BTN_RECRUIT) ? 'sell' : hitPlayerSlot(x, y);
  }

  private recruit(): void {
    const before = this.m.events.length;
    const r = act(this.m, 0, { t: 'recruit' });
    if (r === 'poor') this.toasts.push('功德不够：多杀几只妖怪再来');
    else if (r === 'full') this.toasts.push('格子满了：合成或卖掉一些字');
    // Reason: m.events still holds the last step's events (already shown); only react to the new ones.
    this.handleEvents(this.m.events.slice(before));
  }

  private handleEvents(events: readonly SimEvent[]): void {
    this.fx.consume(events);
    for (const e of events) {
      if (e.t === 'invalid' && e.side === 0) this.toasts.push(e.msg);
      else if (e.t === 'hero' && e.side === 1) this.say(`看俺的${e.unit}！`);
      else if (e.t === 'divine' && e.side === 1) this.say('神来了！');
      else if (e.t === 'leak') this.say(e.side === 0 ? '嘿嘿，漏怪咯～' : '失误失误……');
      else if (e.t === 'wave' && e.overtime === 1) this.say('加时！看谁先倒', true);
      else if (e.t === 'wave' && e.boss) this.say('Boss来了！');
    }
  }

  private say(msg: string, force = false): void {
    if (!force && this.tauntCooldown > 0) return;
    this.taunt = { msg, t: 0 };
    this.tauntCooldown = TAUNT_COOLDOWN;
  }

  private onEnd(): void {
    this.endT = 0;
    this.drag = null;
    if (this.m.winner === 0) {
      const p = this.nav.progress;
      p.unlocked = Math.max(p.unlocked, Math.min(LEVELS.length, this.level + 1));
      p.wins[this.level - 1] = (p.wins[this.level - 1] ?? 0) + 1;
      this.nav.save();
      this.say('这不可能……', true);
    } else {
      this.say('说了你玩不过我吧！', true);
    }
  }

  private ui(): MatchUi {
    const me = this.m.sides[0];
    const dragged = this.drag ? me.slots[this.drag.from] : null;
    const lv = LEVELS[this.level - 1];
    return {
      drag: this.drag,
      dropTarget: this.drag ? this.dropTarget(this.drag.x, this.drag.y) : -1,
      recruitState: recruitStatus(me),
      recruitCost: recruitCost(me.drawCount),
      sellValue: dragged ? Math.floor(dragged.invested * SELL_REFUND) : 0,
      speed: this.speed,
      taunt: this.taunt?.msg ?? null,
      pressed: this.pressed,
      levelName: `第${this.level}关 · ${lv.name}`,
    };
  }

  // ---- overlays ----------------------------------------------------------

  private drawPause(ctx: CanvasRenderingContext2D): void {
    drawPanel(ctx, PANEL);
    text(ctx, '暂停', W / 2, PANEL.y + 50, 26, '#6b1c1c');
    text(ctx, '妖怪也在等你', W / 2, PANEL.y + 90, 13, '#7a6248', 'center', 500);
    drawButton(ctx, PANEL_BTNS[0], '继续', 'primary');
    drawButton(ctx, PANEL_BTNS[1], '重新开始', 'ghost');
    drawButton(ctx, PANEL_BTNS[2], '返回选关', 'ghost');
  }

  private tapPause(p: Pointer): void {
    if (inRect(p.x, p.y, PANEL_BTNS[0])) this.paused = false;
    else if (inRect(p.x, p.y, PANEL_BTNS[1])) this.nav.play(this.level);
    else if (inRect(p.x, p.y, PANEL_BTNS[2])) this.nav.levels();
  }

  private resultButtons(): Array<{ label: string; go: () => void }> {
    const won = this.m.winner === 0;
    const buttons: Array<{ label: string; go: () => void }> = [];
    if (won && this.level < LEVELS.length) buttons.push({ label: '下一关', go: () => this.nav.play(this.level + 1) });
    buttons.push({ label: '再来一局', go: () => this.nav.play(this.level) });
    buttons.push({ label: '返回选关', go: () => this.nav.levels() });
    return buttons;
  }

  private drawResult(ctx: CanvasRenderingContext2D): void {
    const won = this.m.winner === 0;
    const [me, ai] = this.m.sides;
    drawPanel(ctx, PANEL);
    const title = won ? (this.level === LEVELS.length ? '全部通关！' : '胜利！') : '惜败';
    text(ctx, title, W / 2, PANEL.y + 44, 28, won ? '#b3261e' : '#4a3a2e');
    const reason =
      this.m.endReason === 'tiebreak'
        ? '加时打满，按剩余心数判定'
        : this.m.endReason === 'double_ko'
          ? '双方同时失守，按击杀数判定'
          : won
            ? '六耳猕猴的唐僧被妖怪抓走了'
            : '你的唐僧被妖怪抓走了';
    text(ctx, reason, W / 2, PANEL.y + 80, 13, '#7a6248', 'center', 500);
    const reached = this.m.overtime > 0 ? `加时第 ${this.m.overtime} 波` : `第 ${this.m.wave} 波`;
    text(ctx, `坚持到 ${reached}`, W / 2, PANEL.y + 108, 13, '#3b2a1e', 'center', 500);
    text(ctx, `击杀 ${me.kills} : ${ai.kills}　漏怪 ${me.leaks} : ${ai.leaks}`, W / 2, PANEL.y + 130, 13, '#3b2a1e', 'center', 500);
    this.resultButtons().forEach((b, i) => drawButton(ctx, PANEL_BTNS[i], b.label, i === 0 ? 'primary' : 'ghost'));
  }

  private tapResult(p: Pointer): void {
    this.resultButtons().forEach((b, i) => {
      if (inRect(p.x, p.y, PANEL_BTNS[i])) b.go();
    });
  }
}
