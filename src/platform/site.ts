// The address the game was opened from, for the version labels of the menus (title and 关于 screens).
// Reason: screens reach the browser only through src/platform/ (plan.md), so a mini-game build can swap this file.

/** The page's host (e.g. zidou-xiyou.vercel.app, localhost:5173); '' where there is none (tests, a file opened from disk). */
export function siteHost(): string {
  return typeof location === 'undefined' ? '' : location.host;
}
