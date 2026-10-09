// The service worker's precache list and cache name (build/precache.ts), and filling the worker template.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildPrecache, isPrecached, renderServiceWorker, type BuildFile } from '../build/precache.ts';

/** A build output like `pnpm build` produces, with a source map and the worker itself mixed in. */
const BUILD: BuildFile[] = [
  { name: 'index.html', source: '<!doctype html><script src="./assets/index-abc.js"></script>' },
  { name: 'assets/index-abc.js', source: 'console.log("game")' },
  { name: 'assets/index-abc.js.map', source: '{"version":3}' },
  { name: 'sw.js', source: 'self.addEventListener("fetch", () => {})' },
  { name: 'fonts/zdxy-brush.woff2', source: new Uint8Array([0x77, 0x4f, 0x46, 0x32, 1, 2, 3]) },
  { name: 'fonts/OFL.txt', source: 'SIL Open Font License' },
  { name: 'manifest.webmanifest', source: '{"name":"字斗西游"}' },
  { name: 'icons/icon-192.png', source: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) },
  { name: '.DS_Store', source: 'junk' },
];

/** BUILD with the file `name` given new contents. */
function edited(name: string, source: string | Uint8Array): BuildFile[] {
  return BUILD.map((f) => (f.name === name ? { name, source } : f));
}

describe('precache list', () => {
  it('lists index.html, the bundle, the fonts, the manifest and the icons, sorted', () => {
    expect(buildPrecache(BUILD, '0.6.0').urls).toEqual([
      'assets/index-abc.js',
      'fonts/OFL.txt',
      'fonts/zdxy-brush.woff2',
      'icons/icon-192.png',
      'index.html',
      'manifest.webmanifest',
    ]);
  });

  it('leaves out source maps, dotfiles and the worker itself', () => {
    expect(isPrecached('assets/index-abc.js.map')).toBe(false);
    expect(isPrecached('sw.js')).toBe(false);
    expect(isPrecached('.DS_Store')).toBe(false);
    expect(isPrecached('.vite/manifest.json')).toBe(false);
    expect(isPrecached('fonts/zdxy-brush.woff2')).toBe(true);
    expect(isPrecached('icons/sw.js.png')).toBe(true);
  });

  it('keeps the first copy of a name (the bundle wins over public/)', () => {
    const once = buildPrecache(BUILD, '0.6.0');
    const twice = buildPrecache([...BUILD, { name: 'index.html', source: 'a stale public copy' }], '0.6.0');
    expect(twice).toEqual(once);
  });
});

describe('cache name', () => {
  const base = buildPrecache(BUILD, '0.6.0');

  it('is zdxy-<version>-<hash> and deterministic, whatever order the files come in', () => {
    expect(base.cacheName).toMatch(/^zdxy-0\.6\.0-[0-9a-f]{10}$/);
    expect(buildPrecache([...BUILD].reverse(), '0.6.0')).toEqual(base);
  });

  it('changes when any precached file changes, even one whose name stays the same', () => {
    expect(buildPrecache(edited('index.html', '<!doctype html><p>new</p>'), '0.6.0').cacheName).not.toBe(base.cacheName);
    expect(buildPrecache(edited('fonts/zdxy-brush.woff2', new Uint8Array([9])), '0.6.0').cacheName).not.toBe(base.cacheName);
    expect(buildPrecache(edited('manifest.webmanifest', '{}'), '0.6.0').cacheName).not.toBe(base.cacheName);
  });

  it('changes when a file is added, removed or renamed, and with the version', () => {
    const added = buildPrecache([...BUILD, { name: 'icons/icon-512.png', source: 'png' }], '0.6.0');
    const removed = buildPrecache(BUILD.filter((f) => f.name !== 'fonts/OFL.txt'), '0.6.0');
    const renamed = buildPrecache(BUILD.map((f) => (f.name === 'assets/index-abc.js' ? { ...f, name: 'assets/index-xyz.js' } : f)), '0.6.0');
    const names = new Set([base, added, removed, renamed, buildPrecache(BUILD, '0.7.0')].map((p) => p.cacheName));
    expect(names.size).toBe(5);
  });

  it('ignores files that are not precached', () => {
    expect(buildPrecache(edited('assets/index-abc.js.map', '{"version":3,"x":1}'), '0.6.0')).toEqual(base);
    expect(buildPrecache(edited('sw.js', '// other worker'), '0.6.0')).toEqual(base);
  });
});

describe('worker template', () => {
  const template = readFileSync(new URL('../build/sw-template.js', import.meta.url), 'utf8');

  it('gets the cache name and the list as JSON, with no placeholder left', () => {
    const precache = buildPrecache(BUILD, '0.6.0');
    const sw = renderServiceWorker(template, precache);
    expect(sw).toContain(`const CACHE = ${JSON.stringify(precache.cacheName)};`);
    expect(sw).toContain('"fonts/zdxy-brush.woff2"');
    expect(sw).not.toMatch(/__CACHE_NAME__|__PRECACHE__/);
    // It still parses as a script.
    expect(() => new Function(sw)).not.toThrow();
  });

  it('copes with $ in file names and refuses a template without its placeholders', () => {
    const sw = renderServiceWorker('const CACHE = __CACHE_NAME__;\nconst PRECACHE = __PRECACHE__;', { cacheName: 'zdxy-1', urls: ["a$'b.js"] });
    expect(sw).toContain(`"a$'b.js"`);
    expect(() => renderServiceWorker('const PRECACHE = __PRECACHE__;', { cacheName: 'zdxy-1', urls: [] })).toThrow(/__CACHE_NAME__/);
  });
});
