// Line breaking of long Chinese text (render/text-wrap.ts): every line fits the width and nothing is lost, words and
// addresses stay whole, closing punctuation never starts a line and opening punctuation never ends one — checked on
// hand-made cases and on every paragraph of the legal texts at many widths.
import { describe, expect, it } from 'vitest';
import { AGE_NOTICE, PRIVACY_POLICY, USER_AGREEMENT, type LegalDoc } from '../src/config/legal.ts';
import { wrapText, type Measure } from '../src/render/text-wrap.ts';

/** Like a 14 px CJK font: full-width characters (CJK and its punctuation) 14 px, everything else 7 px. */
const measure: Measure = (s) => Array.from(s).reduce((w, ch) => w + ((ch.codePointAt(0) ?? 0) >= 0x2e80 ? 14 : 7), 0);
/** Width of `n` CJK characters. */
const cjk = (n: number) => n * 14;
const squeeze = (s: string) => s.replace(/\s+/g, '');

const paragraphs = (d: LegalDoc) => [...d.intro, ...d.sections.flatMap((s) => [s.heading, ...s.paragraphs])];
const LEGAL = [...paragraphs(PRIVACY_POLICY), ...paragraphs(USER_AGREEMENT), ...AGE_NOTICE];
/** Marks that must not start a line, and marks that must not end one. */
const CLOSING = /^[，。、；：？！）」』】》…—,.;:?!)]/;
const OPENING = /[（「『【《“([]$/;

describe('wrapText', () => {
  it('fills each line up to the width', () => {
    expect(wrapText('一二三四五六七八九十', cjk(5), measure)).toEqual(['一二三四五', '六七八九十']);
    expect(wrapText('一二三四五六七八九十', cjk(4), measure)).toEqual(['一二三四', '五六七八', '九十']);
    expect(wrapText('一二三', cjk(5), measure)).toEqual(['一二三']);
  });

  it('moves a character down with closing punctuation instead of starting a line with it', () => {
    expect(wrapText('一二三四，五六', cjk(4), measure)).toEqual(['一二三', '四，五六']);
    expect(wrapText('一二三四。」五', cjk(5), measure)).toEqual(['一二三', '四。」五']);
  });

  it('moves opening punctuation down with the character after it instead of ending a line with it', () => {
    expect(wrapText('一二三「四五」', cjk(4), measure)).toEqual(['一二三', '「四五」']);
    expect(wrapText('一二三（12+）', cjk(4), measure)).toEqual(['一二三', '（12+）']);
  });

  it('keeps words, numbers and addresses whole, breaking at spaces between them', () => {
    // The address (119 px here) fits a line of its own, not the rest of the first one.
    expect(wrapText('联系邮箱：1832052104@qq.com', cjk(9), measure)).toEqual(['联系邮箱：', '1832052104@qq.com']);
    expect(wrapText('SIL Open Font License 1.1', 7 * 12, measure)).toEqual(['SIL Open', 'Font License', '1.1']);
    expect(wrapText('第三方 SDK，不使用', cjk(4), measure)).toEqual(['第三方', 'SDK，不', '使用']);
  });

  it('cuts a word wider than a whole line between its characters', () => {
    const url = 'https://zidou-xiyou.vercel.app';
    const lines = wrapText(url, 7 * 10, measure);
    expect(lines.join('')).toBe(url);
    for (const line of lines) expect(measure(line)).toBeLessThanOrEqual(7 * 10);
  });

  it('starts a new line at every line break, and gives one empty line for empty text', () => {
    expect(wrapText('一二\n三', cjk(5), measure)).toEqual(['一二', '三']);
    expect(wrapText('', cjk(5), measure)).toEqual(['']);
  });

  it('wraps every legal paragraph within the width, losing nothing and keeping the punctuation rules', () => {
    for (let width = 150; width <= 310; width += 4) {
      for (const p of LEGAL) {
        const lines = wrapText(p, width, measure);
        expect(squeeze(lines.join('')), p).toBe(squeeze(p));
        lines.forEach((line, i) => {
          expect(measure(line), line).toBeLessThanOrEqual(width);
          expect(line.length).toBeGreaterThan(0);
          if (i > 0) expect(CLOSING.test(line), `starts with a closing mark: ${line}`).toBe(false);
          if (i < lines.length - 1) expect(OPENING.test(line), `ends with an opening mark: ${line}`).toBe(false);
          expect(line).toBe(line.trim());
        });
      }
    }
  });

  it('fills lines tightly: the next piece would not have fitted on the line before', () => {
    const lines = wrapText(PRIVACY_POLICY.sections[1].paragraphs[1], cjk(21), measure);
    for (let i = 0; i + 1 < lines.length; i++) {
      // At most one full-width character plus a glued mark is left over at the end of a line.
      expect(measure(lines[i]), lines[i]).toBeGreaterThan(cjk(21) - cjk(3));
    }
  });
});
