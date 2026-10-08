// How a monster's body is posed this frame: which way it faces, how far it leans into its walk, the squash and
// stretch of its two-frame waddle, and the topple of a fresh corpse. Pure maths that writes into caller-owned
// objects, so the renderer can pose every monster every frame without allocating, and tests can pin the numbers.

/** The feet sit this many radii below an enemy's position (the centre of its ground shadow); every pose pivots there. */
export const FOOT = 0.95;
/** A monster turns to face left once its road's horizontal component drops below -FLIP_COS, and back above +FLIP_COS. */
export const FLIP_COS = 0.15;
/** Largest lean (radians) into the horizontal part of the walk; positive tips the head to the right. */
export const MAX_LEAN = 0.12;
/** The two walk frames alternate this many times a second (a whole squash-and-stretch step takes 2 / WALK_FPS s). */
export const WALK_FPS = 6;
/** Walk frame 0, foot down: shorter and wider. */
export const SQUASH_SX = 1.03;
export const SQUASH_SY = 0.94;
/** Walk frame 1, pushing off: taller and narrower. */
export const STRETCH_SX = 0.97;
export const STRETCH_SY = 1.04;
/** A stunned monster stops walking and sways dizzily on its feet: amplitude (radians) and sways per second. */
export const WOBBLE = 0.08;
export const WOBBLE_HZ = 2;

/** What the body is doing: standing still (no battle running), walking, dashing (a boss trait) or reeling from a stun. */
export type Gait = 'idle' | 'walk' | 'dash' | 'stun';

/** A monster's pose; the renderer owns one and refills it for every monster it draws. */
export interface MonsterPose {
  /** Mirror the sprite horizontally (the monster walks left). */
  flip: boolean;
  /** Rotation about the feet in radians, in world terms: positive tips the head to the right. */
  lean: number;
  /** Body scale about the feet (squash and stretch). */
  sx: number;
  sy: number;
}

export function makePose(): MonsterPose {
  return { flip: false, lean: 0, sx: 1, sy: 1 };
}

/** A per-monster phase in [0, 1) from its uid; golden-ratio spacing keeps neighbours in a spawn queue far apart. */
export function uidPhase(uid: number): number {
  const p = uid * 0.6180339887498949;
  return p - Math.floor(p);
}

/**
 * Whether a monster on a road heading `dir` (radians) faces left, given whether it faced left last frame.
 * Reason: the dead band around vertical keeps the old facing, so a monster on a north-south road never flickers.
 */
export function facesLeft(dir: number, wasLeft: boolean): boolean {
  const c = Math.cos(dir);
  if (c < -FLIP_COS) return true;
  if (c > FLIP_COS) return false;
  return wasLeft;
}

/** Which walk frame shows at `time` (s): 0 squashed, 1 stretched. A dash doubles the pace. */
export function walkFrame(time: number, uid: number, dashing: boolean): number {
  const fps = dashing ? WALK_FPS * 2 : WALK_FPS;
  // Reason: the uid shifts the cycle by up to one whole step (two frames), so a crowd neither switches frames
  // at the same moment nor shows the same frame.
  return Math.floor(time * fps + uidPhase(uid) * 2) & 1;
}

/**
 * Fills `out` with the pose of monster `uid` at `time` (s) on a road heading `dir` (radians) and returns it.
 * Walking and dashing lean into the horizontal part of the road and squash/stretch; a stun swaps both for a
 * small sway; idle stands straight. Facing follows `facesLeft` in every gait.
 */
export function monsterPose(out: MonsterPose, dir: number, wasLeft: boolean, gait: Gait, time: number, uid: number): MonsterPose {
  out.flip = facesLeft(dir, wasLeft);
  if (gait === 'walk' || gait === 'dash') {
    const squashed = walkFrame(time, uid, gait === 'dash') === 0;
    out.sx = squashed ? SQUASH_SX : STRETCH_SX;
    out.sy = squashed ? SQUASH_SY : STRETCH_SY;
    out.lean = MAX_LEAN * Math.cos(dir);
    return out;
  }
  out.sx = 1;
  out.sy = 1;
  out.lean = gait === 'stun' ? WOBBLE * Math.sin((time * WOBBLE_HZ + uidPhase(uid)) * Math.PI * 2) : 0;
  return out;
}

/** Seconds a corpse lasts: it topples over, then lies there sinking and fading. Bosses fall slower and heavier. */
export const CORPSE_LIFE = 0.4;
export const BOSS_CORPSE_LIFE = 0.8;
/** Pixels a corpse sinks into the ground over its life. */
export const CORPSE_SINK = 6;
/** Share of a corpse's life spent falling over. */
export const FALL_SHARE = 0.5;

/** A corpse's pose; drawing code keeps one scratch copy. */
export interface CorpsePose {
  /** Rotation about the pivot in radians, clockwise (toppling right): 0 upright, π/2 flat on the ground. */
  angle: number;
  /** Pixels sunk into the ground. */
  sink: number;
  alpha: number;
  /** 0 until the body hits the ground, then 0..1 over the rest of its life (a boss's shockwave follows it). */
  landed: number;
}

export function makeCorpsePose(): CorpsePose {
  return { angle: 0, sink: 0, alpha: 1, landed: 0 };
}

/** Fills `out` with a corpse's pose at `k` = age / life (clamped to 0..1) and returns it. */
export function corpsePose(out: CorpsePose, k: number): CorpsePose {
  const t = Math.min(1, Math.max(0, k));
  const fall = Math.min(1, t / FALL_SHARE);
  // Reason: ease-in — a toppling body starts slowly and speeds up as it goes over, like a felled tree.
  out.angle = (Math.PI / 2) * fall * fall;
  out.sink = CORPSE_SINK * t;
  out.landed = t <= FALL_SHARE ? 0 : (t - FALL_SHARE) / (1 - FALL_SHARE);
  out.alpha = 1 - out.landed;
  return out;
}
