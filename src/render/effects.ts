// Render-only effects driven by simulation events: tracers, pops, floating text, wave banners, shakes.
// Nothing here feeds back into the simulation.
import { ENEMIES, traitText } from '../config/enemies.ts';
import { UNITS } from '../config/units.ts';
import { SLOT_COUNT, SLOT_POS } from '../core/board.ts';
import type { SideId, SimEvent } from '../core/types.ts';
import { COLORS, font, roundRect, text } from './draw.ts';
import { TANG_POS, toScreen, W } from './layout.ts';

interface Tracer {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: string;
  t: number;
}

interface Floater {
  x: number;
  y: number;
  msg: string;
  color: string;
  px: number;
  t: number;
}

interface Ring {
  x: number;
  y: number;
  color: string;
  r: number;
  t: number;
}

interface Banner {
  title: string;
  sub: string;
  color: string;
  t: number;
}

const TRACER_LIFE = 0.14;
const FLOAT_LIFE = 0.9;
const RING_LIFE = 0.45;
const BANNER_LIFE = 2.2;
/** Reason: 白龙 hits every enemy each second; cap tracers so late waves don't flood the frame. */
const MAX_TRACERS = 160;

function waveBanner(e: Extract<SimEvent, { t: 'wave' }>): Banner {
  if (e.overtime > 0) {
    return { title: `加时 第 ${e.overtime} 波`, sub: e.boss ? `${e.boss}又来了！` : '妖怪越来越强，漏一只扣得更多', color: '#ff8a5c', t: 0 };
  }
  if (e.boss) return { title: `第 ${e.wave} 波 · Boss`, sub: `${e.boss}：${traitText(ENEMIES[e.boss])}`, color: '#ffd166', t: 0 };
  return { title: `第 ${e.wave} 波`, sub: '', color: '#fff1c2', t: 0 };
}

export class Effects {
  private tracers: Tracer[] = [];
  private floaters: Floater[] = [];
  private rings: Ring[] = [];
  private banner: Banner | null = null;
  /** Per side, per slot: pop timer that briefly enlarges a tile after it appears or upgrades. */
  readonly pops: [Float64Array, Float64Array] = [new Float64Array(SLOT_COUNT), new Float64Array(SLOT_COUNT)];
  /** Player slots shaking after an invalid drop. */
  readonly shakes = new Float64Array(SLOT_COUNT);
  /** Red flash timer on each side's 唐僧. */
  readonly tangFlash: [number, number] = [0, 0];

  consume(events: readonly SimEvent[]): void {
    for (const e of events) this.on(e);
  }

  private slotScreen(side: SideId, slot: number) {
    const p = SLOT_POS[slot];
    return toScreen(side, p.x, p.y);
  }

  private float(x: number, y: number, msg: string, color: string, px: number): void {
    this.floaters.push({ x, y, msg, color, px, t: 0 });
  }

  private ring(x: number, y: number, color: string, r: number): void {
    this.rings.push({ x, y, color, r, t: 0 });
  }

  private on(e: SimEvent): void {
    switch (e.t) {
      case 'hit': {
        if (this.tracers.length >= MAX_TRACERS) break;
        const a = this.slotScreen(e.side, e.slot);
        const b = toScreen(e.side, e.x, e.y);
        this.tracers.push({ x0: a.x, y0: a.y, x1: b.x, y1: b.y, color: UNITS[e.unit].color, t: 0 });
        break;
      }
      case 'kill': {
        const p = toScreen(e.side, e.x, e.y);
        this.float(p.x, p.y - 8, `+${e.bounty}`, COLORS.gold, e.boss ? 16 : 11);
        if (e.boss) this.ring(p.x, p.y, COLORS.gold, 34);
        break;
      }
      case 'leak': {
        this.tangFlash[e.side] = 0.6;
        const p = TANG_POS[e.side];
        this.float(p.x + 30, p.y - 6, `-${e.hearts}心`, COLORS.red, 15);
        break;
      }
      case 'revive': {
        const p = toScreen(e.side, e.x, e.y);
        this.ring(p.x, p.y, '#ffffff', 28);
        this.float(p.x, p.y - 18, '复活！', '#ffffff', 12);
        break;
      }
      case 'recruit':
        this.pops[e.side][e.slot] = 0.22;
        break;
      case 'merge': {
        this.pops[e.side][e.slot] = 0.3;
        const p = this.slotScreen(e.side, e.slot);
        this.ring(p.x, p.y, COLORS.gold, 30);
        this.float(p.x, p.y - 22, `${e.level}级`, '#fff1c2', 12);
        break;
      }
      case 'hero': {
        this.pops[e.side][e.slot] = 0.4;
        const p = this.slotScreen(e.side, e.slot);
        this.ring(p.x, p.y, '#ff7a45', 42);
        this.float(p.x, p.y - 24, `${e.unit}觉醒！`, '#ffd166', 14);
        break;
      }
      case 'divine': {
        this.pops[e.side][e.slot] = 0.4;
        const p = this.slotScreen(e.side, e.slot);
        this.ring(p.x, p.y, '#ff3b3b', 42);
        this.float(p.x, p.y - 24, '神！', '#ff6a6a', 16);
        break;
      }
      case 'sell': {
        const p = this.slotScreen(e.side, e.slot);
        this.float(p.x, p.y - 10, `+${e.amount}`, COLORS.gold, 12);
        break;
      }
      case 'invalid':
        if (e.side === 0) this.shakes[e.slot] = 0.25;
        break;
      case 'income': {
        const p = this.slotScreen(e.side, e.slot);
        this.float(p.x, p.y - 14, `+${e.amount}`, COLORS.gold, 10);
        break;
      }
      case 'heal': {
        const p = TANG_POS[e.side];
        this.float(p.x + 30, p.y - 6, '回心', '#ff8fb3', 13);
        break;
      }
      case 'wave':
        this.banner = waveBanner(e);
        break;
      case 'end':
        break;
    }
  }

  update(dt: number): void {
    for (const t of this.tracers) t.t += dt;
    for (const f of this.floaters) f.t += dt;
    for (const r of this.rings) r.t += dt;
    this.tracers = this.tracers.filter((t) => t.t < TRACER_LIFE);
    this.floaters = this.floaters.filter((f) => f.t < FLOAT_LIFE);
    this.rings = this.rings.filter((r) => r.t < RING_LIFE);
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t > BANNER_LIFE) this.banner = null;
    }
    for (const arr of [...this.pops, this.shakes]) {
      for (let i = 0; i < arr.length; i++) arr[i] = Math.max(0, arr[i] - dt);
    }
    this.tangFlash[0] = Math.max(0, this.tangFlash[0] - dt);
    this.tangFlash[1] = Math.max(0, this.tangFlash[1] - dt);
  }

  /** Tracers and rings: drawn above tiles and enemies. */
  drawWorld(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.lineCap = 'round';
    for (const t of this.tracers) {
      ctx.globalAlpha = 1 - t.t / TRACER_LIFE;
      ctx.strokeStyle = t.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(t.x0, t.y0);
      ctx.lineTo(t.x1, t.y1);
      ctx.stroke();
    }
    for (const r of this.rings) {
      const k = r.t / RING_LIFE;
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r * (0.4 + 0.6 * k), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Floating numbers and the wave banner: drawn on top of everything else. */
  drawOverlay(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(30,15,5,0.7)';
    for (const f of this.floaters) {
      const k = f.t / FLOAT_LIFE;
      const y = f.y - k * 22;
      ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      ctx.font = font(f.px);
      ctx.strokeText(f.msg, f.x, y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.msg, f.x, y);
    }
    if (this.banner) {
      const b = this.banner;
      const fade = Math.min(1, b.t / 0.2, (BANNER_LIFE - b.t) / 0.4);
      ctx.globalAlpha = Math.max(0, fade);
      const h = b.sub ? 58 : 40;
      const y = 320 - h / 2;
      ctx.fillStyle = 'rgba(20,8,4,0.78)';
      roundRect(ctx, 30, y, W - 60, h, 12);
      ctx.fill();
      text(ctx, b.title, W / 2, y + (b.sub ? 20 : h / 2), 18, b.color);
      if (b.sub) text(ctx, b.sub, W / 2, y + 41, 12, '#f3e6c8', 'center', 500);
    }
    ctx.restore();
  }
}
