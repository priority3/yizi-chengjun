// Visual effects driven by simulation events. Owns every render-only timer (flashes, pops, shakes,
// particles, banners, ultimates, corpses, the boss entrance). Everything here lives in world coordinates and is
// drawn under the camera, except the boss vignette, which the renderer paints in screen space from `introDim()`;
// nothing feeds back into the simulation, so it may use Math.random freely.
import { ENEMIES } from '../config/enemies.ts';
import { CURRENCY, SUBDUE_MARK, TRIAL } from '../config/terms.ts';
import { UNITS } from '../config/units.ts';
import { encounterDesc, encounterName, ENCOUNTERS, kindLabel } from '../core/encounters.ts';
import type { MapData, Pt } from '../core/map.ts';
import type { HeroId, Projectile, SimEvent, Tile } from '../core/types.ts';
import { tr } from '../i18n/lang.ts';
import { enemyName, traitLine, ultimateName } from '../i18n/names.ts';
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
import { BOSS_CORPSE_LIFE, FLY_LIFT, FOOT } from './monster-pose.ts';
import { monsterTop } from './monsters-art.ts';
import { TroopAnim } from './troop-anim.ts';
import { boardEvent } from './vfx-board.ts';

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
/** Reason: a 白龙 sweep hits dozens at once; past this many hit stars on screen, further hits only flash. */
const MAX_POWS = 24;
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
  /** Bodies of fallen bosses, oldest first; the renderer draws them under the living monsters. */
  readonly corpses: Corpse[] = [];
  banner: Banner | null = null;
  /** Enemy uid -> remaining hit-flash time. */
  readonly flash = new Map<number, number>();
  /** Uids of the flyers on the field, refilled by the renderer every frame: their sparks and incoming shots rise to their bodies. */
  readonly air = new Set<number>();
  /** Projectile uids drawn climbing towards a flyer last frame, and the spare set for the next frame. */
  private airShots = new Set<number>();
  private airShotsNext = new Set<number>();
  /** Per slot: pop (appear/upgrade), shake (invalid drop). */
  readonly pops: Float64Array;
  readonly shakes: Float64Array;
  /** The troops' facing, strikes and shot origins (troop-anim.ts). */
  readonly troops: TroopAnim;
  /** The board as of the last consume(), so a shot knows which troop fired it. */
  private tiles: ReadonlyArray<Tile | null> = [];
  campFlash = 0;
  /** Screen-shake magnitude in design px, decays quickly. */
  shake = 0;
  /** Seconds left of a boss wave's entrance (a held rumble plus darkened corners), 0 otherwise. */
  bossIntro = 0;
  private seq = 0;
  /** Live 'pow' hit stars (recounted every update), held under MAX_POWS. */
  private pows = 0;

  constructor(map: MapData) {
    this.map = map;
    this.pops = new Float64Array(map.slots.length);
    this.shakes = new Float64Array(map.slots.length);
    this.troops = new TroopAnim(map.slots.length);
  }

  add(kind: FxKind, x: number, y: number, x2: number, y2: number, color: string, size: number, life: number): void {
    this.fx.push({ kind, x, y, x2, y2, color, size, t: 0, life, seed: this.seq++ });
  }

  burst(x: number, y: number, n: number, shape: ParticleShape, color: string, speed: number, size: number, life: number, gravity = 0): void {
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

  /** A fallen boss's body topples where it fell (a minion vanishes in a puff of smoke instead, see onKill). */
  private addCorpse(def: string, x: number, y: number): void {
    this.corpses.push({ def, x, y, t: 0, life: BOSS_CORPSE_LIFE, lift: ENEMIES[def].flying ? FLY_LIFT : 0 });
  }

  /**
   * A beaten minion vanishes in a puff of smoke with stars flying out of it (a flyer's up at its body); a boss topples
   * in a golden blast and spills its coins. The bounty floats up over the spot.
   */
  private onKill(e: Extract<SimEvent, { t: 'kill' }>): void {
    const def = ENEMIES[e.def];
    // Reason: the puff covers the middle of the figure, which stands well above the spot the monster is placed by.
    const mid = e.y + def.radius * FOOT - (def.flying ? FLY_LIFT : 0) - monsterTop(e.def) / 2;
    if (def.boss) {
      this.addCorpse(e.def, e.x, e.y);
      this.add('boom', e.x, mid, 0, 0, '#ffc94a', def.radius * 1.5, 0.6);
      this.burst(e.x, e.y, 14, 'coin', '', 150, 4, 0.9, 160);
      this.shake = Math.max(this.shake, 6);
    } else {
      this.add('poof', e.x, mid, 0, 0, '', (def.radius * 10) / 12, 0.5);
    }
    this.float(e.x, mid - def.radius * 1.1, `+${e.bounty}`, '#ffd166', def.boss ? 18 : 13);
  }

  /** World position of a slot; -1 means the camp. */
  cell(cell: number): Pt {
    return cell < 0 ? this.map.camp : this.map.slots[cell];
  }

  /**
   * `lift` raises a bolt's end to a flyer's body (see liftAt). The striking soldier's hand or weapon (troops.ts) is
   * where a staff blow, the 金箍棒 and a projectile's puff come from.
   */
  private onShot(e: Extract<SimEvent, { t: 'shot' }>, lift: number): void {
    const m = this.troops.shoot(e.cell, this.tiles[e.cell] ?? null, this.cell(e.cell), e.tx);
    switch (e.kind) {
      case 'swing':
        // Reason: 棍 reaches a monster well away from its pad, so the blow is a streak from the soldier to the hit.
        this.add('streak', m.x, m.y, e.tx, e.ty, 'rgba(255,241,200,0.8)', 3, 0.14);
        this.add('swing', m.x, m.y, e.tx, e.ty, '#fff1c8', 20, 0.18);
        this.burst(e.tx, e.ty, 3, 'dot', '#fff1c8', 70, 2, 0.25);
        break;
      case 'bolt':
        this.add('bolt', e.tx, e.ty - 170, e.tx, e.ty - lift, '#b98cff', 0, 0.24);
        this.burst(e.tx, e.ty - lift, 8, 'dot', '#e0ccff', 140, 2.4, 0.35);
        this.shake = Math.max(this.shake, 1.6);
        break;
      case 'beam':
        this.add('beam', m.x, m.y, e.tx, e.ty, '#f5c542', 0, 0.3);
        for (let i = 0; i < 6; i++) {
          const t = Math.random();
          this.burst(m.x + (e.tx - m.x) * t, m.y + (e.ty - m.y) * t, 1, 'star', '#ffe27a', 50, 3, 0.4);
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
        // Projectile launch: a small puff where it leaves the soldier.
        this.burst(m.x, m.y, 2, 'dot', 'rgba(255,250,235,0.9)', 40, 2, 0.2);
    }
  }

  /** `lift` raises the burst to a flyer's body (see liftAt). */
  private onImpact(e: Extract<SimEvent, { t: 'impact' }>, lift: number): void {
    const y = e.y - lift;
    if (e.kind === 'fire') {
      this.add('boom', e.x, y, 0, 0, '#ff8a2a', 32, 0.4);
      this.burst(e.x, y, 6, 'ember', '#ffd27a', 120, 2.2, 0.45, 60);
      this.shake = Math.max(this.shake, 1);
    } else if (e.kind === 'ice') {
      this.add('ring', e.x, y, 0, 0, '#9fe4ff', 18, 0.3);
      this.burst(e.x, y, 7, 'snow', '#e8f8ff', 90, 2.6, 0.45, 40);
    } else if (e.kind === 'crescent') {
      this.add('slash', e.x, y, 0, 0, '#e8f2fa', 16, 0.25);
    } else if (e.kind === 'needle') {
      this.burst(e.x, y, 4, 'dot', '#7be35a', 60, 1.8, 0.3);
    } else if (e.kind === 'net') {
      // The net opens over its catch.
      this.add('ring', e.x, y, 0, 0, '#c9a066', 24, 0.3);
      this.burst(e.x, y, 5, 'dot', 'rgba(150,105,50,0.85)', 70, 2, 0.3);
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
    this.troops.shoot(e.cell, this.tiles[e.cell] ?? null, p, e.tx);
    this.pops[e.cell] = 0.3;
    this.float(p.x, p.y - 36, ultimateName(e.hero), '#ffd166', 16, true, 1.2);
    for (const q of e.targets) this.burst(q.x, q.y, 4, 'star', '#ffe27a', 120, 3.5, 0.5);
    this.shake = Math.max(this.shake, e.hero === '沙僧' ? 2 : 6);
  }

  /** A 镜 flashes: a silver ring bursts from the camp and rings every monster it hit (up at a flyer's body); the squad lifts its mirrors. */
  private onMirror(e: Extract<SimEvent, { t: 'mirror' }>): void {
    this.troops.pulse(e.cell);
    this.add('ring', e.x, e.y, 0, 0, '#eef4fb', 72, 0.6);
    this.add('ring', e.x, e.y, 0, 0, '#9fb3cc', 44, 0.45);
    this.burst(e.x, e.y, 10, 'star', '#eef4fb', 140, 3, 0.6);
    this.float(e.x, e.y - 40, tr('反弹', 'Reflect!'), '#e8f0fa', 18, true, 1);
    for (const q of e.targets) this.add('ring', q.x, this.air.has(q.uid) ? q.y - FLY_LIFT : q.y, 0, 0, '#e6eef8', 22, 0.4);
  }

  /** Plays the effects of `events`; `tiles` is the board they happened on (who fired each shot). */
  consume(events: readonly SimEvent[], tiles: ReadonlyArray<Tile | null> = this.tiles): void {
    this.tiles = tiles;
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
        case 'mirror':
          this.onMirror(e);
          break;
        case 'hit': {
          this.flash.set(e.uid, 0.12);
          const y = this.air.has(e.uid) ? e.y - FLY_LIFT : e.y;
          // A white star pops where the blow lands, bigger for a harder hit.
          if (this.pows < MAX_POWS) {
            this.add('pow', e.x + rnd(-3, 3), y + rnd(-3, 3), 0, 0, '', 6 + Math.min(5, e.dmg / 12), 0.16);
            this.pows++;
          }
          this.burst(e.x, y, 2, 'dot', UNITS[e.unit].color, 80, 2, 0.22);
          if (e.dmg >= 25) this.float(e.x + rnd(-6, 6), y - 16, String(Math.round(e.dmg)), '#ffffff', 13);
          break;
        }
        case 'kill':
          this.onKill(e);
          break;
        case 'leak':
          this.campFlash = 0.3;
          this.add('ring', e.x, e.y, 0, 0, '#ff6a5a', 40, 0.5);
          this.burst(e.x, e.y, 8, 'dot', '#ff6a5a', 90, 2.5, 0.4);
          this.float(e.x, e.y - 24, tr(`阵地 -${e.dmg}`, `Camp -${e.dmg}`), '#ff6a5a', 16, true, 1.1);
          this.shake = Math.max(this.shake, 3);
          break;
        case 'steal':
          this.float(e.x, e.y - 12, tr(`-${e.amount} ${CURRENCY}`, `-${e.amount} coins`), '#ff6a5a', 15, false, 1.1);
          this.float(e.x, e.y - 34, tr('溜了', 'Got away!'), '#ffd166', 18, true, 1);
          this.burst(e.x, e.y, 8, 'coin', '', 120, 3, 0.7, 150);
          this.shake = Math.max(this.shake, 2);
          break;
        case 'revive':
          this.add('ring', e.x, e.y, 0, 0, '#ffffff', 34, 0.5);
          this.float(e.x, e.y - 22, tr('复活！', 'Back up!'), '#ffffff', 16, true);
          break;
        case 'split':
        case 'summon':
          this.burst(e.x, e.y, 10, 'dot', 'rgba(140,90,170,0.7)', 90, 4, 0.5);
          break;
        case 'execute':
          this.add('slash', e.x, e.y, 0, 0, '#ffffff', 22, 0.35);
          // Reason: the mark is one big brush character in Chinese; the English word is set smaller to stay as wide.
          this.float(e.x, e.y - 18, tr(SUBDUE_MARK, 'Subdued!'), '#e0302a', tr(30, 18), true, 0.8);
          break;
        default:
          boardEvent(this, e);
          break;
        case 'encounter': {
          const def = ENCOUNTERS[e.id];
          this.showBanner(`${kindLabel(def.kind)} · ${encounterName(e.id)}`, encounterDesc(e.id), KIND_COLOR[def.kind], null, 2.2);
          break;
        }
        case 'waveStart': {
          const boss = e.boss ? ENEMIES[e.boss] : null;
          const sub = boss
            ? tr(`Boss ${boss.name}：${traitLine(boss)}`, `Boss ${enemyName(boss.id)}: ${traitLine(boss)}`)
            : e.elite
              ? tr('魔将压阵，小心！', `A ${enemyName('魔')} leads this wave. Careful!`)
              : e.mods
                ? tr(`${TRIAL}：${e.mods}`, `Trial: ${e.mods}`)
                : tr('妖怪从城门出发，别放它们走到营地', 'Monsters set out from the gate: keep them from the camp');
          this.showBanner(tr(`第 ${e.wave} 波`, `Wave ${e.wave}`), sub, boss ? '#ff8a5c' : e.mods ? '#ffb07a' : '#fff1c2');
          if (boss) {
            // Boss entrance: the ground rumbles and the corners darken once (update() holds the rumble up).
            this.bossIntro = BOSS_INTRO;
            this.shake = Math.max(this.shake, BOSS_RUMBLE);
          }
          break;
        }
        case 'waveClear':
          this.showBanner(tr(`击退第 ${e.wave} 波`, `Wave ${e.wave} cleared`), tr(`+${e.bonus} ${CURRENCY} · 商店补货了`, `+${e.bonus} coins · The shop restocked`), '#aef0b8', null, 1.6);
          break;
        case 'enrage':
          this.showBanner(tr('妖怪狂暴了！', 'The monsters go berserk!'), tr('这一波拖得太久：眩晕、减速、击退都不管用了', 'This wave dragged on: stuns, slows and knockback stop working'), '#ff8a5c', null, 2.4);
          this.shake = Math.max(this.shake, BOSS_RUMBLE);
          break;
      }
    }
  }

  /** Trail particles for flying projectiles (called once per frame). */
  trail(projectiles: readonly Projectile[]): void {
    for (const p of projectiles) {
      if (this.particles.length >= MAX_PARTICLES) break;
      const o = this.troops.peekOffset(p, this.cell(p.cell));
      const x = p.x + o.x;
      const y = p.y + o.y - this.shotRise(p);
      if (p.kind === 'fire' && Math.random() < 0.7) {
        this.particles.push({ x: x + rnd(-2, 2), y: y + rnd(-2, 2), vx: 0, vy: -10, gravity: 0, size: rnd(1.5, 2.6), color: '#ffb44a', shape: 'ember', t: 0, life: 0.3 });
      } else if (p.kind === 'ice' && Math.random() < 0.4) {
        this.particles.push({ x, y, vx: rnd(-10, 10), vy: rnd(-10, 10), gravity: 0, size: 1.8, color: '#e8f8ff', shape: 'snow', t: 0, life: 0.3 });
      } else if (p.kind === 'needle' && Math.random() < 0.3) {
        // Poison dripping off the needle.
        this.particles.push({ x, y, vx: 0, vy: 0, gravity: 90, size: 1.3, color: '#7be35a', shape: 'dot', t: 0, life: 0.3 });
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
    this.pows = 0;
    for (const f of this.fx) if (f.kind === 'pow') this.pows++;
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
    this.troops.update(dt);
    for (const arr of [this.pops, this.shakes]) {
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

  /** Draws the projectiles, each leaving its soldier's bow or hand and easing onto its simulated course (troop-anim.ts). */
  drawProjectiles(ctx: CanvasRenderingContext2D, projectiles: readonly Projectile[]): void {
    const next = this.airShotsNext;
    next.clear();
    this.troops.beginShots();
    for (const p of projectiles) {
      const o = this.troops.shotOffset(p, this.cell(p.cell));
      const x = p.x + o.x;
      if (!this.air.has(p.target) && !this.airShots.has(p.uid)) {
        const y = p.y + o.y;
        drawProjectile(ctx, p.kind, x, y, p.tx - x, p.ty - y, p.divine);
        continue;
      }
      // Remembered, so the shot keeps climbing even if its flyer dies before it lands.
      next.add(p.uid);
      const y = p.y + o.y - this.shotRise(p);
      // Pointed at the flyer's lifted body, so it visibly lands on it.
      drawProjectile(ctx, p.kind, x, y, p.tx - x, p.ty - FLY_LIFT - y, p.divine);
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
