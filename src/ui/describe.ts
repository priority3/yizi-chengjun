// One-line descriptions of cards for toasts (tapping a shop card or a tile on the map), the label of a special
// pad while a card is dragged over it, and how each 瞄准 reads.
import { BEACON, COFFER_BOUNTY, SLOT_BONUS, SLOT_NAME, SPRING, TWIN_HASTE, type SlotKind } from '../config/maps.ts';
import { CURRENCY, DEFEAT, gilded, GOLD_GLYPH } from '../config/terms.ts';
import { ULTIMATES } from '../config/ultimates.ts';
import { DRUM_DMG_CAP, glyphOf, UNITS } from '../config/units.ts';
import { drumMul } from '../core/buffs.ts';
import { mirrorRate } from '../core/mirror.ts';
import { isFighter, padDamage, padRange, twinHaste } from '../core/slots.ts';
import { fxScale } from '../core/stats.ts';
import { poisonDps } from '../core/status.ts';
import type { GameState, HeroId, RunMods, TargetMode, Tile, UnitId } from '../core/types.ts';

/** How each target priority reads in toasts. */
export const AIM_LABEL: Readonly<Record<TargetMode, string>> = { first: '打最前', strong: '打最强', weak: '打最弱' };

/** Where a described card is, for the numbers only the run knows: the 鼓 beside a tile, a 镜's reflection this wave. */
export interface BoardSpot {
  g: GameState;
  /** The tile's cell, or -1 for a card still in the shop. */
  cell: number;
}

/** The 法阵 damage bonus as a percentage, e.g. 20. */
const altarPct = (): number => Math.round((SLOT_BONUS.altar.dmgMul - 1) * 100);
/** A fraction as a whole percentage, e.g. 0.15 -> 15. */
const pct = (k: number): number => Math.round(k * 100);
/** A number with at most one decimal, e.g. 4.4 or 2. */
const short = (v: number): string => String(Math.round(v * 10) / 10);

/**
 * What the pad under a fighter adds, appended inside its stats, e.g. "，法阵 +20%" or "，灵泉 2 层 +16%"; '' on plain
 * stone. `twin` is the 双生台 haste it gets right now (0 when its pair holds something else).
 */
function padNote(kind: SlotKind, t: Pick<Tile, 'id' | 'spring'>, twin: number): string {
  switch (kind) {
    case 'altar':
      return `，法阵 +${altarPct()}%`;
    case 'high':
      // Reason: 白龙 reaches the whole field already; a 高台 can't add to that.
      if (!Number.isFinite(UNITS[t.id].range)) return '';
      return UNITS[t.id].kind === 'hero' ? `，高台射程 +${SLOT_BONUS.high.range}` : `，高台 +${SLOT_BONUS.high.range}`;
    case 'spring':
      return t.spring ? `，灵泉 ${t.spring} 层 +${pct(SPRING.dmg * t.spring)}%` : '，灵泉';
    case 'twin':
      return twin > 0 ? `，双生攻速 +${pct(twin)}%` : '，双生台';
    case 'coffer':
    case 'beacon':
      return `，${SLOT_NAME[kind]}`;
    default:
      return '';
  }
}

/** What the 鼓 around a fighter add to its damage, e.g. "，鼓 +15%"; '' without any. */
const drumNote = (mul: number): string => (mul > 1 ? `，鼓 +${Math.round((mul - 1) * 100)}%` : '');

/** What a 毒 or 网 does besides its hit (`dmg` is the hit where it stands): poison per stack, the hold. */
function fxNote(t: Tile, dmg: number): string {
  const fx = UNITS[t.id].fx;
  if (fx.t === 'poison') return `，每层每秒 ${short(poisonDps(t.id, dmg))}`;
  if (fx.t === 'root') return `，定身 ${short(fx.dur * fxScale(t))} 秒`;
  return '';
}

/** A support's numbers that its blurb can't give: a 鼓's bonus at its level, a 镜's reflection in this wave. */
function supportNote(t: Tile, spot?: BoardSpot): string | null {
  const fx = UNITS[t.id].fx;
  if (fx.t === 'drum' && t.level > 1) return `现在伤害 +${Math.round(Math.min(DRUM_DMG_CAP, fx.dmg * t.level) * 100)}%、攻速 +${Math.round(fx.speed * t.level * 100)}%`;
  if (fx.t === 'mirror' && spot) return `每 1 血反弹 ${short(mirrorRate(spot.g, t))}，最多存 ${fx.cap}`;
  return null;
}

/**
 * A card's description. `pad` is the kind of pad the tile stands on (plain for shop cards): a fighter's numbers
 * then include the 法阵 / 高台 bonus or its 灵泉 layers, and the text names the pad. `spot` (the run and the tile's
 * cell) adds what the board gives: the 鼓 beside a fighter, its 双生台 pair, a 镜's reflection this wave.
 */
export function describe(t: Pick<Tile, 'id' | 'level' | 'divine' | 'spring'>, mods: RunMods, pad: SlotKind = 'plain', spot?: BoardSpot): string {
  const def = UNITS[t.id];
  const glyph = glyphOf(t.id);
  const name = `${t.divine ? gilded(glyph) : glyph}${t.level > 1 ? ` ${t.level}级` : ''}`;
  const tile: Tile = { uid: 0, cd: 0, invested: 0, rage: 0, ...t };
  const onBoard = spot !== undefined && spot.cell >= 0;
  const drum = onBoard && isFighter(t.id) ? drumMul(spot.g, spot.cell) : 1;
  const twin = onBoard ? twinHaste(spot.g, spot.cell) : 0;
  const dmg = padDamage(tile, pad, mods) * drum;
  if (def.kind === 'hero') {
    const u = ULTIMATES[t.id as HeroId];
    return `${name} · 大招「${u.name}」：${u.desc}（伤害 ${Math.round(dmg)}${padNote(pad, tile, twin)}${drumNote(drum)}）`;
  }
  if (def.kind === 'attack') {
    const range = padRange(tile, pad, mods);
    const reach = Number.isFinite(range) ? Math.round(range) : '全场';
    return `${name} · ${def.desc}（伤害 ${Math.round(dmg)}${fxNote(tile, dmg)}，射程 ${reach}${padNote(pad, tile, twin)}${drumNote(drum)}）`;
  }
  const notes = [supportNote(tile, spot), pad === 'plain' ? null : SLOT_NAME[pad]].filter((s) => s !== null);
  return `${name} · ${def.desc}${notes.length > 0 ? `（${notes.join('，')}）` : ''}`;
}

/**
 * What a special pad does for the card that would end up standing on it (`id`: the dragged card, or what it
 * combines into), shown next to the pad while dragging; null for plain stone.
 */
export function padLabel(kind: SlotKind, id: UnitId): string | null {
  const fighter = isFighter(id);
  switch (kind) {
    case 'plain':
      return null;
    case 'altar':
      return fighter ? `法阵：伤害 +${altarPct()}%` : `法阵：兵字和英雄伤害 +${altarPct()}%`;
    case 'high':
      return fighter ? `高台：射程 +${SLOT_BONUS.high.range}` : `高台：兵字和英雄射程 +${SLOT_BONUS.high.range}`;
    case 'mire':
      return fighter ? '泥沼：放不了兵字和英雄' : `泥沼：只能放辅助、碎片和${GOLD_GLYPH}`;
    case 'coffer':
      return `聚宝台：每${DEFEAT}一只 +${COFFER_BOUNTY.minion} ${CURRENCY}，Boss +${COFFER_BOUNTY.boss}`;
    case 'beacon':
      return `烽火台：周围的妖怪挨打多掉 ${pct(BEACON.amp)}%`;
    case 'twin':
      return fighter ? `双生台：两台同字，攻速各 +${pct(TWIN_HASTE)}%` : `双生台：两台放同一个兵字，攻速各 +${pct(TWIN_HASTE)}%`;
    case 'spring':
      return fighter
        ? `灵泉：每守住一波伤害 +${pct(SPRING.dmg)}%，最多 ${SPRING.max} 层`
        : `灵泉：兵字和英雄每守住一波伤害 +${pct(SPRING.dmg)}%`;
  }
}
