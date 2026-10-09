// The game's name and tagline in one place. Player-facing text reads them from here, so a rename only touches this
// file, plus the few places that can't import it: index.html, public/manifest.webmanifest and the 软著 config
// (scripts/copyright-config.mjs); tests/brand.test.ts checks the first two still match.

/** The game's name, as players, the platforms and the 软著 registration see it. */
export const GAME_NAME = '一字成军';
/** The line under the name on the title screen and the share card. */
export const TAGLINE = '汉字合成塔防';
/** Prefix of console messages, so the game's own warnings are easy to find. */
export const LOG_TAG = `[${GAME_NAME}]`;
