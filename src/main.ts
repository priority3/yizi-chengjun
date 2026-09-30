// Entry point: sets up the stage, waits for the brush font, then runs the scene loop.
import { createStage, installGuards } from './platform/web.ts';
import { loadFonts } from './render/fonts.ts';
import { L, W } from './render/layout.ts';
import { sprites } from './render/sprites.ts';
import { attachGestures } from './ui/input.ts';
import { SceneManager } from './ui/scenes.ts';

declare global {
  interface Window {
    /** Dev-only handle for inspecting game state from the console. */
    __zdxy?: SceneManager;
  }
}

installGuards();
const root = document.getElementById('app');
if (!root) throw new Error('#app container is missing');
const stage = createStage(root);

stage.ctx.setTransform(stage.pixelRatio, 0, 0, stage.pixelRatio, 0, 0);
stage.ctx.fillStyle = '#1d1714';
stage.ctx.fillRect(0, 0, W, L.H);

if (!(await loadFonts())) console.warn('[字斗西游] brush font not loaded; falling back to the system font');
// Reason: anything painted before the font arrived used the fallback font.
sprites.clear();

const scenes = new SceneManager(stage);
attachGestures(stage, () => scenes.current);
if (import.meta.env.DEV) window.__zdxy = scenes;

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
});
window.addEventListener('pagehide', () => scenes.current.pause?.());
