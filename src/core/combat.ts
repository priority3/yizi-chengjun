// Per-side combat step: enemy movement, supports, attacks with their effects, deaths and bounties.
// Attacks are instant hits (tracers are drawn by the renderer only), which keeps the model deterministic.
import { ENEMIES } from '../config/enemies.ts';
import { START_HEARTS } from '../config/levels.ts';
import { DIVINE, HASTE_CAP, LEVEL_MUL, SLOW_CAP, UNITS } from '../config/units.ts';
import { ADJ8, PATH_LEN, posAt, SLOT_COUNT, SLOT_POS } from './board.ts';
import { fxScale, tileDamage, tileInterval, tileRange } from './stats.ts';
import type { Enemy, MatchState, SideId, SideState, Tile } from './types.ts';

export const DT = 1 / 60;

// Reason: reused every step to avoid per-frame allocation.
const HASTE = new Float64Array(SLOT_COUNT);

/** Attack-speed bonus each slot receives from neighbouring 速 tiles. */
export function computeHaste(side: SideState, out: Float64Array = HASTE): Float64Array {
  out.fill(0);
  const fx = UNITS['速'].fx;
  const pct = fx.t === 'haste' ? fx.pct : 0;
  for (let i = 0; i < SLOT_COUNT; i++) {
    const t = side.slots[i];
    if (!t || t.id !== '速') continue;
    const bonus = pct * t.level * (t.divine ? DIVINE.fx : 1);
    for (const j of ADJ8[i]) out[j] += bonus;
  }
  for (let i = 0; i < SLOT_COUNT; i++) out[i] = Math.min(HASTE_CAP, out[i]);
  return out;
}

function isImmune(e: Enemy): boolean {
  return ENEMIES[e.def].trait?.t === 'immune';
}

export function damage(e: Enemy, amount: number): void {
  const tr = ENEMIES[e.def].trait;
  e.hp -= tr?.t === 'armor' ? Math.max(1, amount - tr.flat) : amount;
}

export function applySlow(e: Enemy, pct: number, dur: number): void {
  if (isImmune(e)) return;
  // Reason: the strongest slow wins and the duration refreshes, so stacking many 冰 never freezes a boss solid.
  e.slowPct = Math.max(e.slowPct, Math.min(SLOW_CAP, pct));
  e.slowT = Math.max(e.slowT, dur);
}

export function applyStun(e: Enemy, dur: number): void {
  // Reason: 'immune' only blocks slows. If it also blocked stuns, the boss would move identically on both
  // boards and often knock out both 唐僧 on the same tick.
  const d = ENEMIES[e.def].boss ? dur * 0.5 : dur;
  e.stunT = Math.max(e.stunT, d);
}

function dist2(a: Enemy, b: Enemy): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/** Living enemy in range that has walked furthest (ties -> lower uid). */
export function findTarget(side: SideState, t: Tile, slot: number): Enemy | null {
  const p = SLOT_POS[slot];
  const r = tileRange(t);
  const r2 = r * r;
  let best: Enemy | null = null;
  for (const e of side.enemies) {
    if (e.hp <= 0) continue;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    if (dx * dx + dy * dy > r2) continue;
    if (!best || e.dist > best.dist || (e.dist === best.dist && e.uid < best.uid)) best = e;
  }
  return best;
}

function hit(m: MatchState, sid: SideId, t: Tile, slot: number, e: Enemy, amount: number): void {
  damage(e, amount);
  m.events.push({ t: 'hit', side: sid, slot, x: e.x, y: e.y, unit: t.id });
}

/** Fires one attack if a target exists. Returns false when there was nothing to shoot at. */
function fire(m: MatchState, sid: SideId, side: SideState, t: Tile, slot: number): boolean {
  const fx = UNITS[t.id].fx;
  const dmg = tileDamage(t);
  const k = fxScale(t);
  if (fx.t === 'global') {
    let any = false;
    for (const e of side.enemies) {
      if (e.hp <= 0) continue;
      hit(m, sid, t, slot, e, dmg);
      any = true;
    }
    return any;
  }
  const target = findTarget(side, t, slot);
  if (!target) return false;
  hit(m, sid, t, slot, target, dmg);
  switch (fx.t) {
    case 'splash': {
      const r2 = fx.radius * fx.radius;
      const pct = Math.min(1, fx.pct * k);
      for (const e of side.enemies) {
        if (e !== target && e.hp > 0 && dist2(e, target) <= r2) damage(e, dmg * pct);
      }
      break;
    }
    case 'slow':
      applySlow(target, fx.pct * k, fx.dur * k);
      break;
    case 'stun': {
      const r2 = fx.radius * fx.radius;
      for (const e of side.enemies) {
        if (e.hp <= 0 && e !== target) continue;
        if (dist2(e, target) > r2) continue;
        if (e !== target) damage(e, dmg * 0.5);
        applyStun(e, fx.dur * k);
      }
      break;
    }
    case 'pierce': {
      // Hit the enemies right behind the target along the road (smaller dist), nearest first.
      const extra = Math.round(fx.count * (t.divine ? DIVINE.fx : 1)) - 1;
      const behind = side.enemies
        .filter((e) => e !== target && e.hp > 0 && e.dist <= target.dist && target.dist - e.dist <= fx.reach)
        .sort((a, b) => b.dist - a.dist || a.uid - b.uid);
      for (let i = 0; i < Math.min(extra, behind.length); i++) hit(m, sid, t, slot, behind[i], dmg);
      break;
    }
    case 'execute': {
      const pct = (ENEMIES[target.def].boss ? fx.bossPct : fx.pct) * k;
      if (target.hp > 0 && target.hp < target.maxHp * pct) target.hp = 0;
      break;
    }
    default:
      break;
  }
  return true;
}

function supportTick(m: MatchState, sid: SideId, side: SideState, t: Tile, slot: number): void {
  const fx = UNITS[t.id].fx;
  if (fx.t === 'income') {
    t.cd -= DT;
    if (t.cd <= 0) {
      const amount = Math.round(fx.amount * LEVEL_MUL[t.level - 1] * (t.divine ? DIVINE.fx : 1));
      side.gongde += amount;
      t.cd += tileInterval(t);
      m.events.push({ t: 'income', side: sid, slot, amount });
    }
  } else if (fx.t === 'heal') {
    // Reason: the timer only runs while 唐僧 is hurt, so a heal can't be banked for an instant save.
    if (side.hearts >= START_HEARTS || m.phase === 'overtime') {
      t.cd = tileInterval(t);
      return;
    }
    t.cd -= DT;
    if (t.cd <= 0) {
      side.hearts = Math.min(START_HEARTS, side.hearts + 1);
      t.cd = tileInterval(t);
      m.events.push({ t: 'heal', side: sid, slot });
    }
  }
}

function moveEnemies(m: MatchState, sid: SideId, side: SideState): void {
  const list = side.enemies;
  let w = 0;
  for (let r = 0; r < list.length; r++) {
    const e = list[r];
    const tr = ENEMIES[e.def].trait;
    if (tr?.t === 'regen') e.hp = Math.min(e.maxHp, e.hp + e.maxHp * tr.pctPerSec * DT);
    if (tr?.t === 'dash') {
      e.traitT -= DT;
      if (e.traitT <= 0) {
        e.traitT += tr.every;
        e.dashT = tr.dur;
      }
    }
    if (e.slowT > 0) {
      e.slowT -= DT;
      if (e.slowT <= 0) e.slowPct = 0;
    }
    if (e.stunT > 0) {
      e.stunT -= DT;
    } else {
      let v = e.speed * (1 - e.slowPct);
      if (e.dashT > 0 && tr?.t === 'dash') {
        v *= tr.mul;
        e.dashT -= DT;
      }
      e.dist += v * DT;
    }
    if (e.dist >= PATH_LEN) {
      side.hearts = Math.max(0, side.hearts - e.leak);
      side.leaks++;
      m.events.push({ t: 'leak', side: sid, hearts: e.leak });
      continue;
    }
    posAt(e.dist, e);
    list[w++] = e;
  }
  list.length = w;
}

function removeDead(m: MatchState, sid: SideId, side: SideState): void {
  const list = side.enemies;
  let w = 0;
  for (let r = 0; r < list.length; r++) {
    const e = list[r];
    if (e.hp > 0) {
      list[w++] = e;
      continue;
    }
    const def = ENEMIES[e.def];
    if (def.trait?.t === 'revive' && e.revives > 0) {
      e.revives--;
      e.hp = e.maxHp * def.trait.pct;
      e.slowPct = 0;
      e.slowT = 0;
      m.events.push({ t: 'revive', side: sid, x: e.x, y: e.y });
      list[w++] = e;
      continue;
    }
    side.gongde += e.bounty;
    side.kills++;
    m.events.push({ t: 'kill', side: sid, x: e.x, y: e.y, bounty: e.bounty, boss: def.boss });
  }
  list.length = w;
}

/** Advances one side by one tick (DT seconds). */
export function stepSide(m: MatchState, sid: SideId): void {
  const side = m.sides[sid];
  moveEnemies(m, sid, side);
  const haste = computeHaste(side);
  for (let i = 0; i < SLOT_COUNT; i++) {
    const t = side.slots[i];
    if (!t) continue;
    const kind = UNITS[t.id].kind;
    if (kind === 'support') {
      supportTick(m, sid, side, t, i);
      continue;
    }
    if (kind !== 'attack' && kind !== 'hero') continue;
    t.cd -= DT * (1 + haste[i]);
    if (t.cd > 0) continue;
    // Reason: when idle, clamp at 0 instead of banking cooldown — otherwise a tile would burst-fire on arrival.
    t.cd = fire(m, sid, side, t, i) ? t.cd + tileInterval(t) : 0;
  }
  removeDead(m, sid, side);
}
