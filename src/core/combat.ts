// Tiles fighting: targeting, instant attacks, travelling projectiles and their effects, supports, and deaths.
// Projectiles deal damage only when they arrive, so what the player sees matches what happens.
import { ENEMIES } from '../config/enemies.ts';
import { DIVINE, HASTE_CAP, LEVEL_MUL, UNITS } from '../config/units.ts';
import { DT } from './clock.ts';
import { applySlow, applyStun, damage, dist2, knock } from './effects.ts';
import type { Pt } from './map.ts';
import { routeOf, spawnMinions } from './monsters.ts';
import { fxScale, tileDamage, tileInterval, tileRange } from './stats.ts';
import type { Enemy, GameState, Projectile, Tile } from './types.ts';
import { castUltimate, isUltimateReady, rageGain } from './ultimates.ts';

// Reason: reused every step to avoid per-frame allocation; resized when a map has a different slot count.
let haste = new Float64Array(0);

/** Attack-speed bonus each slot receives from 速 tiles within SUPPORT_RANGE. */
export function computeHaste(g: GameState): Float64Array {
  const n = g.slots.length;
  if (haste.length !== n) haste = new Float64Array(n);
  haste.fill(0);
  const fx = UNITS['速'].fx;
  const pct = fx.t === 'haste' ? fx.pct : 0;
  for (let i = 0; i < n; i++) {
    const t = g.slots[i];
    if (!t || t.id !== '速') continue;
    const bonus = pct * t.level * (t.divine ? DIVINE.fx : 1);
    for (const j of g.map.adj[i]) haste[j] += bonus;
  }
  for (let i = 0; i < n; i++) haste[i] = Math.min(HASTE_CAP, haste[i]);
  return haste;
}

/** Living enemy in range that is furthest along its road, i.e. closest to the camp (ties -> lower uid). */
export function findTarget(g: GameState, t: Tile, cell: number): Enemy | null {
  const p = g.map.slots[cell];
  const r = tileRange(t, g.mods);
  const r2 = r * r;
  let best: Enemy | null = null;
  let bestRem = Infinity;
  for (const e of g.enemies) {
    if (e.hp <= 0 || e.gone || dist2(e, p.x, p.y) > r2) continue;
    // Flyers are out of reach of ground fighters (see canHitAir).
    if (e.air && !canHitAir(t)) continue;
    const rem = routeOf(g, e).length - e.dist;
    if (rem < bestRem || (rem === bestRem && best !== null && e.uid < best.uid)) {
      best = e;
      bestRem = rem;
    }
  }
  return best;
}

/**
 * Whether `t`'s next attack can reach a flying monster: never for ground fighters (UnitDef.hitsAir false: 棍,
 * 八戒's slam), nor for a 悟空 whose next attack is its ultimate.
 * Reason: 金箍棒·横扫 sweeps a stretch of road, so a charged 悟空 keeps its charge for a target on the ground.
 */
export function canHitAir(t: Tile): boolean {
  return UNITS[t.id].hitsAir && !(t.id === '悟空' && isUltimateReady(t));
}

/** 悟空's staff: every enemy along the line from the cell through the target, nearest first. */
function fireBeam(g: GameState, t: Tile, cell: number, p: Pt, target: Enemy, dmg: number): void {
  const def = UNITS[t.id];
  const fx = def.fx;
  if (fx.t !== 'beam') return;
  const len = Math.hypot(target.x - p.x, target.y - p.y) || 1;
  const ux = (target.x - p.x) / len;
  const uy = (target.y - p.y) / len;
  const reach = tileRange(t, g.mods) + 30;
  const hits: Array<{ e: Enemy; along: number }> = [];
  for (const e of g.enemies) {
    if (e.hp <= 0 || e.gone) continue;
    if (e.air && !def.hitsAir) continue;
    const ex = e.x - p.x;
    const ey = e.y - p.y;
    const along = ex * ux + ey * uy;
    if (along < 0 || along > reach) continue;
    if (Math.abs(ex * uy - ey * ux) <= fx.width / 2 + ENEMIES[e.def].radius) hits.push({ e, along });
  }
  hits.sort((a, b) => a.along - b.along || a.e.uid - b.e.uid);
  const count = Math.round(fx.count * (t.divine ? DIVINE.fx : 1));
  for (const h of hits.slice(0, count)) {
    damage(g, h.e, dmg, t.id);
    knock(g, h.e, def.knockback);
  }
  g.events.push({ t: 'shot', kind: 'beam', unit: t.id, cell, x: p.x, y: p.y, tx: p.x + ux * reach, ty: p.y + uy * reach, divine: t.divine });
}

/** Fires one attack if a target exists. Returns false when there was nothing to shoot at. */
function fire(g: GameState, t: Tile, cell: number): boolean {
  const def = UNITS[t.id];
  const dmg = tileDamage(t, g.mods);
  const p = g.map.slots[cell];
  if (def.kind === 'hero' && isUltimateReady(t)) {
    const target = findTarget(g, t, cell);
    if (!target) return false;
    castUltimate(g, t, cell, target);
    t.rage = 0;
    return true;
  }
  if (def.shot === 'dragon') {
    let any = false;
    for (const e of g.enemies) {
      if (e.hp <= 0 || e.gone) continue;
      if (e.air && !def.hitsAir) continue;
      damage(g, e, dmg, t.id);
      any = true;
    }
    if (any) g.events.push({ t: 'shot', kind: 'dragon', unit: t.id, cell, x: p.x, y: p.y, tx: p.x, ty: p.y, divine: t.divine });
    return any;
  }
  const target = findTarget(g, t, cell);
  if (!target) return false;
  if (def.shot === 'beam') {
    fireBeam(g, t, cell, p, target, dmg);
    return true;
  }
  g.events.push({ t: 'shot', kind: def.shot, unit: t.id, cell, x: p.x, y: p.y, tx: target.x, ty: target.y, divine: t.divine });
  if (def.projSpeed > 0) {
    g.projectiles.push({
      uid: g.nextUid++,
      kind: def.shot,
      unit: t.id,
      cell,
      x: p.x,
      y: p.y,
      target: target.uid,
      tx: target.x,
      ty: target.y,
      speed: def.projSpeed,
      dmg,
      fxK: fxScale(t),
      divine: t.divine,
    });
    return true;
  }
  if (def.fx.t === 'stun') {
    // 八戒 slams the ground around the target: full damage to it, 60% to the others, and everyone is stunned.
    const r2 = def.fx.radius * def.fx.radius;
    const dur = def.fx.dur * fxScale(t) * g.mods.stunMul;
    for (const e of g.enemies) {
      if (e.hp <= 0 || e.gone || dist2(e, target.x, target.y) > r2) continue;
      // The slam shakes the ground: flyers overhead don't feel it.
      if (e.air && !def.hitsAir) continue;
      damage(g, e, e === target ? dmg : dmg * 0.6, t.id);
      applyStun(e, dur);
      knock(g, e, def.knockback);
    }
    return true;
  }
  damage(g, target, dmg, t.id);
  knock(g, target, def.knockback);
  return true;
}

/** A projectile reached its target (or the spot where its target died). */
function impact(g: GameState, pr: Projectile, target: Enemy | null): void {
  const fx = UNITS[pr.unit].fx;
  g.events.push({ t: 'impact', kind: pr.kind, unit: pr.unit, x: pr.tx, y: pr.ty });
  if (fx.t === 'splash') {
    // Reason: a fireball still bursts where it lands even if its target already died.
    if (target) damage(g, target, pr.dmg, pr.unit);
    const radius = fx.radius * g.mods.splashRadiusMul;
    const r2 = radius * radius;
    const pct = Math.min(1, fx.pct * pr.fxK);
    // Splash only reaches flyers when the unit that fired it can hit the air.
    const air = UNITS[pr.unit].hitsAir;
    for (const e of g.enemies) {
      if (e !== target && e.hp > 0 && !e.gone && (air || !e.air) && dist2(e, pr.tx, pr.ty) <= r2) damage(g, e, pr.dmg * pct, pr.unit);
    }
    return;
  }
  if (!target) return;
  damage(g, target, pr.dmg, pr.unit);
  if (fx.t === 'slow') applySlow(target, fx.pct * pr.fxK, fx.dur * pr.fxK);
  if (fx.t === 'execute') {
    const pct = (ENEMIES[target.def].boss ? fx.bossPct : fx.pct) * pr.fxK + g.mods.executeBonus;
    if (target.hp > 0 && target.hp < target.maxHp * pct) {
      target.hp = 0;
      g.events.push({ t: 'execute', x: target.x, y: target.y });
    }
  }
}

export function updateProjectiles(g: GameState): void {
  const list = g.projectiles;
  let w = 0;
  for (let i = 0; i < list.length; i++) {
    const pr = list[i];
    let target: Enemy | null = null;
    for (const e of g.enemies) {
      if (e.uid === pr.target && e.hp > 0 && !e.gone) {
        target = e;
        break;
      }
    }
    if (target) {
      pr.tx = target.x;
      pr.ty = target.y;
    }
    const dx = pr.tx - pr.x;
    const dy = pr.ty - pr.y;
    const dist = Math.hypot(dx, dy);
    const stepLen = pr.speed * DT;
    const reach = target ? ENEMIES[target.def].radius * 0.6 : 2;
    if (dist <= stepLen + reach) {
      impact(g, pr, target);
      continue;
    }
    pr.x += (dx / dist) * stepLen;
    pr.y += (dy / dist) * stepLen;
    list[w++] = pr;
  }
  list.length = w;
}

function supportTick(g: GameState, t: Tile, cell: number): void {
  const fx = UNITS[t.id].fx;
  if (fx.t === 'income') {
    t.cd -= DT;
    if (t.cd <= 0) {
      const amount = Math.round(fx.amount * LEVEL_MUL[t.level - 1] * (t.divine ? DIVINE.fx : 1));
      g.gongde += amount;
      t.cd += tileInterval(t);
      g.events.push({ t: 'income', cell, amount });
    }
  } else if (fx.t === 'heal') {
    // Reason: the timer only runs while the camp is hurt, so a heal can't be banked for later.
    if (g.campHp >= g.campMax) {
      t.cd = tileInterval(t);
      return;
    }
    t.cd -= DT;
    if (t.cd <= 0) {
      const amount = Math.round(fx.amount * (1 + 0.5 * (t.level - 1)) * (t.divine ? DIVINE.fx : 1));
      g.campHp = Math.min(g.campMax, g.campHp + amount);
      t.cd = tileInterval(t);
      g.events.push({ t: 'heal', cell, amount });
    }
  }
}

function removeDead(g: GameState): void {
  const list = g.enemies;
  const splits: Enemy[] = [];
  let w = 0;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (e.gone) continue;
    if (e.hp > 0) {
      list[w++] = e;
      continue;
    }
    const tr = ENEMIES[e.def].trait;
    if (tr?.t === 'revive' && e.revives > 0) {
      e.revives--;
      e.hp = e.maxHp * tr.pct;
      e.slowPct = 0;
      e.slowT = 0;
      g.events.push({ t: 'revive', x: e.x, y: e.y });
      list[w++] = e;
      continue;
    }
    g.gongde += e.bounty;
    g.kills++;
    g.events.push({ t: 'kill', def: e.def, x: e.x, y: e.y, bounty: e.bounty });
    if (tr?.t === 'split') splits.push(e);
  }
  list.length = w;
  for (const e of splits) {
    const tr = ENEMIES[e.def].trait;
    if (tr?.t !== 'split') continue;
    spawnMinions(g, tr.minion, tr.count, e);
    g.events.push({ t: 'split', x: e.x, y: e.y });
  }
}

/** Advances all tiles, projectiles and deaths by one tick (battle phase only). */
export function stepCombat(g: GameState): void {
  const haste = computeHaste(g);
  for (let i = 0; i < g.slots.length; i++) {
    const t = g.slots[i];
    if (!t) continue;
    const kind = UNITS[t.id].kind;
    if (kind === 'support') {
      supportTick(g, t, i);
      continue;
    }
    if (kind !== 'attack' && kind !== 'hero') continue;
    t.cd -= DT * (1 + haste[i]);
    if (t.cd > 0) continue;
    const wasReady = kind === 'hero' && isUltimateReady(t);
    const fired = fire(g, t, i);
    // Reason: when idle, clamp at 0 instead of banking cooldown — otherwise a tile would burst-fire on arrival.
    t.cd = fired ? t.cd + tileInterval(t) : 0;
    if (fired && kind === 'hero' && !wasReady) t.rage = Math.min(1, t.rage + rageGain(t, g.mods));
  }
  updateProjectiles(g);
  removeDead(g);
}
