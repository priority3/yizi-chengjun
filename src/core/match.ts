// A versus match: two identical boards receiving the same waves; whoever's 唐僧 falls first loses.
import { ENEMIES } from '../config/enemies.ts';
import { OT_MAX, PREP_SECONDS, START_GONGDE, START_HEARTS, WAVES_PER_LEVEL } from '../config/levels.ts';
import { aiThink } from './ai.ts';
import { recruit, resolveDrop, SLOT_COUNT } from './board.ts';
import { stepSide } from './combat.ts';
import { mixSeed } from './rng.ts';
import { buildOvertime, buildWave, TICKS_PER_SEC, type WavePlan } from './waves.ts';
import type {
  Action,
  AiKnobs,
  AiState,
  DropResult,
  Enemy,
  EndReason,
  MatchState,
  RecruitResult,
  SideId,
  SideState,
  Spawn,
} from './types.ts';

export interface MatchOptions {
  seed: number;
  level: number;
  /** Knobs per side; null = controlled by the player. */
  ai: [AiKnobs | null, AiKnobs | null];
}

function makeSide(drawSeed: number, bonus: number): SideState {
  return {
    slots: new Array<null>(SLOT_COUNT).fill(null),
    enemies: [],
    gongde: START_GONGDE + bonus,
    hearts: START_HEARTS,
    drawCount: 0,
    rng: drawSeed,
    kills: 0,
    leaks: 0,
  };
}

function makeAi(knobs: AiKnobs | null, seed: number): AiState | null {
  return knobs ? { knobs, rng: seed, next: 0 } : null;
}

export function createMatch(opts: MatchOptions): MatchState {
  // Reason: both sides share one draw seed, so the n-th 化缘 yields the same tile — decisions decide the match.
  const drawSeed = mixSeed(opts.seed, 1);
  return {
    seed: opts.seed,
    level: opts.level,
    tick: 0,
    phase: 'prep',
    wave: 0,
    overtime: 0,
    nextWaveAt: Math.round(PREP_SECONDS * TICKS_PER_SEC),
    spawns: [],
    sides: [makeSide(drawSeed, opts.ai[0]?.bonus ?? 0), makeSide(drawSeed, opts.ai[1]?.bonus ?? 0)],
    ai: [makeAi(opts.ai[0], mixSeed(opts.seed, 2)), makeAi(opts.ai[1], mixSeed(opts.seed, 3))],
    events: [],
    winner: null,
    endReason: null,
    nextUid: 1,
  };
}

/** Applies a player or AI action immediately. Events it produces are appended to `m.events`. */
export function act(m: MatchState, sid: SideId, a: Action): RecruitResult | DropResult {
  if (m.winner !== null) return 'none';
  return a.t === 'recruit' ? recruit(m, sid) : resolveDrop(m, sid, a.from, a.to);
}

function makeEnemy(m: MatchState, s: Spawn): Enemy {
  const tr = ENEMIES[s.def].trait;
  return {
    uid: m.nextUid++,
    def: s.def,
    hp: s.hp,
    maxHp: s.hp,
    speed: s.speed,
    dist: 0,
    x: 1.5,
    y: 0,
    slowPct: 0,
    slowT: 0,
    stunT: 0,
    revives: tr?.t === 'revive' ? tr.times : 0,
    traitT: tr?.t === 'dash' ? tr.every : 0,
    dashT: 0,
    bounty: s.bounty,
    leak: s.leak,
  };
}

function startWave(m: MatchState, plan: WavePlan): void {
  // Reason: plans start at the current tick, after every earlier spawn, so the queue stays sorted.
  for (const s of plan.spawns) m.spawns.push(s);
  m.nextWaveAt = plan.next;
  m.events.push({ t: 'wave', wave: m.wave, boss: plan.boss, overtime: m.overtime });
}

function advanceWaves(m: MatchState): void {
  if (m.tick < m.nextWaveAt) return;
  if (m.wave < WAVES_PER_LEVEL) {
    m.phase = 'waves';
    m.wave++;
    startWave(m, buildWave(m.level, m.wave, m.tick));
    return;
  }
  if (m.overtime >= OT_MAX) {
    finishOnPoints(m);
    return;
  }
  m.phase = 'overtime';
  m.overtime++;
  startWave(m, buildOvertime(m.level, m.overtime, m.tick));
}

function spawnDue(m: MatchState): void {
  let n = 0;
  while (n < m.spawns.length && m.spawns[n].at <= m.tick) n++;
  if (n === 0) return;
  for (let i = 0; i < n; i++) {
    // The same enemy enters both boards at the same moment.
    m.sides[0].enemies.push(makeEnemy(m, m.spawns[i]));
    m.sides[1].enemies.push(makeEnemy(m, m.spawns[i]));
  }
  m.spawns.splice(0, n);
}

function finish(m: MatchState, winner: SideId, reason: EndReason): void {
  m.winner = winner;
  m.endReason = reason;
  m.phase = 'over';
  m.events.push({ t: 'end', winner, reason });
}

/** Overtime cap reached: more hearts, then fewer leaks, then more kills; a full tie goes to the player. */
function finishOnPoints(m: MatchState): void {
  const [p, a] = m.sides;
  let w: SideId = 0;
  if (p.hearts !== a.hearts) w = p.hearts > a.hearts ? 0 : 1;
  else if (p.leaks !== a.leaks) w = p.leaks < a.leaks ? 0 : 1;
  else if (p.kills !== a.kills) w = p.kills > a.kills ? 0 : 1;
  finish(m, w, 'tiebreak');
}

function checkKnockout(m: MatchState): void {
  const pDown = m.sides[0].hearts <= 0;
  const aDown = m.sides[1].hearts <= 0;
  if (!pDown && !aDown) return;
  if (pDown && aDown) finish(m, m.sides[0].kills >= m.sides[1].kills ? 0 : 1, 'double_ko');
  else finish(m, pDown ? 1 : 0, 'ko');
}

/** Advances the match by one fixed tick (1/60 s). */
export function step(m: MatchState): void {
  m.events.length = 0;
  if (m.winner !== null) return;
  for (const sid of [0, 1] as const) {
    const ai = m.ai[sid];
    if (!ai) continue;
    const a = aiThink(m, sid, ai);
    if (a) act(m, sid, a);
  }
  advanceWaves(m);
  if (m.winner !== null) return;
  spawnDue(m);
  stepSide(m, 0);
  stepSide(m, 1);
  checkKnockout(m);
  m.tick++;
}

/** FNV-1a hash of the gameplay-relevant state; equal hashes mean identical matches. */
export function hashState(m: MatchState): number {
  let h = 0x811c9dc5;
  const mix = (n: number) => {
    h ^= n | 0;
    h = Math.imul(h, 0x01000193);
  };
  mix(m.tick);
  mix(m.winner ?? -1);
  mix(m.wave);
  mix(m.overtime);
  for (const s of m.sides) {
    mix(s.gongde);
    mix(s.hearts);
    mix(s.drawCount);
    mix(s.kills);
    mix(s.leaks);
    mix(s.rng);
    for (const t of s.slots) {
      if (!t) {
        mix(-1);
        continue;
      }
      for (const ch of t.id) mix(ch.charCodeAt(0));
      mix(t.level);
      mix(t.divine ? 1 : 0);
    }
    for (const e of s.enemies) {
      mix(e.uid);
      mix(Math.round(e.hp * 100));
      mix(Math.round(e.dist * 1000));
    }
  }
  return h >>> 0;
}
