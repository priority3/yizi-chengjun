// Compliance (v0.9): the game's text must not use religious terms or violent wording. The words that replaced them
// live in src/config/terms.ts. This test reads every .ts file under src/ line by line, comments included:
// 1. none of the banned words below may appear anywhere;
// 2. the strengthening card's old glyph may only stay as the card's internal id (saves and snapshots store it):
//    the quoted literal, and the unquoted key of its entry in config/units.ts. Text says 金, 鎏金 or 金X instead.
// The banned words are written as \u escapes, so this file passes the same check and `git grep` over tests/ finds
// nothing either; the note beside each one says what it is.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Banned words (as escapes) and the config/terms.ts word to use instead. */
const BANNED: ReadonlyArray<readonly [word: string, use: string]> = [
  ['\u529f\u5fb7', 'CURRENCY 铜钱'], // gongde, "merit": the currency
  ['\u5510\u50e7', 'MASTER 师父'], // Tang Seng: whom the camp shelters
  ['\u89c2\u97f3', 'ENC_RENEWAL 枯木逢春'], // Guanyin: the encounter that heals the camp
  ['\u8d22\u795e', 'ENC_FORTUNE 招财进宝'], // caishen, the god of wealth: the encounter that pays
  ['\u571f\u5730\u516c', 'ENC_PEDDLER 货郎摆摊'], // tudigong, the earth god: the half-price shop
  ['\u5929\u964d\u795e\u5b57', 'ENC_GOLD_DROP 天降金字'], // the encounter that drops the strengthening card
  ['\u96f7\u97f3\u5bfa', 'LAST_CHAPTER_NAME 雷音谷'], // the Leiyin temple: chapter 10
  ['\u771f\u7ecf', 'FINAL_WIN 大功告成！'], // the scriptures: the last chapter's win title
  ['\u52ab\u96be', 'TRIAL 考验'], // jienan, "tribulation": the encounter category of harder waves
  ['\u51fb\u6740', 'DEFEAT 击败'], // jisha, "kill": result panels and the share text
  ['\u65a9\u6740', 'SUBDUE 收服'], // zhansha, "execute": 沙僧 and the 法宝 that helps him
  ['\u65a9', 'SUBDUE 收服 / 连击'], // zhan, "behead": 沙僧's ultimate and the mark it leaves
  ['\u6740', 'DEFEAT 击败'], // sha, "kill": in any word
];

/** The strengthening card's old glyph (shen, "god"), allowed only as the card's internal id. */
const OLD_GLYPH = '\u795e';
/** The id as a quoted literal, allowed anywhere: `t.id === …`, the UnitId union, SHOP_WEIGHTS. */
const ID_LITERAL = `'${OLD_GLYPH}'`;
/** The file holding the card table, where the id is also the unquoted key of the card's entry. */
const UNITS_FILE = 'config/units.ts';
const UNITS_KEY = new RegExp(`^\\s*${OLD_GLYPH}:`);

/** What is wrong with one line of `file` (a path under src/): one message per broken rule, [] when it is fine. */
function lineIssues(file: string, line: string): string[] {
  const issues = BANNED.filter(([word]) => line.includes(word)).map(([word, use]) => `${word} -> ${use}`);
  // Reason: strip the allowed spots first, so whatever is left of the glyph is text that players (or readers) see.
  let rest = line.replaceAll(ID_LITERAL, '');
  if (file === UNITS_FILE) rest = rest.replace(UNITS_KEY, '');
  if (rest.includes(OLD_GLYPH)) issues.push(`${OLD_GLYPH} outside the card id -> GOLD_GLYPH 金, GILDING 鎏金 or gilded() 金X`);
  return issues;
}

/** Every .ts file under src/, as a path relative to it with forward slashes. */
function sourceFiles(): string[] {
  const names = readdirSync(new URL('../src/', import.meta.url), { recursive: true, encoding: 'utf8' });
  return names.map((p) => p.replaceAll('\\', '/')).filter((p) => p.endsWith('.ts')).sort();
}

describe('compliance wording', () => {
  it('scans the whole source tree', () => {
    const files = sourceFiles();
    // Reason: a scan that found no files would pass without checking anything.
    expect(files.length).toBeGreaterThan(100);
    expect(files).toContain(UNITS_FILE);
    expect(files).toContain('config/terms.ts');
  });

  it('flags a banned word, and the old glyph anywhere but the card id', () => {
    // The rules on made-up lines, so a broken check can't make the real scan below pass.
    for (const [word] of BANNED) expect(lineIssues('ui/x.ts', `toast('${word}')`), word).not.toEqual([]);
    expect(lineIssues('core/x.ts', `if (t.id === ${ID_LITERAL}) return;`)).toEqual([]);
    expect(lineIssues(UNITS_FILE, `  ${OLD_GLYPH}: { id: ${ID_LITERAL}, glyph: GOLD_GLYPH,`)).toEqual([]);
    expect(lineIssues('render/x.ts', `  ${OLD_GLYPH}: sun,`)).toHaveLength(1);
    expect(lineIssues('ui/x.ts', `// the ${OLD_GLYPH} seal`)).toHaveLength(1);
    expect(lineIssues('ui/x.ts', `text(ctx, "${OLD_GLYPH}")`)).toHaveLength(1);
  });

  it('finds none of it in src/, comments included', () => {
    const issues: string[] = [];
    for (const file of sourceFiles()) {
      const lines = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8').split('\n');
      lines.forEach((line, i) => {
        for (const issue of lineIssues(file, line)) issues.push(`src/${file}:${i + 1}: ${issue}`);
      });
    }
    expect(issues).toEqual([]);
  });
});
