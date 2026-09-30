// Plain-data types shared by the deterministic simulation. Nothing here touches the DOM,
// so a whole run can be snapshotted, hashed and replayed in tests.

export type AttackId = '棍' | '箭' | '火' | '冰' | '雷';
export type SupportId = '速' | '钱' | '疗';
export type FragId = '悟' | '空' | '八' | '戒' | '沙' | '僧' | '白' | '龙';
export type HeroId = '悟空' | '八戒' | '沙僧' | '白龙';
export type UnitId = AttackId | SupportId | FragId | HeroId | '神';

export type UnitKind = 'attack' | 'hero' | 'support' | 'fragment' | 'divine';

/**
 * How an attack is delivered. Projectile shots travel and deal damage on arrival;
 * the others resolve instantly (the renderer still animates them).
 */
export type ShotKind = 'arrow' | 'fire' | 'ice' | 'crescent' | 'swing' | 'bolt' | 'beam' | 'slam' | 'dragon' | 'none';

export type UnitFx =
  | { t: 'none' }
  | { t: 'splash'; radius: number; pct: number }
  | { t: 'slow'; pct: number; dur: number }
  | { t: 'stun'; radius: number; dur: number }
  | { t: 'beam'; width: number; count: number }
  | { t: 'execute'; pct: number; bossPct: number }
  | { t: 'global' }
  | { t: 'haste'; pct: number }
  | { t: 'income'; amount: number }
  | { t: 'heal'; amount: number };

export interface UnitDef {
  id: UnitId;
  kind: UnitKind;
  /** Short role label for tooltips, e.g. 远程. */
  label: string;
  desc: string;
  /** Shop price in 功德. */
  price: number;
  /** Level-1 damage per hit (0 for tiles that never attack). */
  dmg: number;
  /** Attack range in world pixels; Infinity means the whole field. */
  range: number;
  /** Seconds between attacks or pulses. */
  interval: number;
  shot: ShotKind;
  /** Projectile speed in px/s (projectile shots only). */
  projSpeed: number;
  /** Pixels an enemy is pushed back per hit. */
  knockback: number;
  fx: UnitFx;
  /** Glyph colour on the card. */
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
  | { t: 'summon'; every: number; count: number; minion: string }
  | { t: 'immune' }
  | { t: 'armor'; flat: number }
  | { t: 'regen'; pctPerSec: number }
  | { t: 'split'; count: number; minion: string };

export interface EnemyDef {
  id: string;
  /** Character shown on the name tag / tooltips. */
  glyph: string;
  name: string;
  hpK: number;
  /** Pixels per second. */
  speed: number;
  bounty: number;
  /** Damage dealt to the camp per attack. */
  atk: number;
  atkInterval: number;
  /** Body radius in world pixels. */
  radius: number;
  boss: boolean;
  elite: boolean;
  trait?: BossTrait;
}

/** 0 = comes through the top gate, 1 = through the bottom gate. */
export type Lane = 0 | 1;

export interface Enemy {
  uid: number;
  def: string;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  lane: Lane;
  /** y at which it stops in front of the camp and starts attacking. */
  stopY: number;
  speed: number;
  slowPct: number;
  slowT: number;
  stunT: number;
  atk: number;
  /** Countdown to the next attack on the camp. */
  atkT: number;
  revives: number;
  /** Countdown for periodic traits (dash / summon). */
  traitT: number;
  dashT: number;
  bounty: number;
}

export interface Projectile {
  uid: number;
  kind: ShotKind;
  unit: UnitId;
  cell: number;
  x: number;
  y: number;
  /** Target enemy uid; it keeps flying to the last known position if the target dies. */
  target: number;
  tx: number;
  ty: number;
  speed: number;
  dmg: number;
  /** Effect multiplier of the tile that fired it (level / 神). */
  fxK: number;
  divine: boolean;
}

export interface Spawn {
  /** Seconds after the wave started. */
  at: number;
  def: string;
  lane: Lane;
  /** Horizontal spawn position (world px). */
  x: number;
  hp: number;
  speed: number;
  bounty: number;
}

export interface ShopOffer {
  id: UnitId;
  price: number;
  sold: boolean;
}

export type Phase = 'build' | 'battle' | 'won' | 'lost';

export type Action =
  | { t: 'buy'; offer: number; cell: number }
  | { t: 'drop'; from: number; to: number | 'sell' }
  | { t: 'refresh' }
  | { t: 'unlock'; cell: number }
  | { t: 'start' };

export type ActionResult =
  | 'ok'
  | 'merge'
  | 'hero'
  | 'divine'
  | 'move'
  | 'swap'
  | 'sold'
  | 'poor'
  | 'locked'
  | 'occupied'
  | 'invalid'
  | 'phase'
  | 'none';

export type SimEvent =
  | { t: 'shot'; kind: ShotKind; unit: UnitId; cell: number; x: number; y: number; tx: number; ty: number; divine: boolean }
  | { t: 'hit'; uid: number; x: number; y: number; unit: UnitId; dmg: number }
  | { t: 'impact'; kind: ShotKind; unit: UnitId; x: number; y: number }
  | { t: 'kill'; def: string; x: number; y: number; bounty: number }
  | { t: 'campHit'; x: number; y: number; dmg: number }
  | { t: 'revive'; x: number; y: number }
  | { t: 'split'; x: number; y: number }
  | { t: 'summon'; x: number; y: number }
  | { t: 'execute'; x: number; y: number }
  | { t: 'buy'; cell: number; unit: UnitId }
  | { t: 'merge'; cell: number; level: number }
  | { t: 'hero'; cell: number; unit: UnitId; from: number }
  | { t: 'divine'; cell: number }
  | { t: 'sell'; cell: number; amount: number }
  | { t: 'invalid'; cell: number; msg: string }
  | { t: 'income'; cell: number; amount: number }
  | { t: 'heal'; cell: number; amount: number }
  | { t: 'unlock'; cell: number }
  | { t: 'refresh' }
  | { t: 'waveStart'; wave: number; boss: string | null; elite: boolean }
  | { t: 'waveClear'; wave: number; bonus: number }
  | { t: 'won' }
  | { t: 'lost' };

export interface GameState {
  seed: number;
  chapter: number;
  tick: number;
  phase: Phase;
  /** Current wave (1-based) during battle; waves already cleared during build. */
  wave: number;
  totalWaves: number;
  /** Seconds since the current wave started. */
  waveTime: number;
  gongde: number;
  campHp: number;
  campMax: number;
  unlocked: boolean[];
  /** Extra cells bought so far (drives the unlock price). */
  unlockCount: number;
  slots: (Tile | null)[];
  enemies: Enemy[];
  projectiles: Projectile[];
  /** Pending spawns of the current wave, sorted by `at`. */
  spawns: Spawn[];
  shop: ShopOffer[];
  /** Refreshes used in the current build phase (drives the refresh price). */
  refreshes: number;
  /** Gameplay RNG state (shop offers, spawn positions). */
  rng: number;
  kills: number;
  /** Events produced since the current step started (read by the renderer after each step / action). */
  events: SimEvent[];
  nextUid: number;
}
