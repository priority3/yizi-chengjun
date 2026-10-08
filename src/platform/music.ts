// Procedural background music. A 古筝-like pluck plays a pentatonic tune generated from a small seeded PRNG
// (seed = chapter, so every chapter has its own stable melody) over a low drone and a soft noise hi-hat.
// Build phase 72 bpm, battle 112 bpm, the boss wave switches to A minor pentatonic; modes crossfade over 1 s.
// Scheduling is the standard lookahead pattern: a 25 ms timer queues the notes of the next 100 ms on the
// WebAudio clock, so the rhythm stays exact even when the main thread stutters.
import { hz, type Voice } from '../config/sounds.ts';
import { audio, type AudioEngine } from './audio.ts';

export type MusicMode = 'build' | 'battle' | 'boss';

/** Tempo per mode. */
export const BPM: Record<MusicMode, number> = { build: 72, battle: 112, boss: 112 };
/** The tune is counted in eighth notes: 8 per bar, 16 bars per loop (AABA, four bars per section). */
export const STEPS_PER_BAR = 8;
export const BARS = 16;

/** Scheduler timer period (ms) and how far ahead (s) each pass queues notes. */
const TICK_MS = 25;
const LOOKAHEAD = 0.1;
/** Crossfade between modes, and the fade when nobody asks for music any more (s). */
const FADE = 1;
const STOP_FADE = 0.6;
/** want() must be called at least this often (ms) or the music winds down. */
const KEEPALIVE_MS = 300;

interface Scale {
  /** MIDI note of degree 0. */
  tonic: number;
  /** Semitones of the five degrees above the tonic. */
  steps: readonly number[];
}

/** C D E G A from C4, and A C D E G from A3: the same notes with a darker home. */
const MAJOR: Scale = { tonic: 60, steps: [0, 2, 4, 7, 9] };
const MINOR: Scale = { tonic: 57, steps: [0, 3, 5, 7, 10] };

export interface TuneNote {
  /** Scale degree: 0..4 is the first octave, 5..9 the next. */
  deg: number;
  /** Length in eighth notes. */
  len: number;
}

export interface Tune {
  /** The note that starts at each eighth-note step, or null. */
  melody: Array<TuneNote | null>;
  /** Bass degree for each bar. */
  bass: number[];
  /** Loop length in eighth notes. */
  steps: number;
}

/** Bar rhythms (note lengths in eighths, each summing to a bar). */
const RHYTHMS: ReadonlyArray<readonly number[]> = [
  [2, 2, 2, 2],
  [2, 1, 1, 2, 2],
  [3, 1, 2, 2],
  [1, 1, 2, 2, 2],
  [2, 2, 4],
  [4, 2, 2],
  [3, 3, 2],
  [2, 1, 1, 4],
];
/** Phrase-ending bars: the last note rings. */
const CADENCES: ReadonlyArray<readonly number[]> = [[2, 2, 4], [4, 4], [2, 6], [3, 1, 4]];
/** Bass per four-bar section: I I vi V (major) / i i VII v (minor) and two variants. */
const BASS_LINES: ReadonlyArray<readonly number[]> = [[0, 0, 4, 3], [0, 2, 4, 3], [0, 4, 1, 3]];
/** Random-walk moves in scale degrees, weighted toward small steps; the melody stays within degrees 2..9. */
const MOVES = [-2, -1, -1, 0, 1, 1, 2];
const LOW = 2;
const HIGH = 9;
/** Where sections end: the tonic an octave up (home), or its fifth (asking for more). */
const HOME = 5;
const FIFTH = 8;
/** The B section starts higher than A, for contrast. */
const B_START = 7;

/** mulberry32. Local on purpose: the music must never draw from the game's seeded RNG. */
function prng(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(r: () => number, list: readonly T[]): T {
  return list[Math.floor(r() * list.length)];
}

interface Placed extends TuneNote {
  /** Step inside its four-bar section. */
  step: number;
}

/** The next degree of the walk; heading for `end` (one or two degrees at a time) when a cadence is coming. */
function nextDeg(r: () => number, deg: number, end?: number): number {
  if (end === undefined || end === deg) return Math.min(HIGH, Math.max(LOW, deg + pick(r, MOVES)));
  const gap = end - deg;
  return deg + Math.sign(gap) * Math.min(Math.abs(gap), 1 + Math.floor(r() * 2));
}

/** One bar from `rhythm` starting at step `at`, walking on from `deg`; with `end` set the last note lands there. */
function bar(r: () => number, rhythm: readonly number[], at: number, deg: number, end?: number): Placed[] {
  const out: Placed[] = [];
  let s = at;
  rhythm.forEach((len, i) => {
    deg = end !== undefined && i === rhythm.length - 1 ? end : nextDeg(r, deg, end);
    out.push({ step: s, len, deg });
    s += len;
  });
  return out;
}

/** A four-bar section: three free bars from `deg`, then a cadence bar ending on `end`. */
function section(r: () => number, deg: number, end: number): Placed[] {
  const out: Placed[] = [];
  for (let b = 0; b < 4; b++) {
    const last = b === 3;
    out.push(...bar(r, pick(r, last ? CADENCES : RHYTHMS), b * STEPS_PER_BAR, out.length > 0 ? out[out.length - 1].deg : deg, last ? end : undefined));
  }
  return out;
}

/** The chapter's tune: deterministic for a seed. Form AABA — A ends on the fifth, its repeat resolves home. */
export function makeTune(seed: number): Tune {
  const r = prng(Math.imul(seed, 0x9e3779b1) ^ 0x2545f491);
  const a = section(r, HOME, FIFTH);
  const opening = a.filter((n) => n.step < 3 * STEPS_PER_BAR);
  const home = [...opening, ...bar(r, pick(r, CADENCES), 3 * STEPS_PER_BAR, opening[opening.length - 1].deg, HOME)];
  const b = section(r, B_START, FIFTH);
  const steps = BARS * STEPS_PER_BAR;
  const melody: Array<TuneNote | null> = new Array<TuneNote | null>(steps).fill(null);
  [a, home, b, home].forEach((notes, i) => {
    for (const n of notes) melody[i * 4 * STEPS_PER_BAR + n.step] = { deg: n.deg, len: n.len };
  });
  const bass: number[] = [];
  for (let i = 0; i < BARS / 4; i++) {
    const line = [...pick(r, BASS_LINES)];
    // Reason: the sections that resolve home also end on the tonic in the bass.
    if (i % 2 === 1) line[3] = 0;
    bass.push(...line);
  }
  return { melody, bass, steps };
}

/** MIDI note of a scale degree (5 per octave; negative degrees go below the tonic). */
function degMidi(scale: Scale, deg: number): number {
  return scale.tonic + scale.steps[((deg % 5) + 5) % 5] + 12 * Math.floor(deg / 5);
}

/** 古筝-like pluck: a triangle with a quick decay, a faster-fading octave and a tiny pick noise. */
function pluck(f: number, dur: number, vel: number): Voice[] {
  return [
    { osc: 'triangle', freq: [f * 1.004, f], dur, attack: 0.004, gain: 0.13 * vel },
    { osc: 'sine', freq: [f * 2, f * 2], dur: dur * 0.45, attack: 0.003, gain: 0.035 * vel },
    { osc: 'noise', freq: [12000, 6000], dur: 0.02, attack: 0.003, gain: 0.018 * vel, filter: { type: 'highpass', from: 3000, to: 3000 } },
  ];
}

/** A soft sustained root for a whole bar (build phase). */
function drone(f: number, dur: number): Voice[] {
  const shape = { dur, attack: dur * 0.2, hold: dur * 0.3 };
  return [
    { osc: 'sine', freq: [f, f], gain: 0.12, ...shape },
    { osc: 'triangle', freq: [f * 2, f * 2], gain: 0.04, ...shape },
  ];
}

/** A plucked bass note (battle). */
function bass(f: number, dur: number): Voice[] {
  return [
    { osc: 'sine', freq: [f, f], dur, attack: 0.008, gain: 0.18 },
    { osc: 'triangle', freq: [f * 2, f * 2], dur: dur * 0.5, attack: 0.006, gain: 0.04 },
  ];
}

/** A soft closed hi-hat (accented on the off-beats in battle). */
function hat(accent: boolean): Voice {
  return { osc: 'noise', freq: [16000, 16000], dur: accent ? 0.05 : 0.03, attack: 0.003, gain: accent ? 0.045 : 0.028, filter: { type: 'highpass', from: 7000, to: 7000 } };
}

/** The boss wave's heartbeat drum. */
function kick(): Voice {
  return { osc: 'sine', freq: [120, 45], dur: 0.18, attack: 0.003, gain: 0.25 };
}

/** Everything that starts on eighth-note `step` of the tune in a mode. Pure, so tests can check every step. */
export function stepVoices(tune: Tune, mode: MusicMode, step: number): Voice[] {
  const scale = mode === 'boss' ? MINOR : MAJOR;
  const eighth = 30 / BPM[mode];
  const s = ((step % tune.steps) + tune.steps) % tune.steps;
  const inBar = s % STEPS_PER_BAR;
  const out: Voice[] = [];
  const note = tune.melody[s];
  // Reason: the build phase is for thinking, so it only plays the notes on the beat or longer than an eighth;
  // in battle the melody steps back a little so the fight's effects stay on top.
  if (note && (mode !== 'build' || note.len > 1 || inBar % 2 === 0)) {
    const vel = (inBar === 0 ? 1 : 0.85) * (mode === 'build' ? 1 : 0.85);
    out.push(...pluck(hz(degMidi(scale, note.deg)), Math.min(1.6, note.len * eighth * 1.5), vel));
  }
  // The bass sits an octave under the tune.
  const root = degMidi(scale, tune.bass[Math.floor(s / STEPS_PER_BAR)] - 5);
  if (mode === 'build') {
    if (inBar === 0) out.push(...drone(hz(root), STEPS_PER_BAR * eighth));
    if (inBar === 2 || inBar === 6) out.push(hat(false));
  } else {
    if (inBar === 0 || inBar === 4) out.push(...bass(hz(inBar === 0 ? root : root + 12), 2 * eighth));
    out.push(hat(s % 2 === 1));
    if (mode === 'boss' && s % 2 === 0) out.push(kick());
  }
  return out;
}

/** Detaches a layer's output; a node that is already gone is fine. */
function unplug(node: AudioNode): void {
  try {
    node.disconnect();
  } catch {
    // Already disconnected.
  }
}

/** What the scheduler needs from the audio engine. */
type MusicEngine = Pick<AudioEngine, 'ctx' | 'musicActive' | 'musicLayer' | 'schedule'>;

/** One running copy of the tune in a mode; two exist while they crossfade. */
interface Layer {
  mode: MusicMode;
  chapter: number;
  tune: Tune;
  out: GainNode;
  /** Context time of the next step. */
  next: number;
  step: number;
  /** Context time this layer has faded out by; null while it is the live layer. */
  endAt: number | null;
}

export class Music {
  private readonly engine: MusicEngine;
  private readonly wall: () => number;
  private readonly tunes = new Map<number, Tune>();
  private layers: Layer[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private mode: MusicMode = 'build';
  private chapter = 1;
  private lastWant = -Infinity;
  /** Wall-clock ms when the music began winding down (nobody asking, muted or switched off); else null. */
  private dyingSince: number | null = null;

  /** `wall` is a millisecond clock (injectable for tests). */
  constructor(engine: MusicEngine = audio, wall: () => number = () => performance.now()) {
    this.engine = engine;
    this.wall = wall;
  }

  /**
   * Asks for music in `mode`; call it every frame while a chapter runs.
   * Reason: scenes have no dispose hook, so this is a keep-alive. When the calls stop for ~300 ms (the player
   * left the chapter or paused, or the run is over) the music fades out and the scheduler stops by itself.
   */
  want(mode: MusicMode, chapter: number): void {
    this.mode = mode;
    this.chapter = chapter;
    this.lastWant = this.wall();
    if (this.timer !== null || !this.engine.musicActive) return;
    try {
      this.timer = setInterval(() => this.tick(), TICK_MS);
    } catch {
      return;
    }
    this.tick();
  }

  /** The scheduler is running. */
  get playing(): boolean {
    return this.timer !== null;
  }

  /** Layers alive (2 during a crossfade). */
  get layerCount(): number {
    return this.layers.length;
  }

  /** One scheduler pass; the timer calls it every 25 ms (public for tests). Never throws. */
  tick(): void {
    try {
      this.pass();
    } catch {
      this.stop();
    }
  }

  private pass(): void {
    const ctx = this.engine.ctx;
    if (!ctx) {
      this.stop();
      return;
    }
    const now = ctx.currentTime;
    const wall = this.wall();
    const alive = this.engine.musicActive && wall - this.lastWant <= KEEPALIVE_MS;
    if (alive) {
      this.dyingSince = null;
      this.follow(now);
    } else {
      if (this.dyingSince === null) {
        this.dyingSince = wall;
        for (const l of this.layers) this.fade(l, now, STOP_FADE);
      }
      // Reason: a suspended context's clock stands still and its fades never finish; the wall clock decides.
      if (wall - this.dyingSince > (STOP_FADE + 0.4) * 1000) {
        this.stop();
        return;
      }
    }
    for (const l of this.layers) this.fill(l, now);
    this.layers = this.layers.filter((l) => {
      const done = l.endAt !== null && now > l.endAt + 0.05;
      // Reason: a faded layer is silent, so cutting the notes still ringing into it can't click.
      if (done) unplug(l.out);
      return !done;
    });
    if (!alive && this.layers.length === 0) this.stop();
  }

  /** Keeps one live layer in the wanted mode and chapter; a change crossfades into a new layer. */
  private follow(now: number): void {
    const live = this.layers.find((l) => l.endAt === null);
    if (live && live.mode === this.mode && live.chapter === this.chapter) return;
    const out = this.engine.musicLayer();
    if (!out) return;
    if (live) this.fade(live, now, FADE);
    out.gain.setValueAtTime(0, now);
    out.gain.linearRampToValueAtTime(1, now + FADE);
    this.layers.push({ mode: this.mode, chapter: this.chapter, tune: this.tune(this.chapter), out, next: now + 0.05, step: 0, endAt: null });
  }

  private tune(chapter: number): Tune {
    let t = this.tunes.get(chapter);
    if (!t) {
      t = makeTune(chapter);
      this.tunes.set(chapter, t);
    }
    return t;
  }

  /** Fades a layer to silence over `dur` seconds (keeps an earlier, faster fade). */
  private fade(l: Layer, now: number, dur: number): void {
    if (l.endAt !== null && l.endAt <= now + dur) return;
    l.endAt = now + dur;
    const g = l.out.gain;
    // Reason: hold the current level first (it may still be fading in) so the fade-out never jumps.
    if (typeof g.cancelAndHoldAtTime === 'function') {
      g.cancelAndHoldAtTime(now);
    } else {
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
    }
    g.linearRampToValueAtTime(0, now + dur);
  }

  /** Queues the layer's steps up to LOOKAHEAD ahead, never past its fade-out. */
  private fill(l: Layer, now: number): void {
    const eighth = 30 / BPM[l.mode];
    // Reason: after a stall (background tab, slow phone) skip the missed steps instead of playing them at once.
    while (l.next < now) this.advance(l, eighth);
    while (l.next < now + LOOKAHEAD && (l.endAt === null || l.next < l.endAt)) {
      this.engine.schedule(stepVoices(l.tune, l.mode, l.step), l.next, l.out);
      this.advance(l, eighth);
    }
  }

  private advance(l: Layer, eighth: number): void {
    l.next += eighth;
    l.step = (l.step + 1) % l.tune.steps;
  }

  private stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    for (const l of this.layers) unplug(l.out);
    this.layers = [];
    this.dyingSince = null;
  }
}

/** The game's background music. */
export const music = new Music();
