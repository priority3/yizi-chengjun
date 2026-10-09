// Build-time helpers for the service worker (see sw-plugin.ts): which built files to precache, the cache name,
// and filling the hand-written worker template. Pure functions, so tests can run them without a build.
import { createHash } from 'node:crypto';

/** File name of the worker in the build output (next to index.html). */
export const SW_FILE = 'sw.js';
/** Every cache the game creates starts with this; the worker deletes the other ones it finds on activation. */
export const CACHE_PREFIX = 'yzcj-';
/** The page the worker answers navigations with when the network is down or too slow. */
export const INDEX_FILE = 'index.html';

/** One file of the build output. */
export interface BuildFile {
  /** Path relative to the output directory, with forward slashes (e.g. `assets/index-abc.js`). */
  name: string;
  /** Contents; hashed, so the cache name changes whenever any precached file does. */
  source: string | Uint8Array;
}

export interface Precache {
  /** Cache Storage name: `yzcj-<version>-<hash of every precached path and its contents>`. */
  cacheName: string;
  /** Precached paths, relative to sw.js (so the game works under any sub-path), sorted. */
  urls: string[];
}

/** Folder of the app icons (public/icons), which the worker leaves to the browser. */
export const ICONS_DIR = 'icons/';

/**
 * Whether a built file belongs in the precache: everything except source maps, dotfiles, the app icons and the
 * worker itself.
 */
export function isPrecached(name: string): boolean {
  if (name === SW_FILE || name.endsWith('.map')) return false;
  // Reason: the icons are only fetched when the game is installed or added to the home screen, and the system keeps
  // its own copy; precached, their ~0.8 MB would be downloaded again with every release although they never change.
  if (name.startsWith(ICONS_DIR)) return false;
  // Reason: dotfiles (.DS_Store, Vite's .vite/manifest.json) are never requested by the game.
  return !name.split('/').some((part) => part.startsWith('.'));
}

function sha256(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * The precache list and cache name for a build. Deterministic: input order doesn't matter; a changed, added,
 * removed or renamed file changes the name.
 * Reason: index.html, the fonts and the manifest keep their names from build to build, so the name hashes contents
 * rather than relying on Vite's hashed asset names.
 */
export function buildPrecache(files: readonly BuildFile[], version: string): Precache {
  const digests = new Map<string, string>();
  for (const f of files) {
    // Reason: a public file shadowed by a bundle file of the same name is overwritten in the output; callers pass
    // the bundle first, so the first copy is the one that ends up in dist.
    if (isPrecached(f.name) && !digests.has(f.name)) digests.set(f.name, sha256(f.source));
  }
  const urls = [...digests.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const listing = urls.map((u) => `${u} ${digests.get(u)}`).join('\n');
  return { cacheName: `${CACHE_PREFIX}${version}-${sha256(listing).slice(0, 10)}`, urls };
}

/** Placeholders in build/sw-template.js, replaced by JSON literals. */
const PLACEHOLDERS = { cacheName: '__CACHE_NAME__', urls: '__PRECACHE__' } as const;

/** Fills the worker template; throws when the template lost a placeholder (the worker would silently break). */
export function renderServiceWorker(template: string, precache: Precache): string {
  let out = template;
  for (const [key, mark] of Object.entries(PLACEHOLDERS) as [keyof typeof PLACEHOLDERS, string][]) {
    if (!out.includes(mark)) throw new Error(`service worker template is missing ${mark}`);
    const value = key === 'cacheName' ? JSON.stringify(precache.cacheName) : JSON.stringify(precache.urls, null, 2);
    // Reason: split/join rather than String.replace, so `$` sequences in file names are never read as patterns.
    out = out.split(mark).join(value);
  }
  return out;
}
