// One-line descriptions of cards for toasts (tapping a shop card or a tile on the map).
import { ULTIMATES } from '../config/ultimates.ts';
import { UNITS } from '../config/units.ts';
import { tileDamage, tileRange } from '../core/stats.ts';
import type { HeroId, RunMods, Tile } from '../core/types.ts';

export function describe(t: Pick<Tile, 'id' | 'level' | 'divine'>, mods: RunMods): string {
  const def = UNITS[t.id];
  const name = `${t.divine ? '神' : ''}${t.id}${t.level > 1 ? ` ${t.level}级` : ''}`;
  const tile: Tile = { uid: 0, cd: 0, invested: 0, rage: 0, ...t };
  if (def.kind === 'hero') {
    const u = ULTIMATES[t.id as HeroId];
    return `${name} · 大招「${u.name}」：${u.desc}（伤害 ${Math.round(tileDamage(tile, mods))}）`;
  }
  if (def.kind === 'attack') {
    const range = tileRange(tile, mods);
    return `${name} · ${def.desc}（伤害 ${Math.round(tileDamage(tile, mods))}，射程 ${Number.isFinite(range) ? Math.round(range) : '全场'}）`;
  }
  return `${name} · ${def.desc}`;
}
