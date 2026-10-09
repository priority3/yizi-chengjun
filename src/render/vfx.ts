// Visual effects driven by simulation events. Owns every render-only timer (flashes, pops, shakes,
// particles, banners, ultimates, corpses, the boss entrance). Everything here lives in world coordinates and is
// drawn under the camera, except the boss vignette, which the renderer paints in screen space from `introDim()`;
// nothing feeds back into the simulation, so it may use Math.random freely.
import { ENEMIES, traitText } from '../config/enemies.ts';
import { ULTIMATES } from '../config/ultimates.ts';
import { UNITS } from '../config/units.ts';
import { ENCOUNTERS, KIND_LABEL } from '../core/encounters.ts';
import type { MapData, Pt } from '../core/map.ts';
import type { HeroId, Projectile, SimEvent } from '../core/types.ts';
import { COLORS } from './draw.ts';
import {
  drawCorpse,
  drawFloater,
  drawFx,
  drawParticle,
  drawProjectile,
  type Corpse,
  type Floater,
  type Fx,
  type FxKind,
  type Particle,
  type ParticleShape,
} from './fx-draw.ts';
import { drawUltimate, ultLife, type UltFx } from './fx-ultimate.ts';
import { BOSS_CORPSE_LIFE, CORPSE_LIFE, FLY_LIFT } from './monster-pose.ts';

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
/** Reason: a 白龙 sweep can fell dozens at once; past this many falling minions the rest just vanish in their ink. */
const MAX_CORPSES = 40;
/** Boss entrance: seconds of rumble and darkened corners, the rumble's starting shake, and the vignette's peak opacity. */
const BOSS_INTRO = 0.6;
const BOSS_RUMBLE = 6;
const BOSS_DIM = 0.45;
/** A shot aimed at a flyer rises to its body over this many px before it lands. */
const SHOT_RISE = 140;
const KIND_COLOR = { boon: '#aef0b8', trade: '#ffd166', challenge: '#ff8a5c' } as const;

export class Vfx {
  private readonly map: MapData;
  private fx: Fx[] = [];
  private ults: UltFx[] = [];
  private particles: Particle[] = [];
  private floaters: Floater[] = [];
  /** Bodies of the freshly killed, oldest first; the renderer draws them under the living monsters. */
  readonly corpses: Corpse[] = [];
  banner: Banner | null = null;
  /** Enemy uid -> remaining hit-flash time. */
  readonly flash = new Map<number, number>();
  /** Uids of the flyers on the field, refilled by the renderer every frame: their sparks and incoming shots rise to their bodies. */
  readonly air = new Set<number>();
  /** Projectile uids drawn climbing towards a flyer last frame, and the spare set for the next frame. */
  private airShots = new Set<number>();
  private airShotsNext = new Set<number>();
  /** Per slot: pop (appear/upgrade), shake (invalid drop), recoil (just fired). */
  readonly pops: Float64Array;
  readonly shakes: Float64Array;
  readonly recoil: Float64Array;
  campFlash = 0;
  /** Screen-shake magnitude in design px, decays quickly. */
  shake = 0;
  /** Seconds left of a boss wave's entrance (a held rumble plus darkened corners), 0 otherwise. */
  bossIntro = 0;
  private seq = 0;

  constructor(map: MapData) {
    this.map = map;
    this.pops = new Float64Array(map.slots.length);
    this.shakes = new Float64Array(map.slots.length);
    this.recoil = new Float64Array(map.slots.length);
  }

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

  /** A killed monster's body topples where it fell, a flyer's out of the air (a boss always gets one, however crowded the field). */
  private addCorpse(def: string, x: number, y: number, boss: boolean): void {
    if (!boss && this.corpses.length >= MAX_CORPSES) return;
    this.corpses.push({ def, x, y, t: 0, life: boss ? BOSS_CORPSE_LIFE : CORPSE_LIFE, lift: ENEMIES[def].flying ? FLY_LIFT : 0 });
  }

  /** World position of a slot; -1 means the camp. */
  private cell(cell: number): Pt {
    return cell < 0 ? this.map.camp : this.map.slots[cell];
  }

  /** `lift` raises a bolt's end to a flyer's body (see liftAt). */
  private onShot(e: Extract<SimEvent, { t: 'shot' }>, lift: number): void {
    this.recoil[e.cell] = 0.12;
    switch (e.kind) {
      case 'swing':
        this.add('swing', e.x, e.y, e.tx, e.ty, '#fff1c8', 20, 0.18);
        this.burst(e.tx, e.ty, 3, 'dot', '#fff1c8', 70, 2, 0.25);
        break;
      case 'bolt':
        this.add('bolt', e.tx, e.ty - 170, e.tx, e.ty - lift, '#b98cff', 0, 0.24);
        this.burst(e.tx, e.ty - lift, 8, 'dot', '#e0ccff', 140, 2.4, 0.35);
        this.shake = Math.max(this.shake, 1.6);
        break;
      case 'beam':
        this.add('beam', e.x, e.y, e.tx, e.ty, '#f5c542', 0, 0.3);
        for (let i = 0; i < 6; i++) {
          const t = Math.random();
          this.burst(e.x + (e.tx - e.x) * t, e.y + (e.ty - e.y) * t, 1, 'star', '#ffe27a', 50, 3, 0.4);
        }
        break;
      case 'slam':
        this.add('slam', e.tx, e.ty, 0, 0, '#c9a46a', 62, 0.42);
        this.burst(e.tx, e.ty, 10, 'dot', 'rgba(160,120,70,0.8)', 110, 3.2, 0.45, 120);
        this.shake = Math.max(this.shake, 3);
        break;
      case 'dragon':
        this.add('dragon', -40, e.y, this.map.w + 40, 0, '#ffffff', 0, 0.9);
        break;
      default:
        // Projectile launch: a small puff at the card.
        this.burst(e.x, e.y - 6, 2, 'dot', 'rgba(255,250,235,0.9)', 40, 2, 0.2);
    }
  }

  /** `lift` raises the burst to a flyer's body (see liftAt). */
  private onImpact(e: Extract<SimEvent, { t: 'impact' }>, lift: number): void {
    const y = e.y - lift;
    if (e.kind === 'fire') {
      this.add('burst', e.x, y, 0, 0, '#ff9a2a', 46, 0.35);
      this.burst(e.x, y, 9, 'ember', '#ffd27a', 120, 2.2, 0.5, 60);
      this.shake = Math.max(this.shake, 1);
    } else if (e.kind === 'ice') {
      this.add('ring', e.x, y, 0, 0, '#9fe4ff', 18, 0.3);
      this.burst(e.x, y, 7, 'snow', '#e8f8ff', 90, 2.6, 0.45, 40);
    } else if (e.kind === 'crescent') {
      this.add('slash', e.x, y, 0, 0, '#e8f2fa', 16, 0.25);
    } else {
      this.burst(e.x, y, 3, 'dot', '#fff1c8', 60, 1.8, 0.2);
    }
  }

  /**
   * How far up the effect of `events[i]`, aimed at (x, y), should be drawn. A bolt, or a projectile reaching a living
   * target, reports that target's hit right after it at the same spot; when the target is a flyer, the effect rises
   * to its lifted body.
   */
  private liftAt(events: readonly SimEvent[], i: number, x: number, y: number): number {
    const next = events[i + 1];
    return next?.t === 'hit' && next.x === x && next.y === y && this.air.has(next.uid) ? FLY_LIFT : 0;
  }

  private onUltimate(e: Extract<SimEvent, { t: 'ultimate' }>): void {
    const p = this.cell(e.cell);
    this.ults.push({ hero: e.hero, x: p.x, y: p.y, tx: e.tx, ty: e.ty, dir: e.dir, mapW: this.map.w, mapH: this.map.h, pts: e.targets, t: 0, life: ultLife(e.hero, e.targets.length) });
    this.recoil[e.cell] = 0.3;
    this.pops[e.cell] = 0.3;
    this.float(p.x, p.y - 36, ULTIMATES[e.hero].name, '#ffd166', 16, true, 1.2);
    for (const q of e.targets) this.burst(q.x, q.y, 4, 'star', '#ffe27a', 120, 3.5, 0.5);
    this.shake = Math.max(this.shake, e.hero === '沙僧' ? 2 : 6);
  }

  consume(events: readonly SimEvent[]): void {
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      switch (e.t) {
        case 'shot':
          this.onShot(e, this.liftAt(events, i, e.tx, e.ty));
          break;
        case 'impact':
          this.onImpact(e, this.liftAt(events, i, e.x, e.y));
          break;
        case 'ultimate':
          this.onUltimate(e);
          break;
        case 'hit': {
          this.flash.set(e.uid, 0.12);
          const y = this.air.has(e.uid) ? e.y - FLY_LIFT : e.y;
          this.burst(e.x, y, 2, 'dot', UNITS[e.unit].color, 80, 2, 0.22);
          if (e.dmg >= 25) this.float(e.x + rnd(-6, 6), y - 16, String(Math.round(e.dmg)), '#ffffff', 12);
          break;
        }
        case 'kill': {
          const boss = ENEMIES[e.def].boss;
          // A flyer bursts up where its body hovered; its corpse falls from there.
          const y = ENEMIES[e.def].flying ? e.y - FLY_LIFT : e.y;
          this.addCorpse(e.def, e.x, e.y, boss);
          this.burst(e.x, y, boss ? 16 : 7, 'ink', 'rgba(30,18,12,0.75)', boss ? 140 : 80, boss ? 6 : 4, 0.6);
          this.float(e.x, y - 10, `+${e.bounty}`, COLORS.gold, boss ? 18 : 12);
          if (boss) {
            this.add('burst', e.x, e.y, 0, 0, '#ffd27a', 80, 0.6);
            this.burst(e.x, e.y, 14, 'coin', '', 150, 4, 0.9, 160);
            this.shake = Math.max(this.shake, 6);
          }
          break;
        }
        case 'leak':
          this.campFlash = 0.3;
          this.add('ring', e.x, e.y, 0, 0, '#ff6a5a', 40, 0.5);
          this.burst(e.x, e.y, 8, 'dot', '#ff6a5a', 90, 2.5, 0.4);
          this.float(e.x, e.y - 24, `阵地 -${e.dmg}`, '#ff6a5a', 16, true, 1.1);
          this.shake = Math.max(this.shake, 3);
          break;
        case 'steal':
          this.float(e.x, e.y - 12, `-${e.amount} 功德`, '#ff6a5a', 15, false, 1.1);
          this.float(e.x, e.y - 34, '溜了', '#ffd166', 18, true, 1);
          this.burst(e.x, e.y, 8, 'coin', '', 120, 3, 0.7, 150);
          this.shake = Math.max(this.shake, 2);
          break;
        case 'revive':
          this.add('ring', e.x, e.y, 0, 0, '#ffffff', 34, 0.5);
          this.float(e.x, e.y - 22, '复活！', '#ffffff', 16, true);
          break;
        case 'split':
        case 'summon':
          this.burst(e.x, e.y, 10, 'dot', 'rgba(140,90,170,0.7)', 90, 4, 0.5);
          break;
        case 'execute':
          this.add('slash', e.x, e.y, 0, 0, '#ffffff', 22, 0.35);
          this.float(e.x, e.y - 18, '斩', '#e0302a', 30, true, 0.8);
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
            this.float(p.x, p.y - 40, '宝箱 · +30 功德', COLORS.gold, 15, true, 1.2);
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
        case 'mode':
          // The card bobs as it turns to its new 瞄准.
          this.pops[e.cell] = 0.18;
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
          const sub = boss ? `Boss ${boss.name}：${traitText(boss)}` : e.elite ? '魔将压阵，小心！' : e.mods ? `劫难：${e.mods}` : '妖怪从城门出发，别放它们走到营地';
          this.showBanner(`第 ${e.wave} 波`, sub, boss ? '#ff8a5c' : e.mods ? '#ffb07a' : '#fff1c2');
          if (boss) {
            // Boss entrance: the ground rumbles and the corners darken once (update() holds the rumble up).
            this.bossIntro = BOSS_INTRO;
            this.shake = Math.max(this.shake, BOSS_RUMBLE);
          }
          break;
        }
        case 'waveClear':
          this.showBanner(`击退第 ${e.wave} 波`, `+${e.bonus} 功德 · 商店补货了`, '#aef0b8', null, 1.6);
          break;
        case 'enrage':
          this.showBanner('妖怪狂暴了！', '这一波拖得太久：眩晕、减速、击退都不管用了', '#ff8a5c', null, 2.4);
          this.shake = Math.max(this.shake, BOSS_RUMBLE);
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
      const y = p.y - this.shotRise(p);
      if (p.kind === 'fire' && Math.random() < 0.7) {
        this.particles.push({ x: p.x + rnd(-2, 2), y: y + rnd(-2, 2), vx: 0, vy: -10, gravity: 0, size: rnd(1.5, 2.6), color: '#ffb44a', shape: 'ember', t: 0, life: 0.3 });
      } else if (p.kind === 'ice' && Math.random() < 0.4) {
        this.particles.push({ x: p.x, y, vx: rnd(-10, 10), vy: rnd(-10, 10), gravity: 0, size: 1.8, color: '#e8f8ff', shape: 'snow', t: 0, life: 0.3 });
      }
    }
  }

  /**
   * How far above its simulated course a projectile is drawn: 0 normally; a shot aimed at a flyer (or that was, before
   * the flyer died) climbs to the flyer's height over its last SHOT_RISE px.
   * Reason: the simulation aims at a flyer's spot on the ground, but on screen the flyer hovers FLY_LIFT above it.
   */
  private shotRise(p: Projectile): number {
    if (!this.air.has(p.target) && !this.airShots.has(p.uid)) return 0;
    return FLY_LIFT * Math.max(0, 1 - Math.hypot(p.tx - p.x, p.ty - p.y) / SHOT_RISE);
  }

  update(dt: number): void {
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter((f) => f.t < f.life);
    // Compacted in place: the renderer reads this array every frame.
    let alive = 0;
    for (let i = 0; i < this.corpses.length; i++) {
      const c = this.corpses[i];
      c.t += dt;
      if (c.t < c.life) this.corpses[alive++] = c;
    }
    this.corpses.length = alive;
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
    if (this.bossIntro > 0) {
      this.bossIntro = Math.max(0, this.bossIntro - dt);
      // Reason: a normal shake dies out in a fraction of a second; the boss rumble is held up for the whole
      // intro instead, tapering linearly to nothing.
      this.shake = Math.max(this.shake, BOSS_RUMBLE * (this.bossIntro / BOSS_INTRO));
    }
  }

  /** Opacity of the boss-entrance vignette at the viewport corners: swells to BOSS_DIM in ~0.1 s, then fades out. */
  introDim(): number {
    if (this.bossIntro <= 0) return 0;
    const k = 1 - this.bossIntro / BOSS_INTRO;
    return BOSS_DIM * Math.min(1, k / 0.15, (1 - k) / 0.85);
  }

  /** Fresh corpses; drawn before the living monsters so anyone walking past steps over them. */
  drawCorpses(ctx: CanvasRenderingContext2D): void {
    for (const c of this.corpses) drawCorpse(ctx, c);
  }

  drawProjectiles(ctx: CanvasRenderingContext2D, projectiles: readonly Projectile[]): void {
    const next = this.airShotsNext;
    next.clear();
    for (const p of projectiles) {
      if (!this.air.has(p.target) && !this.airShots.has(p.uid)) {
        drawProjectile(ctx, p.kind, p.x, p.y, p.tx - p.x, p.ty - p.y, p.divine);
        continue;
      }
      // Remembered, so the shot keeps climbing even if its flyer dies before it lands.
      next.add(p.uid);
      const y = p.y - this.shotRise(p);
      // Pointed at the flyer's lifted body, so it visibly lands on it.
      drawProjectile(ctx, p.kind, p.x, y, p.tx - p.x, p.ty - FLY_LIFT - y, p.divine);
    }
    // Reason: two sets swapped every frame, so shots that have landed drop out without allocating a new set.
    this.airShotsNext = this.airShots;
    this.airShots = next;
  }

  drawWorld(ctx: CanvasRenderingContext2D): void {
    for (const f of this.fx) drawFx(ctx, f);
    for (const u of this.ults) drawUltimate(ctx, u);
    for (const p of this.particles) drawParticle(ctx, p);
  }

  /** `textScale` keeps floating text readable at any zoom (1 / zoom). */
  drawFloaters(ctx: CanvasRenderingContext2D, textScale: number): void {
    for (const f of this.floaters) drawFloater(ctx, f, textScale);
  }
}
