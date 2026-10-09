// The name lives in src/config/brand.ts; the files that can't import it must say the same.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_NAME } from '../src/config/brand.ts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('the game name', () => {
  it('matches in index.html and the web app manifest', () => {
    const html = read('index.html');
    expect(html).toContain(`<title>${GAME_NAME}</title>`);
    expect(html).toContain(`name="apple-mobile-web-app-title" content="${GAME_NAME}"`);
    const manifest = JSON.parse(read('public/manifest.webmanifest')) as { name: string; short_name: string };
    expect([manifest.name, manifest.short_name]).toEqual([GAME_NAME, GAME_NAME]);
  });
});
