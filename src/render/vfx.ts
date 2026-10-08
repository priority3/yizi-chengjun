// Visual effects driven by simulation events. Owns every render-only timer (flashes, pops, shakes,
// particles, banners, ultimates). Nothing here feeds back into the simulation, so it may use Math.random freely.
import { ENEMIES, traitText } from '../config/enemies.ts';
import { ULTIMATES } from '../config/ultimates.ts';
import { UNITS } from '../config/units.ts';
import { ENCOUNTERS, KIND_LABEL } from '../core/encounters.ts';
import { CELL_COUNT, CELL_POS, GRID_H, GRID_Y, WORLD_H, WORLD_W } from '../core/grid.ts';
import type { HeroId, Projectile, SimEvent } from '../core/types.ts';
import { COLORS } from './draw.ts';
import { drawFloater, drawFx, drawParticle, drawProjectile, type Floater, type Fx, type FxKind, type Particle, type ParticleShape } from './fx-draw.ts';
import { drawUltimate, ultLife, type UltFx } from './fx-ultimate.ts';
import { W, wy } from './layout.ts';

export interface Banner {
  title: string;
  sub: string;
  color: string;
  portrait: HeroId | null;
  t: number;
  life: number;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
/** Reason: 白龙 and splash can hit dozens of enemies per tick; cap live particles to protect frame time. */
const MAX_PARTICLES = 260;
const KIND_COLOR = { boon: '#aef0b8', trade: '#ffd166', challenge: '#ff8a5c' } as const;

export class Vfx {
  private fx: Fx[] = [];
  private ults: UltFx[] = [];
  private particles: Particle[] = [];
  private floaters: Floater[] = [];
  banner: Banner | null = null;
  /** Enemy uid -> remaining hit-flash time. */
  readonly flash = new Map<number, number>();
  /** Per cell: pop (appear/upgrade), shake (invalid drop), recoil (just fired). */
  readonly pops = new Float64Array(CELL_COUNT);
  readonly shakes = new Float64Array(CELL_COUNT);
  readonly recoil = new Float64Array(CELL_COUNT);
  campFlash = 0;
  /** Screen-shake magnitude in design px, decays quickly. */
  shake = 0;
  private seq = 0;

  private add(kind: FxKind, x: number, y: number, x2: number, y2: number, color: string, size: number, life: number): void {
    this.fx.push({ kind, x, y, x2, y2, color, size, t: 0, life, seed: this.seq++ });
  }

  private burst(x: number, y: number, n: number, shape: ParticleShape, color: string, speed: number, size: number, life: number, gravity = 0): void {
    for (let i = 0; i < n && this.particles.length < MAX_PARTICLES; i++) {
      const a = rnd(0, Math.PI * 2);
      const v = rnd(speed * 0.4, speed);
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, gravity, size: rnd(size * 0.6, size), color, shape, t: 0, life: rnd(life * 0.7, life) });
    }
  }

  float(x: number, y: number, msg: string, color: string, px: number, brushFont = false, life = 0.9): void {
    this.floaters.push({ x, y, msg, color, px, brushFont, t: 0, life });
  }

  showBanner(title: string, sub: string, color: string, portrait: HeroId | null = null, life = 2): void {
    this.banner = { title, sub, color, portrait, t: 0, life };
  }

  /** Screen position of a cell; cell -1 means "the camp as a whole". */
  private cell(cell: number): { x: number; y: number } {
    if (cell < 0) return { x: WORLD_W / 2, y: wy(GRID_Y + GRID_H / 2) };
    const p = CELL_POS[cell];
    return { x: p.x, y: wy(p.y) };
  }

  private onShot(e: Extract<SimEvent, { t: 'shot' }>): void {
    this.recoil[e.cell] = 0.12;
    const x0 = e.x;
    const y0 = wy(e.y);
    const x1 = e.tx;
    const y1 = wy(e.ty);
    switch (e.kind) {
      case 'swing':
        this.add('swing', x0, y0, x1, y1, '#fff1c8', 20, 0.18);
        this.burst(x1, y1, 3, 'dot', '#fff1c8', 70, 2, 0.25);
        break;
      case 'bolt':
        this.add('bolt', x1, y1 - 170, x1, y1, '#b98cff', 0, 0.24);
        this.burst(x1, y1, 8, 'dot', '#e0ccff', 140, 2.4, 0.35);
        this.shake = Math.max(this.shake, 1.6);
        break;
      case 'beam':
        this.add('beam', x0, y0, x1, y1, '#f5c542', 0, 0.3);
        for (let i = 0; i < 6; i++) {
          const t = Math.random();
          this.burst(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 1, 'star', '#ffe27a', 50, 3, 0.4);
        }
        break;
      case 'slam':
        this.add('slam', x1, y1, 0, 0, '#c9a46a', 62, 0.42);
        this.burst(x1, y1, 10, 'dot', 'rgba(160,120,70,0.8)', 110, 3.2, 0.45, 120);
        this.shake = Math.max(this.shake, 3);
        break;
      case 'dragon':
        this.add('dragon', -40, wy(WORLD_H * 0.5), W + 40, 0, '#ffffff', 0, 0.9);
        break;
      default:
        // Projectile launch: a small puff at the card.
        this.burst(x0, y0 - 6, 2, 'dot', 'rgba(255,250,235,0.9)', 40, 2, 0.2);
    }
  }

  private onImpact(e: Extract<SimEvent, { t: 'impact' }>): void {
    const x = e.x;
    const y = wy(e.y);
    if (e.kind === 'fire') {
      this.add('burst', x, y, 0, 0, '#ff9a2a', 46, 0.35);
      this.burst(x, y, 9, 'ember', '#ffd27a', 120, 2.2, 0.5, 60);
      this.shake = Math.max(this.shake, 1);
    } else if (e.kind === 'ice') {
      this.add('ring', x, y, 0, 0, '#9fe4ff', 18, 0.3);
      this.burst(x, y, 7, 'snow', '#e8f8ff', 90, 2.6, 0.45, 40);
    } else if (e.kind === 'crescent') {
      this.add('slash', x, y, 0, 0, '#e8f2fa', 16, 0.25);
    } else {
      this.burst(x, y, 3, 'dot', '#fff1c8', 60, 1.8, 0.2);
    }
  }

  private onUltimate(e: Extract<SimEvent, { t: 'ultimate' }>): void {
    const p = this.cell(e.cell);
    const pts = e.targets.map((q) => ({ x: q.x, y: wy(q.y) }));
    this.ults.push({ hero: e.hero, x: p.x, y: p.y, tx: e.tx, ty: wy(e.ty), lane: e.lane, pts, t: 0, life: ultLife(e.hero, pts.length) });
    this.recoil[e.cell] = 0.3;
    this.pops[e.cell] = 0.3;
    this.float(p.x, p.y - 36, ULTIMATES[e.hero].name, '#ffd166', 16, true, 1.2);
    for (const q of pts) this.burst(q.x, q.y, 4, 'star', '#ffe27a', 120, 3.5, 0.5);
    this.shake = Math.max(this.shake, e.hero === '沙僧' ? 2 : 6);
  }

  consume(events: readonly SimEvent[]): void {
    for (const e of events) {
      switch (e.t) {
        case 'shot':
          this.onShot(e);
          break;
        case 'impact':
          this.onImpact(e);
          break;
        case 'ultimate':
          this.onUltimate(e);
          break;
        case 'hit': {
          this.flash.set(e.uid, 0.12);
          const color = UNITS[e.unit].color;
          this.burst(e.x, wy(e.y), 2, 'dot', color, 80, 2, 0.22);
          if (e.dmg >= 25) this.float(e.x + rnd(-6, 6), wy(e.y) - 16, String(Math.round(e.dmg)), '#ffffff', 12);
          break;
        }
        case 'kill': {
          const x = e.x;
          const y = wy(e.y);
          const boss = ENEMIES[e.def].boss;
          this.burst(x, y, boss ? 16 : 7, 'ink', 'rgba(30,18,12,0.75)', boss ? 140 : 80, boss ? 6 : 4, 0.6);
          this.float(x, y - 10, `+${e.bounty}`, COLORS.gold, boss ? 18 : 12);
          if (boss) {
            this.add('burst', x, y, 0, 0, '#ffd27a', 80, 0.6);
            this.burst(x, y, 14, 'coin', '', 150, 4, 0.9, 160);
            this.shake = Math.max(this.shake, 6);
          }
          break;
        }
        case 'campHit':
          this.campFlash = 0.25;
          this.burst(e.x, wy(e.y) + (e.y < 260 ? 10 : -10), 2, 'dot', '#ff6a5a', 60, 2, 0.3);
          this.shake = Math.max(this.shake, 0.7);
          break;
        case 'steal': {
          const x = e.x;
          const y = wy(e.y);
          this.float(x, y - 12, `-${e.amount} 功德`, '#ff6a5a', 15, false, 1.1);
          this.float(x, y - 34, '溜了', '#ffd166', 18, true, 1);
          this.burst(x, y, 8, 'coin', '', 120, 3, 0.7, 150);
          this.shake = Math.max(this.shake, 2);
          break;
        }
        case 'revive':
          this.add('ring', e.x, wy(e.y), 0, 0, '#ffffff', 34, 0.5);
          this.float(e.x, wy(e.y) - 22, '复活！', '#ffffff', 16, true);
          break;
        case 'split':
        case 'summon':
          this.burst(e.x, wy(e.y), 10, 'dot', 'rgba(140,90,170,0.7)', 90, 4, 0.5);
          break;
        case 'execute':
          this.add('slash', e.x, wy(e.y), 0, 0, '#ffffff', 22, 0.35);
          this.float(e.x, wy(e.y) - 18, '斩', '#e0302a', 30, true, 0.8);
          break;
        case 'buy':
        case 'unlock': {
          this.pops[e.cell] = 0.25;
          const p = this.cell(e.cell);
          this.burst(p.x, p.y + 18, 6, 'dot', 'rgba(170,130,80,0.7)', 70, 2.6, 0.35);
          break;
        }
        case 'chest': {
          const p = this.cell(e.cell);
          this.burst(p.x, p.y, 12, 'coin', '', 130, 3.5, 0.8, 160);
          if (e.cell >= 0 && e.unit) {
            this.pops[e.cell] = 0.4;
            this.add('burst', p.x, p.y, 0, 0, '#ffd27a', 60, 0.5);
            this.float(p.x, p.y - 30, `宝箱 · ${e.unit}`, '#fff1c2', 15, true, 1.2);
          } else {
            this.float(p.x, p.y, '宝箱 · +30 功德', COLORS.gold, 15, true, 1.2);
          }
          break;
        }
        case 'merge': {
          this.pops[e.cell] = 0.32;
          const p = this.cell(e.cell);
          this.add('ring', p.x, p.y, 0, 0, COLORS.gold, 40, 0.45);
          this.burst(p.x, p.y, 10, 'star', '#ffe27a', 110, 3.5, 0.6);
          this.float(p.x, p.y - 26, `${e.level}级`, '#fff1c2', 16, true);
          break;
        }
        case 'hero': {
          this.pops[e.cell] = 0.5;
          const p = this.cell(e.cell);
          this.add('ring', p.x, p.y, 0, 0, '#ff8a3a', 70, 0.7);
          this.add('burst', p.x, p.y, 0, 0, '#ffd27a', 70, 0.5);
          this.burst(p.x, p.y, 18, 'star', '#ffd27a', 170, 4.5, 0.9);
          const hero = e.unit as HeroId;
          this.showBanner(`${hero} 觉醒！`, `${UNITS[hero].desc} · 大招：${ULTIMATES[hero].name}`, '#ffd166', hero, 2);
          this.shake = Math.max(this.shake, 3);
          break;
        }
        case 'divine': {
          this.pops[e.cell] = 0.45;
          const p = this.cell(e.cell);
          this.add('seal', p.x + 12, p.y + 12, 0, 0, '#c8001f', 0, 0.9);
          this.burst(p.x, p.y, 14, 'star', '#ffcf4a', 130, 3.5, 0.7);
          break;
        }
        case 'sell': {
          const p = this.cell(e.cell);
          this.float(p.x, p.y - 8, `+${e.amount}`, COLORS.gold, 14);
          this.burst(p.x, p.y, 5, 'coin', '', 70, 3, 0.5, 120);
          break;
        }
        case 'invalid':
          this.shakes[e.cell] = 0.3;
          break;
        case 'income': {
          const p = this.cell(e.cell);
          this.float(p.x, p.y - 20, `+${e.amount}`, COLORS.gold, 12);
          break;
        }
        case 'heal': {
          const p = this.cell(e.cell);
          this.float(p.x, p.y - 20, `+${e.amount}`, COLORS.heal, 13);
          this.burst(p.x, p.y, 6, 'star', '#8ff0a0', 60, 2.6, 0.5);
          break;
        }
        case 'encounter': {
          const def = ENCOUNTERS[e.id];
          this.showBanner(`${KIND_LABEL[def.kind]} · ${e.id}`, def.desc, KIND_COLOR[def.kind], null, 2.2);
          break;
        }
        case 'waveStart': {
          const boss = e.boss ? ENEMIES[e.boss] : null;
          const sub = boss ? `Boss ${boss.name}：${traitText(boss)}` : e.elite ? '魔将压阵，小心！' : e.mods ? `劫难：${e.mods}` : '妖怪从上下两座城门杀来了';
          this.showBanner(`第 ${e.wave} 波`, sub, boss ? '#ff8a5c' : e.mods ? '#ffb07a' : '#fff1c2');
          break;
        }
        case 'waveClear':
          this.showBanner(`击退第 ${e.wave} 波`, `+${e.bonus} 功德 · 商店补货了`, '#aef0b8', null, 1.6);
          break;
        default:
          break;
      }
    }
  }

  /** Trail particles for flying projectiles (called once per frame). */
  trail(projectiles: readonly Projectile[]): void {
    for (const p of projectiles) {
      if (this.particles.length >= MAX_PARTICLES) break;
      if (p.kind === 'fire' && Math.random() < 0.7) {
        this.particles.push({ x: p.x + rnd(-2, 2), y: wy(p.y) + rnd(-2, 2), vx: 0, vy: -10, gravity: 0, size: rnd(1.5, 2.6), color: '#ffb44a', shape: 'ember', t: 0, life: 0.3 });
      } else if (p.kind === 'ice' && Math.random() < 0.4) {
        this.particles.push({ x: p.x, y: wy(p.y), vx: rnd(-10, 10), vy: rnd(-10, 10), gravity: 0, size: 1.8, color: '#e8f8ff', shape: 'snow', t: 0, life: 0.3 });
      }
    }
  }

  update(dt: number): void {
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter((f) => f.t < f.life);
    for (const u of this.ults) u.t += dt;
    this.ults = this.ults.filter((u) => u.t < u.life);
    for (const p of this.particles) {
      p.t += dt;
      p.vx *= 1 - 2.5 * dt;
      p.vy = p.vy * (1 - 2.5 * dt) + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.particles = this.particles.filter((p) => p.t < p.life);
    for (const f of this.floaters) f.t += dt;
    this.floaters = this.floaters.filter((f) => f.t < f.life);
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t > this.banner.life) this.banner = null;
    }
    for (const [uid, t] of this.flash) {
      if (t - dt <= 0) this.flash.delete(uid);
      else this.flash.set(uid, t - dt);
    }
    for (const arr of [this.pops, this.shakes, this.recoil]) {
      for (let i = 0; i < arr.length; i++) arr[i] = Math.max(0, arr[i] - dt);
    }
    this.campFlash = Math.max(0, this.campFlash - dt);
    this.shake = Math.max(0, this.shake - dt * 18);
  }

  drawProjectiles(ctx: CanvasRenderingContext2D, projectiles: readonly Projectile[]): void {
    for (const p of projectiles) drawProjectile(ctx, p.kind, p.x, wy(p.y), p.tx - p.x, p.ty - p.y, p.divine);
  }

  drawWorld(ctx: CanvasRenderingContext2D): void {
    for (const f of this.fx) drawFx(ctx, f);
    for (const u of this.ults) drawUltimate(ctx, u);
    for (const p of this.particles) drawParticle(ctx, p);
  }

  drawFloaters(ctx: CanvasRenderingContext2D): void {
    for (const f of this.floaters) drawFloater(ctx, f);
  }
}
