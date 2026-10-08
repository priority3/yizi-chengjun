// Enemies: spawning, walking to the camp, attacking it (or robbing it), and the timed boss traits.
import { ENEMIES } from '../config/enemies.ts';
import { incomeMul } from '../config/chapters.ts';
import { DT } from './clock.ts';
import { SPAWN_X_MAX, SPAWN_X_MIN, spawnY, stopY } from './grid.ts';
import { rand } from './rng.ts';
import { waveHp } from './waves.ts';
import type { Enemy, GameState, Lane } from './types.ts';

export function makeEnemy(
  g: GameState,
  def: string,
  lane: Lane,
  x: number,
  hp: number,
  speed: number,
  bounty: number,
  y = spawnY(lane),
): Enemy {
  const d = ENEMIES[def];
  const tr = d.trait;
  return {
    uid: g.nextUid++,
    def,
    hp,
    maxHp: hp,
    x,
    y,
    lane,
    stopY: stopY(lane, d.radius),
    // 定风珠 and similar 法宝 slow every enemy that enters the field.
    speed: speed * g.mods.enemySpeedMul,
    slowPct: 0,
    slowT: 0,
    stunT: 0,
    atk: d.atk,
    // Reason: the first bite lands half an interval after arriving, so a crowd doesn't hit on the same tick.
    atkT: d.atkInterval * 0.5,
    revives: tr?.t === 'revive' ? tr.times : 0,
    traitT: tr?.t === 'dash' || tr?.t === 'summon' ? tr.every : 0,
    dashT: 0,
    bounty,
    gone: false,
  };
}

/** Spawns `count` minions around (x, y) at the current wave's strength — used by summon and split. */
export function spawnMinions(g: GameState, def: string, count: number, x: number, y: number, lane: Lane): void {
  const d = ENEMIES[def];
  const hp = waveHp(def, g.chapter, Math.max(1, g.wave));
  for (let i = 0; i < count; i++) {
    const mx = Math.min(SPAWN_X_MAX, Math.max(SPAWN_X_MIN, x + (rand(g) - 0.5) * 60));
    const my = y + (rand(g) - 0.5) * 16;
    g.enemies.push(makeEnemy(g, def, lane, mx, hp, d.speed, Math.round(d.bounty * incomeMul(g.chapter)), my));
  }
}

/** Advances every living enemy by one tick: traits, status timers, walking, and attacking the camp. */
export function moveEnemies(g: GameState): void {
  // Reason: summons append to the list mid-loop; only walk the enemies that existed at the start of the tick.
  const n = g.enemies.length;
  for (let i = 0; i < n; i++) {
    const e = g.enemies[i];
    if (e.hp <= 0 || e.gone) continue;
    const d = ENEMIES[e.def];
    const tr = d.trait;
    if (tr?.t === 'regen') e.hp = Math.min(e.maxHp, e.hp + e.maxHp * tr.pctPerSec * DT);
    if (tr?.t === 'dash' || tr?.t === 'summon') {
      e.traitT -= DT;
      if (e.traitT <= 0) {
        e.traitT += tr.every;
        if (tr.t === 'dash') {
          e.dashT = tr.dur;
        } else {
          spawnMinions(g, tr.minion, tr.count, e.x, e.y, e.lane);
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
    const dir = e.lane === 0 ? 1 : -1;
    const remaining = (e.stopY - e.y) * dir;
    if (remaining > 0.01) {
      let v = e.speed * (1 - e.slowPct);
      if (e.dashT > 0 && tr?.t === 'dash') {
        v *= tr.mul;
        e.dashT -= DT;
      }
      e.y += dir * Math.min(remaining, v * DT);
      continue;
    }
    if (tr?.t === 'steal') {
      // The thief grabs 功德 and slips away instead of biting.
      const amount = Math.min(g.gongde, tr.amount);
      g.gongde -= amount;
      e.gone = true;
      g.events.push({ t: 'steal', x: e.x, y: e.y, amount });
      continue;
    }
    // At the camp: bite on a cooldown. Slows also slow the biting.
    e.atkT -= DT * (1 - e.slowPct);
    if (e.atkT <= 0) {
      e.atkT += d.atkInterval;
      g.campHp = Math.max(0, g.campHp - e.atk);
      g.events.push({ t: 'campHit', x: e.x, y: e.y, dmg: e.atk });
    }
  }
}
