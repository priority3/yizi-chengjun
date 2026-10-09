// plan.md's wording rules for new player-facing text (v0.9 合规版), shared by the tests of the legal texts and screens.

/**
 * Religious terms and violent wording that must not appear, including the single characters for "god" and "kill".
 * Written as \u escapes (like tests/compliance.test.ts), so the banned words never appear verbatim in the repository,
 * not even in the source printout of the 软著 materials.
 */
export const FORBIDDEN_WORDS: readonly string[] = [
  '\u529f\u5fb7', // gongde, "merit"
  '\u5510\u50e7', // Tang Seng
  '\u89c2\u97f3', // Guanyin
  '\u8d22\u795e', // caishen, the god of wealth
  '\u571f\u5730\u516c', // tudigong, the earth god
  '\u795e', // shen, "god"
  '\u4f5b', // fo, "Buddha"
  '\u83e9\u8428', // pusa, "bodhisattva"
  '\u5bfa', // si, "temple"
  '\u5e99', // miao, "shrine"
  '\u771f\u7ecf', // zhenjing, "the scriptures"
  '\u52ab\u96be', // jienan, "tribulation"
  '\u51fb\u6740', // jisha, "kill"
  '\u65a9\u6740', // zhansha, "execute"
  '\u6740', // sha, "kill"
];

/** The forbidden words found in `text` (none, for text that keeps the rules). */
export function forbiddenIn(text: string): string[] {
  return FORBIDDEN_WORDS.filter((w) => text.includes(w));
}
