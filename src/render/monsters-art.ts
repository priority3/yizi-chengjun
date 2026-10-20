// The masked monsters (脸谱小鬼): every enemy is a little figure in opera make-up — two legs under a robe, armour or
// bones, a head in its face colour painted with its mask (monster-masks.ts), horns, ears or hair, and what it carries
// (monster-figure.ts). A figure is drawn in its own units (feet at the origin, facing right, a 小妖 about 31 units tall)
// and scaled by the monster's radius; each kind is painted once into a cached sprite, with a white silhouette copy for
// the hit flash.
import { ENEMIES } from '../config/enemies.ts';
import { CINNABAR, GILT, INK } from './ink.ts';
import { HEAD_Y, paintBack, paintBody, paintHead, type Back, type Body, type Head } from './monster-figure.ts';
import { paintGear, type Gear } from './monster-gear.ts';
import { paintMask, type MaskKind } from './monster-masks.ts';
import { sprites } from './sprites.ts';

interface Look {
  mask: MaskKind;
  /** The head disc under the mask. */
  face: string;
  /** Robe, armour, or the little spider's abdomen. */
  cloth: string;
  /** The belt across the robe (cinnabar, or gold on elites and bosses). */
  trim?: string;
  body: Body;
  head?: Head;
  /** What the front hand holds; a figure without gear (the little spider) has no arm at all. */
  gear?: Gear;
  back?: Back;
  /** Head radius in figure units: 7.4, or 8 for the elite and the bosses. */
  hr?: number;
  /** Head centre where it is not (0, HEAD_Y): the little spider's head rests on its abdomen. */
  hx?: number;
  hy?: number;
  /** Flyers and the little spider have no legs to stand on. */
  legless?: boolean;
  /** Extra scale on top of radius / 12, for a figure much squatter than the rest (the spider). */
  size?: number;
  /** How far the head art reaches above the feet, in figure units: the HP bar sits just over it. */
  top: number;
}

const LOOKS: Record<string, Look> = {
  妖: { mask: 'imp', face: '#86b07c', cloth: '#4a4f78', body: 'robe', head: 'nubs', gear: 'club', top: 34 },
  狼: { mask: 'wolf', face: '#9aa3b0', cloth: '#4f5560', body: 'robe', head: 'pointy', gear: 'claws', top: 35 },
  熊: { mask: 'bear', face: '#4a3426', cloth: '#6e4a2c', body: 'wide', head: 'round', gear: 'hand', top: 32 },
  蛛: { mask: 'spider', face: '#3a2c48', cloth: '#2c2338', body: 'none', back: 'spiderLegs', hr: 6, hx: 3.4, hy: -11, legless: true, size: 1.3, top: 17 },
  // The flyers: a bat spirit in a dark robe on leathery wings, and a yellow 鹏雏 with a crest and stubby golden wings.
  蝠: { mask: 'bat', face: '#6a4a8c', cloth: '#3d2a52', body: 'robe', head: 'bat', gear: 'hand', back: 'batWings', legless: true, top: 37 },
  鹏: { mask: 'chick', face: '#f0c24a', cloth: '#e0902a', body: 'robe', head: 'crest', gear: 'hand', back: 'birdWings', legless: true, top: 36 },
  魔: { mask: 'elite', face: '#c0392b', cloth: '#3a3a44', body: 'armor', head: 'bigHorns', gear: 'spear', hr: 8, top: 42 },
  盗: { mask: 'thief', face: '#c8b48a', cloth: '#2f4a3a', body: 'robe', head: 'band', gear: 'sack', top: 31 },
  // The bosses wear the opera's colours for spirits and demons: gold, silver-white or black faces.
  白骨精: { mask: 'skull', face: '#f4efe2', cloth: '#ece6d6', trim: '#9a8a7a', body: 'bones', head: 'hair', gear: 'boneStaff', hr: 8, top: 36 },
  黄风怪: { mask: 'wind', face: '#e2b13c', cloth: '#a8742a', body: 'robe', head: 'pointy', gear: 'trident', back: 'wind', hr: 8, top: 36 },
  金角大王: { mask: 'gold', face: '#e6b84a', cloth: '#3f6d3a', body: 'wide', head: 'goldHorns', gear: 'gourd', hr: 8, top: 42 },
  红孩儿: { mask: 'child', face: '#f2b68c', cloth: CINNABAR, body: 'bib', head: 'topknots', gear: 'fireSpear', hr: 8, top: 35 },
  黑熊精: { mask: 'blackBear', face: '#2c2420', cloth: '#3a3a44', body: 'armor', head: 'round', gear: 'spear', hr: 8, top: 33 },
  灵感大王: { mask: 'fish', face: '#3d8a8a', cloth: '#2b6585', body: 'robe', head: 'fins', gear: 'hammer', hr: 8, top: 31 },
  蜘蛛精: { mask: 'web', face: '#e9dcef', cloth: '#5c2a60', body: 'robe', head: 'hair', gear: 'hand', back: 'spiderLegs', hr: 8, top: 36 },
  牛魔王: { mask: 'bull', face: '#2c2420', cloth: '#4a2a1a', body: 'armor', head: 'bullHorns', gear: 'ironStaff', hr: 8, top: 39 },
  金翅大鹏: { mask: 'roc', face: '#e2b13c', cloth: '#c0392b', body: 'robe', head: 'bigCrest', gear: 'spear', back: 'goldWings', hr: 8, top: 42 },
  黄眉大王: { mask: 'brows', face: '#e8b98a', cloth: '#c8902a', body: 'robe', head: 'bald', gear: 'cymbal', hr: 8, top: 31 },
};

/** The sprite reaches this many figure units either side of the feet, above them and below them. */
const SPAN_X = 23;
const SPAN_UP = 46;
const SPAN_DOWN = 6;

function lookOf(def: string): Look {
  return LOOKS[def] ?? LOOKS['妖'];
}

/** Px per figure unit for `def`. */
function scaleOf(def: string): number {
  return (ENEMIES[def].radius / 12) * (lookOf(def).size ?? 1);
}

function paintFigure(ctx: CanvasRenderingContext2D, look: Look, grand: boolean): void {
  const hr = look.hr ?? 7.4;
  const hx = look.hx ?? 0;
  const hy = look.hy ?? HEAD_Y;
  const head = look.head ?? 'none';
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  paintBack(ctx, look.back ?? 'none', look.cloth);
  paintHead(ctx, head, look.face, hr, false);
  paintBody(ctx, look.body, look.cloth, look.trim ?? (grand ? GILT : CINNABAR), !look.legless);
  ctx.beginPath();
  ctx.arc(hx, hy, hr, 0, Math.PI * 2);
  ctx.fillStyle = look.face;
  ctx.fill();
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.save();
  ctx.translate(hx, hy);
  paintMask(ctx, look.mask, hr);
  ctx.restore();
  paintHead(ctx, head, look.face, hr, true);
  if (look.gear) paintGear(ctx, look.gear, look.cloth);
  ctx.restore();
}

export interface MonsterSprite {
  img: HTMLCanvasElement;
  flash: HTMLCanvasElement;
  w: number;
  h: number;
  /** Where the feet are inside the sprite. */
  ax: number;
  ay: number;
}

export function monsterSprite(def: string): MonsterSprite {
  const look = lookOf(def);
  const s = scaleOf(def);
  const d = ENEMIES[def];
  const w = Math.ceil(SPAN_X * 2 * s);
  const h = Math.ceil((SPAN_UP + SPAN_DOWN) * s);
  const ax = w / 2;
  const ay = SPAN_UP * s;
  const img = sprites.get(`mon:${def}`, w, h, (ctx) => {
    ctx.translate(ax, ay);
    ctx.scale(s, s);
    paintFigure(ctx, look, d.boss || d.elite);
  });
  // Reason: a white silhouette of the same sprite makes the hit flash follow the exact outline.
  const flash = sprites.get(`mon:${def}:flash`, w, h, (ctx) => {
    ctx.drawImage(img, 0, 0, w, h);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
  });
  return { img, flash, w, h, ax, ay };
}

/** How far above its feet `def`'s head art reaches, in px (the HP bar goes just over it). */
export function monsterTop(def: string): number {
  return lookOf(def).top * scaleOf(def);
}

/** Centre height of `def`'s head above its feet and the head's radius, in px (where the stun stars circle). */
export function monsterHead(def: string): { up: number; r: number } {
  const look = lookOf(def);
  const s = scaleOf(def);
  return { up: -(look.hy ?? HEAD_Y) * s, r: (look.hr ?? 7.4) * s };
}

/** `def`'s head and shoulders, `size` px square, for the boss line on the chapter cards. */
export function monsterPortrait(def: string, size: number): HTMLCanvasElement {
  const look = lookOf(def);
  // Reason: the frame takes the head plus the horns, ears or crest above it; the centre sits low to leave them room.
  const k = size / ((look.hr ?? 7.4) * 3.8);
  const d = ENEMIES[def];
  return sprites.get(`mon:${def}:portrait:${size}`, size, size, (ctx) => {
    ctx.translate(size / 2 - (look.hx ?? 0) * k, size * 0.6 - (look.hy ?? HEAD_Y) * k);
    ctx.scale(k, k);
    paintFigure(ctx, look, d.boss || d.elite);
  });
}
