// One map per chapter, drawn as ASCII. Edit the rows to change a route or move a build slot.
//
//   1-4  monster entrance (start of a road; one road per digit)
//   #    road                        E   the camp (end of every road, exactly one)
//   O    build slot, open at start   o   build slot, bought with 功德
//   A/a  法阵 altar: a fighter on it deals more damage        (upper case open, lower case bought)
//   H/h  高台 high ground: a fighter on it reaches further    (upper case open, lower case bought)
//   M/m  泥沼 mire: fighters can't stand on it; supports, fragments and 神 can
//   ~    water (lava on fire maps)   ^   rock      T   tree      .   plain ground
//
// Each character is one TILE x TILE square of world space. Roads must be simple corridors from each
// entrance to E (no 2x2 road blocks, no crossings); corners get rounded automatically.
// Special pads (A/H/M) go where they matter — corners, junctions — and stay at most a third of a map's pads.

export type MapTheme = 'ridge' | 'wind' | 'plateau' | 'fire' | 'forest' | 'river' | 'web' | 'flame' | 'lion' | 'temple';

/** What a build pad does to the card standing on it. */
export type SlotKind = 'plain' | 'altar' | 'high' | 'mire';

export interface SlotBonus {
  /** Damage multiplier for a fighter (attack or hero card) standing on the pad. */
  dmgMul: number;
  /** Extra attack range in world px for a fighter standing on the pad. */
  range: number;
  /** Whether fighters may stand on the pad at all. */
  fighters: boolean;
}

/** Bonuses of the special pads (B1). Balance lives here — tweak, then re-run `pnpm sim`. */
export const SLOT_BONUS: Readonly<Record<SlotKind, SlotBonus>> = {
  plain: { dmgMul: 1, range: 0, fighters: true },
  altar: { dmgMul: 1.2, range: 0, fighters: true },
  high: { dmgMul: 1, range: 30, fighters: true },
  mire: { dmgMul: 1, range: 0, fighters: false },
};

/** Display name of each pad kind. */
export const SLOT_NAME: Readonly<Record<SlotKind, string>> = { plain: '石台', altar: '法阵', high: '高台', mire: '泥沼' };

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
    hp: 1.5,
    rows: [
      '............',
      '.T...^.o.T..',
      '1#########..',
      '.O...a...#.O',
      '.........#..',
      '..########..',
      '..#.O...o...',
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
    hp: 1.1,
    rows: [
      '1..........2',
      '#.O..^^..O.#',
      '#..........#',
      '#.o..^..o..#',
      '#..^.....^.#',
      '############',
      '.A...#...O..',
      '..^..#..^...',
      '..####..o...',
      '..#.O.......',
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
    hp: 1.42,
    rows: [
      '1##########.',
      '.~~.......#.',
      '..O..o..O.#.',
      '..#######.#.',
      '..#.~~..#.#.',
      '..#.o.O.#.#.',
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
    hp: 1.63,
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
      '..#..o...A.T..',
      '..#########...',
      '.T..h....o#...',
      '......#####...',
      '..O...#..O.T..',
      '......E.......',
    ],
  },
  {
    theme: 'river',
    hp: 1.0,
    rows: [
      '1#####..#####2',
      '.....#..#..T..',
      '.O.a.#..#.o.O.',
      '.#####..#####.',
      '.#..T.....T.#.',
      '.#.O......O.#.',
      '.####....####.',
      '....#....#....',
      '~~~~#~~~~#~~~~',
      '~~~~#~~~~#~~~~',
      '....######....',
      '.M....#...H...',
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
    hp: 1.12,
    rows: [
      '1.........2.',
      '#....T....#.',
      '###.O..O.###',
      '..#.m..m.#..',
      '..#......#..',
      '###.O..O.###',
      '#..........#',
      '#.o......o.#',
      '###......###',
      '..#.O..O.#..',
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
    hp: 1.86,
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
      '.#..O..^..o...',
      '.#.......~~...',
      '.########.O...',
      '..o.....#.....',
      '....#####..~~.',
      '..O.#..O...~~.',
      '....E.........',
    ],
  },
  {
    theme: 'lion',
    hp: 0.88,
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
      '.m...O.#..o...',
      '.......#......',
      '...o...#..H...',
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
    hp: 1.6,
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
      '....a....o.#..',
      '..O......O.#..',
      '....########..',
      '..o.#..O......',
      '....#.....o...',
      '....######....',
      '..M......#.O..',
      '.........E....',
    ],
  },
];
