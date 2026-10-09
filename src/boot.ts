// Starts the game on the installed platform (platform/env.ts): the stage, the brush font, the scenes, input, the
// sound settings, the frame loop and pausing in the background. Platform-neutral: main.ts (the web entry) installs
// the web platform first and adds the web-only parts after; a mini-game entry installs its own platform instead.
import { LOG_TAG } from './config/brand.ts';
import { audio } from './platform/audio.ts';
import { platform } from './platform/env.ts';
import { loadFonts } from './render/fonts.ts';
import { L, W } from './render/layout.ts';
import { sprites } from './render/sprites.ts';
import { attachGestures } from './ui/input.ts';
import { SceneManager, type SceneOptions } from './ui/scenes.ts';

/** Boots the game and runs it; resolves to the scene manager once the first screen is up and the loop is running. */
export async function startGame(options: SceneOptions = {}): Promise<SceneManager> {
  const env = platform();
  const stage = env.createStage();

  stage.ctx.setTransform(stage.pixelRatio, 0, 0, stage.pixelRatio, 0, 0);
  stage.ctx.fillStyle = '#1d1714';
  stage.ctx.fillRect(0, 0, W, L.H);

  if (!(await loadFonts())) console.warn(`${LOG_TAG} brush font not loaded; falling back to the system font`);
  // Reason: anything painted before the font arrived used the fallback font.
  sprites.clear();

  const scenes = new SceneManager(stage, options);
  attachGestures(stage, () => scenes.current);
  // The saved sound settings apply before the first tap creates the AudioContext.
  audio.setMuted(scenes.progress.sound.muted);
  audio.setMusicOn(scenes.progress.sound.music);
  const unlock = (): boolean => {
    audio.unlock();
    return audio.running;
  };
  env.armAudioUnlock(unlock);

  let last = env.now();
  const frame = (now: number): void => {
    // Reason: clamp long gaps (tab switches, breakpoints) so the simulation never tries to catch up minutes at once.
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    scenes.current.update(dt);
    stage.ctx.setTransform(stage.pixelRatio, 0, 0, stage.pixelRatio, 0, 0);
    scenes.current.render(stage.ctx);
    env.requestFrame(frame);
  };
  env.requestFrame(frame);

  env.onVisibility((visible) => {
    if (!visible) scenes.current.pause?.();
    last = env.now();
    if (!visible) {
      audio.suspend();
    } else {
      audio.resume();
      // Reason: iOS may refuse to resume outside a gesture; then the next tap unlocks the audio again.
      env.armAudioUnlock(unlock);
    }
  });
  return scenes;
}
