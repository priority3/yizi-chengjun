// Vertical scrolling of a long page (the 关于 screen): the page follows a dragging finger or mouse, coasts on after a
// flick and slows down, glides to wheel steps and jump targets, and never leaves its content. Pure: the scene feeds
// it the gestures of ui/input.ts and its frame times, so tests/scroller.test.ts drives it directly.

/** How quickly a fling slows down (1/s): its speed falls by a factor e every 1/FRICTION seconds. */
const FRICTION = 4.5;
/** A fling stops below this speed (design px/s). */
const MIN_SPEED = 20;
/** Fastest fling (design px/s). */
const MAX_SPEED = 4000;
/** Only the drag's movement during this last stretch (seconds) sets the fling's speed. */
const FLING_WINDOW = 0.1;
/** How quickly a glide (wheel, jump) closes in on its target (1/s). */
const EASE = 14;
/** Largest single wheel step (design px). Reason: some mice and trackpads report a huge delta for one notch. */
const MAX_WHEEL = 240;

/** Where the page was (offset) at a moment of the scroller's clock (t). */
interface Sample {
  t: number;
  offset: number;
}

export class Scroller {
  /** How far the page is scrolled: 0 shows its top, maxOffset its bottom. */
  offset = 0;
  private max = 0;
  /** Seconds of update() so far: the clock the drag's samples are stamped with. */
  private now = 0;
  /** A fling's speed (design px/s, positive = down the page); 0 when not flinging. */
  private velocity = 0;
  /** Where a glide is heading; null when not gliding. */
  private target: number | null = null;
  /** The drag in progress: where it started and its recent positions; null when not dragging. */
  private drag: { startY: number; startOffset: number; samples: Sample[] } | null = null;

  /** The page is `content` tall and `view` of it shows at a time. */
  setRange(content: number, view: number): void {
    this.max = Math.max(0, content - view);
    this.offset = this.clamp(this.offset);
    if (this.target !== null) this.target = this.clamp(this.target);
  }

  /** The largest offset: the page's bottom edge at the bottom of the view. */
  get maxOffset(): number {
    return this.max;
  }

  /** Whether the page moves by itself (a fling or a glide). */
  get moving(): boolean {
    return this.velocity !== 0 || this.target !== null;
  }

  /** A press on the page: it stops where it is, like a finger catching a sliding sheet. */
  hold(): void {
    this.velocity = 0;
    this.target = null;
  }

  /** A drag began with the finger at screen height `y`. */
  dragStart(y: number): void {
    this.hold();
    this.drag = { startY: y, startOffset: this.offset, samples: [{ t: this.now, offset: this.offset }] };
  }

  /** The finger is now at screen height `y`: the page moves with it (finger up = further down the page). */
  dragMove(y: number): void {
    const d = this.drag;
    if (!d) return;
    this.offset = this.clamp(d.startOffset + (d.startY - y));
    d.samples.push({ t: this.now, offset: this.offset });
    while (d.samples.length > 2 && this.now - d.samples[0].t > FLING_WINDOW) d.samples.shift();
  }

  /** The finger lifted: the page coasts on at the speed it moved during the drag's last moments. */
  dragEnd(): void {
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    const recent = d.samples.filter((s) => this.now - s.t <= FLING_WINDOW);
    if (recent.length < 2) return;
    const first = recent[0];
    const last = recent[recent.length - 1];
    // Reason: moves reported within one frame share a timestamp; count them as one frame's worth of time at least.
    const v = (last.offset - first.offset) / Math.max(1 / 60, this.now - first.t);
    this.velocity = Math.abs(v) < MIN_SPEED ? 0 : Math.max(-MAX_SPEED, Math.min(MAX_SPEED, v));
  }

  /** Ends a drag where it is, without a fling (a second finger turned it into a pinch). */
  cancelDrag(): void {
    this.drag = null;
  }

  /** A wheel or trackpad scroll: positive `deltaY` moves further down the page. Steps add up while gliding. */
  wheel(deltaY: number): void {
    this.velocity = 0;
    const step = Math.max(-MAX_WHEEL, Math.min(MAX_WHEEL, deltaY));
    this.target = this.clamp((this.target ?? this.offset) + step);
  }

  /** Glides to `offset` (kept inside the page), e.g. the top of a section. */
  scrollTo(offset: number): void {
    this.velocity = 0;
    this.target = this.clamp(offset);
  }

  update(dt: number): void {
    if (dt <= 0) return;
    this.now += dt;
    if (this.drag) return;
    if (this.target !== null) {
      this.offset += (this.target - this.offset) * (1 - Math.exp(-EASE * dt));
      if (Math.abs(this.target - this.offset) < 0.5) {
        this.offset = this.target;
        this.target = null;
      }
    } else if (this.velocity !== 0) {
      const next = this.offset + this.velocity * dt;
      this.offset = this.clamp(next);
      this.velocity *= Math.exp(-FRICTION * dt);
      // Reason: reaching either end stops the fling rather than leaving it pressing against the edge.
      if (this.offset !== next || Math.abs(this.velocity) < MIN_SPEED) this.velocity = 0;
    }
  }

  private clamp(offset: number): number {
    return Math.max(0, Math.min(this.max, offset));
  }
}
