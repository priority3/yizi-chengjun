// plan.md's wording rules for new player-facing text (v0.9 合规版), shared by the tests of the legal texts and screens.

/** Religious terms and violent wording that must not appear (神 and 杀 on their own too). */
export const FORBIDDEN_WORDS: readonly string[] = ['功德', '唐僧', '观音', '财神', '土地公', '神', '佛', '菩萨', '寺', '庙', '真经', '劫难', '击杀', '斩杀', '杀'];

/** The forbidden words found in `text` (none, for text that keeps the rules). */
export function forbiddenIn(text: string): string[] {
  return FORBIDDEN_WORDS.filter((w) => text.includes(w));
}
