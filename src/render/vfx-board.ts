// Visual effects of the events about the pads and the purse: buying and unlocking, the 宝箱, merging, awakening a
// hero, 鎏金, selling, a refused drop, a new 瞄准, and the pay-outs of 钱 and 疗 (whose squads lift what they hold).
// Split out of vfx.ts, which handles the fighting and the banners.
import { ULTIMATES } from '../config/ultimates.ts';
import { glyphOf, UNITS } from '../config/units.ts';
import { CURRENCY } from '../config/terms.ts';
import type { HeroId, SimEvent } from '../core/types.ts';
import { COLORS } from './draw.ts';
import type { Vfx } from './vfx.ts';

/** Plays the effect of `e` if it is one of the board and purse events; returns whether it was. */
export function boardEvent(v: Vfx, e: SimEvent): boolean {
  switch (e.t) {
    case 'buy':
    case 'unlock': {
      v.pops[e.cell] = 0.25;
      const p = v.cell(e.cell);
      v.burst(p.x, p.y + 18, 6, 'dot', 'rgba(170,130,80,0.7)', 70, 2.6, 0.35);
      return true;
    }
    case 'chest': {
      const p = v.cell(e.cell);
      v.burst(p.x, p.y, 12, 'coin', '', 130, 3.5, 0.8, 160);
      if (e.cell >= 0 && e.unit) {
        v.pops[e.cell] = 0.4;
        v.add('burst', p.x, p.y, 0, 0, '#ffd27a', 60, 0.5);
        v.float(p.x, p.y - 30, `宝箱 · ${glyphOf(e.unit)}`, '#fff1c2', 15, true, 1.2);
      } else {
        v.float(p.x, p.y - 40, `宝箱 · +30 ${CURRENCY}`, COLORS.gold, 15, true, 1.2);
      }
      return true;
    }
    case 'merge': {
      v.pops[e.cell] = 0.32;
      const p = v.cell(e.cell);
      v.add('ring', p.x, p.y, 0, 0, COLORS.gold, 40, 0.45);
      v.burst(p.x, p.y, 10, 'star', '#ffe27a', 110, 3.5, 0.6);
      v.float(p.x, p.y - 26, `${e.level}级`, '#fff1c2', 16, true);
      return true;
    }
    case 'hero': {
      v.pops[e.cell] = 0.5;
      const p = v.cell(e.cell);
      v.add('ring', p.x, p.y, 0, 0, '#ff8a3a', 70, 0.7);
      v.add('burst', p.x, p.y, 0, 0, '#ffd27a', 70, 0.5);
      v.burst(p.x, p.y, 18, 'star', '#ffd27a', 170, 4.5, 0.9);
      const hero = e.unit as HeroId;
      v.showBanner(`${hero} 觉醒！`, `${UNITS[hero].desc} · 大招：${ULTIMATES[hero].name}`, '#ffd166', hero, 2);
      v.shake = Math.max(v.shake, 3);
      return true;
    }
    case 'divine': {
      v.pops[e.cell] = 0.45;
      const p = v.cell(e.cell);
      v.add('seal', p.x + 12, p.y + 12, 0, 0, '#c8001f', 0, 0.9);
      v.burst(p.x, p.y, 14, 'star', '#ffcf4a', 130, 3.5, 0.7);
      return true;
    }
    case 'sell': {
      const p = v.cell(e.cell);
      v.float(p.x, p.y - 8, `+${e.amount}`, COLORS.gold, 14);
      v.burst(p.x, p.y, 5, 'coin', '', 70, 3, 0.5, 120);
      return true;
    }
    case 'invalid':
      v.shakes[e.cell] = 0.3;
      return true;
    case 'mode':
      // The card bobs as it turns to its new 瞄准.
      v.pops[e.cell] = 0.18;
      return true;
    case 'income': {
      v.troops.pulse(e.cell);
      const p = v.cell(e.cell);
      v.float(p.x, p.y - 20, `+${e.amount}`, COLORS.gold, 12);
      return true;
    }
    case 'heal': {
      v.troops.pulse(e.cell);
      const p = v.cell(e.cell);
      v.float(p.x, p.y - 20, `+${e.amount}`, COLORS.heal, 13);
      v.burst(p.x, p.y, 6, 'star', '#8ff0a0', 60, 2.6, 0.5);
      return true;
    }
    default:
      return false;
  }
}
