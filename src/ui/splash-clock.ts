// Timing of the launch splash (健康游戏忠告 and the 适龄提示 badge, ui/splash-scene.ts): it fades in, a tap anywhere
// continues once it has been up for SPLASH.tapAfter seconds (an earlier tap is kept and acts at that moment), it
// continues by itself after SPLASH.autoAfter seconds, and it fades out. A pure state machine driven by the scene's
// update(dt) and tap(), so tests/splash.test.ts can step through it.

/** The splash's timing, in seconds since it appeared. */
export const SPLASH = {
  /** The advice fades in over this long. */
  fadeIn: 0.35,
  /** A tap continues only once the splash has been up this long. */
  tapAfter: 1,
  /** Without a tap, the splash continues by itself at this point. */
  autoAfter: 3,
  /** The splash fades out into the title screen over this long. */
  fadeOut: 0.4,
  /** The 点击任意处继续 hint fades in over this long once taps continue. */
  hintIn: 0.3,
} as const;

/** showing: up (fading in, then waiting); leaving: fading out; done: gone, the title screen takes over. */
export type SplashPhase = 'showing' | 'leaving' | 'done';

export class SplashClock {
  /** Seconds since the splash appeared. */
  t = 0;
  /** When the fade-out began (seconds since the splash appeared); null while showing. */
  private leftAt: number | null = null;
  /** A tap came before taps could continue: the splash leaves as soon as they can. */
  private tapped = false;

  update(dt: number): void {
    this.t += Math.max(0, dt);
    if (this.leftAt !== null) return;
    const due = this.tapped ? SPLASH.tapAfter : SPLASH.autoAfter;
    // Reason: the fade-out starts at the moment it was due, so a long frame (up to 0.1 s) can't shorten it unevenly.
    if (this.t >= due) this.leftAt = due;
  }

  /** A tap anywhere: continues now if the splash has been up long enough, else as soon as it has. */
  tap(): void {
    if (this.leftAt !== null) return;
    if (this.t >= SPLASH.tapAfter) this.leftAt = this.t;
    else this.tapped = true;
  }

  get phase(): SplashPhase {
    if (this.leftAt === null) return 'showing';
    return this.t >= this.leftAt + SPLASH.fadeOut ? 'done' : 'leaving';
  }

  /** How much of the splash shows: rises to 1 while fading in, falls back to 0 while fading out. */
  get alpha(): number {
    const shown = Math.min(1, this.t / SPLASH.fadeIn);
    if (this.leftAt === null) return shown;
    return Math.min(shown, Math.max(0, 1 - (this.t - this.leftAt) / SPLASH.fadeOut));
  }

  /** Opacity of the 点击任意处继续 hint (before the splash's own fade): 0 until a tap would continue. */
  get hint(): number {
    return Math.min(1, Math.max(0, (this.t - SPLASH.tapAfter) / SPLASH.hintIn));
  }
}
