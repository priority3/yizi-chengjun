// The 战报 players share: a 1080 x 1920 portrait card in the game's parchment-and-ink style, painted on demand when
// 分享战报 is tapped (never per frame). Top to bottom: the brush title with a red seal, the chapter (or another
// mode's title) over its map, the outcome with its stars, the run's numbers, the 法宝 it was played with, and the
// address, date and version of the game. The paper, frame and seal art live in share-art.ts.
import { CHAPTERS } from '../config/chapters.ts';
import { MAPS, type MapDef } from '../config/maps.ts';
import { TREASURES, type TreasureId } from '../config/treasures.ts';
import { buildMap, type MapData } from '../core/map.ts';
import { MAX_STARS } from '../core/rating.ts';
import { fitPx, roundRect, text } from './draw.ts';
import { brush, sans } from './fonts.ts';
import { drawPortrait, type PortraitId } from './heroes-art.ts';
import type { Rect } from './layout.ts';
import { paintMap } from './map-art.ts';
import { drawRatingStar } from './rating-art.ts';
import { THEMES } from './scenery.ts';
import { drawSeal, inkRule, paintFrame, paintPaper } from './share-art.ts';
import { drawTreasureToken } from './treasure-art.ts';

/** Size of the card in pixels: a phone-screen portrait, shown full screen by most chat apps. */
export const CARD_W = 1080;
export const CARD_H = 1920;

/** The kind of run a card reports: a chapter, or the endless and daily modes. */
export type ShareMode = 'chapter' | 'endless' | 'daily';

/** One 法宝 the run was played with, at the tier that applied. */
export interface ShareToken {
  id: TreasureId;
  tier: number;
}

/**
 * Everything the card shows, as a plain object built by the scene (see ui/share-result.ts). Chapter runs fill every
 * chapter field; endless and daily runs leave out `chapter`, `totalWaves` and `stars` and bring their own title.
 */
export interface ShareInfo {
  mode: ShareMode;
  /** The big line under the game's name, e.g. 第八章 · 火焰山 (brush). */
  title: string;
  /** The small line under it, e.g. 打败了牛魔王. */
  subtitle: string;
  /** 1-based chapter of a chapter run. */
  chapter?: number;
  /** Which of the ten maps (1-based, numbered like the chapters) to show when it isn't `chapter`'s (daily runs). */
  map?: number;
  /** The run was won (chapters only: endless and daily runs always end when the camp falls). */
  won: boolean;
  /** Waves cleared. */
  waves: number;
  /** Waves in the run; absent when there is no last wave (endless, daily). */
  totalWaves?: number;
  /** Camp HP left (a whole number, 0 when it fell) and its maximum. */
  campHp: number;
  campMax: number;
  kills: number;
  /** Star rating of a won chapter, 1..3; absent when the result has none. */
  stars?: number;
  /** The equipped 法宝, at most three. */
  treasures: ShareToken[];
  /** The local date of the run, e.g. 2026年10月8日. */
  dateText: string;
}

/** Where the blocks sit, top to bottom (card pixels); `inner` is the inset of the frame's inner line. */
export const CARD_LAYOUT = {
  inner: 44,
  titleY: 176,
  taglineY: 290,
  ruleY: 340,
  chapterY: 410,
  subtitleY: 474,
  map: { x: 300, y: 520, w: 480, h: 640 },
  /** The outcome line, raised when stars go under it. */
  headlineY: 1240,
  headlineAloneY: 1306,
  starsY: 1372,
  stats: { x: 120, y: 1448, w: 840, h: 160 },
  tokensY: 1672,
  hostY: 1800,
  footY: 1842,
} as const;

/** Pixel sizes of the brush title and of the outcome line. */
export const TITLE_PX = 150;
export const HEADLINE_PX = 112;
/** The seal beside the title, and the gap between them. */
export const SEAL_W = 104;
export const SEAL_H = 176;
const SEAL_GAP = 30;
/** Rating stars: side and middle radius (the middle one sits higher, like on the result panel) and spacing. */
export const STAR_R = 48;
export const STAR_MID_R = 58;
export const STAR_RISE = 14;
const STAR_GAP = 136;
/** 法宝 tokens: radius and distance between centres. */
export const TOKEN_R = 46;
export const TOKEN_GAP = 230;
/** Widest a centred line may get: the frame's inside less a margin. */
const LINE_W = 900;

const INK = '#2a1a10';
const INK_SOFT = '#3b2a1e';
const BROWN = '#7a6248';
const RED = '#b3261e';

/** The outcome line: 章节通关！ (取得真经！ for the last chapter) / 阵地失守, or 撑过第 N 波 for runs without a last wave. */
export function shareHeadline(info: ShareInfo): string {
  if (info.mode === 'chapter') {
    if (!info.won) return '阵地失守';
    return info.chapter === CHAPTERS.length ? '取得真经！' : '章节通关！';
  }
  return info.waves > 0 ? `撑过第 ${info.waves} 波` : '阵地失守';
}

/** One cell of the numbers box: a label and its value. */
export interface ShareStat {
  label: string;
  value: string;
}

/** The numbers box: waves cleared (out of the total when there is one), camp HP left, kills. */
export function shareStats(info: ShareInfo): ShareStat[] {
  return [
    { label: '守住波数', value: info.totalWaves === undefined ? String(info.waves) : `${info.waves}/${info.totalWaves}` },
    { label: '剩余阵地', value: `${info.campHp}/${info.campMax}` },
    { label: '击杀妖怪', value: String(info.kills) },
  ];
}

/** Centres the brush title and the seal beside it as one group; returns the x of each one's centre. */
export function headerLayout(titleW: number): { titleX: number; sealX: number } {
  const x0 = (CARD_W - (titleW + SEAL_GAP + SEAL_W)) / 2;
  return { titleX: x0 + titleW / 2, sealX: x0 + titleW + SEAL_GAP + SEAL_W / 2 };
}

/** x of each 法宝 token's centre: a row of `n` centred on the card. */
export function tokenXs(n: number): number[] {
  return Array.from({ length: n }, (_, i) => CARD_W / 2 + (i - (n - 1) / 2) * TOKEN_GAP);
}

/** The map a card shows (a built map, or null when the info names none). */
function mapOf(info: ShareInfo): MapData | null {
  const n = info.map ?? info.chapter;
  const def = n === undefined ? undefined : (MAPS[n - 1] as MapDef | undefined);
  return def ? buildMap(def) : null;
}

/** The address players can open the game at, '' where there is none (a file opened from disk, tests). */
function siteHost(): string {
  return typeof location === 'undefined' ? '' : location.host;
}

/**
 * Paints the whole card onto `ctx`, whose transform maps card pixels (CARD_W x CARD_H) onto the target. `host` is the
 * address printed at the bottom (this page's by default; nothing is printed when it is '').
 */
export function paintShareCard(ctx: CanvasRenderingContext2D, info: ShareInfo, host = siteHost()): void {
  ctx.save();
  paintPaper(ctx, CARD_W, CARD_H);
  paintFrame(ctx, CARD_W, CARD_H, CARD_LAYOUT.inner);
  drawHeader(ctx);
  drawChapter(ctx, info);
  drawMapPanel(ctx, mapOf(info), CARD_LAYOUT.map);
  drawOutcome(ctx, info);
  drawStats(ctx, info);
  drawTokens(ctx, info.treasures);
  drawFooter(ctx, info.dateText, host);
  ctx.restore();
}

/** A new CARD_W x CARD_H canvas with the card painted on it. */
export function renderShareCard(info: ShareInfo): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not supported in this browser');
  paintShareCard(ctx, info);
  return canvas;
}

/** 一字成军 in big brush strokes with the red 战报 seal beside it, the tagline, and an ink rule. */
function drawHeader(ctx: CanvasRenderingContext2D): void {
  const title = '一字成军';
  ctx.font = brush(TITLE_PX);
  const { titleX, sealX } = headerLayout(ctx.measureText(title).width);
  ctx.save();
  ctx.shadowColor = 'rgba(60,30,10,0.3)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 5;
  text(ctx, title, titleX, CARD_LAYOUT.titleY, brush(TITLE_PX), INK);
  ctx.restore();
  drawSeal(ctx, sealX, CARD_LAYOUT.titleY - 4, SEAL_W, SEAL_H, ['战', '报'], -0.07);
  text(ctx, '汉字合成塔防', CARD_W / 2, CARD_LAYOUT.taglineY, brush(44), '#8a6a44');
  inkRule(ctx, CARD_W / 2, CARD_LAYOUT.ruleY, 330);
}

/** The run's title (chapter number and name) and subtitle, each shrunk to fit if long. */
function drawChapter(ctx: CanvasRenderingContext2D, info: ShareInfo): void {
  text(ctx, info.title, CARD_W / 2, CARD_LAYOUT.chapterY, brush(fitPx(ctx, info.title, LINE_W, 80, brush, 40)), INK_SOFT);
  const sub = (n: number) => sans(n, 600);
  text(ctx, info.subtitle, CARD_W / 2, CARD_LAYOUT.subtitleY, sub(fitPx(ctx, info.subtitle, LINE_W, 34, sub, 20)), BROWN);
}

/**
 * The map, letterboxed on its ground colour inside a mounted frame; the four heroes stand in when there is no map.
 * Reason: painted straight onto the card with paintMap rather than through mapThumb, whose one-per-chapter cache
 * would swap out the chapter screen's small thumbnail (it would fade in again there); at this size the map's own
 * gates and camp read without the thumbnail's markers.
 */
function drawMapPanel(ctx: CanvasRenderingContext2D, map: MapData | null, r: Rect): void {
  const radius = 18;
  ctx.save();
  roundRect(ctx, r.x - 4, r.y + 6, r.w + 8, r.h + 10, radius + 4);
  ctx.fillStyle = 'rgba(70,40,12,0.24)';
  ctx.fill();
  roundRect(ctx, r.x, r.y, r.w, r.h, radius);
  ctx.clip();
  if (map) {
    const pal = THEMES[map.theme];
    const ground = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
    ground.addColorStop(0, pal.ground[0]);
    ground.addColorStop(1, pal.ground[1]);
    ctx.fillStyle = ground;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    const s = Math.min(r.w / map.w, r.h / map.h);
    ctx.translate(r.x + (r.w - map.w * s) / 2, r.y + (r.h - map.h * s) / 2);
    ctx.scale(s, s);
    paintMap(ctx, map);
  } else {
    drawHeroes(ctx, r);
  }
  ctx.restore();
  roundRect(ctx, r.x, r.y, r.w, r.h, radius);
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#6e4a1e';
  ctx.stroke();
  roundRect(ctx, r.x + 9, r.y + 9, r.w - 18, r.h - 18, radius - 7);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,244,220,0.6)';
  ctx.stroke();
}

/** Stand-in picture without a map: the four heroes on warm paper. */
function drawHeroes(ctx: CanvasRenderingContext2D, r: Rect): void {
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, '#efdcb4');
  g.addColorStop(1, '#d9bf8c');
  ctx.fillStyle = g;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  const heroes: PortraitId[] = ['悟空', '八戒', '沙僧', '白龙'];
  heroes.forEach((h, i) => {
    const x = r.x + r.w * (i % 2 === 0 ? 0.3 : 0.7);
    const y = r.y + r.h * (i < 2 ? 0.32 : 0.68);
    drawPortrait(ctx, h, x, y, r.w * 0.17);
  });
}

/** The outcome in big brush strokes, with the result panel's three stars under it when the result has stars. */
function drawOutcome(ctx: CanvasRenderingContext2D, info: ShareInfo): void {
  const stars = info.stars;
  const head = shareHeadline(info);
  const color = info.won ? RED : info.mode === 'chapter' ? '#4a3a2e' : '#8a3a22';
  const y = stars === undefined ? CARD_LAYOUT.headlineAloneY : CARD_LAYOUT.headlineY;
  ctx.save();
  ctx.shadowColor = 'rgba(60,30,10,0.22)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 4;
  text(ctx, head, CARD_W / 2, y, brush(fitPx(ctx, head, LINE_W, HEADLINE_PX, brush, 48)), color);
  ctx.restore();
  if (stars === undefined) return;
  for (let i = 0; i < MAX_STARS; i++) {
    const mid = i === 1;
    const x = CARD_W / 2 + (i - 1) * STAR_GAP;
    drawRatingStar(ctx, x, mid ? CARD_LAYOUT.starsY - STAR_RISE : CARD_LAYOUT.starsY, mid ? STAR_MID_R : STAR_R, i < stars);
  }
}

/** The numbers box: three cells, a label over each value, thin rules between them. */
function drawStats(ctx: CanvasRenderingContext2D, info: ShareInfo): void {
  const r = CARD_LAYOUT.stats;
  roundRect(ctx, r.x, r.y, r.w, r.h, 22);
  ctx.fillStyle = 'rgba(255,250,236,0.62)';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(184,134,44,0.85)';
  ctx.stroke();
  const cells = shareStats(info);
  const cw = r.w / cells.length;
  const value = (n: number) => sans(n, 800);
  cells.forEach((c, i) => {
    const cx = r.x + cw * (i + 0.5);
    if (i > 0) {
      ctx.beginPath();
      ctx.moveTo(r.x + cw * i, r.y + 30);
      ctx.lineTo(r.x + cw * i, r.y + r.h - 30);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(160,110,40,0.4)';
      ctx.stroke();
    }
    text(ctx, c.label, cx, r.y + 44, sans(30, 600), '#8a6a44');
    text(ctx, c.value, cx, r.y + 110, value(fitPx(ctx, c.value, cw - 36, 64, value, 28)), INK_SOFT);
  });
}

/** The equipped 法宝 as the game's tokens with their names under them, or a quiet note when there were none. */
function drawTokens(ctx: CanvasRenderingContext2D, list: readonly ShareToken[]): void {
  const y = CARD_LAYOUT.tokensY;
  if (list.length === 0) {
    text(ctx, '这一局没带法宝', CARD_W / 2, y + 16, sans(30, 600), '#9a7a52');
    return;
  }
  const xs = tokenXs(list.length);
  list.forEach((t, i) => {
    drawTreasureToken(ctx, t.id, t.tier, xs[i], y, TOKEN_R);
    text(ctx, TREASURES[t.id].id, xs[i], y + TOKEN_R + 28, sans(26, 700), '#6a4a26');
  });
}

/** Where to play (the address this copy runs at), then the date and the version. */
function drawFooter(ctx: CanvasRenderingContext2D, dateText: string, host: string): void {
  if (host) {
    const line = `在线玩：${host}`;
    const bold = (n: number) => sans(n, 700);
    text(ctx, line, CARD_W / 2, CARD_LAYOUT.hostY, bold(fitPx(ctx, line, LINE_W, 34, bold, 20)), '#8a3a22');
  }
  text(ctx, `${dateText} · v${__APP_VERSION__}`, CARD_W / 2, CARD_LAYOUT.footY, sans(26, 500), '#9a7a52');
}
