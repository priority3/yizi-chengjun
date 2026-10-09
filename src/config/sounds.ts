// Sound recipes. Every sound effect is a few synthesized voices (an oscillator or white noise with a pitch
// glide, an envelope and an optional filter sweep) that platform/audio.ts turns into WebAudio nodes — there are
// no audio files. Pure data, importable from Node. soundFor() maps a simulation event to its sound; frequent,
// low-value events stay silent so a dense fight doesn't turn into noise.
import type { HeroId, ShotKind, SimEvent } from '../core/types.ts';
import { ENEMIES } from './enemies.ts';

export type Osc = 'sine' | 'triangle' | 'square' | 'sawtooth' | 'noise';

export interface VoiceFilter {
  type: 'lowpass' | 'highpass' | 'bandpass';
  /** Cutoff (centre for bandpass) in Hz at the start of the voice; glides exponentially to `to` by its end. */
  from: number;
  to: number;
  /**
   * Resonance as WebAudio reads it: for bandpass the usual Q (default 1, bigger = narrower); for low/highpass
   * the peak at the cutoff in dB (default 0, a gentle bump; negative flattens it).
   */
  q?: number;
}

/**
 * One synthesized layer of a sound. The envelope rises linearly to `gain` over `attack`, stays there for
 * `hold`, then decays exponentially to silence at `dur`.
 */
export interface Voice {
  osc: Osc;
  /**
   * Pitch glide [start, end] in Hz. Noise has no pitch, so for 'noise' it is the top of the noise band
   * (its brightness): low values give a dull rumble, high values a hiss.
   */
  freq: [number, number];
  /** Seconds from the voice's start to silence. */
  dur: number;
  /** Seconds to reach full gain. */
  attack: number;
  /** Peak level 0..1, before the sfx / music / master volumes. */
  gain: number;
  /** Seconds after the sound starts before this voice begins. */
  delay?: number;
  /** Seconds at full gain before the decay starts (held notes such as horns). */
  hold?: number;
  /** Pitch wobble: `rate` in Hz, `depth` in cents. */
  vibrato?: { rate: number; depth: number };
  filter?: VoiceFilter;
}

export type SoundId =
  | 'arrow'
  | 'fireShot'
  | 'ice'
  | 'bolt'
  | 'swing'
  | 'beam'
  | 'slam'
  | 'crescent'
  | 'dragon'
  | 'needle'
  | 'net'
  | 'mirror'
  | 'fireImpact'
  | 'kill'
  | 'bossKill'
  | 'execute'
  | 'revive'
  | 'leak'
  | 'steal'
  | 'ultWukong'
  | 'ultBajie'
  | 'ultShaseng'
  | 'ultBailong'
  | 'buy'
  | 'merge'
  | 'awaken'
  | 'divine'
  | 'coin'
  | 'unlock'
  | 'aim'
  | 'invalid'
  | 'offer'
  | 'encounter'
  | 'waveStart'
  | 'bossWave'
  | 'waveClear'
  | 'won'
  | 'lost';

/** Frequency of a MIDI note number (69 = A4 = 440 Hz). */
export function hz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** Brightness of full-band noise (the highest frequency a voice may use). */
const NOISE_TOP = 16000;
/**
 * Overall level of the effects: the gains written in the recipes below are relative to each other and get
 * multiplied by this. Reason: measured offline, it puts the loudest jingles' peaks around -6 dBFS after the
 * bus volumes (and a worst-case burst of 8 battle sounds near -2 dBFS, which the output limiter catches).
 */
const LEVEL = 1.8;

const lp = (from: number, to: number, q?: number): VoiceFilter => ({ type: 'lowpass', from, to, q });
const hp = (from: number, to: number, q?: number): VoiceFilter => ({ type: 'highpass', from, to, q });
const bp = (from: number, to: number, q?: number): VoiceFilter => ({ type: 'bandpass', from, to, q });

/** A pitched voice gliding `from` -> `to` Hz. */
function tone(osc: Exclude<Osc, 'noise'>, from: number, to: number, dur: number, gain: number, more: Partial<Voice> = {}): Voice {
  return { osc, freq: [from, to], dur, attack: 0.004, gain: gain * LEVEL, ...more };
}

/** A white-noise burst, usually coloured by a filter sweep. */
function noise(dur: number, gain: number, filter?: VoiceFilter, more: Partial<Voice> = {}): Voice {
  return { osc: 'noise', freq: [NOISE_TOP, NOISE_TOP], dur, attack: 0.003, gain: gain * LEVEL, ...(filter ? { filter } : {}), ...more };
}

/** Notes (MIDI numbers) played one after another, `gap` seconds apart, starting at `delay`. */
function run(notes: readonly number[], gap: number, dur: number, gain: number, delay = 0, osc: Exclude<Osc, 'noise'> = 'triangle'): Voice[] {
  return notes.map((m, i) => tone(osc, hz(m), hz(m), dur, gain, { delay: delay + i * gap }));
}

/** A crash cymbal: bright noise, 400 ms. */
const cymbal = (delay = 0, gain = 0.1): Voice => noise(0.4, gain, hp(8000, 5000), { delay });
/**
 * A drum hit: a sine thump dropping to `f`, plus a short beater click.
 * Reason: phone speakers can't play the 45-145 Hz thump at all; the click is what they let through.
 */
const drum = (f: number, delay = 0, gain = 0.4): Voice[] => [tone('sine', f * 1.8, f, 0.25, gain, { delay }), noise(0.03, gain * 0.25, lp(2500, 800), { delay })];
/** One clink of a 铜钱. */
const clink = (f: number, delay: number, gain = 0.09): Voice => tone('triangle', f, f, 0.07, gain, { delay });

/** A war horn note: filtered sawtooth with vibrato, plus a soft triangle an octave below for body. */
function horn(f: number, dur: number, gain: number, delay = 0): Voice[] {
  const shape = { attack: 0.05, hold: dur * 0.45, delay };
  return [
    tone('sawtooth', f, f, dur, gain, { ...shape, vibrato: { rate: 5.5, depth: 14 }, filter: lp(1400, 800) }),
    tone('triangle', f / 2, f / 2, dur, gain * 0.8, shape),
  ];
}

// ---- tower shots ----------------------------------------------------------------------------------------

/** 箭: a short airy whoosh plus a falling twang. */
const ARROW: Voice[] = [noise(0.06, 0.07, hp(4000, 2500)), tone('sine', 900, 300, 0.08, 0.08)];
/** 火 launch: a low whoomp with a little breath. */
const FIRE_SHOT: Voice[] = [tone('sine', 150, 110, 0.15, 0.2, { attack: 0.01 }), noise(0.12, 0.05, lp(1400, 500), { attack: 0.02 })];
/** 冰: a glassy tick and a short high ding. */
const ICE: Voice[] = [tone('triangle', 1800, 1750, 0.09, 0.07), tone('sine', 2400, 2400, 0.06, 0.05, { delay: 0.025 })];
/** 雷: a crack sweeping from high to low over a sub thump. */
const BOLT: Voice[] = [noise(0.3, 0.15, bp(4000, 300, 1.2)), tone('sine', 90, 55, 0.2, 0.28)];
/** 棍: a swish. */
const SWING: Voice[] = [noise(0.08, 0.13, bp(2000, 500, 1.5), { attack: 0.01 })];
/** 悟空's staff: a rising buzz. */
const BEAM: Voice[] = [tone('sawtooth', 200, 800, 0.2, 0.07, { attack: 0.01, filter: lp(2400, 3200) })];
/** 八戒's rake: a deep thud and dust. */
const SLAM: Voice[] = [tone('sine', 90, 45, 0.25, 0.35), noise(0.18, 0.12, lp(1800, 200))];
/** 沙僧's crescent blade: a falling whistle. */
const CRESCENT: Voice[] = [tone('triangle', 1200, 400, 0.12, 0.11)];
/** 白龙's sweep: three slightly detuned sines gliding up an octave. */
const DRAGON: Voice[] = [300, 303.5, 296.5].map((f) => tone('sine', f, f * 2, 0.6, 0.045, { attack: 0.1 }));
/** 毒: a thin hiss and a tiny falling tick, the quietest shot (it fires often). */
const NEEDLE: Voice[] = [noise(0.045, 0.05, hp(6000, 4000)), tone('sine', 2600, 1700, 0.05, 0.045, { delay: 0.01 })];
/** 网: a rope whooshing open (band-passed noise sweeping down) and a soft woody thud. */
const NET: Voice[] = [noise(0.2, 0.1, bp(1800, 600, 1.2), { attack: 0.02 }), tone('triangle', 180, 110, 0.12, 0.08, { delay: 0.06 })];

/** Ultimate = the hero's normal attack + a 0.4 s rising arpeggio from `root` + a cymbal. */
function ultimate(shot: readonly Voice[], root: number): Voice[] {
  return [...shot, ...run([root, root + 4, root + 7, root + 12, root + 16], 0.08, 0.2, 0.09, 0.05), cymbal(0.05)];
}

// ---- table ----------------------------------------------------------------------------------------------

export const SOUNDS: Record<SoundId, Voice[]> = {
  arrow: ARROW,
  fireShot: FIRE_SHOT,
  ice: ICE,
  bolt: BOLT,
  swing: SWING,
  beam: BEAM,
  slam: SLAM,
  crescent: CRESCENT,
  dragon: DRAGON,
  needle: NEEDLE,
  net: NET,
  // 镜 flashing back: a bright bronze chime (C6 with a bell partial), a glint gliding up an octave, and a breath of shimmer.
  mirror: [
    tone('sine', hz(84), hz(84), 0.7, 0.06),
    tone('sine', hz(84) * 2.76, hz(84) * 2.76, 0.4, 0.025),
    tone('triangle', 1200, 2400, 0.3, 0.04, { attack: 0.05 }),
    noise(0.35, 0.03, hp(6000, 9000), { attack: 0.08 }),
  ],
  // 火 landing: a muffled blast closing down from 3 kHz, then three crackles.
  fireImpact: [noise(0.2, 0.18, lp(3000, 300)), ...[0.035, 0.08, 0.13].map((d) => noise(0.025, 0.09, hp(2500, 2500), { delay: d }))],
  kill: [noise(0.12, 0.15, lp(2400, 400)), tone('sine', 320, 160, 0.08, 0.1)],
  // Reason: two drum hits on top of a bigger burst, so a boss falling stands out from the minions dying around it.
  bossKill: [noise(0.3, 0.2, lp(2000, 200)), ...drum(80, 0, 0.42), ...drum(80, 0.22, 0.42)],
  // 斩: a sharp slash.
  execute: [noise(0.09, 0.14, hp(3000, 7000)), tone('sine', 2600, 700, 0.08, 0.07)],
  // A boss getting back up: a rising shimmer.
  revive: [tone('sine', 220, 880, 0.4, 0.11, { attack: 0.06 }), tone('triangle', 330, 1320, 0.4, 0.04, { attack: 0.06 }), noise(0.4, 0.04, hp(3000, 8000), { attack: 0.1 })],
  // The camp is hit: a drum and two falling notes (G4 -> E-flat 4).
  leak: [...drum(80, 0, 0.4), tone('triangle', hz(67), hz(67), 0.16, 0.12, { delay: 0.04 }), tone('triangle', hz(63), hz(63), 0.3, 0.12, { delay: 0.2 })],
  // The thief runs off with 铜钱: three quick clinks, falling.
  steal: [clink(2600, 0), clink(2300, 0.05), clink(2000, 0.1)],
  ultWukong: ultimate(BEAM, 72),
  ultBajie: ultimate(SLAM, 67),
  ultShaseng: ultimate(CRESCENT, 74),
  ultBailong: ultimate(DRAGON, 76),
  // Paper: two high rustles, and the card landing on the stone.
  buy: [noise(0.08, 0.13, hp(2500, 4500), { attack: 0.008 }), noise(0.05, 0.08, hp(3500, 3500), { delay: 0.05 }), tone('sine', 240, 150, 0.06, 0.08, { delay: 0.04 })],
  // C5 E5 G5, 60 ms apart.
  merge: run([72, 76, 79], 0.06, 0.12, 0.1),
  // A C major chord with a cymbal and a low thump.
  awaken: [...[60, 64, 67, 72].map((m) => tone('triangle', hz(m), hz(m), 0.45, 0.08, { attack: 0.01, hold: 0.12 })), cymbal(0, 0.1), ...drum(70, 0, 0.3)],
  // A bell: the fundamental plus inharmonic partials at 2.76x and 5.4x that die away faster.
  divine: [tone('sine', hz(72), hz(72), 1.2, 0.08), tone('sine', hz(72) * 2.76, hz(72) * 2.76, 0.7, 0.035), tone('sine', hz(72) * 5.4, hz(72) * 5.4, 0.35, 0.02)],
  // 铜钱: two short clinks (refresh, sell, income, chest).
  coin: [clink(2200, 0), clink(2700, 0.07)],
  // A stone settling: dull low noise and a thump.
  unlock: [noise(0.12, 0.3, lp(900, 200), { freq: [1500, 500] }), tone('sine', 110, 60, 0.12, 0.2)],
  // 瞄准 switched: a dry wooden click and a short rising blip, like a bow being turned.
  aim: [noise(0.03, 0.08, bp(3000, 2200, 2)), tone('triangle', 900, 1500, 0.07, 0.07, { delay: 0.02 })],
  // A soft low buzz.
  invalid: [tone('square', 150, 140, 0.12, 0.1, { filter: lp(1400, 900) })],
  // An encounter is offered: a quiet chime after the wave-clear arpeggio (A5 C6 E6).
  offer: run([81, 84, 88], 0.09, 0.4, 0.04, 0.55, 'sine'),
  // An encounter is chosen: G5 -> C6 with a bell shimmer.
  encounter: [...run([79, 84], 0.1, 0.35, 0.07), tone('sine', hz(84) * 2.76, hz(84) * 2.76, 0.3, 0.02, { delay: 0.1 })],
  waveStart: horn(220, 0.45, 0.12),
  bossWave: [...horn(165, 0.9, 0.12), ...drum(60, 0, 0.35), ...drum(60, 0.45, 0.3)],
  // A rising pentatonic run C5 D5 E5 G5 C6.
  waveClear: run([72, 74, 76, 79, 84], 0.07, 0.25, 0.1, 0.05),
  // Four-note horn call G4 C5 E5 G5, the last one held. Reason: it waits 0.35 s so the boss's death lands first.
  won: [...horn(hz(67), 0.16, 0.08, 0.35), ...horn(hz(72), 0.16, 0.08, 0.53), ...horn(hz(76), 0.16, 0.08, 0.71), ...horn(hz(79), 0.8, 0.09, 0.89)],
  // Falling A minor E4 C4 A3, after the leak that ended the run.
  lost: [...horn(hz(64), 0.32, 0.09, 0.4), ...horn(hz(60), 0.32, 0.09, 0.75), ...horn(hz(57), 1, 0.1, 1.1)],
};

/** Higher plays first when a batch of events has more sounds than Sfx starts at once; unlisted sounds are 0. */
const PRIORITY: Partial<Record<SoundId, number>> = {
  won: 3,
  lost: 3,
  waveStart: 2,
  bossWave: 2,
  waveClear: 2,
  ultWukong: 2,
  ultBajie: 2,
  ultShaseng: 2,
  ultBailong: 2,
  awaken: 2,
  bossKill: 2,
  leak: 2,
  steal: 2,
  merge: 1,
  divine: 1,
  buy: 1,
  coin: 1,
  unlock: 1,
  aim: 1,
  invalid: 1,
  offer: 1,
  encounter: 1,
  revive: 1,
  execute: 1,
  fireImpact: 1,
  mirror: 1,
};

export function soundPriority(id: SoundId): number {
  return PRIORITY[id] ?? 0;
}

const SHOT_SOUND: Record<ShotKind, SoundId | null> = {
  arrow: 'arrow',
  fire: 'fireShot',
  ice: 'ice',
  crescent: 'crescent',
  swing: 'swing',
  bolt: 'bolt',
  beam: 'beam',
  slam: 'slam',
  dragon: 'dragon',
  needle: 'needle',
  net: 'net',
  none: null,
};

const ULT_SOUND: Record<HeroId, SoundId> = { 悟空: 'ultWukong', 八戒: 'ultBajie', 沙僧: 'ultShaseng', 白龙: 'ultBailong' };

/**
 * The silent-event table: event types that never make a sound, because they come too often to be worth a
 * voice each (every hit, every 疗 pulse...). Impacts other than 火 are silent too (the shot already sounded).
 */
export const SILENT_EVENTS: ReadonlyArray<SimEvent['t']> = ['hit', 'heal', 'split', 'summon'];

/** Compile-time exhaustiveness guard: an unknown event at runtime is simply silent. */
function unhandled(e: never): null {
  void e;
  return null;
}

/** The sound an event makes, or null for a silent one. */
export function soundFor(e: SimEvent): SoundId | null {
  switch (e.t) {
    case 'shot':
      return SHOT_SOUND[e.kind];
    case 'impact':
      return e.kind === 'fire' ? 'fireImpact' : null;
    case 'hit':
    case 'heal':
    case 'split':
    case 'summon':
      return null;
    case 'kill':
      return ENEMIES[e.def]?.boss ? 'bossKill' : 'kill';
    case 'leak':
      return 'leak';
    case 'revive':
      return 'revive';
    case 'execute':
      return 'execute';
    case 'buy':
      return 'buy';
    case 'merge':
      return 'merge';
    case 'hero':
      return 'awaken';
    case 'divine':
      return 'divine';
    case 'sell':
    case 'income':
    case 'refresh':
    case 'chest':
      return 'coin';
    case 'invalid':
      return 'invalid';
    case 'unlock':
      return 'unlock';
    case 'mode':
      return 'aim';
    case 'ultimate':
      return ULT_SOUND[e.hero];
    case 'encounterOffer':
      return 'offer';
    case 'encounter':
      return 'encounter';
    case 'steal':
      return 'steal';
    case 'mirror':
      return 'mirror';
    case 'waveStart':
      return e.boss ? 'bossWave' : 'waveStart';
    // A berserk endless wave sounds the alarm of a boss entrance.
    case 'enrage':
      return 'bossWave';
    case 'waveClear':
      return 'waveClear';
    case 'won':
      return 'won';
    case 'lost':
      return 'lost';
    default:
      // Reason: a SimEvent type added later must get a case above; until it does, this line fails to compile.
      return unhandled(e);
  }
}
