// A run: build phase (shop open, maybe an encounter to pick) <-> battle phase (a wave attacks) until a chapter's boss
// falls or the camp does. Endless and daily runs have no last wave: only the camp falling ends them.
import { CAMP_HP, CHAPTERS, FIRST_SHOP_ATTACKERS, startGongde, waveBonus } from '../config/chapters.ts';
import { ENDLESS_CHAPTER } from '../config/endless.ts';
import type { MapDef } from '../config/maps.ts';
import { cycleTarget, makeTile, resolveDrop, TARGET_MODES } from './board.ts';
import { DT } from './clock.ts';
import { stepCombat } from './combat.ts';
import { chooseEncounter, defaultWaveMods, encounterDue, modsLabel, offerEncounter, openChest } from './encounters.ts';
import { bestOpenSlot, buildMap } from './map.ts';
import { enraged, enragedNow, isOpenEnded, modeMap, UNLIMITED } from './modes.ts';
import { makeEnemy, moveEnemies } from './monsters.ts';
import { mixSeed } from './rng.ts';
import { buy, refresh, restock, unlock } from './shop.ts';
import { defaultMods } from './treasures.ts';
import { buildWave } from './waves.ts';
import type { Action, ActionResult, GameMode, GameState, RunMods } from './types.ts';

export interface GameOptions {
  seed: number;
  /** The chapter to play; endless and daily runs always play by chapter 10's rules, whatever is passed here. */
  chapter: number;
  /** 法宝 effects; defaults to none. The daily challenge never takes any, so everyone plays it on equal terms. */
  mods?: RunMods;
  /** Map override (tests); defaults to the mode's map (see modeMap). */
  map?: MapDef;
  /** 'chapter' (the default), 'endless', or 'daily' (then `seed` is the day, YYYYMMDD, which also picks the map). */
  mode?: GameMode;
}

export function createGame(opts: GameOptions): GameState {
  const mode = opts.mode ?? 'chapter';
  const open = isOpenEnded(mode);
  // Reason: the open-ended runs read chapter 10 wherever a chapter is read (economy, air raids, 鹏雏, encounters).
  const chapter = open ? ENDLESS_CHAPTER : opts.chapter;
  const ch = CHAPTERS[chapter - 1];
  const mods = mode === 'daily' ? defaultMods() : (opts.mods ?? defaultMods());
  const campMax = CAMP_HP + mods.campHpBonus;
  const map = buildMap(opts.map ?? modeMap(mode, chapter, opts.seed));
  const g: GameState = {
    seed: opts.seed,
    chapter,
    mode,
    map,
    tick: 0,
    phase: 'build',
    wave: 0,
    totalWaves: open ? UNLIMITED : ch.waves,
    waveTime: 0,
    gongde: startGongde(chapter) + mods.startGongde,
    campHp: campMax,
    campMax,
    unlocked: [...map.open],
    unlockCount: 0,
    slots: new Array<null>(map.slots.length).fill(null),
    enemies: [],
    projectiles: [],
    spawns: [],
    shop: [],
    refreshes: 0,
    encounter: null,
    encounters: 0,
    waveMods: defaultWaveMods(),
    activeMods: defaultWaveMods(),
    shopDiscount: 1,
    freeRefresh: false,
    chest: false,
    mods,
    rng: mixSeed(opts.seed, 7),
    kills: 0,
    events: [],
    nextUid: 1,
  };
  // Every chapter starts with one free 箭 on the slot that sees the most road, and a shop with attack cards.
  // Reason: a map from the editor may have no open pad a fighter can stand on; it then starts without the 箭.
  const start = bestOpenSlot(map);
  if (start >= 0) g.slots[start] = makeTile(g, '箭', 0);
  restock(g, FIRST_SHOP_ATTACKERS);
  return g;
}

function startWave(g: GameState): ActionResult {
  g.wave++;
  g.shopDiscount = 1;
  g.freeRefresh = false;
  const plan = buildWave(g, g.wave);
  g.spawns = plan.spawns;
  g.waveTime = 0;
  g.phase = 'battle';
  g.events.push({ t: 'waveStart', wave: g.wave, boss: plan.boss, elite: plan.elite, mods: modsLabel(plan.mods) });
  return 'ok';
}

/** Applies a player (or bot) action immediately. Events it produces are appended to `g.events`. */
export function act(g: GameState, a: Action): ActionResult {
  if (g.phase === 'won' || g.phase === 'lost') return 'phase';
  // Reason: a pending encounter must be answered before the shop reopens or the next wave starts; rearranging the
  // board (drops, 瞄准) is fine meanwhile.
  if (g.encounter && a.t !== 'choose' && a.t !== 'drop' && a.t !== 'mode') return 'phase';
  switch (a.t) {
    case 'buy':
      return g.phase === 'build' ? buy(g, a.offer, a.cell) : 'phase';
    case 'refresh':
      return g.phase === 'build' ? refresh(g) : 'phase';
    case 'start':
      return g.phase === 'build' ? startWave(g) : 'phase';
    case 'choose':
      return chooseEncounter(g, a.option);
    case 'unlock':
      return unlock(g, a.cell);
    case 'drop':
      return resolveDrop(g, a.from, a.to);
    case 'mode':
      return cycleTarget(g, a.cell);
  }
}

function endWave(g: GameState): void {
  g.projectiles.length = 0;
  if (g.totalWaves !== UNLIMITED && g.wave >= g.totalWaves) {
    g.phase = 'won';
    g.events.push({ t: 'won' });
    return;
  }
  const bonus = Math.round(waveBonus(g.wave, g.chapter) * g.activeMods.bonusMul);
  g.gongde += bonus;
  if (g.mods.healOnClear > 0 && g.campHp < g.campMax) {
    const amount = Math.min(g.mods.healOnClear, g.campMax - g.campHp);
    g.campHp += amount;
    g.events.push({ t: 'heal', cell: -1, amount });
  }
  g.phase = 'build';
  g.refreshes = 0;
  restock(g);
  g.events.push({ t: 'waveClear', wave: g.wave, bonus });
  if (g.chest) openChest(g);
  if (encounterDue(g.wave, g.totalWaves)) offerEncounter(g);
}

/** Advances the run by one fixed tick (1/60 s). Nothing moves during the build phase. */
export function step(g: GameState): void {
  g.events.length = 0;
  g.tick++;
  if (g.phase !== 'battle') return;
  g.waveTime += DT;
  while (g.spawns.length > 0 && g.spawns[0].at <= g.waveTime) {
    const s = g.spawns.shift();
    if (s) g.enemies.push(makeEnemy(g, s.def, s.path, s.hp, s.speed, s.bounty, 0, s.side));
  }
  moveEnemies(g);
  stepCombat(g);
  // A berserk endless wave (enraged): whatever this tick's attacks stunned, slowed or netted walks on next tick.
  // Reason: nets too, though they hold bosses fully: the berserk exists to end waves a board could hold forever.
  if (enraged(g)) {
    if (enragedNow(g)) g.events.push({ t: 'enrage' });
    for (const e of g.enemies) {
      e.stunT = 0;
      e.slowT = 0;
      e.slowPct = 0;
      e.rootT = 0;
    }
  }
  if (g.campHp <= 0) {
    g.phase = 'lost';
    g.events.push({ t: 'lost' });
    return;
  }
  if (g.spawns.length === 0 && g.enemies.length === 0) endWave(g);
}

/** FNV-1a hash of the gameplay-relevant state; equal hashes mean identical runs. */
export function hashState(g: GameState): number {
  let h = 0x811c9dc5;
  const mix = (n: number) => {
    h ^= n | 0;
    h = Math.imul(h, 0x01000193);
  };
  const mixText = (s: string) => {
    for (const ch of s) mix(ch.charCodeAt(0));
  };
  // Reason: only the open-ended modes are mixed in, so every chapter run keeps the hash it always had.
  if (g.mode !== 'chapter') mixText(g.mode);
  mix(g.tick);
  mix(g.wave);
  mix(g.gongde);
  mix(Math.round(g.campHp * 100));
  mix(g.campMax);
  mix(g.kills);
  mix(g.rng);
  mix(g.unlockCount);
  mix(g.encounters);
  mix(Math.round(g.shopDiscount * 100));
  mix(g.chest ? 1 : 0);
  for (const id of g.encounter ?? []) mixText(id);
  const m = g.waveMods;
  mix(Math.round(m.speedMul * 100));
  mix(Math.round(m.hpMul * 100));
  mix((m.wolves ? 1 : 0) + (m.thief ? 2 : 0));
  if (m.miniBoss) mixText(m.miniBoss);
  for (const t of g.slots) {
    if (!t) {
      mix(-1);
      continue;
    }
    mixText(t.id);
    mix(t.level);
    mix(t.divine ? 1 : 0);
    mix(Math.round(t.rage * 100));
    mix(TARGET_MODES.indexOf(t.target ?? 'first'));
    // Reason: only once a 镜 has caught something, so every other board hashes as it always did.
    if (t.charge) mix(Math.round(t.charge * 100));
  }
  for (const e of g.enemies) {
    mix(e.uid);
    mix(Math.round(e.hp * 100));
    mix(Math.round(e.dist * 100));
    // Poison and nets only when present, likewise.
    if (e.poison) {
      mix(e.poison.stacks);
      mix(Math.round(e.poison.t * 100));
      mix(Math.round(e.poison.dps * 100));
    }
    if (e.rootT > 0) mix(Math.round(e.rootT * 100));
  }
  for (const o of g.shop) mixText(o.id);
  return h >>> 0;
}
