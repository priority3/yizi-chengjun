// Enemy table: minions shared by every level plus two bosses per level.
import type { BossTrait, EnemyDef } from '../core/types.ts';

export const BASE_HP = 30;
/** Per-wave growth factors. */
export const HP_GROWTH = 1.15;
export const SPEED_GROWTH = 0.02;
export const BOUNTY_GROWTH = 0.1;

const minion = (id: string, name: string, hpK: number, speed: number, bounty: number): EnemyDef => ({
  id,
  glyph: id,
  name,
  hpK,
  speed,
  bounty,
  leak: 1,
  boss: false,
});

const boss = (id: string, glyph: string, hpK: number, speed: number, bounty: number, trait?: BossTrait): EnemyDef => ({
  id,
  glyph,
  name: id,
  hpK,
  speed,
  bounty,
  leak: 2,
  boss: true,
  trait,
});

export const ENEMIES: Record<string, EnemyDef> = {
  妖: minion('妖', '小妖', 1, 1.0, 5),
  狼: minion('狼', '狼妖', 0.6, 1.7, 4),
  熊: minion('熊', '熊怪', 3, 0.6, 12),
  黑熊精: boss('黑熊精', '黑熊', 10, 0.5, 60),
  白骨精: boss('白骨精', '白骨', 16, 0.45, 120, { t: 'revive', times: 2, pct: 0.35 }),
  虎先锋: boss('虎先锋', '虎', 10, 0.5, 60),
  黄风怪: boss('黄风怪', '黄风', 16, 0.45, 120, { t: 'dash', every: 5, dur: 1, mul: 2 }),
  银角: boss('银角', '银角', 10, 0.5, 60),
  红孩儿: boss('红孩儿', '红孩', 16, 0.45, 120, { t: 'immune' }),
  铁扇公主: boss('铁扇公主', '铁扇', 10, 0.5, 60),
  牛魔王: boss('牛魔王', '牛魔', 16, 0.45, 120, { t: 'armor', flat: 20 }),
  青狮: boss('青狮', '青狮', 10, 0.5, 60),
  金翅大鹏: boss('金翅大鹏', '大鹏', 16, 0.7, 120, { t: 'regen', pctPerSec: 0.015 }),
};

/** One-line description of a boss trait for banners. */
export function traitText(def: EnemyDef): string {
  const tr = def.trait;
  if (!tr) return '皮糙肉厚';
  switch (tr.t) {
    case 'revive':
      return `倒下后会复活 ${tr.times} 次`;
    case 'dash':
      return `每 ${tr.every} 秒突然加速`;
    case 'immune':
      return '免疫减速';
    case 'armor':
      return `每次受击减伤 ${tr.flat}`;
    case 'regen':
      return '跑得快，还会回血';
  }
}
