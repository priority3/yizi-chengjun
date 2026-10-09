// The title screen's layout (ui/title-layout.ts): the 关于 button stays on screen and clear of 开始游戏, 继续上次, the
// hint lines, the version label, the 有新版本 banner and the game's name at every design height (640..800), and the
// buttons that moved into title-layout.ts kept their places.
import { afterAll, describe, expect, it } from 'vitest';
import { L, MAX_H, MIN_H, setDesignHeight, W, type Rect } from '../src/render/layout.ts';
import { updateBannerHit, updateBannerRect } from '../src/render/update-banner.ts';
import { ABOUT_BUTTON, continueButton, hintRows, startButton, versionAnchor } from '../src/ui/title-layout.ts';

const overlap = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** A hint line (11 px text, centred, about 270 wide), taken wider and taller than it is. */
const hintBox = (y: number): Rect => ({ x: 20, y: y - 9, w: W - 40, h: 18 });
/** The version label (9 px, right-aligned): however long the host, it stays in this strip along the bottom. */
function versionBox(): Rect {
  const v = versionAnchor();
  return { x: 0, y: v.y - 8, w: v.x, h: 16 };
}
/** The game's name (66 px brush at 0.24 of the height, with its glow) and the tagline 54 below it (scenes.ts). */
const nameBox = (): Rect => ({ x: 0, y: L.H * 0.24 - 33 - 22, w: W, h: 33 + 22 + 54 + 14 });

afterAll(() => setDesignHeight(MIN_H));

describe('title screen layout', () => {
  it('keeps the 关于 button on screen and clear of everything else at every design height', () => {
    for (let h = MIN_H; h <= MAX_H; h++) {
      setDesignHeight(h);
      const a = ABOUT_BUTTON;
      expect(a.x >= 0 && a.y >= 0 && a.x + a.w <= W && a.y + a.h <= L.H, `H ${h}`).toBe(true);
      const [hint1, hint2] = hintRows();
      const others: Array<[string, Rect]> = [
        ['开始游戏', startButton(false)],
        ['开始游戏 under 继续上次', startButton(true)],
        ['继续上次', continueButton()],
        ['hint 1', hintBox(hint1)],
        ['hint 2', hintBox(hint2)],
        ['version label', versionBox()],
        ['update banner', updateBannerRect()],
        ['update banner tap area', updateBannerHit()],
        ['name and tagline', nameBox()],
      ];
      for (const [name, r] of others) expect(overlap(a, r), `H ${h}: ${name}`).toBe(false);
    }
  });

  it('is as easy to hit as the menus\' 返回 button', () => {
    expect(ABOUT_BUTTON.w).toBeGreaterThanOrEqual(60);
    expect(ABOUT_BUTTON.h).toBeGreaterThanOrEqual(34);
  });

  it('keeps 继续上次, 开始游戏, the hints and the version label where they were', () => {
    for (const h of [640, 720, 800]) {
      setDesignHeight(h);
      const mid = h * 0.66;
      expect(startButton(false)).toEqual({ x: 90, y: mid, w: 180, h: 56 });
      expect(startButton(true)).toEqual({ x: 90, y: mid + 14, w: 180, h: 44 });
      expect(continueButton()).toEqual({ x: 90, y: mid - 52, w: 180, h: 56 });
      expect(hintRows()).toEqual([mid + 82, mid + 100]);
      expect(versionAnchor()).toEqual({ x: W - 8, y: h - 9 });
      // The bottom-most of them ends above the update banner, which ends above the version label.
      expect(hintRows()[1] + 9).toBeLessThan(updateBannerHit().y);
    }
  });
});
