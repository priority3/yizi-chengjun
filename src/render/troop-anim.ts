// Per-pad animation state of the troops (render only, never fed back into the simulation): which way each squad
// faces, how long since it last struck, whose turn it was, and where each projectile seemed to leave from.
// The simulation launches every shot from the pad's centre; on screen it leaves the striking soldier's bow or hand
// and drifts onto its true course as it flies, so nothing about where it lands changes.
import type { Pt } from '../core/map.ts';
import type { Projectile, Tile } from '../core/types.ts';
import { muzzle, troopSize } from './troops.ts';

/** Seconds since the last strike for a squad that hasn't struck yet (long past any animation). */
const NEVER = 99;

export class TroopAnim {
  /** 1 facing right, -1 facing left. */
  readonly face: Int8Array;
  /** Seconds since the squad last struck or pulsed. */
  readonly since: Float64Array;
  /** The soldier who struck last (-1: the whole squad, as for a support's pulse). */
  readonly shooter: Int8Array;
  /** Strikes so far, to take turns. */
  private readonly count: Uint32Array;
  /** Where the last shot of each pad left, relative to the pad's centre. */
  private readonly lastX: Float64Array;
  private readonly lastY: Float64Array;
  /** Launch offsets of the projectiles in flight by uid, and the spare map refilled each frame. */
  private offsets = new Map<number, Pt>();
  private spare = new Map<number, Pt>();

  constructor(slots: number) {
    this.face = new Int8Array(slots).fill(1);
    this.since = new Float64Array(slots).fill(NEVER);
    this.shooter = new Int8Array(slots);
    this.count = new Uint32Array(slots);
    this.lastX = new Float64Array(slots);
    this.lastY = new Float64Array(slots);
  }

  update(dt: number): void {
    for (let i = 0; i < this.since.length; i++) this.since[i] += dt;
  }

  /**
   * The tile on `cell` (standing at `pad`) shoots at (tx, ty): the squad turns to face it, the next soldier in turn
   * strikes, and the point the shot leaves from is returned.
   */
  shoot(cell: number, tile: Tile | null, pad: Pt, tx: number): Pt {
    if (Math.abs(tx - pad.x) > 2) this.face[cell] = tx < pad.x ? -1 : 1;
    const n = tile ? troopSize(tile) : 1;
    this.shooter[cell] = this.count[cell]++ % n;
    this.since[cell] = 0;
    const m = tile ? muzzle(tile, pad.x, pad.y, this.face[cell], this.shooter[cell]) : pad;
    this.lastX[cell] = m.x - pad.x;
    this.lastY[cell] = m.y - pad.y;
    return m;
  }

  /** A support's pulse (pay-out, heal, mirror flash): the whole squad lifts what it holds. */
  pulse(cell: number): void {
    this.shooter[cell] = -1;
    this.since[cell] = 0;
  }

  /** Call once per frame before the projectiles are drawn, so offsets of landed shots are dropped. */
  beginShots(): void {
    const old = this.offsets;
    this.offsets = this.spare;
    this.spare = old;
    this.offsets.clear();
  }

  /**
   * How far from its simulated spot projectile `p` (fired from the pad at `pad`) is drawn: the launch offset of its
   * soldier, fading to nothing as the shot covers the way to its target.
   */
  shotOffset(p: Projectile, pad: Pt): Pt {
    // Reason: a projectile is first seen the frame it was fired, right after its pad's shot set lastX/lastY.
    const o = this.spare.get(p.uid) ?? this.launch(p);
    this.offsets.set(p.uid, o);
    return fade(o, p, pad);
  }

  /** shotOffset without remembering anything, for effects drawn before the projectiles this frame (their trails). */
  peekOffset(p: Projectile, pad: Pt): Pt {
    return fade(this.offsets.get(p.uid) ?? this.launch(p), p, pad);
  }

  private launch(p: Projectile): Pt {
    return { x: this.lastX[p.cell] ?? 0, y: this.lastY[p.cell] ?? 0 };
  }
}

/** Launch offset `o` scaled by the share of the way projectile `p` still has to go. */
function fade(o: Pt, p: Projectile, pad: Pt): Pt {
  const done = Math.hypot(p.x - pad.x, p.y - pad.y);
  const left = Math.hypot(p.tx - p.x, p.ty - p.y);
  const k = done + left > 0 ? left / (done + left) : 0;
  return { x: o.x * k, y: o.y * k };
}
