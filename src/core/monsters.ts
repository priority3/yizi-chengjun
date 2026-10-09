// Enemies: spawning onto a road (or a flyer's flight line), walking it, hurting the camp when they reach the end,
// and the timed boss traits.
import { incomeMul, LEAK_MUL } from '../config/chapters.ts';
import { ENEMIES } from '../config/enemies.ts';
import { MAP_SPEED } from '../config/maps.ts';
import { DT } from './clock.ts';
import { pathPoint, type PathData } from './map.ts';
import { rand } from './rng.ts';
import { runWaveHp } from './waves.ts';
import type { Enemy, GameState } from './types.ts';

/** The line `e` follows: its entrance's road, or for a flyer the straight flight line from that entrance to the camp. */
export function routeOf(g: GameState, e: Enemy): PathData {
  return e.air ? g.map.flights[e.path] : g.map.paths[e.path];
}

export function makeEnemy(g: GameState, def: string, path: number, hp: number, speed: number, bounty: number, dist = 0, side = 0): Enemy {
  const d = ENEMIES[def];
  const tr = d.trait;
  const e: Enemy = {
    uid: g.nextUid++,
    def,
    hp,
    maxHp: hp,
    // Set by placeOnRoad below, once the enemy knows whether it walks or flies.
    x: 0,
    y: 0,
    path,
    air: d.flying === true,
    dist,
    side,
    // Roads are long, so everyone walks faster than on the old camp; 定风珠 and similar 法宝 slow them again.
    speed: speed * MAP_SPEED * g.mods.enemySpeedMul,
    slowPct: 0,
    slowT: 0,
    stunT: 0,
    atk: d.atk,
    revives: tr?.t === 'revive' ? tr.times : 0,
    traitT: tr?.t === 'dash' || tr?.t === 'summon' ? tr.every : 0,
    dashT: 0,
    bounty,
    gone: false,
  };
  placeOnRoad(g, e);
  return e;
}

/** Puts the enemy where its `dist` says it is on its road (or flight line). */
export function placeOnRoad(g: GameState, e: Enemy): void {
  const p = pathPoint(routeOf(g, e), e.dist, e.side);
  e.x = p.x;
  e.y = p.y;
}

/** Spawns `count` minions just behind `near` on its road, at the current wave's strength — used by summon and split. */
export function spawnMinions(g: GameState, def: string, count: number, near: Enemy): void {
  const d = ENEMIES[def];
  const hp = Math.round(runWaveHp(g, def, Math.max(1, g.wave)) * g.map.hpScale);
  for (let i = 0; i < count; i++) {
    const dist = Math.max(0, near.dist - 12 - rand(g) * 30);
    const side = (rand(g) - 0.5) * 2;
    g.enemies.push(makeEnemy(g, def, near.path, hp, d.speed, Math.round(d.bounty * incomeMul(g.chapter)), dist, side));
  }
}

/** The monster reached the camp: a thief runs off with 功德, anyone else hurts the camp. Either way it leaves the field. */
function arrive(g: GameState, e: Enemy): void {
  e.gone = true;
  const tr = ENEMIES[e.def].trait;
  if (tr?.t === 'steal') {
    const amount = Math.min(g.gongde, tr.amount);
    g.gongde -= amount;
    g.events.push({ t: 'steal', x: e.x, y: e.y, amount });
    return;
  }
  const dmg = Math.round(e.atk * LEAK_MUL);
  g.campHp = Math.max(0, g.campHp - dmg);
  g.events.push({ t: 'leak', x: e.x, y: e.y, dmg });
}

/** Advances every living enemy by one tick: traits, status timers, and walking the road. */
export function moveEnemies(g: GameState): void {
  // Reason: summons append to the list mid-loop; only walk the enemies that existed at the start of the tick.
  const n = g.enemies.length;
  for (let i = 0; i < n; i++) {
    const e = g.enemies[i];
    if (e.hp <= 0 || e.gone) continue;
    const tr = ENEMIES[e.def].trait;
    if (tr?.t === 'regen') e.hp = Math.min(e.maxHp, e.hp + e.maxHp * tr.pctPerSec * DT);
    if (tr?.t === 'dash' || tr?.t === 'summon') {
      e.traitT -= DT;
      if (e.traitT <= 0) {
        e.traitT += tr.every;
        if (tr.t === 'dash') {
          e.dashT = tr.dur;
        } else {
          spawnMinions(g, tr.minion, tr.count, e);
          g.events.push({ t: 'summon', x: e.x, y: e.y });
        }
      }
    }
    if (e.slowT > 0) {
      e.slowT -= DT;
      if (e.slowT <= 0) e.slowPct = 0;
    }
    if (e.stunT > 0) {
      e.stunT -= DT;
      continue;
    }
    let v = e.speed * (1 - e.slowPct);
    if (e.dashT > 0 && tr?.t === 'dash') {
      v *= tr.mul;
      e.dashT -= DT;
    }
    e.dist += v * DT;
    const road = routeOf(g, e);
    if (e.dist >= road.length) {
      e.dist = road.length;
      placeOnRoad(g, e);
      arrive(g, e);
      continue;
    }
    placeOnRoad(g, e);
  }
}
