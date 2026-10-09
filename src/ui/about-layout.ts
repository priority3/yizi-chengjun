// Layout of the 关于 screen, in design units: the parchment panel the page scrolls in, and the page itself — a block of
// jump buttons, then 隐私政策, 用户协议, 适龄提示, 健康游戏忠告 and 版本与联系方式, every paragraph wrapped to the panel's
// width in the sans font. Pure: text is measured through a callback, so tests/about.test.ts checks it without a canvas.
import { AGE_NOTICE, CONTACT_EMAIL, DEVELOPER, HEALTH_ADVICE, PRIVACY_POLICY, USER_AGREEMENT, type LegalDoc } from '../config/legal.ts';
import { ageBadgeHeight } from '../render/age-badge.ts';
import { sans } from '../render/fonts.ts';
import { L, W, type Rect } from '../render/layout.ts';
import { wrapText } from '../render/text-wrap.ts';

/** The page's sections. */
export type AboutSectionId = 'privacy' | 'terms' | 'age' | 'advice' | 'contact';

/** The sections in page order, with the names their jump buttons show. */
export const ABOUT_SECTIONS: ReadonlyArray<{ id: AboutSectionId; name: string }> = [
  { id: 'privacy', name: '隐私政策' },
  { id: 'terms', name: '用户协议' },
  { id: 'age', name: '适龄提示' },
  { id: 'advice', name: '健康游戏忠告' },
  { id: 'contact', name: '版本与联系方式' },
];

/** The kinds of text on the page. */
export type AboutStyle = 'title' | 'meta' | 'heading' | 'body' | 'advice';

/** Font of each kind of text: sans throughout, readable at phone size and needing no brush glyphs. */
export const ABOUT_FONT: Readonly<Record<AboutStyle, string>> = {
  title: sans(17, 800),
  meta: sans(12, 500),
  heading: sans(14, 800),
  body: sans(14, 500),
  advice: sans(15, 600),
};

/** Font of the jump buttons' labels. */
export const JUMP_FONT = sans(13, 700);

/** Line height of each kind of text. Reason: about 1.6 times the size for body text, comfortable to read on a phone. */
export const LINE: Readonly<Record<AboutStyle, number>> = { title: 28, meta: 20, heading: 26, body: 23, advice: 28 };

/** Room above the page's first line and below its last. */
const PAGE_PAD = 14;
/** Space after a paragraph. */
const PARA_GAP = 6;
/** Space between two sections; a thin rule runs through its middle. */
const SECTION_GAP = 32;
/** The jump buttons: their height and the gap between them. */
const JUMP_H = 30;
const JUMP_GAP = 8;
/** Width of the 适龄提示 badge on the page. */
const BADGE_W = 56;

/** The parchment panel the page scrolls in, under the 返回 button and the screen's title. */
export function aboutPanel(): Rect {
  return { x: 10, y: 62, w: W - 20, h: L.H - 74 };
}

/** The part of the panel the page shows through: inside its double border. */
export function aboutView(): Rect {
  const p = aboutPanel();
  return { x: p.x + 8, y: p.y + 8, w: p.w - 16, h: p.h - 16 };
}

/** Left edge (screen x) of the page's text. */
export const TEXT_X = 30;
/** Width the page's text wraps to; the panel's right edge keeps room for the scroll bar. */
export const TEXT_W = W - 2 * TEXT_X;

/** One thing on the page. Every `y` counts from the page's top, which shows at the view's top when not scrolled. */
export type AboutItem =
  /** A line of text: `y` is its middle, `x` its left end (its centre when `center`). */
  | { kind: 'text'; style: AboutStyle; text: string; x: number; y: number; center: boolean }
  /** The 适龄提示 badge, its top-left corner at (x, y). */
  | { kind: 'badge'; x: number; y: number; w: number }
  /** A jump button: a tap glides the page to its section. */
  | { kind: 'jump'; id: AboutSectionId; label: string; rect: Rect }
  /** The thin rule between two sections. */
  | { kind: 'rule'; y: number };

export interface AboutPage {
  items: AboutItem[];
  /** The page's whole height. */
  height: number;
  /** Where each section starts (page y): scrolled there, its rule sits just above the view's top edge. */
  tops: Record<AboutSectionId, number>;
}

/** Width of `s` drawn in `font`. */
export type FontMeasure = (s: string, font: string) => number;

/** The top and bottom (page y) of an item, for drawing only what shows. */
export function itemSpan(item: AboutItem): [number, number] {
  switch (item.kind) {
    case 'text':
      return [item.y - LINE[item.style] / 2, item.y + LINE[item.style] / 2];
    case 'badge':
      return [item.y, item.y + ageBadgeHeight(item.w)];
    case 'jump':
      return [item.rect.y, item.rect.y + item.rect.h];
    case 'rule':
      return [item.y - 4, item.y + 4];
  }
}

/** Lays the page out from the top down. */
class PageBuilder {
  readonly items: AboutItem[] = [];
  readonly tops: Record<AboutSectionId, number> = { privacy: 0, terms: 0, age: 0, advice: 0, contact: 0 };
  /** Where the next thing goes (page y). */
  y = PAGE_PAD;
  private readonly measure: FontMeasure;

  constructor(measure: FontMeasure) {
    this.measure = measure;
  }

  /** `text` in `style`, wrapped to the text width, left-aligned or centred, then `gap` of space. */
  lines(text: string, style: AboutStyle, center = false, gap = PARA_GAP): void {
    const font = ABOUT_FONT[style];
    for (const line of wrapText(text, TEXT_W, (s) => this.measure(s, font))) {
      this.items.push({ kind: 'text', style, text: line, x: center ? W / 2 : TEXT_X, y: this.y + LINE[style] / 2, center });
      this.y += LINE[style];
    }
    this.y += gap;
  }

  /** The jump buttons: the three short names on one row, the two long ones on the next. */
  jumps(): void {
    for (const row of [ABOUT_SECTIONS.slice(0, 3), ABOUT_SECTIONS.slice(3)]) {
      const w = (TEXT_W - (row.length - 1) * JUMP_GAP) / row.length;
      row.forEach((s, k) => this.items.push({ kind: 'jump', id: s.id, label: s.name, rect: { x: TEXT_X + k * (w + JUMP_GAP), y: this.y, w, h: JUMP_H } }));
      this.y += JUMP_H + JUMP_GAP;
    }
    this.y -= JUMP_GAP;
  }

  /** Starts section `id`: the rule after what came before, then its centred title. */
  section(id: AboutSectionId, title: string): void {
    this.y += SECTION_GAP / 2;
    this.items.push({ kind: 'rule', y: this.y });
    this.tops[id] = this.y + 2;
    this.y += SECTION_GAP / 2;
    this.lines(title, 'title', true, 2);
  }

  /** A legal text: title and date centred, the opening paragraphs, then each numbered heading with its paragraphs. */
  doc(id: AboutSectionId, doc: LegalDoc): void {
    this.section(id, doc.title);
    this.lines(`生效日期：${doc.effective}`, 'meta', true, 10);
    for (const p of doc.intro) this.lines(p, 'body');
    for (const s of doc.sections) {
      this.y += 6;
      this.lines(s.heading, 'heading', false, 2);
      for (const p of s.paragraphs) this.lines(p, 'body');
    }
  }

  /** The 适龄提示 badge, centred on its own row. */
  badge(): void {
    this.items.push({ kind: 'badge', x: W / 2 - BADGE_W / 2, y: this.y + 4, w: BADGE_W });
    this.y += ageBadgeHeight(BADGE_W) + 16;
  }
}

/** The whole page, its text wrapped with `measure`; `version` is the version label (ui/version-label.ts). */
export function layoutAbout(measure: FontMeasure, version: string): AboutPage {
  const b = new PageBuilder(measure);
  b.jumps();
  b.doc('privacy', PRIVACY_POLICY);
  b.doc('terms', USER_AGREEMENT);
  b.section('age', '适龄提示');
  b.badge();
  for (const p of AGE_NOTICE) b.lines(p, 'body');
  b.section('advice', '健康游戏忠告');
  for (const line of HEALTH_ADVICE) b.lines(line, 'advice', true, 0);
  b.section('contact', '版本与联系方式');
  b.lines(`版本：${version}`, 'body');
  b.lines(`开发者：${DEVELOPER}`, 'body');
  b.lines(`联系邮箱：${CONTACT_EMAIL}`, 'body');
  b.lines('反馈问题时，请在邮件里附上上面的版本号。', 'meta');
  return { items: b.items, height: b.y + PAGE_PAD, tops: b.tops };
}
