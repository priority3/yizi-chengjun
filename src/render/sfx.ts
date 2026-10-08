// Sound effects driven by simulation events, the audio twin of Vfx: SimEvent -> SoundId (config/sounds.ts)
// -> the audio engine. Throttled, so a dense fight (白龙 hitting forty monsters at once) can't stack dozens of
// voices: each sound starts at most once per 50 ms and a single batch of events starts at most 8 sounds.
import { soundFor, soundPriority, SOUNDS, type SoundId } from '../config/sounds.ts';
import type { SimEvent } from '../core/types.ts';
import { audio } from '../platform/audio.ts';

/** The same sound starts at most once per this many milliseconds. */
export const SFX_REPEAT_MS = 50;
/** Sounds started per consume() call at most; the rest are dropped, lowest priority first. */
export const SFX_MAX_PER_CALL = 8;

export class Sfx {
  private readonly out: (id: SoundId) => void;
  private readonly now: () => number;
  /** When each sound last started (ms on the `now` clock). */
  private readonly last = new Map<SoundId, number>();

  /** `out` plays a sound and `now` is a millisecond clock; both are injectable for tests. */
  constructor(out: (id: SoundId) => void = (id) => audio.play(SOUNDS[id]), now: () => number = () => performance.now()) {
    this.out = out;
    this.now = now;
  }

  /** Plays the sounds of a batch of events (one simulation step, or one player action). */
  consume(events: readonly SimEvent[]): void {
    if (events.length === 0) return;
    const ids: SoundId[] = [];
    for (const e of events) {
      const id = soundFor(e);
      if (id !== null && !ids.includes(id)) ids.push(id);
    }
    this.start(ids);
  }

  /** Feedback that has no simulation event, e.g. an action refused for lack of 功德. */
  play(id: SoundId): void {
    this.start([id]);
  }

  private start(ids: SoundId[]): void {
    if (ids.length === 0) return;
    const t = this.now();
    const ready = ids.filter((id) => t - (this.last.get(id) ?? -Infinity) >= SFX_REPEAT_MS);
    // Reason: the sort is stable, so equal priorities keep event order and a burst keeps its first sounds;
    // a jingle at the end of a busy step (won, waveClear) still outranks the shots before it.
    ready.sort((a, b) => soundPriority(b) - soundPriority(a));
    for (const id of ready.slice(0, SFX_MAX_PER_CALL)) {
      this.last.set(id, t);
      this.out(id);
    }
  }
}
