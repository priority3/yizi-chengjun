// The player-facing words the v0.9 compliance pass settled on: the currency, who the camp shelters, the strengthening
// card and what it does, four encounter names and the encounter category of harder waves, chapter 10 with its win
// title, and the words for beating monsters. Every text that uses one of them reads it from here (templates
// included), so a later re-theme edits only this file; the game's name and tagline live in brand.ts.
// Identifiers that saves hold stay as they were (GameState.gongde, the card's UnitId '神' and kind 'divine'); ids that
// spelled a replaced word became ASCII ids (four encounters, the 'master' portrait). tests/compliance.test.ts keeps
// the wording these replaced out of src/.

/** The currency: shop prices, rewards, refunds, thefts (the square-holed coin in the HUD). */
export const CURRENCY = '铜钱';

/** Who the camp shelters: the monsters must not reach 师父's camp (the portrait beside the camp HP). */
export const MASTER = '师父';

/** The strengthening card's glyph (UnitDef.glyph; its UnitId stays '神'), also the red seal on a strengthened card. */
export const GOLD_GLYPH = '金';

/** What the strengthening card does to a fighter or a hero: the shop label under the card, the drop hint. */
export const GILDING = '鎏金';

/** The name of a fighter or hero the card strengthened, e.g. 金悟空, 金箭. */
export function gilded(name: string): string {
  return `${GOLD_GLYPH}${name}`;
}

/** Encounter (boon): the camp heals to full and its HP cap grows. */
export const ENC_RENEWAL = '枯木逢春';

/** Encounter (boon): coins at once. */
export const ENC_FORTUNE = '招财进宝';

/** Encounter (boon): the strengthening card drops onto an empty pad. */
export const ENC_GOLD_DROP = `天降${GOLD_GLYPH}字`;

/** Encounter (trade): half-price shop and free refreshes for one build phase. */
export const ENC_PEDDLER = '货郎摆摊';

/** The encounter category that makes the next wave harder for bigger rewards (beside 福缘 and 机缘). */
export const TRIAL = '考验';

/** Chapter 10's name: its chapter card, banners, the endless and daily maps, the share card. */
export const LAST_CHAPTER_NAME = '雷音谷';

/** The title of the last chapter's win, on the result panel and the share card. */
export const FINAL_WIN = '大功告成！';

/** How the result panels and the share text count the monsters beaten: 击败 N 只妖怪. */
export const DEFEAT = '击败';

/** 沙僧's finishing blow on a weakened monster: his label and description, and the 法宝 that raises its threshold. */
export const SUBDUE = '收服';

/** The brush mark that floats over a monster 沙僧 finishes off (the first character of SUBDUE). */
export const SUBDUE_MARK = SUBDUE[0];
