/// <reference types="vitest/config" />
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import { serviceWorker } from './build/sw-plugin.ts';
import { GAME_NAME, GAME_NAME_EN } from './src/config/brand.ts';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

/** Short commit hash for the on-screen version label: Vercel exposes it as an env var; locally ask git; else "dev". */
function commitHash(): string {
  const fromEnv = process.env.VERCEL_GIT_COMMIT_SHA;
  if (fromEnv) return fromEnv.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'dev';
  }
}

/**
 * The English page of the portal build: English language tag and title, and no web-app manifest, since a portal runs
 * the game in its own page where it can't be installed.
 */
function englishPage(): Plugin {
  return {
    name: 'yzcj:english-page',
    transformIndexHtml: (html) =>
      html
        .replace('<html lang="zh-CN">', '<html lang="en">')
        .replace(`<title>${GAME_NAME}</title>`, `<title>${GAME_NAME_EN}</title>`)
        .replace(`name="apple-mobile-web-app-title" content="${GAME_NAME}"`, `name="apple-mobile-web-app-title" content="${GAME_NAME_EN}"`)
        .replace(/\n\s*<link rel="manifest"[^>]*>/, ''),
  };
}

// `pnpm build` makes the web version (dist/): Chinese or English by the player's browser, with offline play.
// `pnpm build:en` (mode "en") makes the package for overseas game portals (dist-en/): always English, without the
// launch splash, offline play, updates or the map editor (main.ts reads __BUILD_LANG__).
export default defineConfig(({ mode }) => ({
  // Reason: relative asset URLs so the built game works when hosted under any sub-path.
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_BUILD__: JSON.stringify(commitHash()),
    __BUILD_LANG__: JSON.stringify(mode === 'en' ? 'en' : ''),
  },
  build: { outDir: mode === 'en' ? 'dist-en' : 'dist' },
  // Writes dist/sw.js (offline play, update prompt); see build/sw-plugin.ts.
  plugins: mode === 'en' ? [englishPage()] : [serviceWorker(pkg.version)],
  test: {
    // Reason: parallel agents work in git worktrees under .claude/worktrees; never pick up their copies of the tests.
    exclude: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/dist-en/**', '.claude/**'],
    // Installs the web platform (src/platform/env.ts) before each test file, as main.ts does in the browser.
    setupFiles: ['./tests/setup.ts'],
  },
}));
