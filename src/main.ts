// Web entry point: installs the browser platform (platform/web.ts), starts the game (boot.ts), then adds what only the
// web version has: the map editor at …/#editor, offline play and updates (service worker), and the dev console hooks.
import { startGame } from './boot.ts';
import { wantsEditor } from './platform/editor-io.ts';
import { installPlatform, platform } from './platform/env.ts';
import { registerServiceWorker } from './platform/pwa.ts';
import { showShareOverlay } from './platform/share.ts';
import { installGuards, webPlatform } from './platform/web.ts';
import { appIconDataUrl } from './render/app-icon.ts';
import { renderShareCard, type ShareInfo } from './render/share-card.ts';
import { EditorScene } from './ui/editor-scene.ts';
import type { Scene, SceneManager } from './ui/scenes.ts';
import { sampleShareInfo, shareText } from './ui/share-result.ts';

declare global {
  interface Window {
    /** Dev-only handle for inspecting game state from the console. */
    __yzcj?: SceneManager;
    /** Dev-only: the app icon as a PNG data URL (`maskable` = full-bleed, emblem inside the safe zone). */
    __yzcjIcon?: (size: number, maskable?: boolean) => string;
    /** Dev only: paints a result card and shows it in the save-image overlay; returns the PNG as a data URL. */
    __yzcjShare?: (patch?: Partial<ShareInfo>) => string;
  }
}

installPlatform(webPlatform());
installGuards();

// Every launch opens on the 健康游戏忠告 splash, except a page opened on the map editor (#editor, see below).
const scenes = await startGame({ splash: !wantsEditor(), editor: (nav, stage) => new EditorScene(nav, stage) });
if (import.meta.env.DEV) window.__yzcj = scenes;
// Exports public/icons/*.png from the browser console (the project has no image assets or Node canvas).
if (import.meta.env.DEV) window.__yzcjIcon = appIconDataUrl;
if (import.meta.env.DEV) window.__yzcjShare = devShare;
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

window.addEventListener('pagehide', () => scenes.current.pause?.());

/**
 * Dev console hook. `__yzcjShare()` paints the card of the run on screen (in any phase) or, away from a run, a sample
 * chapter-1 win; `__yzcjShare({ chapter: 8 })` paints a sample of chapter 8; any other fields patch the card, e.g.
 * `__yzcjShare({ won: false, waves: 3, stars: undefined })`. Shows it in the overlay (never the share sheet).
 */
function devShare(patch: Partial<ShareInfo> = {}): string {
  // Reason: only a run's scene (ui/game-scene.ts) has shareInfo; the Scene interface doesn't promise it.
  const scene = scenes.current as Scene & { shareInfo?: () => ShareInfo };
  const base = patch.chapter === undefined && scene.shareInfo ? scene.shareInfo() : sampleShareInfo(patch.chapter ?? 1, new Date());
  const info: ShareInfo = { ...base, ...patch };
  const url = renderShareCard(info).toDataURL('image/png');
  showShareOverlay(url, shareText(info, platform().shareUrl()));
  return url;
}
