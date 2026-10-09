// One-line descriptions of cards for toasts (tapping a shop card or a tile on the map), the label of a special
// pad while a card is dragged over it, and how each 瞄准 reads.
import { SLOT_BONUS, SLOT_NAME, type SlotKind } from '../config/maps.ts';
import { ULTIMATES } from '../config/ultimates.ts';
import { UNITS } from '../config/units.ts';
import { isFighter, padDamage, padRange } from '../core/slots.ts';
import type { HeroId, RunMods, TargetMode, Tile, UnitId } from '../core/types.ts';

/** How each target priority reads in toasts. */
export const AIM_LABEL: Readonly<Record<TargetMode, string>> = { first: '打最前', strong: '打最强', weak: '打最弱' };

/** The 法阵 damage bonus as a percentage, e.g. 20. */
const altarPct = (): number => Math.round((SLOT_BONUS.altar.dmgMul - 1) * 100);

/** What the pad under a fighter adds, appended inside its stats, e.g. "，法阵 +20%"; '' on plain stone. */
function padNote(kind: SlotKind, id: UnitId): string {
  if (kind === 'altar') return `，法阵 +${altarPct()}%`;
  // Reason: 白龙 reaches the whole field already; a 高台 can't add to that.
  if (kind === 'high' && Number.isFinite(UNITS[id].range)) return UNITS[id].kind === 'hero' ? `，高台射程 +${SLOT_BONUS.high.range}` : `，高台 +${SLOT_BONUS.high.range}`;
  return '';
}

/**
 * A card's description. `pad` is the kind of pad the tile stands on (plain for shop cards): a fighter's numbers
 * then include the 法阵 / 高台 bonus, which the text names.
 */
export function describe(t: Pick<Tile, 'id' | 'level' | 'divine'>, mods: RunMods, pad: SlotKind = 'plain'): string {
  const def = UNITS[t.id];
  const name = `${t.divine ? '神' : ''}${t.id}${t.level > 1 ? ` ${t.level}级` : ''}`;
  const tile: Tile = { uid: 0, cd: 0, invested: 0, rage: 0, ...t };
  if (def.kind === 'hero') {
    const u = ULTIMATES[t.id as HeroId];
    return `${name} · 大招「${u.name}」：${u.desc}（伤害 ${Math.round(padDamage(tile, pad, mods))}${padNote(pad, t.id)}）`;
  }
  if (def.kind === 'attack') {
    const range = padRange(tile, pad, mods);
    const reach = Number.isFinite(range) ? Math.round(range) : '全场';
    return `${name} · ${def.desc}（伤害 ${Math.round(padDamage(tile, pad, mods))}，射程 ${reach}${padNote(pad, t.id)}）`;
  }
  return `${name} · ${def.desc}${pad === 'plain' ? '' : `（${SLOT_NAME[pad]}）`}`;
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
      return fighter ? '泥沼：放不了兵字和英雄' : '泥沼：只能放辅助、碎片和神';
  }
}
