// One-line descriptions of cards for toasts (tapping a shop card or a tile on the map), the label of a special
// pad while a card is dragged over it, and how each 瞄准 reads, in Chinese or English (i18n/lang.ts).
import { BEACON, COFFER_BOUNTY, SLOT_BONUS, SPRING, TWIN_HASTE, type SlotKind } from '../config/maps.ts';
import { CURRENCY, DEFEAT, GOLD_GLYPH } from '../config/terms.ts';
import { DRUM_DMG_CAP, UNITS } from '../config/units.ts';
import { drumMul } from '../core/buffs.ts';
import { mirrorRate } from '../core/mirror.ts';
import { isFighter, padDamage, padRange, twinHaste } from '../core/slots.ts';
import { fxScale } from '../core/stats.ts';
import { poisonDps } from '../core/status.ts';
import type { GameState, HeroId, RunMods, TargetMode, Tile, UnitId } from '../core/types.ts';
import { isEn, tr } from '../i18n/lang.ts';
import { gildedName, padName, ultimateDesc, ultimateName, unitDesc, unitName } from '../i18n/names.ts';

/** How each target priority reads in toasts. */
export const AIM_LABEL: Readonly<Record<TargetMode, string>> = { first: '打最前', strong: '打最强', weak: '打最弱' };
const AIM_LABEL_EN: Readonly<Record<TargetMode, string>> = { first: 'First', strong: 'Strongest', weak: 'Weakest' };

/** A target priority in the current language. */
export function aimLabel(mode: TargetMode): string {
  return isEn() ? AIM_LABEL_EN[mode] : AIM_LABEL[mode];
}

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
/** What starts each note inside a description's brackets: "，" in Chinese, ", " in English. */
const sep = (): string => tr('，', ', ');

/**
 * What the pad under a fighter adds, appended inside its stats, e.g. "，法阵 +20%" or "，灵泉 2 层 +16%" (", Rune
 * Circle +20%"); '' on plain stone. `twin` is the 双生台 haste it gets right now (0 when its pair holds something else).
 */
function padNote(kind: SlotKind, t: Pick<Tile, 'id' | 'spring'>, twin: number): string {
  const name = padName(kind);
  switch (kind) {
    case 'altar':
      return `${sep()}${name} +${altarPct()}%`;
    case 'high':
      // Reason: 白龙 reaches the whole field already; a 高台 can't add to that.
      if (!Number.isFinite(UNITS[t.id].range)) return '';
      if (UNITS[t.id].kind !== 'hero') return `${sep()}${name} +${SLOT_BONUS.high.range}`;
      return tr(`，高台射程 +${SLOT_BONUS.high.range}`, `, ${name} range +${SLOT_BONUS.high.range}`);
    case 'spring':
      if (!t.spring) return `${sep()}${name}`;
      return tr(`，灵泉 ${t.spring} 层 +${pct(SPRING.dmg * t.spring)}%`, `, ${name} ×${t.spring} +${pct(SPRING.dmg * t.spring)}%`);
    case 'twin':
      return twin > 0 ? tr(`，双生攻速 +${pct(twin)}%`, `, twin speed +${pct(twin)}%`) : `${sep()}${name}`;
    case 'coffer':
    case 'beacon':
      return `${sep()}${name}`;
    default:
      return '';
  }
}

/** What the 鼓 around a fighter add to its damage, e.g. "，鼓 +15%" (", Drum +15%"); '' without any. */
const drumNote = (mul: number): string => (mul > 1 ? `${sep()}${unitName('鼓')} +${Math.round((mul - 1) * 100)}%` : '');

/** What a 毒 or 网 does besides its hit (`dmg` is the hit where it stands): poison per stack, the hold. */
function fxNote(t: Tile, dmg: number): string {
  const fx = UNITS[t.id].fx;
  if (fx.t === 'poison') return tr(`，每层每秒 ${short(poisonDps(t.id, dmg))}`, `, ${short(poisonDps(t.id, dmg))}/s per stack`);
  if (fx.t === 'root') return tr(`，定身 ${short(fx.dur * fxScale(t))} 秒`, `, holds ${short(fx.dur * fxScale(t))} s`);
  return '';
}

/** A support's numbers that its blurb can't give: a 鼓's bonus at its level, a 镜's reflection in this wave. */
function supportNote(t: Tile, spot?: BoardSpot): string | null {
  const fx = UNITS[t.id].fx;
  if (fx.t === 'drum' && t.level > 1) {
    const dmg = Math.round(Math.min(DRUM_DMG_CAP, fx.dmg * t.level) * 100);
    const speed = Math.round(fx.speed * t.level * 100);
    return tr(`现在伤害 +${dmg}%、攻速 +${speed}%`, `now +${dmg}% damage, +${speed}% speed`);
  }
  if (fx.t === 'mirror' && spot) {
    const rate = short(mirrorRate(spot.g, t));
    return tr(`每 1 血反弹 ${rate}，最多存 ${fx.cap}`, `throws back ${rate} per 1 HP lost, stores up to ${fx.cap}`);
  }
  return null;
}

/**
 * A card's description. `pad` is the kind of pad the tile stands on (plain for shop cards): a fighter's numbers
 * then include the 法阵 / 高台 bonus or its 灵泉 layers, and the text names the pad. `spot` (the run and the tile's
 * cell) adds what the board gives: the 鼓 beside a fighter, its 双生台 pair, a 镜's reflection this wave.
 */
export function describe(t: Pick<Tile, 'id' | 'level' | 'divine' | 'spring'>, mods: RunMods, pad: SlotKind = 'plain', spot?: BoardSpot): string {
  const def = UNITS[t.id];
  const plain = unitName(t.id);
  const name = `${t.divine ? gildedName(plain) : plain}${t.level > 1 ? tr(` ${t.level}级`, ` Lv${t.level}`) : ''}`;
  const tile: Tile = { uid: 0, cd: 0, invested: 0, rage: 0, ...t };
  const onBoard = spot !== undefined && spot.cell >= 0;
  const drum = onBoard && isFighter(t.id) ? drumMul(spot.g, spot.cell) : 1;
  const twin = onBoard ? twinHaste(spot.g, spot.cell) : 0;
  const dmg = padDamage(tile, pad, mods) * drum;
  if (def.kind === 'hero') {
    const hero = t.id as HeroId;
    const notes = `${Math.round(dmg)}${padNote(pad, tile, twin)}${drumNote(drum)}`;
    return tr(
      `${name} · 大招「${ultimateName(hero)}」：${ultimateDesc(hero)}（伤害 ${notes}）`,
      `${name} · Ultimate "${ultimateName(hero)}": ${ultimateDesc(hero)} (damage ${notes})`,
    );
  }
  if (def.kind === 'attack') {
    const range = padRange(tile, pad, mods);
    const reach = Number.isFinite(range) ? String(Math.round(range)) : tr('全场', 'all');
    const after = `${padNote(pad, tile, twin)}${drumNote(drum)}`;
    return tr(
      `${name} · ${def.desc}（伤害 ${Math.round(dmg)}${fxNote(tile, dmg)}，射程 ${reach}${after}）`,
      `${name} · ${unitDesc(t.id)} (damage ${Math.round(dmg)}${fxNote(tile, dmg)}, range ${reach}${after})`,
    );
  }
  const notes = [supportNote(tile, spot), pad === 'plain' ? null : padName(pad)].filter((s) => s !== null);
  return `${name} · ${unitDesc(t.id)}${notes.length > 0 ? tr(`（${notes.join('，')}）`, ` (${notes.join(', ')})`) : ''}`;
}

/**
 * What a special pad does for the card that would end up standing on it (`id`: the dragged card, or what it
 * combines into), shown next to the pad while dragging; null for plain stone.
 */
export function padLabel(kind: SlotKind, id: UnitId): string | null {
  return isEn() ? padLabelEn(kind, isFighter(id)) : padLabelZh(kind, isFighter(id));
}

function padLabelZh(kind: SlotKind, fighter: boolean): string | null {
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

function padLabelEn(kind: SlotKind, fighter: boolean): string | null {
  switch (kind) {
    case 'plain':
      return null;
    case 'altar':
      return fighter ? `Rune Circle: damage +${altarPct()}%` : `Rune Circle: fighters and heroes +${altarPct()}% damage`;
    case 'high':
      return fighter ? `High Ground: range +${SLOT_BONUS.high.range}` : `High Ground: fighters and heroes +${SLOT_BONUS.high.range} range`;
    case 'mire':
      return fighter ? 'Mire: no fighters or heroes' : 'Mire: supports, fragments and Gold only';
    case 'coffer':
      return `Coffer: +${COFFER_BOUNTY.minion} coins per monster defeated, boss +${COFFER_BOUNTY.boss}`;
    case 'beacon':
      return `Beacon: monsters around take ${pct(BEACON.amp)}% more damage`;
    case 'twin':
      return fighter ? `Twin Pad: same glyph on both, +${pct(TWIN_HASTE)}% speed each` : `Twin Pad: same fighter on both, +${pct(TWIN_HASTE)}% speed each`;
    case 'spring':
      return fighter
        ? `Spirit Spring: +${pct(SPRING.dmg)}% damage per wave held, up to ${SPRING.max} layers`
        : `Spirit Spring: fighters and heroes +${pct(SPRING.dmg)}% damage per wave held`;
  }
}
