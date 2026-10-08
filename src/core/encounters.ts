// 奇遇 (encounters): after every second cleared wave the player picks one of three event cards.
// Boons apply at once; challenges queue modifiers for the next wave in exchange for bigger rewards.
import { CHAPTERS } from '../config/chapters.ts';
import { ENEMIES } from '../config/enemies.ts';
import { UNITS } from '../config/units.ts';
import { makeTile } from './board.ts';
import { CELL_COUNT } from './grid.ts';
import { rand } from './rng.ts';
import { rollOffer } from './shop.ts';
import type { ActionResult, EncounterId, GameState, WaveMods } from './types.ts';

export type EncounterKind = 'boon' | 'trade' | 'challenge';

export interface EncounterDef {
  id: EncounterId;
  kind: EncounterKind;
  desc: string;
}

export const ENCOUNTERS: Record<EncounterId, EncounterDef> = {
  观音赐福: { id: '观音赐福', kind: 'boon', desc: '阵地回满血，血量上限 +10' },
  财神到: { id: '财神到', kind: 'boon', desc: '立刻获得 50 功德' },
  天降神字: { id: '天降神字', kind: 'boon', desc: '一张「神」落到阵地空格上（没空格则得 40 功德）' },
  土地公摆摊: { id: '土地公摆摊', kind: 'trade', desc: '本轮商店半价，刷新免费' },
  宝箱: { id: '宝箱', kind: 'trade', desc: '打完下一波，开出一张随机卡放到阵地上' },
  妖风大作: { id: '妖风大作', kind: 'challenge', desc: '下一波妖怪快 40%，赏金和波次奖励翻倍' },
  月圆之夜: { id: '月圆之夜', kind: 'challenge', desc: '下一波妖怪多 50% 血，赏金 ×2.5' },
  狼群来袭: { id: '狼群来袭', kind: 'challenge', desc: '下一波全是狼，数量 ×1.5，赏金翻倍' },
  盗宝妖: { id: '盗宝妖', kind: 'challenge', desc: '下一波混进一只小偷：摸到阵地偷 30 功德，杀掉得 30' },
  妖王亲临: { id: '妖王亲临', kind: 'challenge', desc: '下一波末尾来一只半血妖王，赏金 60' },
};

export const ENCOUNTER_IDS = Object.keys(ENCOUNTERS) as EncounterId[];
export const OFFER_SIZE = 3;
export const KIND_LABEL: Record<EncounterKind, string> = { boon: '福缘', trade: '机缘', challenge: '劫难' };

export function defaultWaveMods(): WaveMods {
  return { speedMul: 1, hpMul: 1, bountyMul: 1, bonusMul: 1, wolves: false, thief: false, miniBoss: null };
}

/** Short HUD text for queued or active wave modifiers; '' when the wave is plain. */
export function modsLabel(m: WaveMods): string {
  const parts: string[] = [];
  if (m.wolves) parts.push('全是狼 ×1.5');
  if (m.speedMul !== 1) parts.push(`移速 ×${m.speedMul}`);
  if (m.hpMul !== 1) parts.push(`血量 ×${m.hpMul}`);
  if (m.thief) parts.push('盗宝妖混入');
  if (m.miniBoss) parts.push(`妖王${ENEMIES[m.miniBoss].name}压阵`);
  if (m.bountyMul !== 1) parts.push(`赏金 ×${m.bountyMul}`);
  if (m.bonusMul !== 1) parts.push(`波次奖励 ×${m.bonusMul}`);
  return parts.join(' · ');
}

/** Encounters open after every second cleared wave, never right before the boss wave is over. */
export function encounterDue(clearedWave: number, totalWaves: number): boolean {
  return clearedWave % 2 === 0 && clearedWave < totalWaves;
}

function emptyCells(g: GameState): number[] {
  const out: number[] = [];
  for (let i = 0; i < CELL_COUNT; i++) if (g.unlocked[i] && !g.slots[i]) out.push(i);
  return out;
}

/** A boss from an earlier chapter (chapter 1 previews its own boss), picked with the run RNG. */
function miniBossFor(g: GameState): string {
  const pool = CHAPTERS.filter((c) => c.id < g.chapter).map((c) => c.boss);
  if (pool.length === 0) return CHAPTERS[g.chapter - 1].boss;
  return pool[Math.floor(rand(g) * pool.length)];
}

export function rollEncounters(g: GameState): EncounterId[] {
  const pool = [...ENCOUNTER_IDS];
  const out: EncounterId[] = [];
  for (let i = 0; i < OFFER_SIZE; i++) out.push(pool.splice(Math.floor(rand(g) * pool.length), 1)[0]);
  return out;
}

export function offerEncounter(g: GameState): void {
  g.encounter = rollEncounters(g);
  g.encounters++;
  g.events.push({ t: 'encounterOffer', options: [...g.encounter] });
}

export function applyEncounter(g: GameState, id: EncounterId): void {
  const m = g.waveMods;
  switch (id) {
    case '观音赐福':
      g.campMax += 10;
      g.campHp = g.campMax;
      break;
    case '财神到':
      g.gongde += 50;
      break;
    case '天降神字': {
      const empty = emptyCells(g);
      if (empty.length === 0) {
        g.gongde += 40;
        break;
      }
      const cell = empty[Math.floor(rand(g) * empty.length)];
      g.slots[cell] = makeTile(g, '神', UNITS['神'].price);
      g.events.push({ t: 'buy', cell, unit: '神' });
      break;
    }
    case '土地公摆摊':
      g.shopDiscount = 0.5;
      g.freeRefresh = true;
      break;
    case '宝箱':
      g.chest = true;
      break;
    case '妖风大作':
      m.speedMul = 1.4;
      m.bountyMul = 2;
      m.bonusMul = 2;
      break;
    case '月圆之夜':
      m.hpMul = 1.5;
      m.bountyMul = 2.5;
      break;
    case '狼群来袭':
      m.wolves = true;
      m.bountyMul = 2;
      break;
    case '盗宝妖':
      m.thief = true;
      break;
    case '妖王亲临':
      m.miniBoss = miniBossFor(g);
      break;
  }
}

/** Player picks card `option` of the pending offer. */
export function chooseEncounter(g: GameState, option: number): ActionResult {
  if (!g.encounter) return 'none';
  const id = g.encounter[option];
  if (!id) return 'none';
  g.encounter = null;
  applyEncounter(g, id);
  g.events.push({ t: 'encounter', id });
  return 'ok';
}

/** The 宝箱 pays out after the wave: a random card onto an empty cell, or 功德 when the camp is full. */
export function openChest(g: GameState): void {
  g.chest = false;
  const empty = emptyCells(g);
  if (empty.length === 0) {
    g.gongde += 30;
    g.events.push({ t: 'chest', cell: -1, unit: null });
    return;
  }
  const id = rollOffer(g);
  const cell = empty[Math.floor(rand(g) * empty.length)];
  g.slots[cell] = makeTile(g, id, UNITS[id].price);
  g.events.push({ t: 'chest', cell, unit: id });
}
