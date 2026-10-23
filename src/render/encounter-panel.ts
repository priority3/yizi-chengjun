// The 奇遇 modal: three event cards to pick from between waves.
import { TRIAL } from '../config/terms.ts';
import { encounterDesc, encounterName, ENCOUNTERS, kindLabel, type EncounterKind } from '../core/encounters.ts';
import type { EncounterId } from '../core/types.ts';
import { isEn, tr } from '../i18n/lang.ts';
import { fitLines, fitPx, roundRect, text } from './draw.ts';
import { brush, sans } from './fonts.ts';
import { L, W, type Rect } from './layout.ts';
import { drawPanel } from './widgets.ts';

const CARD_H = 72;
const CARD_GAP = 8;

const KIND_STYLE: Record<EncounterKind, { bg: string; edge: string; chip: string }> = {
  boon: { bg: '#edf7e6', edge: '#4f9d5b', chip: '#2f7d32' },
  trade: { bg: '#fff5d6', edge: '#c8962c', chip: '#a8740c' },
  challenge: { bg: '#fdebe4', edge: '#c8322a', chip: '#b3261e' },
};

export function encounterPanel(): Rect {
  return { x: 16, y: L.hud.h + 20, w: W - 32, h: 96 + 3 * CARD_H + 2 * CARD_GAP + 18 };
}

export function encounterCardRects(): Rect[] {
  const p = encounterPanel();
  return [0, 1, 2].map((i) => ({ x: p.x + 14, y: p.y + 88 + i * (CARD_H + CARD_GAP), w: p.w - 28, h: CARD_H }));
}

export function drawEncounterPanel(ctx: CanvasRenderingContext2D, options: readonly EncounterId[], pressed: string | null): void {
  const p = encounterPanel();
  drawPanel(ctx, p);
  text(ctx, tr('奇  遇', 'Encounter'), W / 2, p.y + 40, brush(30), '#8a3a22');
  const rule = tr(`三选一 · 福缘立刻生效，${TRIAL}下一波生效`, 'Pick one · Blessings work now, Trials on the next wave');
  text(ctx, rule, W / 2, p.y + 68, sans(fitPx(ctx, rule, p.w - 24, 11, (n) => sans(n, 600), 9), 600), '#7a6248');
  const rects = encounterCardRects();
  options.forEach((id, i) => {
    const def = ENCOUNTERS[id];
    const st = KIND_STYLE[def.kind];
    const r = rects[i];
    const dy = pressed === `enc:${i}` ? 2 : 0;
    roundRect(ctx, r.x, r.y + 3, r.w, r.h, 12);
    ctx.fillStyle = 'rgba(60,30,10,0.18)';
    ctx.fill();
    roundRect(ctx, r.x, r.y + dy, r.w, r.h, 12);
    ctx.fillStyle = st.bg;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = st.edge;
    ctx.stroke();
    // Reason: the English kinds (Blessing, Chance, Trial) need a wider chip than two Chinese characters.
    const chipW = tr(40, 58);
    roundRect(ctx, r.x + 10, r.y + dy + 12, chipW, 20, 6);
    ctx.fillStyle = st.chip;
    ctx.fill();
    const kind = kindLabel(def.kind);
    text(ctx, kind, r.x + 10 + chipW / 2, r.y + dy + 22.5, sans(fitPx(ctx, kind, chipW - 6, 10, (n) => sans(n, 800), 8), 800), '#fff8e8');
    const name = encounterName(id);
    const nameX = r.x + 18 + chipW;
    text(ctx, name, nameX, r.y + dy + 23, brush(fitPx(ctx, name, r.x + r.w - 10 - nameX, 21, brush, 14)), '#3b2a1e', 'left');
    drawDesc(ctx, encounterDesc(id), r, dy);
  });
}

/**
 * A card's description under its name: one line, shrunk to fit, in Chinese; up to two lines in English, whose
 * descriptions run about twice as long.
 */
function drawDesc(ctx: CanvasRenderingContext2D, desc: string, r: Rect, dy: number): void {
  const font = (n: number) => sans(n, 600);
  if (!isEn()) {
    text(ctx, desc, r.x + 11, r.y + dy + 52, font(fitPx(ctx, desc, r.w - 22, 11, font, 8)), '#5a4028', 'left');
    return;
  }
  const { px, lines } = fitLines(ctx, desc, r.w - 22, 11, font, 2, 8);
  const lineH = px + 3;
  lines.forEach((line, i) => text(ctx, line, r.x + 11, r.y + dy + 52 + (i - (lines.length - 1) / 2) * lineH, font(px), '#5a4028', 'left'));
}
