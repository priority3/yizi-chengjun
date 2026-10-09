// Sound: recipe data, the event -> sound table, the Sfx throttle, saved settings, the music generator, and the
// audio engine / music scheduler driven through a strict fake AudioContext (it throws where browsers throw).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CHAPTERS } from '../src/config/chapters.ts';
import { SILENT_EVENTS, soundFor, SOUNDS, type SoundId, type Voice } from '../src/config/sounds.ts';
import type { HeroId, ShotKind, SimEvent } from '../src/core/types.ts';
import { AudioEngine } from '../src/platform/audio.ts';
import { BARS, makeTune, Music, music, STEPS_PER_BAR, stepVoices, type MusicMode } from '../src/platform/music.ts';
import { parseProgress, parseSound } from '../src/platform/web.ts';
import { Sfx, SFX_MAX_PER_CALL, SFX_REPEAT_MS } from '../src/render/sfx.ts';

/** Problems with a voice's parameters; empty when it is playable without clicks or inaudible pitches. */
function voiceProblems(v: Voice): string[] {
  const out: string[] = [];
  const band = (f: number) => f >= 20 && f <= 16000;
  if (!(v.dur > 0)) out.push(`dur ${v.dur}`);
  if (!(v.gain > 0 && v.gain <= 1)) out.push(`gain ${v.gain}`);
  if (!(v.attack >= 0.003 && v.attack + (v.hold ?? 0) < v.dur)) out.push(`attack ${v.attack} hold ${v.hold} dur ${v.dur}`);
  if (!((v.delay ?? 0) >= 0)) out.push(`delay ${v.delay}`);
  if (!v.freq.every(band)) out.push(`freq ${v.freq.join('->')}`);
  // Bandpass Q is a plain ratio and must be positive; low/highpass Q is in dB and only needs to be sane.
  const q = v.filter?.q ?? (v.filter?.type === 'bandpass' ? 1 : 0);
  const qOk = v.filter?.type === 'bandpass' ? q > 0 && q <= 30 : Math.abs(q) <= 20;
  if (v.filter && !(band(v.filter.from) && band(v.filter.to) && qOk)) out.push(`filter ${JSON.stringify(v.filter)}`);
  if (v.vibrato && !(v.vibrato.rate > 0 && v.vibrato.depth > 0 && v.vibrato.depth <= 100)) out.push(`vibrato ${JSON.stringify(v.vibrato)}`);
  return out;
}

// Reason: Records keyed by the union types, so a new ShotKind, hero or SimEvent fails to compile here until
// the sound table (and these samples) cover it.
const SHOT_KINDS = Object.keys({ arrow: 0, fire: 0, ice: 0, crescent: 0, swing: 0, bolt: 0, beam: 0, slam: 0, dragon: 0, needle: 0, net: 0, none: 0 } satisfies Record<ShotKind, 0>) as ShotKind[];
const HEROES = Object.keys({ 悟空: 0, 八戒: 0, 沙僧: 0, 白龙: 0 } satisfies Record<HeroId, 0>) as HeroId[];
const at = { x: 10, y: 20 };
const shot = (kind: ShotKind): SimEvent => ({ t: 'shot', kind, unit: '箭', cell: 0, ...at, tx: 0, ty: 0, divine: false });
const kill: SimEvent = { t: 'kill', def: '妖', ...at, bounty: 2 };
const SAMPLES: { [K in SimEvent['t']]: Array<Extract<SimEvent, { t: K }>> } = {
  shot: SHOT_KINDS.map((kind) => ({ t: 'shot', kind, unit: '箭', cell: 0, ...at, tx: 0, ty: 0, divine: false })),
  hit: [{ t: 'hit', uid: 1, ...at, unit: '箭', dmg: 5 }],
  impact: SHOT_KINDS.map((kind) => ({ t: 'impact', kind, unit: '火', ...at })),
  kill: [{ t: 'kill', def: '妖', ...at, bounty: 2 }, { t: 'kill', def: '白骨精', ...at, bounty: 40 }],
  leak: [{ t: 'leak', ...at, dmg: 9 }],
  revive: [{ t: 'revive', ...at }],
  split: [{ t: 'split', ...at }],
  summon: [{ t: 'summon', ...at }],
  execute: [{ t: 'execute', ...at }],
  buy: [{ t: 'buy', cell: 0, unit: '箭' }],
  merge: [{ t: 'merge', cell: 0, level: 2 }],
  hero: [{ t: 'hero', cell: 0, unit: '悟空', from: 1 }],
  divine: [{ t: 'divine', cell: 0 }],
  sell: [{ t: 'sell', cell: 0, amount: 5 }],
  invalid: [{ t: 'invalid', cell: 0, msg: '不行' }],
  income: [{ t: 'income', cell: 0, amount: 3 }],
  heal: [{ t: 'heal', cell: 0, amount: 6 }],
  mirror: [{ t: 'mirror', cell: 0, ...at, dmg: 40, targets: [{ uid: 1, ...at }] }],
  unlock: [{ t: 'unlock', cell: 0 }],
  mode: [{ t: 'mode', cell: 0, mode: 'strong' }],
  refresh: [{ t: 'refresh' }],
  ultimate: HEROES.map((hero) => ({ t: 'ultimate', hero, cell: 0, ...at, tx: 0, ty: 0, path: 0, dir: 0, targets: [] })),
  encounterOffer: [{ t: 'encounterOffer', options: ['fortune', '宝箱', '盗宝妖'] }],
  encounter: [{ t: 'encounter', id: 'fortune' }],
  chest: [{ t: 'chest', cell: 0, unit: '火' }, { t: 'chest', cell: -1, unit: null }],
  steal: [{ t: 'steal', ...at, amount: 30 }],
  waveStart: [{ t: 'waveStart', wave: 1, boss: null, elite: false, mods: '' }, { t: 'waveStart', wave: 5, boss: '白骨精', elite: false, mods: '' }],
  waveClear: [{ t: 'waveClear', wave: 1, bonus: 20 }],
  enrage: [{ t: 'enrage' }],
  won: [{ t: 'won' }],
  lost: [{ t: 'lost' }],
};
const ALL_EVENTS: SimEvent[] = Object.values(SAMPLES).flat();

describe('sound recipes', () => {
  it('keep every voice in a playable range', () => {
    for (const [id, voices] of Object.entries(SOUNDS)) {
      expect(voices.length, id).toBeGreaterThan(0);
      expect(voices.flatMap(voiceProblems), id).toEqual([]);
    }
  });

  it('give every event a known sound or list it as silent', () => {
    for (const e of ALL_EVENTS) {
      const id = soundFor(e);
      if (id !== null) expect(SOUNDS[id], `${e.t} -> ${id}`).toBeDefined();
      else expect(SILENT_EVENTS.includes(e.t) || e.t === 'impact' || (e.t === 'shot' && e.kind === 'none'), `silent ${e.t}`).toBe(true);
    }
    for (const t of SILENT_EVENTS) for (const e of SAMPLES[t]) expect(soundFor(e)).toBeNull();
  });

  it('pick the right variant of an event', () => {
    expect(soundFor(SAMPLES.hit[0])).toBeNull();
    expect(SAMPLES.impact.map(soundFor).filter((id) => id !== null)).toEqual(['fireImpact']);
    expect(SAMPLES.kill.map(soundFor)).toEqual(['kill', 'bossKill']);
    expect(SAMPLES.waveStart.map(soundFor)).toEqual(['waveStart', 'bossWave']);
    expect(new Set(SAMPLES.ultimate.map(soundFor)).size).toBe(HEROES.length);
    expect(SAMPLES.shot.map(soundFor).filter((id) => id !== null)).toHaveLength(SHOT_KINDS.length - 1);
  });
});

describe('Sfx', () => {
  function setup() {
    const played: SoundId[] = [];
    const clock = { ms: 1000 };
    const sfx = new Sfx((id) => played.push(id), () => clock.ms);
    return { played, clock, sfx };
  }

  it('plays the same sound at most once per 50 ms', () => {
    const { played, clock, sfx } = setup();
    sfx.consume([kill, kill, kill]);
    expect(played).toEqual(['kill']);
    clock.ms += SFX_REPEAT_MS - 20;
    sfx.consume([kill]);
    sfx.play('kill');
    expect(played).toEqual(['kill']);
    clock.ms += 20;
    sfx.consume([kill]);
    expect(played).toEqual(['kill', 'kill']);
  });

  it('caps a burst at 8 sounds, keeping the important ones', () => {
    const { played, sfx } = setup();
    const burst = [...SHOT_KINDS.map(shot), kill, ...SAMPLES.waveClear, ...SAMPLES.won];
    sfx.consume(burst);
    expect(played).toHaveLength(SFX_MAX_PER_CALL);
    expect(played.slice(0, 2)).toEqual(['won', 'waveClear']);
    // The next batch is not limited by the last one.
    sfx.consume([...SAMPLES.leak]);
    expect(played).toHaveLength(SFX_MAX_PER_CALL + 1);
  });

  it('stays quiet for silent events', () => {
    const { played, sfx } = setup();
    sfx.consume([...SAMPLES.hit, ...SAMPLES.heal, ...SAMPLES.split, ...SAMPLES.summon]);
    sfx.consume([]);
    expect(played).toEqual([]);
  });
});

describe('sound settings in the save', () => {
  it('fill in defaults for a save from before sound existed', () => {
    const old = JSON.stringify({ unlocked: 3, wins: [1, 2], vault: { stones: 5, treasures: [], equipped: [] }, tutorialDone: true });
    const p = parseProgress(old, CHAPTERS.length);
    expect(p?.sound).toEqual({ muted: false, music: true });
    expect(p?.unlocked).toBe(3);
    expect(p?.tutorialDone).toBe(true);
  });

  it('keep saved settings and repair junk', () => {
    const saved = JSON.stringify({ unlocked: 1, wins: [], sound: { muted: true, music: false } });
    expect(parseProgress(saved, CHAPTERS.length)?.sound).toEqual({ muted: true, music: false });
    expect(parseSound('loud')).toEqual({ muted: false, music: true });
    expect(parseSound({ muted: 1, music: 0 })).toEqual({ muted: false, music: true });
  });
});

describe('procedural music', () => {
  it('gives every chapter its own stable tune', () => {
    const tunes = CHAPTERS.map((c) => makeTune(c.id));
    expect(makeTune(3)).toEqual(tunes[2]);
    expect(new Set(tunes.map((t) => JSON.stringify(t.melody))).size).toBe(CHAPTERS.length);
  });

  it('writes melodies that never overlap and end on the tonic', () => {
    for (const ch of CHAPTERS) {
      const t = makeTune(ch.id);
      expect(t.steps).toBe(BARS * STEPS_PER_BAR);
      expect(t.melody).toHaveLength(t.steps);
      expect(t.bass).toHaveLength(BARS);
      let free = 0;
      t.melody.forEach((n, s) => {
        if (!n) return;
        expect(s, `chapter ${ch.id} step ${s}`).toBeGreaterThanOrEqual(free);
        expect(n.deg >= 0 && n.deg < 10 && n.len > 0).toBe(true);
        free = s + n.len;
      });
      expect(free).toBe(t.steps);
      expect(t.melody.findLast((n) => n !== null)?.deg).toBe(5);
    }
  });

  it('moves the boss wave to A minor pentatonic', () => {
    const t = makeTune(1);
    const last = t.melody.findLastIndex((n) => n !== null);
    const pitchClass = (mode: MusicMode) => Math.round(69 + 12 * Math.log2(stepVoices(t, mode, last)[0].freq[1] / 440)) % 12;
    expect(pitchClass('battle')).toBe(0);
    expect(pitchClass('boss')).toBe(9);
  });

  it('only builds playable voices', () => {
    for (const ch of CHAPTERS) {
      const t = makeTune(ch.id);
      for (const mode of ['build', 'battle', 'boss'] as const) {
        const voices = Array.from({ length: t.steps }, (_, s) => stepVoices(t, mode, s)).flat();
        expect(voices.flatMap(voiceProblems), `chapter ${ch.id} ${mode}`).toEqual([]);
      }
    }
  });
});

// ---- a strict fake of the WebAudio API --------------------------------------------------------------------

class FakeParam {
  value: number;
  readonly events: Array<{ kind: string; v: number; t: number }> = [];
  constructor(v = 0) {
    this.value = v;
  }
  private log(kind: string, v: number, t: number): this {
    if (!Number.isFinite(v) || !Number.isFinite(t) || t < 0) throw new RangeError(`${kind}(${v}, ${t})`);
    this.events.push({ kind, v, t });
    return this;
  }
  setValueAtTime(v: number, t: number): this {
    this.value = v;
    return this.log('set', v, t);
  }
  linearRampToValueAtTime(v: number, t: number): this {
    return this.log('lin', v, t);
  }
  exponentialRampToValueAtTime(v: number, t: number): this {
    // Like browsers: an exponential ramp can't reach zero.
    if (!(v > 0)) throw new RangeError(`exponential ramp to ${v}`);
    return this.log('exp', v, t);
  }
  setTargetAtTime(v: number, t: number, _tau: number): this {
    return this.log('target', v, t);
  }
  cancelScheduledValues(t: number): this {
    return this.log('cancel', 0, t);
  }
}

class FakeNode {
  readonly outputs: unknown[] = [];
  disconnected = false;
  connect<T>(dest: T): T {
    this.outputs.push(dest);
    return dest;
  }
  disconnect(): void {
    this.disconnected = true;
  }
}

class FakeSource extends FakeNode {
  startAt = -1;
  stopAt = -1;
  ended = false;
  onended: (() => void) | null = null;
  start(t = 0): void {
    if (this.startAt >= 0) throw new Error('InvalidStateError: started twice');
    if (t < 0) throw new RangeError('start in the past');
    this.startAt = t;
  }
  stop(t = 0): void {
    if (this.startAt < 0) throw new Error('InvalidStateError: stop before start');
    this.stopAt = t;
  }
}

type FakeCompressor = FakeNode & { threshold: FakeParam; knee: FakeParam; ratio: FakeParam; attack: FakeParam; release: FakeParam };

class FakeContext {
  static last: FakeContext | null = null;
  state = 'suspended';
  currentTime = 0;
  readonly sampleRate = 48000;
  readonly destination = new FakeNode();
  readonly sources: FakeSource[] = [];
  readonly gains: Array<FakeNode & { gain: FakeParam }> = [];
  readonly compressors: FakeCompressor[] = [];
  constructor() {
    FakeContext.last = this;
  }
  resume(): Promise<void> {
    this.state = 'running';
    return Promise.resolve();
  }
  suspend(): Promise<void> {
    this.state = 'suspended';
    return Promise.resolve();
  }
  createGain() {
    const g = Object.assign(new FakeNode(), { gain: new FakeParam(1) });
    this.gains.push(g);
    return g;
  }
  createOscillator() {
    const o = Object.assign(new FakeSource(), { type: 'sine', frequency: new FakeParam(440), detune: new FakeParam(0) });
    this.sources.push(o);
    return o;
  }
  createBufferSource() {
    const s = Object.assign(new FakeSource(), { buffer: null as unknown, loop: false, playbackRate: new FakeParam(1) });
    this.sources.push(s);
    return s;
  }
  createBiquadFilter() {
    return Object.assign(new FakeNode(), { type: 'lowpass', frequency: new FakeParam(350), Q: new FakeParam(1) });
  }
  createDynamicsCompressor(): FakeCompressor {
    const c = Object.assign(new FakeNode(), { threshold: new FakeParam(), knee: new FakeParam(), ratio: new FakeParam(), attack: new FakeParam(), release: new FakeParam() });
    this.compressors.push(c);
    return c;
  }
  createBuffer(_channels: number, length: number, _rate: number) {
    const data = new Float32Array(length);
    return { length, getChannelData: () => data };
  }
  /** Moves the clock and ends the sources whose stop time has passed. */
  advance(seconds: number): void {
    this.currentTime += seconds;
    for (const s of this.sources) {
      if (s.ended || s.stopAt < 0 || s.stopAt > this.currentTime) continue;
      s.ended = true;
      s.onended?.();
    }
  }
}

function unlockedEngine(): { engine: AudioEngine; ctx: FakeContext } {
  vi.stubGlobal('AudioContext', FakeContext);
  const engine = new AudioEngine();
  engine.unlock();
  return { engine, ctx: FakeContext.last as FakeContext };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('audio engine', () => {
  it('is a silent no-op without WebAudio', () => {
    const engine = new AudioEngine();
    expect(() => {
      engine.unlock();
      engine.setMuted(true);
      engine.setMusicOn(false);
      engine.play(SOUNDS.coin);
      engine.suspend();
      engine.resume();
    }).not.toThrow();
    expect(engine.ctx).toBeNull();
    expect(engine.musicLayer()).toBeNull();
    music.want('battle', 1);
    expect(music.playing).toBe(false);
  });

  it('builds click-free voices for every sound and cleans them up', () => {
    const { engine, ctx } = unlockedEngine();
    expect(engine.running).toBe(true);
    for (const [id, voices] of Object.entries(SOUNDS)) {
      const sources = ctx.sources.length;
      const gains = ctx.gains.length;
      engine.play(voices);
      const made = ctx.sources.slice(sources);
      expect(made, id).toHaveLength(voices.length + voices.filter((v) => v.vibrato).length);
      expect(made.every((s) => s.startAt >= ctx.currentTime && s.stopAt > s.startAt), id).toBe(true);
      // Every voice's envelope starts from 0 and ends on an exponential fade to (almost) nothing.
      const envelopes = ctx.gains.slice(gains).filter((g) => g.gain.events.some((e) => e.kind === 'exp'));
      expect(envelopes, id).toHaveLength(voices.length);
      for (const g of envelopes) {
        const ev = g.gain.events;
        expect(ev[0]).toMatchObject({ kind: 'set', v: 0 });
        expect(ev[1].kind, id).toBe('lin');
        expect(ev[1].t - ev[0].t, id).toBeGreaterThanOrEqual(0.003 - 1e-9);
        expect(ev[ev.length - 1]).toMatchObject({ kind: 'exp', v: 0.0001 });
      }
      ctx.advance(5);
      expect(envelopes.every((g) => g.disconnected), id).toBe(true);
    }
  });

  it('limits peaks without boosting the rest of the mix', () => {
    const { ctx } = unlockedEngine();
    const lim = ctx.compressors[0];
    // The spec's compressor adds (1 / curve(0 dB))^0.6 of makeup gain; with a hard knee curve(0 dB) = T(1 - 1/R).
    expect(lim.knee.value).toBe(0);
    const makeup = 10 ** ((-0.6 * lim.threshold.value * (1 - 1 / lim.ratio.value)) / 20);
    const trim = lim.outputs[0] as FakeNode & { gain: FakeParam };
    expect(makeup * trim.gain.value).toBeCloseTo(1, 9);
    expect(trim.outputs).toEqual([ctx.destination]);
  });

  it('clamps an out-of-range voice into a click-free envelope', () => {
    const { engine, ctx } = unlockedEngine();
    const gains = ctx.gains.length;
    engine.play([{ osc: 'square', freq: [200, 0], dur: 0.05, attack: 0, hold: 1, gain: 2 }]);
    const ev = ctx.gains[gains].gain.events;
    expect(ev[1].t - ev[0].t).toBeGreaterThanOrEqual(0.003 - 1e-9);
    expect(Math.max(...ev.map((e) => e.v))).toBeLessThanOrEqual(1);
    expect(ev[ev.length - 1]).toMatchObject({ kind: 'exp', v: 0.0001 });
    expect(ev[ev.length - 1].t).toBeCloseTo(ev[0].t + 0.05);
  });

  it('plays nothing while muted', () => {
    const { engine, ctx } = unlockedEngine();
    engine.setMuted(true);
    const before = ctx.sources.length;
    engine.play(SOUNDS.won);
    expect(ctx.sources.length).toBe(before);
    expect(engine.musicActive).toBe(false);
  });
});

describe('music scheduler', () => {
  /** Advances the wall clock and the audio clock together in 25 ms scheduler ticks, asking for `mode` each tick. */
  function driver() {
    vi.useFakeTimers();
    const { engine, ctx } = unlockedEngine();
    const clock = { ms: 0 };
    const m = new Music(engine, () => clock.ms);
    const run = (seconds: number, mode?: MusicMode) => {
      for (let i = 0; i < Math.round(seconds / 0.025); i++) {
        clock.ms += 25;
        ctx.advance(0.025);
        if (mode) m.want(mode, 3);
        m.tick();
      }
    };
    return { engine, ctx, m, run };
  }

  it('queues notes just ahead, crossfades between modes and stops by itself', () => {
    const { ctx, m, run } = driver();
    m.want('build', 3);
    expect(m.playing).toBe(true);
    run(2, 'build');
    expect(m.layerCount).toBe(1);
    expect(ctx.sources.length).toBeGreaterThan(0);
    expect(Math.max(...ctx.sources.map((s) => s.startAt))).toBeLessThanOrEqual(ctx.currentTime + 0.1);
    run(0.2, 'battle');
    expect(m.layerCount).toBe(2);
    run(1.5, 'boss');
    expect(m.layerCount).toBe(1);
    // Nobody asks any more (paused, left the chapter): it fades out and the timer stops.
    run(2);
    expect(m.playing).toBe(false);
    expect(m.layerCount).toBe(0);
    const scheduled = ctx.sources.length;
    run(1);
    expect(ctx.sources.length).toBe(scheduled);
  });

  it('never starts while muted or with the music switched off', () => {
    const { engine, m, run } = driver();
    engine.setMusicOn(false);
    m.want('battle', 3);
    run(0.5, 'battle');
    expect(m.playing).toBe(false);
    engine.setMusicOn(true);
    run(0.1, 'battle');
    expect(m.playing).toBe(true);
    engine.setMuted(true);
    run(2, 'battle');
    expect(m.playing).toBe(false);
  });
});
