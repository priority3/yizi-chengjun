// Line breaking for long Chinese text (the 关于 screen's legal texts). Lines break between any two CJK characters or
// at a space; Latin words, numbers and addresses stay whole (12+, SDK, 1832052104@qq.com); and the basic Chinese
// line-breaking rules hold wherever the text allows: closing punctuation never starts a line and opening punctuation
// never ends one (the neighbouring character moves to the next line with it). Pure: the caller measures the text,
// so tests/text-wrap.test.ts runs it without a canvas.

/** Width of `s` in the font being wrapped, e.g. (s) => ctx.measureText(s).width after setting ctx.font. */
export type Measure = (s: string) => number;

/** Marks that may not start a line: closing brackets and quotes, clause and sentence punctuation, dashes, ellipses. */
const NO_START = new Set(Array.from('，。、；：？！）」』】》〉”’…—～％,.;:?!)]}%'));
/** Marks that may not end a line: opening brackets and quotes. */
const NO_END = new Set(Array.from('（「『【《〈“‘([{'));
/** Characters that join into one unbreakable word: Latin letters, digits and what sits inside numbers and addresses. */
const WORD = /^[A-Za-z0-9@._\-+/:#&=?%~]$/;
const SPACE = /^\s$/;

/**
 * The text cut into the pieces a line may break between: one CJK character, a whole word, or a space (' ').
 * Reason: a closing mark is glued to the piece before it and an opening mark to the piece after it, so no break can
 * separate either from its neighbour.
 */
function pieces(text: string): string[] {
  const out: string[] = [];
  const chars = Array.from(text);
  let i = 0;
  while (i < chars.length) {
    if (SPACE.test(chars[i])) {
      while (i < chars.length && SPACE.test(chars[i])) i++;
      out.push(' ');
      continue;
    }
    let piece = chars[i++];
    if (WORD.test(piece)) while (i < chars.length && WORD.test(chars[i])) piece += chars[i++];
    const last = out[out.length - 1];
    if (last !== undefined && last !== ' ' && (NO_START.has(piece[0]) || NO_END.has(last[last.length - 1]))) {
      out[out.length - 1] = last + piece;
    } else {
      out.push(piece);
    }
  }
  return out;
}

/** The longest start of `s` (at least one character) that fits in `maxWidth`, and the rest. */
function cut(s: string, maxWidth: number, measure: Measure): [string, string] {
  const chars = Array.from(s);
  let n = 1;
  while (n < chars.length && measure(chars.slice(0, n + 1).join('')) <= maxWidth) n++;
  return [chars.slice(0, n).join(''), chars.slice(n).join('')];
}

/** One paragraph (no '\n') as lines, filled greedily. */
function wrapParagraph(text: string, maxWidth: number, measure: Measure): string[] {
  const lines: string[] = [];
  let line = '';
  /** A space waits between `line` and the next piece; it disappears if a line break falls there instead. */
  let space = false;
  for (const piece of pieces(text)) {
    if (piece === ' ') {
      space = line !== '';
      continue;
    }
    const joined = space ? `${line} ${piece}` : line + piece;
    space = false;
    if (line !== '' && measure(joined) <= maxWidth) {
      line = joined;
      continue;
    }
    if (line !== '') lines.push(line);
    line = piece;
    // A piece wider than a whole line by itself (a long address on a narrow panel) is cut between characters.
    while (Array.from(line).length > 1 && measure(line) > maxWidth) {
      const [head, rest] = cut(line, maxWidth, measure);
      lines.push(head);
      line = rest;
    }
  }
  lines.push(line);
  return lines;
}

/** Splits `text` into lines no wider than `maxWidth` (as `measure` sees them); a '\n' always starts a new line. */
export function wrapText(text: string, maxWidth: number, measure: Measure): string[] {
  return text.split('\n').flatMap((para) => wrapParagraph(para, maxWidth, measure));
}
