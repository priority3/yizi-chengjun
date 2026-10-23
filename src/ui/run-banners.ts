// The banners a run opens with, by mode: a chapter, an endless run, or the daily challenge, and the one-time tips of
// a first chapter-1 run (kept apart from the scene so game-scene.ts stays small).
import { CHAPTERS } from '../config/chapters.ts';
import { ENDLESS, ENDLESS_CHAPTER } from '../config/endless.ts';
import { CURRENCY, MASTER, TRIAL } from '../config/terms.ts';
import { dayLabel } from '../core/modes.ts';
import type { GameState } from '../core/types.ts';
import { tr } from '../i18n/lang.ts';
import { chapterLabel, chapterName, enemyName } from '../i18n/names.ts';

export interface BannerText {
  title: string;
  sub: string;
}

/** What a run's banner says of the 法宝 brought along: ' · 带了 2 件法宝' (' · 2 relics along'), or '' without any. */
export function gearNote(equipped: number): string {
  if (equipped === 0) return '';
  return tr(` · 带了 ${equipped} 件法宝`, ` · ${equipped} ${equipped === 1 ? 'relic' : 'relics'} along`);
}

/** The banner of a fresh chapter run: the chapter, its boss and the 法宝 brought (`gear`, from gearNote). */
export function chapterBanner(chapter: number, gear: string): BannerText {
  const boss = enemyName(CHAPTERS[chapter - 1].boss);
  return {
    title: `${chapterLabel(chapter)} · ${chapterName(chapter)}`,
    sub: tr(`别让妖怪走到${MASTER}的营地，打败${boss}${gear}`, `Keep the monsters from the Master's camp, defeat ${boss}${gear}`),
  };
}

/** The banner of a fresh endless or daily run; `gear` notes the 法宝 brought (gearNote). */
export function openEndedBanner(g: GameState, gear: string): BannerText {
  if (g.mode === 'daily') {
    return {
      title: tr(`每日挑战 · ${dayLabel(g.seed)}`, `Daily Challenge · ${dayLabel(g.seed)}`),
      sub: tr('今天人人同一张图、同一批妖怪 · 不带法宝', 'Same map and monsters for everyone today · No relics'),
    };
  }
  return {
    title: `${tr('无尽', 'Endless')} · ${chapterName(ENDLESS_CHAPTER)}`,
    sub: tr(
      `每 ${ENDLESS.bossEvery} 波来一个 Boss · 每撑过一波 ${ENDLESS.stonesPerWave} 灵石${gear}`,
      `A boss every ${ENDLESS.bossEvery} waves · ${ENDLESS.stonesPerWave} Spirit Stones per wave held${gear}`,
    ),
  };
}

/** The banner of the map editor's 试玩: chapter 1's monsters and economy on the edited map. */
export function testBanner(): BannerText {
  return { title: '试玩 · 自制地图', sub: `第一章的妖怪和${CURRENCY} · 不带法宝 · 不存档、不计奖励` };
}

/** The banner of a resumed run: the wave that comes next, and where. */
export function resumeBanner(g: GameState): BannerText {
  const sub = tr('回到这一波开打前，摆好的字都在', 'Back before this wave, with every glyph where you left it');
  const next = tr(`第 ${g.wave + 1} 波`, `Wave ${g.wave + 1}`);
  const go = tr('继续', 'Continue');
  if (g.mode === 'endless') return { title: `${go} · ${tr('无尽', 'Endless')} ${next}`, sub: `${tr(`已撑过 ${g.wave} 波`, `${g.wave} waves held`)} · ${sub}` };
  if (g.mode === 'daily') return { title: `${go} · ${tr('每日挑战', 'Daily')} ${next}`, sub: `${dayLabel(g.seed)} · ${sub}` };
  return { title: `${go} · ${chapterLabel(g.chapter)} ${next}`, sub: `${chapterName(g.chapter)} · ${sub}` };
}

/** The tips a first chapter-1 run shows once each. */
export type TipKey = 'frag' | 'trash' | 'leak' | 'enc' | 'rage' | 'aim';

export function tipText(key: TipKey): string {
  switch (key) {
    case 'frag':
      return tr('名字碎片：凑齐「悟」「空」这样的另一半就能觉醒英雄', 'Name fragment: join it with its other half, like Wu and Kong, to awaken a hero');
    case 'trash':
      return tr('不要的字可以拖到垃圾桶卖掉', "Drag a glyph you don't need to the bin to sell it");
    case 'leak':
      return tr('妖怪走到营地会伤到阵地：把火力摆在路的转弯处', 'Monsters that reach the camp hurt it: put your firepower at the bends of the road');
    case 'enc':
      return tr(`奇遇三选一：福缘立刻生效，${TRIAL}下一波生效但赏金更多`, 'Pick one of three: Blessings work at once, Trials toughen the next wave for bigger bounties');
    case 'rage':
      return tr('英雄普攻十下攒满怒气，下一击就是大招', "Ten hits fill a hero's rage: the next one is the ultimate");
    case 'aim':
      return tr('再点一下这张字，可以切换瞄准', 'Tap the glyph again to change its target');
  }
}
