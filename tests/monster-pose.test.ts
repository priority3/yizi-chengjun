import { describe, expect, it } from 'vitest';
import { buildMap } from '../src/core/map.ts';
import {
  corpsePose,
  facesLeft,
  makeCorpsePose,
  makePose,
  monsterPose,
  uidPhase,
  WALK_FPS,
  walkFrame,
  type Gait,
} from '../src/render/monster-pose.ts';
import { Vfx } from '../src/render/vfx.ts';
import { TEST_MAP } from './helpers.ts';

const RIGHT = 0;
const LEFT = Math.PI;
const DOWN = Math.PI / 2;
const UP = -Math.PI / 2;
/** A road heading whose horizontal component (its cosine) is exactly `c`. */
const heading = (c: number): number => Math.acos(c);
const GAITS: readonly Gait[] = ['idle', 'walk', 'dash', 'stun'];

/** How many times the body changes between squashed and stretched during the first second. */
function switchesPerSecond(gait: Gait, uid: number): number {
  const pose = makePose();
  let prev = monsterPose(pose, RIGHT, false, gait, 0, uid).sy;
  let count = 0;
  for (let i = 1; i <= 1200; i++) {
    const sy = monsterPose(pose, RIGHT, false, gait, i / 1200, uid).sy;
    if (sy !== prev) count++;
    prev = sy;
  }
  return count;
}

/** Seconds until monster `uid` first changes walk frame. */
function firstSwitch(uid: number): number {
  const start = walkFrame(0, uid, false);
  for (let i = 1; i <= 1200; i++) if (walkFrame(i / 1200, uid, false) !== start) return i / 1200;
  return Infinity;
}

describe('monster facing', () => {
  it('turns left past cos -0.15 and back right only past cos +0.15', () => {
    expect(facesLeft(LEFT, false)).toBe(true);
    expect(facesLeft(RIGHT, true)).toBe(false);
    expect(facesLeft(heading(-0.16), false)).toBe(true);
    expect(facesLeft(heading(0.16), true)).toBe(false);
    // Inside the dead band the old facing holds, so a monster on a vertical road never flickers.
    for (const c of [-0.14, -0.05, 0, 0.05, 0.14]) {
      expect(facesLeft(heading(c), true)).toBe(true);
      expect(facesLeft(heading(c), false)).toBe(false);
    }
    expect(facesLeft(DOWN, true)).toBe(true);
    expect(facesLeft(UP, true)).toBe(true);
    expect(monsterPose(makePose(), DOWN, true, 'walk', 0.2, 3).flip).toBe(true);
  });

  it('carries the facing through a turn from heading left, down a vertical road, and on to the right', () => {
    const pose = makePose();
    let left = false;
    const facings = [LEFT, heading(-0.5), DOWN, heading(0.1), heading(0.3), RIGHT].map((dir, i) => {
      left = monsterPose(pose, dir, left, 'walk', i * 0.1, 1).flip;
      return left;
    });
    expect(facings).toEqual([true, true, true, true, false, false]);
  });
});

describe('monster lean', () => {
  it('leans into the horizontal part of the walk, never more than 0.12 rad either way', () => {
    const pose = makePose();
    for (let i = 0; i <= 72; i++) {
      const dir = -Math.PI + (i / 72) * Math.PI * 2;
      for (const gait of GAITS) {
        for (const time of [0, 0.13, 0.5, 1.71]) {
          expect(Math.abs(monsterPose(pose, dir, false, gait, time, 3).lean)).toBeLessThanOrEqual(0.12 + 1e-12);
        }
      }
    }
    expect(monsterPose(pose, RIGHT, false, 'walk', 0, 1).lean).toBeCloseTo(0.12);
    expect(monsterPose(pose, LEFT, true, 'walk', 0, 1).lean).toBeCloseTo(-0.12);
    expect(monsterPose(pose, DOWN, false, 'walk', 0, 1).lean).toBeCloseTo(0);
    expect(monsterPose(pose, heading(0.5), false, 'dash', 0, 1).lean).toBeCloseTo(0.06);
  });
});

describe('walk cycle', () => {
  it('alternates a squashed frame (scaleY 0.94) and a stretched one (scaleY 1.04), scaleX the other way', () => {
    const pose = makePose();
    const uid = 5;
    for (let n = 2; n < 10; n++) {
      // The middle of walk frame n, well away from the moments it switches.
      const t = (n + 0.5 - uidPhase(uid) * 2) / WALK_FPS;
      monsterPose(pose, RIGHT, false, 'walk', t, uid);
      expect([pose.sx, pose.sy]).toEqual(n % 2 === 0 ? [1.03, 0.94] : [0.97, 1.04]);
    }
  });

  it('switches frame 6 times a second while walking and twice as often while dashing', () => {
    for (const uid of [1, 2, 3, 10, 77]) {
      expect(switchesPerSecond('walk', uid)).toBe(6);
      expect(switchesPerSecond('dash', uid)).toBe(12);
    }
  });

  it('offsets the cycle by uid so a crowd is out of step', () => {
    // At any one moment a queue of monsters shows both frames...
    const frames = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((uid) => walkFrame(0.5, uid, false)));
    expect(frames.size).toBe(2);
    // ...and neighbours change frame at different moments.
    expect(Math.abs(firstSwitch(1) - firstSwitch(2))).toBeGreaterThan(1 / 60);
    expect(uidPhase(1)).not.toBeCloseTo(uidPhase(2));
  });

  it('stops squashing when stunned and only sways a little, keeping its facing', () => {
    const pose = makePose();
    const leans = new Set<number>();
    for (let i = 0; i < 20; i++) {
      monsterPose(pose, LEFT, true, 'stun', i * 0.05, 4);
      expect([pose.sx, pose.sy, pose.flip]).toEqual([1, 1, true]);
      expect(Math.abs(pose.lean)).toBeLessThanOrEqual(0.12);
      leans.add(Math.round(pose.lean * 1000));
    }
    expect(leans.size).toBeGreaterThan(3);
    monsterPose(pose, RIGHT, false, 'idle', 0.3, 4);
    expect([pose.sx, pose.sy, pose.lean]).toEqual([1, 1, 0]);
  });
});

describe('corpse', () => {
  it('topples a quarter turn to the right, then sinks 6 px and fades out', () => {
    const p = makeCorpsePose();
    expect(corpsePose(p, 0)).toEqual({ angle: 0, sink: 0, alpha: 1, landed: 0 });
    corpsePose(p, 0.25);
    // Speeding up as it goes over: halfway through the fall it has turned less than halfway.
    expect(p.angle).toBeGreaterThan(0);
    expect(p.angle).toBeLessThan(Math.PI / 4);
    corpsePose(p, 0.5);
    expect(p.angle).toBeCloseTo(Math.PI / 2);
    expect(p.alpha).toBe(1);
    corpsePose(p, 1);
    expect(p.angle).toBeCloseTo(Math.PI / 2);
    expect(p.sink).toBeCloseTo(6);
    expect(p.alpha).toBe(0);
    let prev = corpsePose(makeCorpsePose(), 0);
    for (let i = 1; i <= 50; i++) {
      const cur = corpsePose(makeCorpsePose(), i / 50);
      expect(cur.angle).toBeGreaterThanOrEqual(prev.angle);
      expect(cur.sink).toBeGreaterThanOrEqual(prev.sink);
      expect(cur.alpha).toBeLessThanOrEqual(prev.alpha);
      prev = cur;
    }
  });
});

describe('death and boss entrance effects', () => {
  it('leaves a corpse for every kill: 0.4 s for a minion, 0.8 s for a boss', () => {
    const vfx = new Vfx(buildMap(TEST_MAP));
    vfx.consume([
      { t: 'kill', def: '妖', x: 100, y: 120, bounty: 2 },
      { t: 'kill', def: '白骨精', x: 200, y: 150, bounty: 40 },
    ]);
    expect(vfx.corpses.map((c) => [c.def, c.x, c.y, c.life])).toEqual([
      ['妖', 100, 120, 0.4],
      ['白骨精', 200, 150, 0.8],
    ]);
    vfx.update(0.41);
    expect(vfx.corpses.map((c) => c.def)).toEqual(['白骨精']);
    vfx.update(0.4);
    expect(vfx.corpses).toHaveLength(0);
  });

  it('holds a rumble and darkens the corners for 0.6 s when a boss wave starts', () => {
    const vfx = new Vfx(buildMap(TEST_MAP));
    vfx.consume([{ t: 'waveStart', wave: 5, boss: '白骨精', elite: false, mods: '' }]);
    expect(vfx.bossIntro).toBe(0.6);
    let peak = 0;
    for (let i = 0; i < 18; i++) {
      vfx.update(1 / 60);
      peak = Math.max(peak, vfx.introDim());
    }
    // A plain shake would have died out by now; the boss rumble is still going.
    expect(vfx.shake).toBeGreaterThan(2);
    expect(peak).toBeGreaterThan(0.4);
    expect(peak).toBeLessThanOrEqual(0.45);
    for (let i = 0; i < 20; i++) vfx.update(1 / 60);
    expect(vfx.bossIntro).toBe(0);
    expect(vfx.introDim()).toBe(0);
  });

  it('starts a plain wave without a boss entrance', () => {
    const vfx = new Vfx(buildMap(TEST_MAP));
    vfx.consume([{ t: 'waveStart', wave: 1, boss: null, elite: false, mods: '' }]);
    expect(vfx.bossIntro).toBe(0);
    expect(vfx.introDim()).toBe(0);
    expect(vfx.shake).toBe(0);
  });
});
