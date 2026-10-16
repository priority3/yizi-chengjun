// The brush font is a subset built by scripts/subset-font.py from the characters the sources draw. A stale subset
// never breaks the layout — brush() falls back to the system sans face — so nothing else notices a character added
// without re-running `pnpm font`; it just renders one glyph in the wrong face on a real phone. This test runs the
// script's own --check, so that gap fails the build instead.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** The interpreter `pnpm font` uses; FONT_PYTHON overrides it when python3 is not the right one. */
function pythonWithFontTools(): string | null {
  const candidates = [process.env.FONT_PYTHON, 'python3', 'python'].filter((bin): bin is string => Boolean(bin));
  for (const bin of candidates) {
    try {
      execFileSync(bin, ['-c', 'import fontTools, brotli'], { cwd: ROOT, stdio: 'ignore' });
      return bin;
    } catch {
      // Not this one: try the next candidate.
    }
  }
  return null;
}

const python = pythonWithFontTools();

// Reason: skipping (not failing) keeps `pnpm test` usable on a machine that only runs the game — fontTools is a
// `pnpm font` dependency, not a test one.
(python ? describe : describe.skip)('brush font subset', () => {
  // Reason: the check loads the woff2 and walks every source file, and starting Python + fontTools alone costs
  // several seconds — well past the 5 s default.
  it('covers every character the sources draw in the brush font', { timeout: 60_000 }, () => {
    try {
      const out = execFileSync(python as string, ['scripts/subset-font.py', '--check'], { cwd: ROOT, encoding: 'utf8' });
      expect(out).toContain('OK:');
    } catch (error) {
      const e = error as { stdout?: string; stderr?: string; message?: string };
      throw new Error(`brush subset is missing characters:\n${e.stdout ?? ''}${e.stderr ?? ''}${e.message ?? ''}`.trim());
    }
  });
});
