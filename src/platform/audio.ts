// WebAudio engine. Every sound in the game is synthesized here from Voice recipes (config/sounds.ts): there are
// no audio files. Lazy: no AudioContext exists until unlock() runs inside a user gesture (iOS and Chrome refuse
// to start audio otherwise). Graph: sfx bus + music bus -> master -> limiter (-4 dBFS) -> speakers.
// The context comes from the platform (platform/env.ts createAudioContext), so any WebAudio-compatible context works.
// Every method is a silent no-op without WebAudio (Node tests, old browsers) and never throws: sound is
// optional, the game must keep running.
import type { Voice } from '../config/sounds.ts';
import { platform } from './env.ts';

/** Starting bus volumes (0..1). Music sits well under the effects. */
export const MASTER_VOLUME = 0.6;
export const SFX_VOLUME = 0.8;
export const MUSIC_VOLUME = 0.35;

/** Envelope floor: exponential ramps can't reach 0, and -80 dB is inaudible. */
const SILENT = 0.0001;
/** Shortest attack; anything faster clicks. */
const MIN_ATTACK = 0.003;
/** Scheduling lead so a voice never starts in the audio thread's past (that would cut its attack and click). */
const LEAD = 0.005;
/** Voices alive at once; beyond this new ones are dropped to protect slow phones. */
const MAX_VOICES = 48;
/** Time constant (s) of the mute / music on-off fades. */
const SWITCH_FADE = 0.03;
/** Output limiter: a hard knee at this level with a steep ratio, a safety net only big bursts reach. */
const LIMIT_DB = -4;
const LIMIT_RATIO = 20;

/** A gain node at `value`, already connected to `dest`. */
function gainNode(ctx: AudioContext, value: number, dest: AudioNode): GainNode {
  const g = ctx.createGain();
  g.gain.value = value;
  g.connect(dest);
  return g;
}

/** Sets `p` to `from` at `t` and glides exponentially to `to` by `end` (stays constant when they are equal). */
function glide(p: AudioParam, from: number, to: number, t: number, end: number): void {
  p.setValueAtTime(from, t);
  if (to !== from && from > 0 && to > 0) p.exponentialRampToValueAtTime(to, end);
}

/** Ignores a rejected promise (resume/suspend can reject while the page is in the background). */
function settle(p: Promise<void> | undefined): void {
  void Promise.resolve(p).catch(() => undefined);
}

export class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  /** One second of white noise, looped by every noise voice from a random offset. */
  private noise: AudioBuffer | null = null;
  private isMuted = false;
  private isMusicOn = true;
  private live = 0;
  /** WebAudio is missing or failed once: stop trying. */
  private broken = false;

  /** The context, once unlocked (for the music scheduler). */
  get ctx(): AudioContext | null {
    return this.context;
  }

  /** Context time in seconds (0 before unlock). */
  get now(): number {
    return this.context?.currentTime ?? 0;
  }

  get running(): boolean {
    return this.context?.state === 'running';
  }

  get muted(): boolean {
    return this.isMuted;
  }

  get musicOn(): boolean {
    return this.isMusicOn;
  }

  /** Music may play: the context runs, sound isn't muted and music is switched on. */
  get musicActive(): boolean {
    return this.running && !this.isMuted && this.isMusicOn;
  }

  /** Creates the context on first use and resumes it. Call from a user gesture; safe to call again. */
  unlock(): void {
    if (this.broken) return;
    try {
      if (!this.context) this.create();
      this.resume();
    } catch {
      // Reason: a browser that throws while building the graph won't do better on the next tap.
      this.broken = true;
    }
  }

  /** Page hidden: stop the audio thread. */
  suspend(): void {
    const ctx = this.context;
    if (!ctx || ctx.state !== 'running') return;
    try {
      settle(ctx.suspend());
    } catch {
      // Ignore: an old engine without suspend() just keeps running silently.
    }
  }

  /** Page visible again (or a gesture): restart a suspended or interrupted context. */
  resume(): void {
    const ctx = this.context;
    if (!ctx || ctx.state === 'running' || ctx.state === 'closed') return;
    try {
      settle(ctx.resume());
    } catch {
      // Ignore: the next user gesture calls unlock() and tries again.
    }
  }

  setMuted(muted: boolean): void {
    this.isMuted = muted;
    this.fadeTo(this.master, muted ? 0 : MASTER_VOLUME);
  }

  setMusicOn(on: boolean): void {
    this.isMusicOn = on;
    this.fadeTo(this.musicBus, on ? MUSIC_VOLUME : 0);
  }

  /** Plays a sound effect now. */
  play(voices: readonly Voice[]): void {
    const ctx = this.context;
    if (!ctx || !this.sfxBus || this.isMuted || ctx.state !== 'running') return;
    this.start(ctx, voices, ctx.currentTime + LEAD, this.sfxBus);
  }

  /** Schedules voices at context time `when` into `dest`, a music layer from musicLayer(). */
  schedule(voices: readonly Voice[], when: number, dest: AudioNode): void {
    const ctx = this.context;
    if (!ctx || this.isMuted || ctx.state !== 'running') return;
    this.start(ctx, voices, Math.max(when, ctx.currentTime + LEAD), dest);
  }

  /** A fresh silent gain node on the music bus: one per music layer, so two layers can crossfade. */
  musicLayer(): GainNode | null {
    const ctx = this.context;
    if (!ctx || !this.musicBus) return null;
    try {
      return gainNode(ctx, 0, this.musicBus);
    } catch {
      return null;
    }
  }

  private create(): void {
    const ctx = platform().createAudioContext();
    if (!ctx) {
      this.broken = true;
      return;
    }
    // Reason: a big fight can stack a dozen voices, and clipping sounds far worse than squashing the peaks.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = LIMIT_DB;
    limiter.knee.value = 0;
    limiter.ratio.value = LIMIT_RATIO;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    // Reason: WebAudio's compressor always adds a fixed makeup gain of (1 / curve(1.0))^0.6, which with a hard
    // knee is 0.6 x |threshold| x (1 - 1/ratio) dB. Undo it, so the limiter only ever turns peaks down.
    const makeupDb = -0.6 * LIMIT_DB * (1 - 1 / LIMIT_RATIO);
    limiter.connect(gainNode(ctx, 10 ** (-makeupDb / 20), ctx.destination));
    const master = gainNode(ctx, this.isMuted ? 0 : MASTER_VOLUME, limiter);
    this.sfxBus = gainNode(ctx, SFX_VOLUME, master);
    this.musicBus = gainNode(ctx, this.isMusicOn ? MUSIC_VOLUME : 0, master);
    this.master = master;
    const n = ctx.sampleRate;
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buf;
    // Reason: old iOS only opens the audio output once a buffer source has started inside the gesture.
    const prime = ctx.createBufferSource();
    prime.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    prime.connect(ctx.destination);
    prime.start(0);
    this.context = ctx;
  }

  private fadeTo(node: GainNode | null, value: number): void {
    const ctx = this.context;
    if (!ctx || !node) return;
    try {
      node.gain.cancelScheduledValues(ctx.currentTime);
      node.gain.setTargetAtTime(value, ctx.currentTime, SWITCH_FADE);
    } catch {
      // Ignore: the setting is stored and applied on the next unlock.
    }
  }

  private start(ctx: AudioContext, voices: readonly Voice[], t0: number, dest: AudioNode): void {
    for (const v of voices) {
      if (this.live >= MAX_VOICES) return;
      try {
        this.voice(ctx, v, t0 + Math.max(0, v.delay ?? 0), dest);
      } catch {
        // A refused node never stops the game; the other voices still play.
      }
    }
  }

  /** Builds one voice: source (oscillator or noise) -> optional filter -> envelope -> dest. */
  private voice(ctx: AudioContext, v: Voice, t: number, dest: AudioNode): void {
    const dur = Math.max(0.01, v.dur);
    const end = t + dur;
    const attack = Math.min(Math.max(MIN_ATTACK, v.attack), dur * 0.9);
    const hold = Math.max(0, Math.min(v.hold ?? 0, dur - attack - 0.01));
    const peak = Math.min(1, Math.max(SILENT, v.gain));
    const nodes: AudioNode[] = [];
    const amp = ctx.createGain();
    nodes.push(amp);
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(peak, t + attack);
    if (hold > 0) amp.gain.setValueAtTime(peak, t + attack + hold);
    amp.gain.exponentialRampToValueAtTime(SILENT, end);
    let head: AudioNode = amp;
    if (v.filter) {
      const f = ctx.createBiquadFilter();
      nodes.push(f);
      f.type = v.filter.type;
      // Reason: WebAudio reads Q in dB for low/highpass but as a plain ratio for bandpass.
      f.Q.value = v.filter.q ?? (v.filter.type === 'bandpass' ? 1 : 0);
      glide(f.frequency, v.filter.from, v.filter.to, t, end);
      f.connect(amp);
      head = f;
    }
    let src: AudioScheduledSourceNode;
    if (v.osc === 'noise') {
      const n = ctx.createBufferSource();
      n.buffer = this.noise;
      n.loop = true;
      // Reason: slowing white noise down narrows its band to rate x Nyquist, so freq sets its brightness.
      const nyquist = ctx.sampleRate / 2;
      glide(n.playbackRate, v.freq[0] / nyquist, v.freq[1] / nyquist, t, end);
      n.connect(head);
      n.start(t, Math.random() * 0.9);
      src = n;
    } else {
      const o = ctx.createOscillator();
      o.type = v.osc;
      glide(o.frequency, v.freq[0], v.freq[1], t, end);
      if (v.vibrato) {
        const lfo = ctx.createOscillator();
        lfo.frequency.value = v.vibrato.rate;
        const depth = ctx.createGain();
        depth.gain.value = v.vibrato.depth;
        lfo.connect(depth);
        depth.connect(o.detune);
        lfo.start(t);
        lfo.stop(end);
        nodes.push(lfo, depth);
      }
      o.connect(head);
      o.start(t);
      src = o;
    }
    src.stop(end + 0.02);
    nodes.push(src);
    // Reason: reach the speakers only once the source has a scheduled stop, so a failure above can never
    // leave a looping noise source running.
    amp.connect(dest);
    this.live++;
    src.onended = () => {
      this.live--;
      for (const node of nodes) node.disconnect();
    };
  }
}

/** The game's one audio engine. */
export const audio = new AudioEngine();
