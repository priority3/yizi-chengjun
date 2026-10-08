// Enemy table: minions shared by every chapter, one elite, and one boss per chapter.
import type { BossTrait, EnemyDef } from '../core/types.ts';

export const BASE_HP = 24;
/** Per-wave speed growth (HP growth is per chapter, see chapters.ts). */
export const SPEED_GROWTH = 0.015;

interface Stats {
  hpK: number;
  speed: number;
  bounty: number;
  atk: number;
  radius: number;
}

const minion = (id: string, name: string, s: Stats): EnemyDef => ({ id, glyph: id, name, ...s, boss: false, elite: false });

const boss = (id: string, glyph: string, s: Stats, trait?: BossTrait): EnemyDef => ({
  id,
  glyph,
  name: id,
  ...s,
  boss: true,
  elite: false,
  trait,
});

const BOSS_STATS: Stats = { hpK: 14, speed: 14, bounty: 40, atk: 9, radius: 22 };

export const ENEMIES: Record<string, EnemyDef> = {
  妖: minion('妖', '小妖', { hpK: 1, speed: 30, bounty: 2, atk: 3, radius: 12 }),
  狼: minion('狼', '狼妖', { hpK: 0.6, speed: 48, bounty: 2, atk: 2, radius: 11 }),
  熊: minion('熊', '熊怪', { hpK: 3, speed: 19, bounty: 5, atk: 7, radius: 15 }),
  蛛: minion('蛛', '小蜘蛛', { hpK: 0.45, speed: 44, bounty: 1, atk: 2, radius: 9 }),
  魔: { id: '魔', glyph: '魔', name: '魔将', hpK: 8, speed: 20, bounty: 12, atk: 8, radius: 17, boss: false, elite: true },
  // The thief from the 盗宝妖 encounter: quick, frail, robs the camp instead of biting it.
  盗: { id: '盗', glyph: '盗', name: '盗宝妖', hpK: 1.2, speed: 56, bounty: 30, atk: 0, radius: 11, boss: false, elite: false, trait: { t: 'steal', amount: 30 } },
  白骨精: boss('白骨精', '白骨', BOSS_STATS, { t: 'revive', times: 1, pct: 0.4 }),
  黄风怪: boss('黄风怪', '黄风', BOSS_STATS, { t: 'dash', every: 4, dur: 1, mul: 3 }),
  金角大王: boss('金角大王', '金角', BOSS_STATS, { t: 'summon', every: 5, count: 2, minion: '妖' }),
  红孩儿: boss('红孩儿', '红孩', { ...BOSS_STATS, speed: 18 }, { t: 'immune' }),
  黑熊精: boss('黑熊精', '黑熊', { ...BOSS_STATS, hpK: 18 }, { t: 'armor', flat: 5 }),
  灵感大王: boss('灵感大王', '灵感', BOSS_STATS, { t: 'regen', pctPerSec: 0.02 }),
  蜘蛛精: boss('蜘蛛精', '蜘蛛', { ...BOSS_STATS, hpK: 18 }, { t: 'split', count: 5, minion: '蛛' }),
  牛魔王: boss('牛魔王', '牛魔', { ...BOSS_STATS, hpK: 15, atk: 14 }, { t: 'armor', flat: 7 }),
  金翅大鹏: boss('金翅大鹏', '大鹏', { ...BOSS_STATS, hpK: 17, speed: 22 }, { t: 'dash', every: 3, dur: 1, mul: 3.5 }),
  黄眉大王: boss('黄眉大王', '黄眉', { ...BOSS_STATS, hpK: 18 }, { t: 'summon', every: 5, count: 2, minion: '狼' }),
};

/** One-line description of a boss trait for banners and tooltips. */
export function traitText(def: EnemyDef): string {
  const tr = def.trait;
  if (!tr) return def.elite ? '皮糙肉厚' : '';
  switch (tr.t) {
    case 'revive':
      return `倒下后会复活 ${tr.times} 次`;
    case 'dash':
      return `每 ${tr.every} 秒突然冲刺`;
    case 'summon':
      return `每 ${tr.every} 秒召唤 ${tr.count} 只${ENEMIES[tr.minion].name}`;
    case 'immune':
      return '免疫减速';
    case 'armor':
      return `每次受击减伤 ${tr.flat}`;
    case 'regen':
      return '不断回血';
    case 'split':
      return `死后分裂成 ${tr.count} 只${ENEMIES[tr.minion].name}`;
    case 'steal':
      return `摸到阵地偷走 ${tr.amount} 功德`;
  }
}
