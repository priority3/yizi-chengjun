// Plain-data types shared by the deterministic simulation. Nothing here touches the DOM,
// so a whole match can be snapshotted, hashed and replayed in tests.

/** 0 = player (bottom half), 1 = AI opponent (top half). */
export type SideId = 0 | 1;

export type AttackId = '棍' | '箭' | '火' | '冰' | '雷';
export type SupportId = '速' | '钱' | '疗';
export type FragId = '悟' | '空' | '八' | '戒' | '沙' | '僧' | '白' | '龙';
export type HeroId = '悟空' | '八戒' | '沙僧' | '白龙';
export type UnitId = AttackId | SupportId | FragId | HeroId | '神';

export type UnitKind = 'attack' | 'hero' | 'support' | 'fragment' | 'divine';

export type UnitFx =
  | { t: 'none' }
  | { t: 'splash'; radius: number; pct: number }
  | { t: 'slow'; pct: number; dur: number }
  | { t: 'stun'; radius: number; dur: number }
  | { t: 'pierce'; count: number; reach: number }
  | { t: 'execute'; pct: number; bossPct: number }
  | { t: 'global' }
  | { t: 'haste'; pct: number }
  | { t: 'income'; amount: number }
  | { t: 'heal' };

export interface UnitDef {
  id: UnitId;
  kind: UnitKind;
  /** Short role label for tooltips, e.g. 远程. */
  label: string;
  desc: string;
  /** Level-1 damage per hit (0 for tiles that never attack). */
  dmg: number;
  /** Attack range in cells; Infinity means the whole board. */
  range: number;
  /** Seconds between attacks or pulses. */
  interval: number;
  fx: UnitFx;
  /** Glyph colour. */
  color: string;
}

export interface Tile {
  uid: number;
  id: UnitId;
  level: number;
  divine: boolean;
  /** Seconds until the next attack / pulse. */
  cd: number;
  /** 功德 spent to produce this tile; selling refunds a share of it. */
  invested: number;
}

export type BossTrait =
  | { t: 'revive'; times: number; pct: number }
  | { t: 'dash'; every: number; dur: number; mul: number }
  | { t: 'immune' }
  | { t: 'armor'; flat: number }
  | { t: 'regen'; pctPerSec: number };

export interface EnemyDef {
  id: string;
  /** Text drawn on the enemy token (1–2 characters). */
  glyph: string;
  name: string;
  hpK: number;
  /** Cells per second. */
  speed: number;
  bounty: number;
  /** Hearts lost when it reaches 唐僧. */
  leak: number;
  boss: boolean;
  trait?: BossTrait;
}

export interface Enemy {
  uid: number;
  def: string;
  hp: number;
  maxHp: number;
  speed: number;
  /** Distance walked along the road in cells; also the targeting priority. */
  dist: number;
  /** Board position derived from `dist` (cell units), refreshed every step. */
  x: number;
  y: number;
  slowPct: number;
  slowT: number;
  stunT: number;
  revives: number;
  /** Countdown to the next dash (黄风怪). */
  traitT: number;
  dashT: number;
  bounty: number;
  leak: number;
}

export interface SideState {
  slots: (Tile | null)[];
  enemies: Enemy[];
  gongde: number;
  hearts: number;
  drawCount: number;
  /** Draw RNG state. Both sides start from the same seed, so the n-th draw matches. */
  rng: number;
  kills: number;
  leaks: number;
}

export interface AiKnobs {
  /** Average seconds between decisions. */
  think: number;
  /** Probability that a decision is wasted or random. */
  mistake: number;
  /** Extra starting 功德 (can be negative). */
  bonus: number;
}

export interface AiState {
  knobs: AiKnobs;
  rng: number;
  /** Tick of the next decision. */
  next: number;
}

export interface Spawn {
  at: number;
  def: string;
  hp: number;
  speed: number;
  bounty: number;
  leak: number;
}

export type Action = { t: 'recruit' } | { t: 'drop'; from: number; to: number | 'sell' };

export type RecruitResult = 'ok' | 'poor' | 'full';
export type DropResult = 'merge' | 'hero' | 'divine' | 'move' | 'swap' | 'sold' | 'invalid' | 'none';

export type SimEvent =
  | { t: 'hit'; side: SideId; slot: number; x: number; y: number; unit: UnitId }
  | { t: 'kill'; side: SideId; x: number; y: number; bounty: number; boss: boolean }
  | { t: 'leak'; side: SideId; hearts: number }
  | { t: 'revive'; side: SideId; x: number; y: number }
  | { t: 'recruit'; side: SideId; slot: number; unit: UnitId }
  | { t: 'merge'; side: SideId; slot: number; level: number }
  | { t: 'hero'; side: SideId; slot: number; unit: UnitId }
  | { t: 'divine'; side: SideId; slot: number }
  | { t: 'sell'; side: SideId; slot: number; amount: number }
  | { t: 'invalid'; side: SideId; slot: number; msg: string }
  | { t: 'income'; side: SideId; slot: number; amount: number }
  | { t: 'heal'; side: SideId; slot: number }
  | { t: 'wave'; wave: number; boss: string | null; overtime: number }
  | { t: 'end'; winner: SideId; reason: EndReason };

export type Phase = 'prep' | 'waves' | 'overtime' | 'over';
export type EndReason = 'ko' | 'double_ko' | 'tiebreak';

export interface MatchState {
  seed: number;
  level: number;
  tick: number;
  phase: Phase;
  /** Regular wave number (1..10). */
  wave: number;
  /** Overtime wave number (0 = not in overtime yet). */
  overtime: number;
  nextWaveAt: number;
  /** Pending spawns, sorted by `at`. */
  spawns: Spawn[];
  sides: [SideState, SideState];
  ai: [AiState | null, AiState | null];
  /** Events produced since the current step started (read by the renderer after each step / action). */
  events: SimEvent[];
  winner: SideId | null;
  endReason: EndReason | null;
  nextUid: number;
}
