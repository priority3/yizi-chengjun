// Plain-data types shared by the deterministic simulation. Nothing here touches the DOM,
// so a whole run can be snapshotted, hashed and replayed in tests.
import type { MapData } from './map.ts';

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
  /** Whether its attacks reach flying monsters (false: 棍 and 八戒's slam only fight on the ground). */
  hitsAir: boolean;
  /** Damage multiplier against flying monsters (default 1). */
  airMul?: number;
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
  /** Hero rage 0..1; at 1 the next attack is the ultimate (always 0 for non-heroes). */
  rage: number;
}

export type BossTrait =
  | { t: 'revive'; times: number; pct: number }
  | { t: 'dash'; every: number; dur: number; mul: number }
  | { t: 'summon'; every: number; count: number; minion: string }
  | { t: 'immune' }
  | { t: 'armor'; flat: number }
  | { t: 'regen'; pctPerSec: number }
  | { t: 'split'; count: number; minion: string }
  /** Reaching the camp steals 功德 instead of biting, then the thief vanishes. */
  | { t: 'steal'; amount: number };

export interface EnemyDef {
  id: string;
  /** Character shown on the name tag / tooltips. */
  glyph: string;
  name: string;
  hpK: number;
  /** Pixels per second along the road (before MAP_SPEED). */
  speed: number;
  bounty: number;
  /** Camp damage when it reaches the end of the road (times LEAK_MUL). */
  atk: number;
  /** Body radius in world pixels. */
  radius: number;
  boss: boolean;
  elite: boolean;
  trait?: BossTrait;
  /** Flies straight from its entrance to the camp (map.flights) instead of walking the road. */
  flying?: boolean;
}

export interface Enemy {
  uid: number;
  def: string;
  hp: number;
  maxHp: number;
  /** World position, derived from `dist` along the road every tick. */
  x: number;
  y: number;
  /** Which road it walks (index into map.paths), or for a flyer which entrance's flight line (map.flights). */
  path: number;
  /**
   * A flyer (EnemyDef.flying): it follows map.flights[path], shrugs off knockback and only units with hitsAir reach it.
   * Reason: set once from the def, so hashState needn't mix it.
   */
  air: boolean;
  /** Distance travelled along the road (or flight line), in px. */
  dist: number;
  /** Sideways offset factor (-1..1) so a crowd spreads across the road. */
  side: number;
  speed: number;
  slowPct: number;
  slowT: number;
  stunT: number;
  /** Camp damage (times LEAK_MUL) if it reaches the end of the road. */
  atk: number;
  revives: number;
  /** Countdown for periodic traits (dash / summon). */
  traitT: number;
  dashT: number;
  bounty: number;
  /** Left the field without dying (reached the camp, or a thief that got away): removed, no bounty. */
  gone: boolean;
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
  /** Road to walk (index into map.paths), or the entrance a flyer takes off from (map.flights). */
  path: number;
  /** Sideways offset factor (-1..1). */
  side: number;
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
  | { t: 'start' }
  /** Pick one of the pending encounter cards. */
  | { t: 'choose'; option: number };

export type EncounterId =
  | '观音赐福'
  | '财神到'
  | '天降神字'
  | '土地公摆摊'
  | '宝箱'
  | '妖风大作'
  | '月圆之夜'
  | '狼群来袭'
  | '盗宝妖'
  | '妖王亲临';

/** Modifiers an encounter applies to the next wave. */
export interface WaveMods {
  speedMul: number;
  hpMul: number;
  bountyMul: number;
  /** Multiplies the 功德 paid when the wave is cleared. */
  bonusMul: number;
  /** Replace the minions with 1.5x as many wolves. */
  wolves: boolean;
  /** Add a 功德-stealing thief mid-wave. */
  thief: boolean;
  /** Add this boss at half HP at the end of the wave. */
  miniBoss: string | null;
}

/** Run-wide modifiers granted by equipped 法宝, read by the simulation. */
export interface RunMods {
  dmgMul: number;
  unitDmgMul: Partial<Record<UnitId, number>>;
  unitRangeMul: Partial<Record<UnitId, number>>;
  splashRadiusMul: number;
  stunMul: number;
  /** Added to execute thresholds. */
  executeBonus: number;
  rageMul: number;
  campHpBonus: number;
  /** Camp HP restored whenever a wave is cleared. */
  healOnClear: number;
  startGongde: number;
  enemySpeedMul: number;
}

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
  /** A monster reached the camp and hurt it. */
  | { t: 'leak'; x: number; y: number; dmg: number }
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
  /** `dir` is the road direction (radians) at the target, for the sweep animation. */
  | { t: 'ultimate'; hero: HeroId; cell: number; x: number; y: number; tx: number; ty: number; path: number; dir: number; targets: Array<{ x: number; y: number }> }
  | { t: 'encounterOffer'; options: EncounterId[] }
  | { t: 'encounter'; id: EncounterId }
  /** A 宝箱 opened: a card landed on `cell`, or 功德 when the camp had no room (cell -1, unit null). */
  | { t: 'chest'; cell: number; unit: UnitId | null }
  | { t: 'steal'; x: number; y: number; amount: number }
  /** `mods` is the HUD label of the encounter modifiers in force, '' for a plain wave. */
  | { t: 'waveStart'; wave: number; boss: string | null; elite: boolean; mods: string }
  | { t: 'waveClear'; wave: number; bonus: number }
  | { t: 'won' }
  | { t: 'lost' };

export interface GameState {
  seed: number;
  chapter: number;
  /** The chapter's map: roads, slots, camp. Built once per run, never mutated. */
  map: MapData;
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
  /** Pending encounter cards; shopping and the next wave wait until one is chosen. */
  encounter: EncounterId[] | null;
  /** Encounters offered so far this run (every second cleared wave). */
  encounters: number;
  /** Modifiers queued for the next wave by an encounter. */
  waveMods: WaveMods;
  /** Modifiers of the wave currently being fought (for bonus multipliers and the HUD). */
  activeMods: WaveMods;
  /** Price multiplier this build phase (土地公摆摊 = 0.5). */
  shopDiscount: number;
  freeRefresh: boolean;
  /** A 宝箱 opens after the next wave. */
  chest: boolean;
  /** 法宝 effects for this run. */
  mods: RunMods;
  /** Gameplay RNG state (shop offers, spawn positions). */
  rng: number;
  kills: number;
  /** Events produced since the current step started (read by the renderer after each step / action). */
  events: SimEvent[];
  nextUid: number;
}
