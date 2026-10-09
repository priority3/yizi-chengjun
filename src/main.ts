// Entry point: sets up the stage, waits for the brush font, then runs the scene loop.
import { LOG_TAG } from './config/brand.ts';
import { audio } from './platform/audio.ts';
import { wantsEditor } from './platform/editor-io.ts';
import { registerServiceWorker } from './platform/pwa.ts';
import { createStage, installGuards } from './platform/web.ts';
import { appIconDataUrl } from './render/app-icon.ts';
import { loadFonts } from './render/fonts.ts';
import { L, W } from './render/layout.ts';
import { sprites } from './render/sprites.ts';
import { attachGestures } from './ui/input.ts';
import { SceneManager } from './ui/scenes.ts';

declare global {
  interface Window {
    /** Dev-only handle for inspecting game state from the console. */
    __yzcj?: SceneManager;
    /** Dev-only: the app icon as a PNG data URL (`maskable` = full-bleed, emblem inside the safe zone). */
    __yzcjIcon?: (size: number, maskable?: boolean) => string;
  }
}

installGuards();
const root = document.getElementById('app');
if (!root) throw new Error('#app container is missing');
const stage = createStage(root);

stage.ctx.setTransform(stage.pixelRatio, 0, 0, stage.pixelRatio, 0, 0);
stage.ctx.fillStyle = '#1d1714';
stage.ctx.fillRect(0, 0, W, L.H);

if (!(await loadFonts())) console.warn(`${LOG_TAG} brush font not loaded; falling back to the system font`);
// Reason: anything painted before the font arrived used the fallback font.
sprites.clear();

// Every launch opens on the 健康游戏忠告 splash, except a page opened on the map editor (#editor, see below).
const scenes = new SceneManager(stage, { splash: !wantsEditor() });
attachGestures(stage, () => scenes.current);
// The saved sound settings apply before the first tap creates the AudioContext.
audio.setMuted(scenes.progress.sound.muted);
audio.setMusicOn(scenes.progress.sound.music);

/** Gestures that may start audio. Reason: a touch only counts as a user activation on release (touchend / pointerup). */
const UNLOCK_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'] as const;

function unlockAudio(e: Event): void {
  // Reason: Chrome logs a warning for audio started on a touch's pointerdown; its touchend follows anyway.
  if (e.type === 'pointerdown' && (e as PointerEvent).pointerType !== 'mouse') return;
  audio.unlock();
  if (audio.running) for (const t of UNLOCK_EVENTS) window.removeEventListener(t, unlockAudio, true);
}

/** Listens (capture phase, so nothing can swallow it) until a gesture has the audio running. Idempotent. */
function armAudioUnlock(): void {
  for (const t of UNLOCK_EVENTS) window.addEventListener(t, unlockAudio, true);
}
armAudioUnlock();
if (import.meta.env.DEV) window.__yzcj = scenes;
// Exports public/icons/*.png from the browser console (the project has no image assets or Node canvas).
if (import.meta.env.DEV) window.__yzcjIcon = appIconDataUrl;
// Offline play and the 有新版本 banner; a no-op in dev and wherever service workers are unavailable.
registerServiceWorker();

/**
 * The map editor (plan.md D1) has no button: the address …/#editor opens it, on load or when typed later (also in
 * production); leaving that address closes it again.
 */
function followAddress(): void {
  if (wantsEditor()) scenes.editor();
  else if (scenes.inEditor()) scenes.title();
}
window.addEventListener('hashchange', followAddress);
followAddress();

let last = performance.now();

function frame(now: number): void {
  // Reason: clamp long gaps (tab switches, breakpoints) so the simulation never tries to catch up minutes at once.
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;
  scenes.current.update(dt);
  stage.ctx.setTransform(stage.pixelRatio, 0, 0, stage.pixelRatio, 0, 0);
  scenes.current.render(stage.ctx);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) scenes.current.pause?.();
  last = performance.now();
  if (document.hidden) {
    audio.suspend();
  } else {
    audio.resume();
    // Reason: iOS may refuse to resume outside a gesture; then the next tap unlocks the audio again.
    armAudioUnlock();
  }
});
window.addEventListener('pagehide', () => scenes.current.pause?.());
