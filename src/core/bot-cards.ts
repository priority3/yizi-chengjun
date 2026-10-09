// How the balance bot (core/bot.ts) values the B5 cards whose worth isn't their own damage: a 网 is utility (it holds
// the monster in front but barely hurts it), a 鼓 is worth what it adds to the fighters beside it, and a 镜 what the
// camp is losing. Values are in tileValue's units, roughly damage per second.
import { DRUM_DMG_CAP, HASTE_CAP, UNITS } from '../config/units.ts';
import { isFighter } from './slots.ts';
import { poisonPerHit, tileDps, tileInterval } from './stats.ts';
import type { GameState, Tile, UnitId } from './types.ts';
import { isBossWave, isEliteWave } from './waves.ts';

/** What the bot reckons any support is worth per level (速, 钱, 疗; a 镜 starts from it too). */
export const SUPPORT_VALUE = 12;
/** A 网's worth per level: a little below a plain 箭 (about 10.7), when the bot wants one at all (see wantsNet). */
export const NET_VALUE = 8;

/**
 * Whether the bot would buy the 网 `id`: one net, and only with a boss or the elite coming next.
 * Reason: in `pnpm sim` every net the bot kept on the board cost it wins (a cell and 功德 that a fighter would have
 * used better); the one thing a net does that nothing else does is hold a boss for its full time.
 */
export function wantsNet(g: GameState, id: UnitId): boolean {
  if (g.slots.some((t) => t?.id === id)) return false;
  const next = g.wave + 1;
  return isBossWave(g, next) || isEliteWave(g, next);
}
/** A 镜's worth per level, as a share of SUPPORT_VALUE: `calm` with a full camp, plus `hurt` times the share of HP lost. */
export const MIRROR_VALUE = { calm: 0.5, hurt: 1.5 } as const;
/**
 * Share of a needle's full poison (poisonPerHit) the bot counts on. Reason: a stack only pays in full on a monster
 * that lives through it; measured over bot runs (`pnpm sim`), 毒's poison dealt about half its nominal damage.
 */
export const POISON_SHARE = 0.5;

/** A 毒's poison as damage per second over time, at the share the bot can count on (0 for any other tile). */
export function poisonValue(t: Tile): number {
  const iv = tileInterval(t);
  return iv > 0 ? (POISON_SHARE * poisonPerHit(t)) / iv : 0;
}

/**
 * The damage per second a 鼓 of `level` on `cell` would add to the fighters within its reach (0 with none there).
 * Reason: the caps are counted as if no other 鼓 or 速 were near, so this stays a rough upper bound, like tileValue.
 */
export function drumValue(g: GameState, cell: number, level: number): number {
  const fx = UNITS['鼓'].fx;
  if (fx.t !== 'drum' || cell < 0) return 0;
  const gain = (1 + Math.min(DRUM_DMG_CAP, fx.dmg * level)) * (1 + Math.min(HASTE_CAP, fx.speed * level)) - 1;
  let sum = 0;
  for (const j of g.map.adj[cell]) {
    const t = g.slots[j];
    if (t && isFighter(t.id)) sum += tileDps(t) * gain;
  }
  return sum;
}

/** A 镜 of `level` in this run: little while the camp is whole, up to four times that once it has been bled. */
export function mirrorValue(g: GameState, level: number): number {
  const hurt = g.campMax > 0 ? 1 - g.campHp / g.campMax : 0;
  return SUPPORT_VALUE * level * (MIRROR_VALUE.calm + MIRROR_VALUE.hurt * hurt);
}

/**
 * What buying `card` onto the empty `cell` is worth, where that depends on the board (鼓) or the run (镜); null for
 * every other card, which tileValue rates on its own.
 */
export function placedValue(g: GameState, card: Tile, cell: number): number | null {
  const fx = UNITS[card.id].fx;
  if (fx.t === 'drum') return drumValue(g, cell, card.level);
  if (fx.t === 'mirror') return mirrorValue(g, card.level);
  return null;
}
