// One map per chapter, drawn as ASCII. Edit the rows to change a route or move a build slot.
//
//   1-4  monster entrance (start of a road; one road per digit)
//   #    road                        E   the camp (end of every road, exactly one)
//   O    build slot, open at start   o   build slot, bought with 铜钱
//   A/a  法阵 altar: a fighter on it deals more damage        (upper case open, lower case bought)
//   H/h  高台 high ground: a fighter on it reaches further    (upper case open, lower case bought)
//   M/m  泥沼 mire: fighters can't stand on it; supports, fragments and the 金 card can
//   C/c  聚宝台 coffer: every monster the card on it finishes off pays extra 铜钱
//   B/b  烽火台 beacon: with any card on it, the monsters around it take more from every hit
//   D/d  双生台 twin: pads pair up in reading order (1st with 2nd, 3rd with 4th); the same fighter on both is faster
//   S/s  灵泉 spring: a card on it soaks up a layer for every wave it stays through; a fighter hits harder for each
//   ~    water (lava on fire maps)   ^   rock      T   tree      .   plain ground
//
// Each character is one TILE x TILE square of world space. Roads must be simple corridors from each
// entrance to E (no 2x2 road blocks, no crossings); corners get rounded automatically.
// Special pads go where they matter — corners, junctions — and stay at most two fifths of a map's pads. The kinds
// come in one chapter at a time: 法阵 and 高台 from chapter 1, 聚宝台 from 2, 烽火台 from 3, 双生台 from 4 (always in
// pairs), 泥沼 from 5, 灵泉 from 6.

export type MapTheme = 'ridge' | 'wind' | 'plateau' | 'fire' | 'forest' | 'river' | 'web' | 'flame' | 'lion' | 'temple';

/** What a build pad does to the card standing on it. */
export type SlotKind = 'plain' | 'altar' | 'high' | 'mire' | 'coffer' | 'beacon' | 'twin' | 'spring';

export interface SlotBonus {
  /** Damage multiplier for a fighter (attack or hero card) standing on the pad. */
  dmgMul: number;
  /** Extra attack range in world px for a fighter standing on the pad. */
  range: number;
  /** Whether fighters may stand on the pad at all. */
  fighters: boolean;
}

/**
 * Bonuses of the special pads (B1). Balance lives here — tweak, then re-run `pnpm sim`. The four later pads add
 * nothing here: their effects are below (COFFER_BOUNTY, BEACON, TWIN_HASTE, SPRING), applied by core/slots.ts.
 */
export const SLOT_BONUS: Readonly<Record<SlotKind, SlotBonus>> = {
  plain: { dmgMul: 1, range: 0, fighters: true },
  altar: { dmgMul: 1.2, range: 0, fighters: true },
  high: { dmgMul: 1, range: 30, fighters: true },
  mire: { dmgMul: 1, range: 0, fighters: false },
  coffer: { dmgMul: 1, range: 0, fighters: true },
  beacon: { dmgMul: 1, range: 0, fighters: true },
  twin: { dmgMul: 1, range: 0, fighters: true },
  spring: { dmgMul: 1, range: 0, fighters: true },
};

/** 聚宝台: extra 铜钱 for every monster the card standing on it finishes off (the last hit is its), more for a boss. */
export const COFFER_BOUNTY = { minion: 1, boss: 10 } as const;
/** 烽火台: while any card stands on it, monsters within `range` px of it take `amp` more from every hit (poison aside). */
export const BEACON = { range: 130, amp: 0.15 } as const;
/** 双生台: the same fighter on both pads of a pair attacks this much faster on each (added to its 速 and 鼓 haste, uncapped). */
export const TWIN_HASTE = 0.25;
/** 灵泉: one layer per wave cleared with the card on it, at most `max`; each adds `dmg` to a fighter's damage. Moving it clears them. */
export const SPRING = { max: 3, dmg: 0.08 } as const;

/** Display name of each pad kind. */
export const SLOT_NAME: Readonly<Record<SlotKind, string>> = {
  plain: '石台',
  altar: '法阵',
  high: '高台',
  mire: '泥沼',
  coffer: '聚宝台',
  beacon: '烽火台',
  twin: '双生台',
  spring: '灵泉',
};

/** The ASCII letters that make a build pad: its kind, and whether it is open from the start (upper case). */
export const PAD_LETTERS: Readonly<Record<string, { kind: SlotKind; open: boolean }>> = {
  O: { kind: 'plain', open: true },
  o: { kind: 'plain', open: false },
  A: { kind: 'altar', open: true },
  a: { kind: 'altar', open: false },
  H: { kind: 'high', open: true },
  h: { kind: 'high', open: false },
  M: { kind: 'mire', open: true },
  m: { kind: 'mire', open: false },
  C: { kind: 'coffer', open: true },
  c: { kind: 'coffer', open: false },
  B: { kind: 'beacon', open: true },
  b: { kind: 'beacon', open: false },
  D: { kind: 'twin', open: true },
  d: { kind: 'twin', open: false },
  S: { kind: 'spring', open: true },
  s: { kind: 'spring', open: false },
};

export interface MapDef {
  theme: MapTheme;
  rows: readonly string[];
  /** Hand tuning for how forgiving the layout is (1 = average); multiplies monster HP on this map. */
  hp?: number;
}

/** World pixels per map square. */
export const TILE = 48;
/** Monsters walk this much faster than on the old small camp, since roads are several screens long. */
export const MAP_SPEED = 2;
/** ...and carry this much more HP, since every tower along the road gets a turn at them. */
export const MAP_HP = 2.5;

export const MAPS: readonly MapDef[] = [
  {
    theme: 'ridge',
    hp: 1.55,
    rows: [
      '.....1......',
      '.T...#..^T..',
      '.O...#..O...',
      '.T...#....^^',
      '..O..#####..',
      '......T..#..',
      '..o..O...#.o',
      '.T.......#T.',
      '..########..',
      '..#.A....o..',
      '..#..^....T.',
      '..#..h...O..',
      '..#####.TT..',
      '.O....#..o..',
      '..^...#.....',
      '......E.....',
    ],
  },
  {
    theme: 'wind',
    hp: 1.4,
    rows: [
      '............',
      '.T...^.o.T..',
      '1#########..',
      '.O...a...#.O',
      '.........#..',
      '..########..',
      '..#.C...o...',
      '..#......H..',
      '..########..',
      '.O.....o.#..',
      '.........#.T',
      '..########..',
      '..#.O..O....',
      '..#......o..',
      '..####......',
      '.....E......',
    ],
  },
  {
    theme: 'plateau',
    hp: 0.97,
    rows: [
      '1..........2',
      '#.O..^^..O.#',
      '#..........#',
      '#.o..^..o..#',
      '#..^.....^.#',
      '############',
      '.A...#...O..',
      '..^..#..^...',
      '..####..c...',
      '..#.B.......',
      '..#..^..O...',
      '..########..',
      '.o..^..h.#..',
      '.....#####..',
      '..O..#..O...',
      '.....E......',
    ],
  },
  {
    theme: 'fire',
    hp: 1.22,
    rows: [
      '1##########.',
      '.~~.......#.',
      '..O..o..O.#.',
      '..#######.#.',
      '..#.~~..#.#.',
      '..#.d.D.#.#.',
      '..#..~..#.#.',
      '..#.E##.#.#.',
      '..#...#.#.#.',
      '..#.A.#.#.#.',
      '..#.~.#.#.#.',
      '..#...###.#.',
      '..#.o...h.#.',
      '..#..o..~.#.',
      '..#########.',
      '.O...o..O~~.',
    ],
  },
  {
    theme: 'forest',
    hp: 1.46,
    rows: [
      '.1..........2.',
      '.#..O.TT.O..#.',
      '.#.T......T.#.',
      '.####..o.####.',
      '.T..#....#..T.',
      '.O..#.^^.#..O.',
      '.T..#....#.T..',
      '.m..######..m.',
      '......#..T....',
      '..O...#...O...',
      '..T...#.T.....',
      '..#####.......',
      '..#..b...A.T..',
      '..#########...',
      '.T..h....o#...',
      '......#####...',
      '..O...#..O.T..',
      '......E.......',
    ],
  },
  {
    theme: 'river',
    hp: 0.83,
    rows: [
      '1#####..#####2',
      '.....#..#..T..',
      '.O.a.#..#.o.O.',
      '.#####..#####.',
      '.#..T.....T.#.',
      '.#.S......O.#.',
      '.####....####.',
      '....#....#....',
      '~~~~#~~~~#~~~~',
      '~~~~#~~~~#~~~~',
      '....######....',
      '.O....#...H...',
      '..T...#....T..',
      '..o...####.o..',
      '.........#....',
      '..M..#####.O..',
      '.T...#..^.....',
      '.....E........',
    ],
  },
  {
    theme: 'web',
    hp: 0.95,
    rows: [
      '1.........2.',
      '#....T....#.',
      '###.O..O.###',
      '..#.m..o.#..',
      '..#......#..',
      '###.O..O.###',
      '#..........#',
      '#.o......o.#',
      '###......###',
      '..#.D..D.#..',
      '..#......#..',
      '..########..',
      '.h...#....o.',
      '.....#......',
      '..O..#..A...',
      '.....E......',
    ],
  },
  {
    theme: 'flame',
    hp: 1.73,
    rows: [
      '1############.',
      '.T.M......~~#.',
      '......~.....#.',
      '.m...O..o...#.',
      '.############.',
      '.#..~~......~~',
      '.#.O..O..o..~~',
      '.############.',
      '......~.....#.',
      '..~~..a...H.#.',
      '.############2',
      '.#..S..^..o...',
      '.#.......~~...',
      '.########.O...',
      '..o.....#.....',
      '....#####..~~.',
      '..O.#..C...~~.',
      '....E.........',
    ],
  },
  {
    theme: 'lion',
    hp: 0.68,
    rows: [
      '.1..........2.',
      '.#..T....T..#.',
      '.#.O......O.#.',
      '.#..o....o..#.',
      '.####....####.',
      '....#....#....',
      '.O..#....#..O.',
      '....######....',
      '3####..#......',
      '.m...B.#..o...',
      '.......#......',
      '...c...#..H...',
      '....####......',
      '..O.#....a....',
      '....#......O..',
      '....#####.....',
      '........#..m..',
      '........E.....',
    ],
  },
  {
    theme: 'temple',
    hp: 1.79,
    rows: [
      '.1..........2.',
      '.#....TT....#.',
      '.#.O..^^..O.#.',
      '.############.',
      '......#.......',
      '.o.M..#..O.o..',
      '..#####.......',
      '..#...h..O....',
      '..#.O.........',
      '..##########..',
      '....a....d.#..',
      '..O......D.#..',
      '....########..',
      '..o.#..S......',
      '....#.....o...',
      '....######....',
      '..M......#.O..',
      '.........E....',
    ],
  },
];
