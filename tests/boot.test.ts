// The shared start (src/boot.ts) on a platform with no browser behind it, the way a mini-game build will run it: the
// stage cleared to the backdrop colour, the brush font asked for, the title screen up, input from the platform's
// pointer feed, frames from its frame callback (long gaps clamped), and pausing and silence in the background.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startGame } from '../src/boot.ts';
import { audio } from '../src/platform/audio.ts';
import { installPlatform, type PointerSample } from '../src/platform/env.ts';
import { webPlatform } from '../src/platform/web.ts';
import { MIN_H, setDesignHeight } from '../src/render/layout.ts';
import type { Scene } from '../src/ui/scenes.ts';
import { startButton } from '../src/ui/title-layout.ts';
import { fakePlatform, type FakePlatform } from './fake-platform.ts';

let env: FakePlatform;

beforeEach(() => {
  setDesignHeight(MIN_H);
  env = fakePlatform();
  installPlatform(env);
  // The fake platform has no brush font: boot says so once.
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  installPlatform(webPlatform());
  vi.restoreAllMocks();
});

/** Runs the frame the game asked for, at time `now` (ms on the platform clock). */
function runFrame(now: number): void {
  const frame = env.frames.shift();
  if (!frame) throw new Error('the game asked for no frame');
  frame(now);
}

describe('boot', () => {
  it('starts on any platform: backdrop, font, title screen, input and the frame loop', async () => {
    const scenes = await startGame({ splash: false });
    expect(env.screen.fills[0]).toBe('#1d1714');
    expect(env.fontLoads).toEqual([2500]);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('brush font not loaded'));
    expect([env.sinks.length, env.unlocks.length, env.visibility.length, env.frames.length]).toEqual([1, 1, 1, 1]);
    // Without an audio context a gesture can't start sound, so the platform keeps offering gestures.
    expect(env.unlocks[0]()).toBe(false);

    // Each frame draws the current scene, the title screen, and asks for the next one.
    runFrame(1016);
    expect(env.screen.texts).toContain('开始游戏');
    expect(env.frames).toHaveLength(1);

    // A tap from the platform's pointer feed reaches the title screen: 开始游戏 opens the chapter screen.
    const title = scenes.current;
    const b = startButton(false);
    const p: PointerSample = { id: 1, x: b.x + b.w / 2, y: b.y + b.h / 2, touch: true, primary: true };
    env.sinks[0].down(p, () => {});
    env.sinks[0].up(p);
    expect(scenes.current).not.toBe(title);
    env.screen.texts.length = 0;
    runFrame(1032);
    expect(env.screen.texts).toContain('选择章节');
  });

  it('clamps long gaps between frames, and pauses and goes quiet in the background', async () => {
    const scenes = await startGame({ splash: false });
    const steps: number[] = [];
    const pause = vi.fn();
    const stub: Scene = { update: (dt) => steps.push(Number(dt.toFixed(3))), render: () => {}, pause };
    scenes.current = stub;
    // The loop started at the platform clock's 1000 ms; then a minute passes in one frame (a breakpoint, a stall).
    runFrame(1016);
    runFrame(1032);
    runFrame(61032);
    expect(steps).toEqual([0.016, 0.016, 0.1]);

    const suspend = vi.spyOn(audio, 'suspend');
    const resume = vi.spyOn(audio, 'resume');
    env.clock = 90000;
    env.visibility[0](false);
    expect(pause).toHaveBeenCalledTimes(1);
    expect(suspend).toHaveBeenCalledTimes(1);
    // Back in front: time restarts from the moment the game came back, and gestures may start the audio again.
    env.clock = 95000;
    env.visibility[0](true);
    expect(resume).toHaveBeenCalledTimes(1);
    expect(env.unlocks).toHaveLength(2);
    runFrame(95016);
    expect(steps.at(-1)).toBe(0.016);
  });

  it('leaves the map editor out unless the entry hands one over', async () => {
    const scenes = await startGame({ splash: false });
    const title = scenes.current;
    scenes.editor();
    expect(scenes.current).toBe(title);
  });
});
