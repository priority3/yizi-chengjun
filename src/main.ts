// Entry point: sets up the stage, input and scenes, then runs the render loop.
import { createStage, installGuards } from './platform/web.ts';
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
