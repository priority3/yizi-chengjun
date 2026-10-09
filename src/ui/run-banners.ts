// The banners a run opens with, by mode: a chapter, an endless run, or the daily challenge (kept apart from the scene
// so game-scene.ts stays small).
import { CHAPTERS } from '../config/chapters.ts';
import { ENDLESS, ENDLESS_CHAPTER } from '../config/endless.ts';
import { dayLabel } from '../core/modes.ts';
import type { GameState } from '../core/types.ts';
import { NUMERALS } from '../render/panels.ts';

export interface BannerText {
  title: string;
  sub: string;
}

/** The banner of a fresh endless or daily run; `gear` notes the 法宝 brought (' · 带了 2 件法宝', or ''). */
export function openEndedBanner(g: GameState, gear: string): BannerText {
  if (g.mode === 'daily') return { title: `每日挑战 · ${dayLabel(g.seed)}`, sub: '今天人人同一张图、同一批妖怪 · 不带法宝' };
  return {
    title: `无尽 · ${CHAPTERS[ENDLESS_CHAPTER - 1].name}`,
    sub: `每 ${ENDLESS.bossEvery} 波来一个 Boss · 每撑过一波 ${ENDLESS.stonesPerWave} 灵石${gear}`,
  };
}

/** The banner of a resumed run: the wave that comes next, and where. */
export function resumeBanner(g: GameState): BannerText {
  const sub = '回到这一波开打前，摆好的字都在';
  const next = `第 ${g.wave + 1} 波`;
  if (g.mode === 'endless') return { title: `继续 · 无尽 ${next}`, sub: `已撑过 ${g.wave} 波 · ${sub}` };
  if (g.mode === 'daily') return { title: `继续 · 每日挑战 ${next}`, sub: `${dayLabel(g.seed)} · ${sub}` };
  return { title: `继续 · 第${NUMERALS[g.chapter - 1]}章 ${next}`, sub: `${CHAPTERS[g.chapter - 1].name} · ${sub}` };
}
