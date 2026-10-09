// Per-wave traces of bot runs for the balance tools (`pnpm sim --trace`, `--leaks`). A read-only observer turns
// the events of every act() and step() into one summary per wave, so a traced run is exactly the run runChapter plays.
import { CURRENCY, GILDING } from '../config/terms.ts';
import { glyphOf } from '../config/units.ts';
import { encounterName } from './encounters.ts';
import { playChapter, summarize, type RunObserver, type RunResult, type SimOptions } from './sim.ts';
import type { Action, EncounterId, GameState, SimEvent, UnitId } from './types.ts';

export interface WaveTrace {
  /** 1-based wave number. */
  wave: number;
  /** The boss ending the wave (a chapter's last wave, every 5th wave of an endless run), else null. */
  boss: string | null;
  /** The elite 魔将 ends the wave. */
  elite: boolean;
  /** Monsters that entered the field during the wave, summons and split-offs included. */
  spawned: number;
  killed: number;
  /** Monsters that reached the camp and hurt it. A 盗宝妖 that gets away is not a leak; it shows up in `stolen`. */
  leaked: number;
  /** 铜钱 carried off by 盗宝妖. */
  stolen: number;
  /** Camp HP when the wave ended (after 人参果's on-clear heal). */
  campHpAfter: number;
  /** 铜钱 in hand when the wave started, i.e. after the build phase before it. */
  gongdeBefore: number;
  /** 铜钱 when the wave ended: bounties, 钱 and the clear bonus added, thefts taken off. */
  gongdeAfter: number;
  /** What happened in the build phase before this wave, e.g. "买 箭→石台3", "合成 火2级@石台5", "解锁 石台7", "刷新". */
  bought: string[];
  /** The 奇遇 answered in that build phase: "offered options → pick", plus what it produced. */
  encounter?: string;
}

export interface ChapterTrace {
  result: RunResult;
  waves: WaveTrace[];
}

/** Slots are numbered from 1 in map reading order (top to bottom, left to right), the order of `map.slots`. */
const slotName = (cell: number): string => `石台${cell + 1}`;

/** A card as the player sees it (金 for the gilding card); a missing one prints as before, "undefined". */
const glyph = (id: UnitId | undefined): string => (id ? glyphOf(id) : String(id));

type EventOf<T extends SimEvent['t']> = Extract<SimEvent, { t: T }>;

function firstOf<T extends SimEvent['t']>(events: readonly SimEvent[], t: T): EventOf<T> | undefined {
  return events.find((e): e is EventOf<T> => e.t === t);
}

/** Collects WaveTraces from the events of one run. */
function waveRecorder(): { observer: RunObserver; waves: WaveTrace[] } {
  const waves: WaveTrace[] = [];
  // Build-phase log, handed to the next wave when it starts.
  let bought: string[] = [];
  let encounter: string | undefined;
  let offer: EncounterId[] = [];
  // The wave being fought and the uids of every monster seen in it.
  let cur: WaveTrace | null = null;
  const seen = new Set<number>();
  // A sold tile is gone by the time the action's events arrive, so remember its name beforehand.
  let sold: UnitId | undefined;

  /** "买 火 " when the action was a purchase (it cost 铜钱), '' for a drag on the board. */
  const via = (g: GameState, a: Action): string => (a.t === 'buy' ? `买 ${glyph(g.shop[a.offer]?.id)} ` : '');

  const startWave = (g: GameState, e: EventOf<'waveStart'>) => {
    const { wave, boss, elite } = e;
    cur = { wave, boss, elite, spawned: 0, killed: 0, leaked: 0, stolen: 0, campHpAfter: g.campHp, gongdeBefore: g.gongde, gongdeAfter: g.gongde, bought, encounter };
    waves.push(cur);
    bought = [];
    encounter = undefined;
    seen.clear();
  };

  const observer: RunObserver = {
    beforeAction(g, a) {
      sold = a.t === 'drop' && a.to === 'sell' ? g.slots[a.from]?.id : undefined;
    },
    action(g, a, _result, events) {
      const pick = firstOf(events, 'encounter');
      if (pick) {
        // The goldDrop (天降金字) lands its card with a 'buy' event inside the same action; it is a gift, not a purchase.
        const gift = firstOf(events, 'buy');
        encounter = `${offer.map(encounterName).join('/')} → ${encounterName(pick.id)}${gift ? `（${glyph(gift.unit)}→${slotName(gift.cell)}）` : ''}`;
        return;
      }
      // Rejected actions only leave 'invalid' events (or none), so they never reach the log.
      for (const e of events) {
        if (e.t === 'buy') bought.push(`买 ${glyph(e.unit)}→${slotName(e.cell)}`);
        else if (e.t === 'merge') bought.push(`${via(g, a)}合成 ${glyph(g.slots[e.cell]?.id)}${e.level}级@${slotName(e.cell)}`);
        else if (e.t === 'hero') bought.push(`${via(g, a)}觉醒 ${glyph(e.unit)}@${slotName(e.cell)}`);
        else if (e.t === 'divine') bought.push(`${via(g, a)}${GILDING} ${glyph(g.slots[e.cell]?.id)}@${slotName(e.cell)}`);
        else if (e.t === 'sell') bought.push(`卖 ${sold ? glyph(sold) : slotName(e.cell)}`);
        else if (e.t === 'unlock') bought.push(`解锁 ${slotName(e.cell)}`);
        else if (e.t === 'refresh') bought.push('刷新');
        // 铜钱 is read here, after the whole build phase: 'start' is always the bot's last action before a wave.
        else if (e.t === 'waveStart') startWave(g, e);
      }
    },
    tick(g) {
      const w = cur;
      if (!w) return;
      for (const e of g.events) {
        if (e.t === 'kill') w.killed++;
        else if (e.t === 'leak') w.leaked++;
        else if (e.t === 'steal') w.stolen += e.amount;
        else if (e.t === 'hit') seen.add(e.uid);
        else if (e.t === 'encounterOffer') offer = e.options;
        else if (e.t === 'chest') {
          // The 宝箱 picked before this wave opens as the wave is cleared.
          const loot = e.unit ? `开出 ${glyph(e.unit)}→${slotName(e.cell)}` : `阵地满，换成${CURRENCY}`;
          w.encounter = `${w.encounter ?? '宝箱'}（${loot}）`;
        }
      }
      // Reason: no event marks a monster entering the field, so count distinct uids: those still on the field
      // after the tick, plus any that died in the very tick they appeared (those only show up in 'hit' events).
      for (const e of g.enemies) seen.add(e.uid);
      w.spawned = seen.size;
      w.campHpAfter = g.campHp;
      w.gongdeAfter = g.gongde;
      // The tick that clears, wins or loses the wave leaves the battle phase; a time-capped run keeps its last values.
      if (g.phase !== 'battle') cur = null;
    },
  };
  return { observer, waves };
}

/** Plays the same run as runChapter(seed, chapter, opts) (an endless one with endlessOptions) and reports it wave by wave. */
export function traceChapter(seed: number, chapter: number, opts: SimOptions = {}): ChapterTrace {
  const rec = waveRecorder();
  const g = playChapter(seed, chapter, opts, rec.observer);
  return { result: summarize(g), waves: rec.waves };
}
