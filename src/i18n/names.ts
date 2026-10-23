// The player-visible names and lines of the game's data in the current language (lang.ts): the Chinese of config/,
// or the English of en-tables.ts. Every text that names a card, a monster, a chapter, a 法宝, an ultimate or a pad
// reads it here, so a language switch shows everywhere on the next frame.
import { GAME_NAME, GAME_NAME_EN, TAGLINE, TAGLINE_EN } from '../config/brand.ts';
import { CHAPTERS } from '../config/chapters.ts';
import { HERO_RECIPES } from '../config/combos.ts';
import { ENEMIES, traitText } from '../config/enemies.ts';
import { SLOT_NAME, type SlotKind } from '../config/maps.ts';
import { CURRENCY, gilded } from '../config/terms.ts';
import { RARITY_LABEL, TREASURES, type Rarity, type TreasureId } from '../config/treasures.ts';
import { ULTIMATES } from '../config/ultimates.ts';
import { glyphOf, UNITS } from '../config/units.ts';
import type { EnemyDef, HeroId, UnitId } from '../core/types.ts';
import { BOSS_SHORT_EN, CHAPTER_EN, ENEMY_EN, PAD_EN, RARITY_EN, TREASURE_EN, traitTextEn, ULTIMATE_EN, UNIT_EN } from './en-tables.ts';
import { isEn } from './lang.ts';

/** Chapter numbers as Chinese numerals (第三章); the map editor uses them too. */
export const NUMERALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

/** The game's name: 一字成军, Glyph Legion. */
export function gameName(): string {
  return isEn() ? GAME_NAME_EN : GAME_NAME;
}

/** The line under the name on the title screen and the share card. */
export function tagline(): string {
  return isEn() ? TAGLINE_EN : TAGLINE;
}

/** What texts call a card: its glyph in Chinese (箭, 悟空, 金), its English name in English (Arrow, Wukong, Gold). */
export function unitName(id: UnitId): string {
  return isEn() ? UNIT_EN[id].name : glyphOf(id);
}

/** A card's one-line description. */
export function unitDesc(id: UnitId): string {
  return isEn() ? UNIT_EN[id].desc : UNITS[id].desc;
}

/**
 * The line under a card in the shop. Chinese shows the role (远程): the glyph already names the card. English shows
 * the name instead, since the glyph means nothing to its readers, and for a fragment the hero it belongs to: Wu
 * (Wukong).
 */
export function shopCaption(id: UnitId): string {
  if (!isEn()) return UNITS[id].label;
  const hero = HERO_RECIPES.find((r) => r.a === id || r.b === id)?.hero;
  return hero ? `${UNIT_EN[id].name} (${UNIT_EN[hero].name})` : UNIT_EN[id].name;
}

/** The name of a fighter or hero the 金 card strengthened: 金箭, Gold Arrow. */
export function gildedName(name: string): string {
  return isEn() ? `Gold ${name}` : gilded(name);
}

/** The currency in a phrase like "50 coins". */
export function currency(): string {
  return isEn() ? 'coins' : CURRENCY;
}

/** A monster's name by enemy id. */
export function enemyName(id: string): string {
  return isEn() ? (ENEMY_EN[id] ?? id) : ENEMIES[id].name;
}

/** A boss's name where room is short (the chapter cards): the full name in Chinese, a shorter one in English. */
export function bossShortName(id: string): string {
  return isEn() ? (BOSS_SHORT_EN[id] ?? enemyName(id)) : ENEMIES[id].name;
}

/** One line on what a boss, the elite or the thief does ('' for a plain minion). */
export function traitLine(def: EnemyDef): string {
  return isEn() ? traitTextEn(def.trait, def.elite) : traitText(def);
}

/** A chapter's name (1-based chapter number). */
export function chapterName(chapter: number): string {
  return isEn() ? CHAPTER_EN[chapter - 1] : CHAPTERS[chapter - 1].name;
}

/** A chapter's number as a heading: 第三章, Chapter 3. */
export function chapterLabel(chapter: number): string {
  return isEn() ? `Chapter ${chapter}` : `第${NUMERALS[chapter - 1]}章`;
}

/** A 法宝's name (the id is its Chinese name). */
export function treasureName(id: TreasureId): string {
  return isEn() ? TREASURE_EN[id].name : id;
}

/** What a 法宝 of effect size `v` does. */
export function treasureText(id: TreasureId, v: number): string {
  return isEn() ? TREASURE_EN[id].text(v) : TREASURES[id].text(v);
}

export function rarityName(r: Rarity): string {
  return isEn() ? RARITY_EN[r] : RARITY_LABEL[r];
}

/** A hero's ultimate: its name and what it does. */
export function ultimateName(hero: HeroId): string {
  return isEn() ? ULTIMATE_EN[hero].name : ULTIMATES[hero].name;
}

export function ultimateDesc(hero: HeroId): string {
  return isEn() ? ULTIMATE_EN[hero].desc : ULTIMATES[hero].desc;
}

/** A pad kind's name: 法阵, Rune Circle. */
export function padName(kind: SlotKind): string {
  return isEn() ? PAD_EN[kind] : SLOT_NAME[kind];
}
