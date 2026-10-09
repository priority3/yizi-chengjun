// Vite plugin that writes dist/sw.js: the hand-written worker in sw-template.js, filled with the list of files to
// precache (the whole bundle plus everything copied from public/) and a cache name that changes with the build.
// Replaces vite-plugin-pwa without adding a dependency; only active in `vite build`.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import { buildPrecache, INDEX_FILE, renderServiceWorker, SW_FILE, type BuildFile } from './precache.ts';

/** Every file under `dir`, as paths relative to it with forward slashes. */
function listFiles(dir: string, prefix = ''): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(dir, prefix), { withFileTypes: true })) {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listFiles(dir, name));
    else if (entry.isFile()) out.push(name);
  }
  return out;
}

/** The service worker plugin; `version` (package.json) becomes part of the cache name. */
export function serviceWorker(version: string): Plugin {
  let publicDir = '';
  return {
    name: 'yzcj:service-worker',
    apply: 'build',
    configResolved(config) {
      // Reason: only files Vite actually copies into the output may be precached (a 404 fails the whole install).
      // publicDir is an empty string when public/ is disabled.
      publicDir = config.build.copyPublicDir ? config.publicDir : '';
    },
    generateBundle: {
      // Reason: Vite adds index.html to the bundle in its own generateBundle; 'post' runs after it.
      order: 'post',
      handler(_options, bundle) {
        // The bundle first: buildPrecache keeps the first copy of a name, and bundle files overwrite public ones.
        const files: BuildFile[] = Object.values(bundle).map((f) => ({ name: f.fileName, source: f.type === 'chunk' ? f.code : f.source }));
        // Reason: Vite copies public/ into the output separately, so those files never show up in `bundle`.
        if (publicDir && existsSync(publicDir)) {
          for (const name of listFiles(publicDir)) files.push({ name, source: readFileSync(join(publicDir, name)) });
        }
        const precache = buildPrecache(files, version);
        if (!precache.urls.includes(INDEX_FILE)) this.error(`${INDEX_FILE} is missing from the build; the offline fallback needs it`);
        const template = readFileSync(new URL('./sw-template.js', import.meta.url), 'utf8');
        this.emitFile({ type: 'asset', fileName: SW_FILE, source: renderServiceWorker(template, precache) });
      },
    },
  };
}
