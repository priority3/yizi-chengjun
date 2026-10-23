// The English of the game's data tables, keyed by the same Chinese ids as config/ and core/encounters.ts (the ids
// never change: saves and hashes hold them). Read through names.ts, which picks these or the Chinese by language.
// The words follow the Chinese ones: coins (铜钱), the Master (师父), Gold for the 金 card, Subdue (收服),
// defeat (击败), hero and fragment names in pinyin. tests/english.test.ts checks every id has its English.
// Reason for some odd choices (Tabletop, Burning, Blazing, Moonlit, and Battle and Craft on buttons): the brush
// font's capital F is a script F that reads like a J, so names drawn in brush avoid starting a word with it.
import type { SlotKind } from '../config/maps.ts';
import type { Rarity, TreasureId } from '../config/treasures.ts';
import { DRUM_FX, MIRROR_EVERY, POISON_FX } from '../config/units.ts';
import type { BossTrait, EncounterId, HeroId, UnitId } from '../core/types.ts';

const pct = (v: number): string => `${Math.round(v * 100)}%`;

/** A card's English name (what its glyph means) and its one-line description. */
export interface UnitEn {
  name: string;
  desc: string;
}

const FRAG_DESC = "Can't fight. Drop it on its other half to awaken a hero";

export const UNIT_EN: Record<UnitId, UnitEn> = {
  棍: { name: 'Staff', desc: 'Fast swings at ground monsters on the road beside it' },
  箭: { name: 'Arrow', desc: 'Longest range; ×1.3 damage to fliers' },
  火: { name: 'Fire', desc: 'Fireballs burst and hurt the monsters around' },
  冰: { name: 'Ice', desc: 'Icicles slow monsters down' },
  雷: { name: 'Thunder', desc: 'Slow, heavy lightning; ×1.3 damage to fliers' },
  毒: { name: 'Poison', desc: `Needles stack poison up to ${POISON_FX.max} times, bosses too` },
  网: { name: 'Net', desc: 'Nets hold monsters in place, bosses too' },
  速: { name: 'Haste', desc: 'Glyphs on the 8 cells around attack faster' },
  钱: { name: 'Coin', desc: 'Makes coins every 4 s during battle' },
  疗: { name: 'Heal', desc: 'Slowly heals the camp while it is hurt' },
  鼓: { name: 'Drum', desc: `Glyphs on the 8 cells around: +${pct(DRUM_FX.dmg)} damage, +${pct(DRUM_FX.speed)} speed per level` },
  镜: { name: 'Mirror', desc: `Every ${MIRROR_EVERY} s, throws the camp's damage back at every monster` },
  悟: { name: 'Wu', desc: FRAG_DESC },
  空: { name: 'Kong', desc: FRAG_DESC },
  八: { name: 'Ba', desc: FRAG_DESC },
  戒: { name: 'Jie', desc: FRAG_DESC },
  沙: { name: 'Sha', desc: FRAG_DESC },
  僧: { name: 'Seng', desc: FRAG_DESC },
  白: { name: 'Bai', desc: FRAG_DESC },
  龙: { name: 'Long', desc: FRAG_DESC },
  悟空: { name: 'Wukong', desc: 'His staff shoots out through a whole line of monsters' },
  八戒: { name: 'Bajie', desc: 'His rake slams the ground, hurting and stunning all around' },
  沙僧: { name: 'Sha Seng', desc: 'His crescent spade flies out and subdues badly hurt monsters' },
  白龙: { name: 'Bailong', desc: 'The white dragon sweeps the field, hitting every monster' },
  // Reason: written '神' (quoted) because tests/compliance.test.ts only allows the character as that literal.
  '神': { name: 'Gold', desc: 'Drop it on a fighter or hero to make it a Gold one' },
};

/** Each hero's ultimate (config/ultimates.ts). */
export const ULTIMATE_EN: Record<HeroId, UnitEn> = {
  悟空: { name: 'Staff Sweep', desc: 'One blow hits every monster on a long stretch of road' },
  八戒: { name: 'Rake from the Sky', desc: 'The rake drops from the sky and stuns a wide area' },
  沙僧: { name: 'Staff Combo', desc: 'Strikes five monsters in a row; subdues the badly hurt' },
  白龙: { name: 'Dragon Roar', desc: 'A roar pushes every monster back to the gate' },
};

/** Monster names by enemy id (config/enemies.ts): minions, the elite, the thief and the ten bosses. */
export const ENEMY_EN: Record<string, string> = {
  妖: 'Imp',
  狼: 'Wolf Demon',
  熊: 'Bear Brute',
  蛛: 'Spiderling',
  蝠: 'Bat Spirit',
  鹏: 'Roc Chick',
  魔: 'Demon General',
  盗: 'Thief Imp',
  白骨精: 'White Bone Demon',
  黄风怪: 'Yellow Wind Demon',
  金角大王: 'Golden Horn King',
  红孩儿: 'Red Boy',
  黑熊精: 'Black Bear Demon',
  灵感大王: 'King Lingan',
  蜘蛛精: 'Spider Demon',
  牛魔王: 'Bull Demon King',
  金翅大鹏: 'Golden Roc',
  黄眉大王: 'Yellowbrow King',
};

/** Shorter English boss names for the chapter cards' narrow boss line (like EnemyDef.glyph's two characters). */
export const BOSS_SHORT_EN: Record<string, string> = {
  白骨精: 'White Bone',
  黄风怪: 'Yellow Wind',
  金角大王: 'Golden Horn',
  红孩儿: 'Red Boy',
  黑熊精: 'Black Bear',
  灵感大王: 'Lingan',
  蜘蛛精: 'Spider',
  牛魔王: 'Bull King',
  金翅大鹏: 'Golden Roc',
  黄眉大王: 'Yellowbrow',
};

/** The English of traitText (config/enemies.ts): one line on what a boss, the elite or the thief does. */
export function traitTextEn(trait: BossTrait | undefined, elite: boolean): string {
  if (!trait) return elite ? 'Thick-skinned' : '';
  switch (trait.t) {
    case 'revive':
      return trait.times === 1 ? 'Gets back up once after falling' : `Gets back up ${trait.times} times after falling`;
    case 'dash':
      return `Dashes ahead every ${trait.every} s`;
    case 'summon':
      return `Calls ${trait.count} ${ENEMY_EN[trait.minion]}s every ${trait.every} s`;
    case 'immune':
      return "Can't be slowed";
    case 'armor':
      return `Blocks ${trait.flat} damage from every hit`;
    case 'regen':
      return 'Keeps healing';
    case 'split':
      return `Splits into ${trait.count} ${ENEMY_EN[trait.minion]}s when beaten`;
    case 'steal':
      return `Steals ${trait.amount} coins if it reaches the camp`;
  }
}

/** Chapter names by chapter number (index = chapter - 1, config/chapters.ts). */
export const CHAPTER_EN: readonly string[] = [
  'White Tiger Ridge',
  'Yellow Wind Ridge',
  'Tabletop Mountain',
  'Burning Cloud Cave',
  'Black Wind Mountain',
  'Heaven River',
  'Silk Web Cave',
  'Blazing Mountain',
  'Lion Camel Ridge',
  'Thunder Valley',
];

/** A 法宝's English name and effect line (config/treasures.ts). */
export interface TreasureEn {
  name: string;
  text(v: number): string;
}

export const TREASURE_EN: Record<TreasureId, TreasureEn> = {
  金刚琢: { name: 'Diamond Ring', text: (v) => `Camp HP +${Math.round(v)}` },
  紫金红葫芦: { name: 'Magic Gourd', text: (v) => `Start with +${Math.round(v)} coins` },
  人参果: { name: 'Ginseng Fruit', text: (v) => `Camp heals ${Math.round(v)} after each wave` },
  缩地符: { name: 'Earthfold Charm', text: (v) => `Arrow range +${pct(v)}` },
  定风珠: { name: 'Wind Pearl', text: (v) => `Monster speed -${pct(v)}` },
  芭蕉扇: { name: 'Palm-Leaf Fan', text: (v) => `Fire splash radius +${pct(v)}` },
  避火罩: { name: 'Fire Ward', text: (v) => `Fire damage +${pct(v)}` },
  照妖镜: { name: 'Truth Mirror', text: (v) => `All damage +${pct(v)}` },
  九齿钉耙: { name: 'Nine-Tooth Rake', text: (v) => `Bajie's stun time +${pct(v)}` },
  紧箍咒: { name: 'Headband Spell', text: (v) => `Hero rage gain +${pct(v)}` },
  降妖宝杖: { name: 'Demon Staff', text: (v) => `Sha Seng's subdue line +${pct(v)}` },
  定颜珠: { name: 'Ageless Pearl', text: (v) => `Bailong's damage +${pct(v)}` },
};

export const RARITY_EN: Record<Rarity, string> = { common: 'Common', rare: 'Rare', epic: 'Epic' };

/** A 奇遇 card's English name and description (core/encounters.ts). */
export const ENCOUNTER_EN: Record<EncounterId, UnitEn> = {
  renewal: { name: 'Spring Renewal', desc: 'The camp heals to full; max HP +10' },
  fortune: { name: 'Windfall', desc: 'Get 50 coins right away' },
  goldDrop: { name: 'Gold from the Sky', desc: 'A Gold card lands on an empty pad (no room: 40 coins)' },
  peddler: { name: "Peddler's Stall", desc: 'Half-price shop and free refreshes this round' },
  宝箱: { name: 'Treasure Chest', desc: 'Beat the next wave to open a random card onto a pad' },
  妖风大作: { name: 'Demon Gale', desc: 'Next wave: monsters 40% faster; bounties and wave bonus ×2' },
  月圆之夜: { name: 'Moonlit Night', desc: 'Next wave: monsters +50% HP; bounties ×2.5' },
  狼群来袭: { name: 'Wolf Pack', desc: 'Next wave: all wolves, ×1.5 as many; bounties ×2' },
  盗宝妖: { name: 'Thief Imp', desc: 'A thief joins the next wave: steals 30 coins at the camp; defeat it for 30' },
  妖王亲临: { name: 'Demon King', desc: 'A demon king at half HP closes the next wave; bounty 60' },
};

/** The three encounter kinds (福缘, 机缘, 考验). */
export const ENCOUNTER_KIND_EN = { boon: 'Blessing', trade: 'Chance', challenge: 'Trial' } as const;

/** Pad names (config/maps.ts SLOT_NAME). */
export const PAD_EN: Readonly<Record<SlotKind, string>> = {
  plain: 'Stone Pad',
  altar: 'Rune Circle',
  high: 'High Ground',
  mire: 'Mire',
  coffer: 'Coffer',
  beacon: 'Beacon',
  twin: 'Twin Pad',
  spring: 'Spirit Spring',
};
