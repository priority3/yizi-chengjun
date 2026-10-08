/// <reference types="vitest/config" />
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

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

export default defineConfig({
  // Reason: relative asset URLs so the built game works when hosted under any sub-path.
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_BUILD__: JSON.stringify(commitHash()),
  },
  test: {
    // Reason: parallel agents work in git worktrees under .claude/worktrees; never pick up their copies of the tests.
    exclude: ['**/node_modules/**', '**/.git/**', '**/dist/**', '.claude/**'],
  },
});
